/*JOINT_MODEL_START*//* ============================================================
 * Cost-of-Waiting 聯合排程模型 v2（機隊級 · 多約束）
 * 決策：每項任務 t 選一個選項 o = (窗口 w, 備件來源 m) 或「延後至下次定檢」
 * 目標：Σ 預期總成本（AOG 風險 + 燃油/碳 + 浪費壽命 + 人工 + 機庫 + 物流/短租 + MEL + 延長停場 − 合併節省）
 * 約束：見 CONSTRAINTS；精確分支定界（demo 規模等價於 MILP 最優解）
 * 所有運營數字為合成；RUL 來自 C-MAPSS 模型輸出（由頁面注入）
 * ============================================================ */
(function(root){
const USD=7.8;
function erf(x){const s=Math.sign(x);x=Math.abs(x);const t=1/(1+0.3275911*x);const y=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-0.284496736)*t+0.254829592)*t*Math.exp(-x*x);return s*y;}
const Phi=z=>0.5*(1+erf(z/Math.SQRT2));

/* ---------------- 參數（全部可在頁面調整；來源見 PARAM_META） ---------------- */
function defaultParams(){return {
  horizon:14, evalDays:60, deferDay:30, epsEcon:0.05, epsWarn:0.15,
  fuelPrice:5900,            // HK$/t（國泰 2025 年報推算）
  carbonPriceUSD:30,         // US$/t CO2（內部碳價）
  co2PerFuel:3.16,           // ICAO
  carbonCoverage:1.0,        // 適用碳價的覆蓋比例（內部影子碳價 = 100%）
  carbonIsCash:false,        // 碳成本是否為實際現金支出（合規）；否則只作決策影子價格
  recovery:{rate:0.40, disassyInspect:60000, repair:0, logistics:30000, txnPct:0.02}, // 拆下零件回收（示例值）
  riskCap:0.08,              // P_max
  aog:{hkgHours:24, outHours:72, rateUSD:40000, pHKG:0.55, engineRecoveryHK:1200000},
  labour:{HKG:{B1:610,B2:680}, BKK:{B1:900,B2:1000}, SIN:{B1:950,B2:1050}, otMult:1.5},
  hangarFee:{HKG:30000, BKK:0, SIN:60000},
  extensionPerHour:78000, maxExtension:6,
  mel:{dayCost:25000},
  otCapPct:0.25,
  dedicated:{hours:48, rateUSD:10000, slot:150000, days:[2,5,9]},
  stations:{
    HKG:{bays:2, B1:600, B2:150, stand:1, wash:2},
    BKK:{bays:0, B1:40,  B2:16,  stand:0, wash:0},
    SIN:{bays:1, B1:80,  B2:24,  stand:0, wash:0}
  },
  background:{HKG:{1:{bays:0,B1:260,B2:60},2:{bays:0,B1:280,B2:60},3:{bays:1,B1:300,B2:70},4:{bays:0,B1:260,B2:60},5:{bays:0,B1:270,B2:60},6:{bays:1,B1:290,B2:70},7:{bays:1,B1:300,B2:70},
                     8:{bays:0,B1:260,B2:60},9:{bays:0,B1:270,B2:60},10:{bays:0,B1:260,B2:60},11:{bays:0,B1:280,B2:60},12:{bays:0,B1:270,B2:60},13:{bays:0,B1:260,B2:60},14:{bays:0,B1:260,B2:60}}},
  pools:{
    'GE90-ENG':{label:'777 備用發動機（GE90-115B）', stock:{HKG:1}, arrivals:[{day:9,station:'HKG',qty:1,note:'返修完成'}],
                lease:{cost:2300000, lead:5}, transfer:null},
    'APU-SG':{label:'APU 起動發電機', stock:{SIN:1}, arrivals:[],
              lease:{cost:90000, lead:1}, transfer:{lead:2, cost:15000}}
  }
};}
const FUEL_777_DAY=7.0*11.3;   // t/天/架：巡航約 7 t/h × 日利用率 11.3 h
const PARAM_META=[
 ['fuelPrice','p_f','航油價格','HK$/t',5900,[5900,8960],'國泰 2025 年報燃油成本 ÷ 消耗量（約 HK$5,900/t）；IATA 2026 估 SAF US$2,872/t 為傳統航油 2.5 倍 ⇒ ≈US$1,149/t'],
 ['carbonPriceUSD','p_c','內部碳價','US$/t',30,[0,95],'CORSIA 一期價格預測（Sylvera）；上限取 EU ETS 2026 年 11 月約 €88/t'],
 ['co2PerFuel','e','CO₂ 排放係數','t CO₂/t',3.16,[3.16,3.16],'ICAO 碳排放計算器方法'],
 ['carbonCoverage','κ_c','碳價覆蓋比例','',1.0,[0,1],'內部影子碳價取 100%；合規成本按實際受管制排放比例（情景）'],
 ['recovery.rate','ρ','拆下零件可回收比例','',0.40,[0,1],'示例值：綠色時間轉租／作備發使用可回收的剩餘價值比例'],
 ['recovery.disassyInspect','c_insp','回收：拆卸與檢測','HK$',60000,[30000,150000],'示例值：孔探 + 記錄審查'],
 ['recovery.logistics','c_lg','回收：物流','HK$',30000,[10000,80000],'示例值'],
 ['recovery.txnPct','τ_x','回收：交易成本','',0.02,[0,0.05],'示例值：經紀 / 文件費佔回收價值比例'],
 ['aog.rateUSD','c_AOG','AOG 每小時成本','US$/h',40000,[10000,150000],'Boeing 估算 US$10k–150k/h（取決於機型與航線）'],
 ['aog.hkgHours','h_HKG','AOG 時長（HKG，件在站）','h',24,[12,48],'GE90 換發 48 h / 450 工時（Austrian Technik）；最快紀錄 2 h 13 min（GE）'],
 ['aog.outHours','h_out','AOG 時長（外站）','h',72,[48,120],'外站需運送備發與工作組：換發時長 + 運輸（假設）'],
 ['aog.engineRecoveryHK','c_rec','外站換發回收成本','HK$',1200000,[600000,2400000],'運送備發、機組與工具（假設）'],
 ['aog.pHKG','π','失效發生在 HKG 的機率','',0.55,[0.4,0.7],'按 HKG 基地停留時間比例（假設）'],
 ['pools.GE90-ENG.lease.cost','c_lease','備用發動機短租／加急','HK$',2300000,[1500000,3000000],'GE90-115B 長租 US$250k–300k/月；短租按 1 個月起租 + 運輸'],
 ['pools.GE90-ENG.lease.lead','τ_lease','短租交付期','天',5,[3,7],'租賃池調機 + 運輸 + 文件（假設）'],
 ['labour.HKG.B1','ℓ_B1','HKG B1 工時費率','HK$/h',610,[450,800],'大型航司技師工資 US$50–65/h + 30% 附加 ≈ US$78/h（FAA/BTS，Simpson 2025）'],
 ['labour.otMult','γ','加班倍數','×',1.5,[1.5,2.0],'香港常見加班補償 1.5×（假設）'],
 ['extensionPerHour','ρ','計劃停場延長成本','HK$/h',78000,[39000,156000],'取 Boeing AOG 區間下限 US$10k/h（有預告、可調機）'],
 ['dedicated.rateUSD','c_ded','臨時抽調停場每小時','US$/h',10000,[10000,40000],'同上，有預告的計劃停場'],
 ['riskCap','P_max','失效概率上限','',0.08,[0.03,0.10],'工程安全約束（可靠性方案設定，假設）'],
 ['epsEcon','ε','經濟區間容忍度','',0.05,[0.02,0.10],'修改建議文件：演示初始值 5%'],
 ['evalDays','E','評估期','天',60,[30,90],'覆蓋一個 A 檢週期（假設）'],
 ['stations.HKG.B1','Cap_B1','HKG B1 每日工時','h',600,[450,750],'約 75 名 B1 × 8 h（假設）'],
 ['stations.HKG.bays','Cap_bay','HKG 可用機庫位','個',2,[1,3],'假設'],
 ['pools.GE90-ENG.stock.HKG','S⁰','HKG 在站備用發動機','台',1,[0,2],'假設'],
 ['pools.GE90-ENG.arrivals.0.day','t_ret','返修到貨日','D+',9,[5,13],'假設']
];
function defaultWindows(){return {
 'DEMO-07':[{id:'W0',d:1,st:'HKG',g:9,kind:'night'},{id:'W1',d:3,st:'HKG',g:9,kind:'night'},{id:'W2',d:6,st:'HKG',g:30,kind:'rest'},{id:'W3',d:10,st:'BKK',g:9,kind:'out'},{id:'W4',d:13,st:'HKG',g:36,kind:'acheck'}],
 'DEMO-04':[{id:'W0',d:1,st:'HKG',g:9,kind:'night'},{id:'W1',d:4,st:'HKG',g:30,kind:'rest'},{id:'W2',d:6,st:'HKG',g:9,kind:'night'},{id:'W3',d:9,st:'BKK',g:9,kind:'out'},{id:'W4',d:12,st:'HKG',g:36,kind:'acheck'}],
 'DEMO-13':[{id:'W0',d:2,st:'HKG',g:9,kind:'night'},{id:'W1',d:5,st:'HKG',g:9,kind:'night'},{id:'W2',d:6,st:'HKG',g:30,kind:'rest'},{id:'W3',d:9,st:'BKK',g:9,kind:'out'},{id:'W4',d:11,st:'HKG',g:36,kind:'acheck'}],
 'DEMO-02':[{id:'W1',d:2,st:'HKG',g:9,kind:'night'},{id:'W2',d:4,st:'SIN',g:10,kind:'out'},{id:'W3',d:6,st:'HKG',g:9,kind:'night'},{id:'W4',d:8,st:'HKG',g:9,kind:'night'},{id:'W5',d:11,st:'BKK',g:8,kind:'out'}],
 'DEMO-06':[{id:'W1',d:2,st:'HKG',g:9,kind:'night'},{id:'W2',d:5,st:'BKK',g:9,kind:'out'},{id:'W3',d:8,st:'HKG',g:9,kind:'night'},{id:'W4',d:12,st:'HKG',g:9,kind:'night'}],
 'DEMO-09':[{id:'W1',d:3,st:'HKG',g:9,kind:'night'},{id:'W2',d:6,st:'HKG',g:9,kind:'night'},{id:'W3',d:9,st:'SIN',g:10,kind:'out'},{id:'W4',d:14,st:'HKG',g:36,kind:'acheck'}],
 'DEMO-03':[{id:'W1',d:2,st:'HKG',g:9,kind:'night'},{id:'W2',d:5,st:'HKG',g:9,kind:'night'},{id:'W3',d:7,st:'BKK',g:9,kind:'out'},{id:'W4',d:9,st:'HKG',g:9,kind:'night'},{id:'W5',d:12,st:'HKG',g:9,kind:'night'}],
 'DEMO-11':[{id:'W1',d:3,st:'HKG',g:9,kind:'night'},{id:'W2',d:7,st:'HKG',g:9,kind:'night'},{id:'W3',d:10,st:'HKG',g:9,kind:'night'},{id:'W4',d:13,st:'SIN',g:10,kind:'out'}],
 'DEMO-15':[{id:'W1',d:1,st:'HKG',g:9,kind:'night'},{id:'W2',d:4,st:'HKG',g:9,kind:'night'},{id:'W3',d:8,st:'HKG',g:9,kind:'night'},{id:'W4',d:11,st:'HKG',g:36,kind:'acheck'}],
 'DEMO-21':[{id:'W1',d:2,st:'HKG',g:9,kind:'night'},{id:'W2',d:3,st:'HKG',g:9,kind:'night'},{id:'W3',d:7,st:'HKG',g:9,kind:'night'},{id:'W4',d:10,st:'SIN',g:10,kind:'out'}],
 'DEMO-24':[{id:'W1',d:1,st:'HKG',g:9,kind:'night'},{id:'W2',d:5,st:'BKK',g:9,kind:'out'},{id:'W3',d:9,st:'HKG',g:9,kind:'night'},{id:'W4',d:13,st:'HKG',g:9,kind:'night'}],
 'DEMO-27':[{id:'W1',d:2,st:'HKG',g:9,kind:'night'},{id:'W2',d:5,st:'HKG',g:9,kind:'night'},{id:'W3',d:9,st:'HKG',g:36,kind:'acheck'}],
 'DEMO-31':[{id:'W1',d:3,st:'HKG',g:9,kind:'night'},{id:'W2',d:6,st:'HKG',g:9,kind:'night'},{id:'W3',d:12,st:'HKG',g:9,kind:'night'}],
 'DEMO-33':[{id:'W1',d:4,st:'HKG',g:9,kind:'night'},{id:'W2',d:8,st:'HKG',g:9,kind:'night'},{id:'W3',d:12,st:'HKG',g:36,kind:'acheck'}],
 'DEMO-41':[{id:'W1',d:1,st:'HKG',g:8,kind:'night'},{id:'W2',d:3,st:'HKG',g:8,kind:'night'},{id:'W3',d:6,st:'HKG',g:8,kind:'night'},{id:'W4',d:10,st:'HKG',g:8,kind:'night'}],
 'DEMO-44':[{id:'W1',d:2,st:'HKG',g:8,kind:'night'},{id:'W2',d:6,st:'SIN',g:10,kind:'out'},{id:'W3',d:10,st:'HKG',g:36,kind:'acheck'}],
 'DEMO-47':[{id:'W1',d:3,st:'HKG',g:8,kind:'night'},{id:'W2',d:7,st:'BKK',g:9,kind:'out'},{id:'W3',d:11,st:'HKG',g:8,kind:'night'}],
 'DEMO-52':[{id:'W1',d:2,st:'HKG',g:9,kind:'night'},{id:'W2',d:3,st:'HKG',g:9,kind:'night'},{id:'W3',d:7,st:'HKG',g:9,kind:'night'},{id:'W4',d:13,st:'HKG',g:9,kind:'night'}],
 'DEMO-61':[{id:'W1',d:1,st:'HKG',g:7,kind:'night'},{id:'W2',d:3,st:'HKG',g:7,kind:'night'},{id:'W3',d:5,st:'HKG',g:7,kind:'night'},{id:'W4',d:8,st:'HKG',g:36,kind:'acheck'}],
 'DEMO-63':[{id:'W1',d:2,st:'HKG',g:7,kind:'night'},{id:'W2',d:6,st:'HKG',g:7,kind:'night'},{id:'W3',d:9,st:'HKG',g:7,kind:'night'}]
};}
// 發動機性能退化增長率：CF6 4,000 FH 後 SFC +2.0%（NASA）⇒ 每天 2%/(4000/11.3) ≈ 0.0056%/天
const K_ENG=FUEL_777_DAY*0.02/(4000/11.3);
// 每架每日燃油（t/天）＝ 平均每小時油耗 × 日利用率；國泰 2025 年日利用率 11.3 h（年報），窄體與區域航線取 9.5 h（假設）
const FUEL_DAY={'777-300ER':7.0*11.3,'777-300':6.8*11.3,'A350-900':5.8*11.3,'A350-1000':6.6*11.3,'A330-300':5.7*9.5,'A321neo':2.6*9.5};
const KE=ty=>FUEL_DAY[ty]*0.02/(4000/11.3);   // 發動機退化增長：4,000 飛行小時後耗油 +2%（NASA CF6 研究）
function defaultTasks(cm){
  const eng=(reg)=>cm&&cm[reg]?cm[reg]:null;
  const E7=eng('DEMO-07')||{mu:19.43,sig:2.34,f0:0.202,k:0.0044}, E4=eng('DEMO-04')||{mu:15.81,sig:2.34,f0:0.469,k:0.0073}, E13=eng('DEMO-13')||{mu:14.25,sig:2.34,f0:0.147,k:0.0047};
  const ENGV=51000; // HK$/天：GE90-115B 整機價值 >US$35M ÷ 在翼約 30,000 飛行小時 × 11.3 h/天 × 50%（業界報導，估算）
  const engTask=(id,reg,name,E,unit)=>({id,reg,type:'777-300ER',cls:'R',name,src:'cm',unit,mu:E.mu,sig:E.sig,f0:E.f0,k:E.k,r:1,v:ENGV,
     dur:36,mh:{B1:300,B2:60},hangar:true,tool:'stand',pool:'GE90-ENG',hkgOnly:true,pax:Math.round(368*0.852*2),deadline:null,
     basis:'換發 36 小時、360 工時（參考 Austrian Technik GE90 換發 48 小時、450 工時）'});
  const wash=(id,reg,type,pen,extra)=>({id,reg,type,cls:'P',name:'發動機清洗（雙發）',src:'syn',lever:'engine',mu:null,f0:+(FUEL_DAY[type]*pen).toFixed(3),k:+KE(type).toFixed(4),r:0.6,v:0,
     dur:4,mh:{B1:12,B2:0},hangar:false,tool:'wash',pool:null,hkgOnly:true,pax:0,deadline:null,pen,
     basis:`耗油增加 ${(pen*100).toFixed(1)}%（清洗可降 0.5–1.5%）× ${FUEL_DAY[type].toFixed(0)} t/天；可恢復 60%`,...(extra||{})});
  const bleed=(id,reg,type,pen,side)=>({id,reg,type,cls:'P',name:`${side}引氣管路漏氣修復`,src:'syn',lever:'bleed',mu:null,f0:+(FUEL_DAY[type]*pen).toFixed(3),k:0.002,r:0.9,v:0,
     dur:4,mh:{B1:8,B2:0},hangar:false,tool:null,pool:null,hkgOnly:false,pax:0,deadline:null,pen,
     basis:`耗油增加 ${(pen*100).toFixed(1)}%（每 1% 多餘引氣約增加 1–2% 耗油，NASA）；可恢復 90%`});
  const air=(id,reg,type,name,kgYear,dur,mh)=>({id,reg,type,cls:'P',name,src:'syn',lever:'airframe',mu:null,f0:+(kgYear/1000/365).toFixed(3),k:0,r:0.9,v:0,
     dur,mh:{B1:mh,B2:0},hangar:true,tool:null,pool:null,hkgOnly:false,pax:0,deadline:null,pen:kgYear/1000/365/FUEL_DAY[type],
     basis:`額外阻力每年多耗油 ${(kgYear/1000).toFixed(1)} t（ASTEROID 氣動劣化估算工具）`});
  return [
  {...engTask('R1','DEMO-07','2 號發動機更換',E7,64),alert:1},
  {...engTask('R2','DEMO-04','1 號發動機更換',E4,49),alert:3},
  {...engTask('R3','DEMO-13','2 號發動機更換',E13,36),alert:2},
  {id:'R4',alert:4,reg:'DEMO-02',type:'A330-300',cls:'R',name:'輔助動力裝置起動發電機更換',src:'syn',mu:9,sig:2,f0:0.12,k:0.004,r:1,v:4000,
   dur:4,mh:{B1:6,B2:6},hangar:false,tool:null,pool:'APU-SG',hkgOnly:false,pax:Math.round(317*0.852*2),deadline:10,mel:true,basis:'保留故障期限 10 天；期間地面改用外接電源與空調（合成數據）'},
  wash('P1','DEMO-07','777-300ER',0.010,{bundleWith:'R1',bundleMH:-4}),
  bleed('P2','DEMO-06','777-300ER',0.006,'左側'),
  air('P3','DEMO-09','777-300ER','襟翼端密封與副翼間隙修復',51597,6,14),
  wash('P4','DEMO-03','777-300ER',0.008),
  air('P5','DEMO-11','777-300ER','縫翼收起不到位與擾流板翹起修復',41208,5,10),
  wash('P6','DEMO-15','777-300ER',0.009),
  wash('P7','DEMO-21','A350-900',0.007),
  bleed('P8','DEMO-24','A350-900',0.004,'右側'),
  wash('P9','DEMO-27','A350-900',0.011),
  wash('P10','DEMO-31','A350-1000',0.008),
  air('P11','DEMO-33','A350-1000','貨艙門密封條更換',18000,4,8),
  wash('P12','DEMO-41','A330-300',0.010),
  air('P13','DEMO-44','A330-300','襟翼滑軌整流罩修復',22000,5,10),
  bleed('P14','DEMO-47','A330-300',0.005,'左側'),
  wash('P15','DEMO-52','777-300',0.012),
  wash('P16','DEMO-61','A321neo',0.008),
  air('P17','DEMO-63','A321neo','機翼前緣密封修復',9000,3,6)
  ];
}
/* ---------------- 單項成本 ---------------- */
function fuelTonnes(t,d,P){ // 評估期內退化多燒燃油（t）
  const E=P.evalDays, F=(a,b)=>t.f0*(b-a)+t.k*(b*b-a*a)/2;
  const dd=Math.min(d,E);
  return F(0,dd)+(1-t.r)*F(dd,E);
}
function pFail(t,d,P){ if(t.cls!=='R') return 0; return Phi((d-t.mu)/t.sig); }
function aogCost(t,P){
  const a=P.aog, hk=a.hkgHours*a.rateUSD*USD, out=a.outHours*a.rateUSD*USD;
  return a.pHKG*hk+(1-a.pHKG)*out+(t.tool==='stand'?a.engineRecoveryHK:0);
}
/* 選項：每個窗口 × 備件來源 + 延後 */
function optionsFor(t,W,P){
  const opts=[];
  const ws=(W[t.reg]||[]).filter(w=>w.d<=P.horizon);
  const pool=t.pool?P.pools[t.pool]:null;
  for(const w of ws){
    if(t.hkgOnly&&w.st!=='HKG') continue;
    if(t.hangar&&P.stations[w.st].bays<=0&&w.kind!=='acheck') continue;
    if(t.dur>w.g+P.maxExtension) continue;   // 時長不可能塞進該窗口
    if(t.tool==='stand'&&P.stations[w.st].stand<=0) continue;
    if(t.tool==='wash'&&P.stations[w.st].wash<=0) continue;
    if(t.deadline!=null&&w.d>t.deadline) continue;
    const modes=pool?['stock'].concat(pool.transfer?['transfer']:[]).concat(['lease']):['none'];
    for(const m of modes){
      if(m==='lease'&&w.d<pool.lease.lead) continue;
      if(m==='transfer'&&w.d<pool.transfer.lead) continue;
      opts.push(makeOpt(t,w,m,P));
    }
  }
  if(t.cls==='R'){
    for(const d of P.dedicated.days){ if(d>P.horizon) continue; if(t.deadline!=null&&d>t.deadline) continue;
      const modes=pool?['stock'].concat(pool.transfer?['transfer']:[]).concat(['lease']):['none'];
      for(const m of modes){ if(m==='lease'&&d<pool.lease.lead) continue; if(m==='transfer'&&d<pool.transfer.lead) continue;
        opts.push(makeOpt(t,{id:'X'+d,d,st:'HKG',g:P.dedicated.hours,kind:'ded'},m,P)); } }
  }
  if(t.deadline==null||t.deadline>=P.deferDay){
    opts.push(makeOpt(t,{id:'D',d:P.deferDay,st:'HKG',g:0,kind:'defer'},'none',P));
  }
  return opts.filter(o=>o.ok).filter(o=>{
    if(P.lock&&P.lock[t.id]) return P.lock[t.id]===o.key;
    return !(P.exclude&&P.exclude[o.key]);
  });
}
/* 未用剩餘壽命：毛值、可回收價值、回收成本、淨損失（只對可靠性工作） */
function lifeTerms(t,d,P){
  if(t.cls!=='R'||!t.v) return {rulDays:0,gross:0,recov:0,recCost:0,netRec:0,recovered:false,loss:0};
  const R=P.recovery, rulDays=Math.max(0,t.mu-d), gross=rulDays*t.v;
  const recov=gross*R.rate, recCost=gross>0?(R.disassyInspect+R.repair+R.logistics+recov*R.txnPct):0;
  const netRec=Math.max(0,recov-recCost);          // 不劃算時不回收（淨回收取 0，不出現負回收）
  return {rulDays,gross,recov,recCost,netRec,recovered:netRec>0,loss:gross-netRec};
}
/* 單一選項的五項成本：AOG、燃油、碳、未用壽命淨損失、維修執行 */
function comp(t,w,m,P){
  const pf=pFail(t,w.d,P), fuelT=fuelTonnes(t,w.d,P), co2=fuelT*P.co2PerFuel;
  const aog=pf*aogCost(t,P);
  const fuel=fuelT*P.fuelPrice;                                   // 只計燃油支出
  const carbon=co2*P.carbonPriceUSD*USD*P.carbonCoverage;          // 共用燃油量 × 排放因子 × 碳價 × 覆蓋比例
  const L=lifeTerms(t,w.d,P);
  let lab=0,log=0,ded=0;
  if(w.kind!=='defer'){
    const Lr=P.labour[w.st]||P.labour.HKG;
    lab=t.mh.B1*Lr.B1+t.mh.B2*Lr.B2;
    if(w.kind==='ded'){ lab=t.mh.B1*P.labour.HKG.B1+t.mh.B2*P.labour.HKG.B2; ded=P.dedicated.hours*P.dedicated.rateUSD*USD+P.dedicated.slot; }
    if(m==='lease') log=P.pools[t.pool].lease.cost;
    if(m==='transfer') log=P.pools[t.pool].transfer.cost;
  }else{ lab=t.mh.B1*P.labour.HKG.B1+t.mh.B2*P.labour.HKG.B2; }
  const mel=t.mel?w.d*P.mel.dayCost:0;
  const exec=lab+log+mel+ded;
  return {pf,fuelT,co2,aog,fuel,carbon,life:L.loss,L,lab,log,mel,ded,exec,base:aog+fuel+carbon+L.loss+exec};
}
function makeOpt(t,w,m,P){
  const c=comp(t,w,m,P);
  const ok=!(t.cls==='R'&&c.pf>P.riskCap);
  return {task:t.id,key:t.id+'|'+w.id+'|'+m,w,m,ok,pax:c.pf*t.pax,...c,fuelHK:c.fuel+c.carbon,waste:c.life};
}
/* 固定原窗口重新計價（敏感度「固定窗口」模式用） */
function repricePlan(plan,T,P){const np={};for(const t of T){const o=plan[t.id];if(o) np[t.id]=makeOpt(t,o.w,o.m,P);}return {...evaluate(np,T,P),plan:np};}

/* ---------------- 計劃評估（耦合項與約束） ---------------- */
function evaluate(plan,T,P){ // plan: taskId -> opt
  const byAW={}; // reg|win -> tasks
  for(const t of T){const o=plan[t.id]; if(!o||o.w.kind==='defer'||o.w.kind==='ded') continue; const k=t.reg+'|'+o.w.id; (byAW[k]=byAW[k]||{w:o.w,reg:t.reg,ts:[]}).ts.push({t,o});}
  let hangarCost=0, ext=0, bundle=0, otExtra=0; const viol=[];
  const use={}; // st|d -> {bays,B1,B2,stand,wash}
  const U=(st,d)=>use[st+'|'+d]=use[st+'|'+d]||{bays:0,B1:0,B2:0,stand:0,wash:0};
  for(const k in byAW){
    const g=byAW[k], w=g.w, u=U(w.st,w.d);
    const ids=g.ts.map(x=>x.t.id);
    let elapsed=0, needH=false;
    for(const {t} of g.ts){
      let mh1=t.mh.B1, par=false;
      if(t.bundleWith&&ids.includes(t.bundleWith)){mh1+=t.bundleMH; par=true; bundle+=(-t.bundleMH)*(P.labour[w.st]||P.labour.HKG).B1*(w.kind==='ot'?P.labour.otMult:1);}
      u.B1+=mh1; u.B2+=t.mh.B2;
      if(!par) elapsed+=t.dur;
      if(t.hangar) needH=true;
      if(t.tool==='stand') u.stand++;
      if(t.tool==='wash') u.wash++;
    }
    if(needH&&w.kind!=='acheck'){u.bays++; hangarCost+=P.hangarFee[w.st]||0;}
    const over=Math.max(0,elapsed-w.g);
    if(over>P.maxExtension) viol.push(`${g.reg} ${w.id} 停場不足：需 ${elapsed}h，可用 ${w.g}h`);
    ext+=over*P.extensionPerHour;
  }
  // 資源容量
  for(const key in use){
    const [st,dS]=key.split('|'), d=+dS, cap=P.stations[st], bg=((P.background[st]||{})[d])||{bays:0,B1:0,B2:0}, u=use[key];
    if(u.bays+bg.bays>cap.bays) viol.push(`${st} D+${d} 機庫位不足（${u.bays+bg.bays}/${cap.bays}）`);
    for(const sk of ['B1','B2']){ const need=u[sk]+bg[sk], ex=Math.max(0,need-cap[sk]);
      if(ex>cap[sk]*P.otCapPct) viol.push(`${st} D+${d} ${sk} 工時不足（需 ${need}，上限 ${Math.round(cap[sk]*(1+P.otCapPct))}）`);
      else if(ex>0){ otExtra+=ex*(P.labour[st]||P.labour.HKG)[sk]*(P.labour.otMult-1); u[sk+'ot']=ex; } }
    if(u.stand>cap.stand) viol.push(`${st} D+${d} 發動機架不足`);
    if(u.wash>cap.wash) viol.push(`${st} D+${d} 水洗設備不足`);
  }
  // 備件池（按站點累計：已用 ≤ 庫存 + 到貨 + 調撥到達）
  for(const pid in P.pools){
    const pool=P.pools[pid], uses=T.filter(t=>t.pool===pid&&plan[t.id]&&plan[t.id].w.kind!=='defer');
    const stockUse=uses.filter(t=>plan[t.id].m==='stock'), trUse=uses.filter(t=>plan[t.id].m==='transfer');
    const stations=new Set([...Object.keys(pool.stock),...pool.arrivals.map(a=>a.station),...stockUse.map(t=>plan[t.id].w.st)]);
    // 調撥：從有庫存的站點（非本站）出庫
    const avail=(st,d)=>(pool.stock[st]||0)+pool.arrivals.filter(a=>a.station===st&&a.day<=d).reduce((s,a)=>s+a.qty,0);
    for(const st of stations){
      const ds=stockUse.filter(t=>plan[t.id].w.st===st).map(t=>plan[t.id].w.d).sort((a,b)=>a-b);
      ds.forEach((d,i)=>{const outTr=trUse.filter(t=>plan[t.id].w.st!==st&&plan[t.id].w.d-pool.transfer.lead<=d).length; if(i+1+outTr>avail(st,d)) viol.push(`${pool.label}：${st} D+${d} 庫存不足`);});
    }
    trUse.forEach(t=>{const o=plan[t.id]; const others=Object.keys(pool.stock).filter(s=>s!==o.w.st); const tot=others.reduce((s,st)=>s+avail(st,o.w.d-pool.transfer.lead),0); const used=trUse.filter(x=>plan[x.id].w.d<=o.w.d).length; if(used>tot) viol.push(`${pool.label}：調撥來源不足`);});
  }
  let base=0,fuelT=0,aog=0,waste=0,lab=0,log=0,mel=0,pax=0,risk=0,fuelC=0,carbC=0,lifeG=0,lifeR=0,execO=0;
  for(const t of T){const o=plan[t.id]; if(!o) continue; base+=o.base; fuelT+=o.fuelT; aog+=o.aog; waste+=o.waste; lab+=o.lab; log+=o.log; mel+=o.mel; pax+=o.pax; risk=Math.max(risk,o.pf); fuelC+=o.fuel; carbC+=o.carbon; lifeG+=o.L.gross; lifeR+=o.L.netRec; execO+=o.exec;}
  let ded=0; for(const t of T){const o=plan[t.id]; if(o&&o.ded) ded+=o.ded;}
  const total=base+hangarCost+ext+otExtra-bundle;
  const coupling=hangarCost+ext+otExtra-bundle;              // 計劃層資源耦合（只在計劃層計一次）
  const comps={aog,fuel:fuelC,carbon:carbC,life:waste,exec:execO+coupling};
  return {total,fuelT,co2:fuelT*P.co2PerFuel,aog,waste,lab,log,mel,ded,hangar:hangarCost,ext,ot:otExtra,bundle,pax,riskMax:risk,viol,use,
    comps,coupling,execOpt:execO,lifeGross:lifeG,lifeNetRec:lifeR,
    parts:{fuel:fuelC+carbC}};
}

/* ---------------- 精確分支定界 ---------------- */
function solveJoint(T,W,P,opts){
  opts=opts||{};
  const O={};
  const hangTasks={}; T.forEach(t=>{if(t.hangar) hangTasks[t.reg]=(hangTasks[t.reg]||0)+1;});
  T.forEach(t=>{
    O[t.id]=optionsFor(t,W,P).map(o=>{
      let lb=o.base;
      if(o.w.kind!=='defer'){
        lb+=Math.max(0,t.dur-o.w.g)*P.extensionPerHour;                       // 單獨延長停場（下界）
        if(t.hangar&&o.w.kind!=='acheck') lb+=(P.hangarFee[o.w.st]||0)/hangTasks[t.reg]; // 機庫費分攤（下界）
        if(t.bundleWith) lb-=(-t.bundleMH)*(P.labour[o.w.st]||P.labour.HKG).B1*(o.w.kind==='ot'?P.labour.otMult:1); // 可能的合併節省
      }
      return {...o,lb};
    }).sort((a,b)=>a.lb-b.lb);
  });
  // 先排耦合最強的可靠性任務，再排選項少的
  const order=[...T].sort((a,b)=>(a.cls===b.cls?0:(a.cls==='R'?-1:1))||O[a.id].length-O[b.id].length);
  const minRest=new Array(order.length+1).fill(0);
  for(let i=order.length-1;i>=0;i--){const L=O[order[i].id]; minRest[i]=minRest[i+1]+(L.length?L[0].lb:Infinity);}
  // 初始上界：基線計劃（可行）
  let best=null;
  const base=solveBaseline(T,W,P,opts.tau);
  if(base.viol.length===0&&T.every(t=>base.plan[t.id])) best={...base,plan:{...base.plan}};   // 只有完整且可行的基線才作初始上界
  let nodes=0; const plan={};
  const t0=Date.now(), limit=opts.nodeLimit||250000;
  function rec(i){
    nodes++; if(nodes>limit) return;
    const ev=evaluate(plan,T,P);
    if(ev.viol.length) return;
    if(best&&ev.total+minRest[i]>=best.total-1e-6) return;
    if(i===order.length){ if(!best||ev.total<best.total) best={...ev,plan:{...plan}}; return; }
    const t=order[i];
    for(const o of O[t.id]){
      if(best&&ev.total+o.lb+minRest[i+1]>=best.total-1e-6) break; // 選項已按下界排序
      plan[t.id]=o; rec(i+1); delete plan[t.id];
    }
  }
  rec(0);
  return {best,nodes,ms:Date.now()-t0,options:O,complete:nodes<=limit};
}

/* ---------------- 基線：固定閾值 + 先到先得；性能任務排到定檢 ---------------- */
function solveBaseline(T,W,P,tau){
  tau=tau==null?7:tau;
  const plan={}; const O={}; T.forEach(t=>O[t.id]=optionsFor(t,W,P));
  const rel=T.filter(t=>t.cls==='R').sort((a,b)=>(a.alert||99)-(b.alert||99)); // 按告警先後（先到先得）
  const tryAssign=(t,cands)=>{for(const o of cands){plan[t.id]=o; if(evaluate(plan,T,P).viol.length===0) return true; delete plan[t.id];} return false;};
  for(const t of rel){
    const trig=t.mel?0:Math.max(0,t.mu-tau);
    // 規則：觸發日之後第一個可行窗口；優先用庫存，其次調撥，最後短租
    const rank={stock:0,transfer:1,lease:2,none:0};
    const reg=o=>o.w.kind!=='defer'&&o.w.kind!=='ded';
    const c=O[t.id].filter(o=>reg(o)&&o.w.d>=trig).sort((a,b)=>a.w.d-b.w.d||rank[a.m]-rank[b.m]);
    const c2=O[t.id].filter(reg).sort((a,b)=>b.w.d-a.w.d||rank[a.m]-rank[b.m]);           // 觸發前最晚的常規窗口
    const c3=O[t.id].filter(o=>o.w.kind==='ded').sort((a,b)=>b.w.d-a.w.d||rank[a.m]-rank[b.m]); // 最後才臨時停場
    if(!tryAssign(t,c)) if(!tryAssign(t,c2)) if(!tryAssign(t,c3)) tryAssign(t,O[t.id].filter(o=>o.w.kind==='defer'));
  }
  // 性能任務：現行做法是排進下次定檢（A 檢）；本期無定檢則延後
  for(const t of T.filter(t=>t.cls==='P')){
    const c=O[t.id].filter(o=>o.w.kind==='acheck');
    if(!tryAssign(t,c)) tryAssign(t,O[t.id].filter(o=>o.w.kind==='defer'));
  }
  const ev=evaluate(plan,T,P);
  return {...ev,plan};
}

/* ---------------- 各自最優（忽略資源，只作對照） ---------------- */
function solveSelfish(T,W,P){
  const plan={}; T.forEach(t=>{const o=optionsFor(t,W,P).sort((a,b)=>a.base-b.base)[0]; if(o) plan[t.id]=o;});
  const ev=evaluate(plan,T,P); return {...ev,plan};
}


/* ================= 單項 Cost-of-Waiting 曲線與經濟區間 ================= */
function invNorm(p){ // Acklam
  const a=[-39.6968302866538,220.946098424521,-275.928510446969,138.357751867269,-30.6647980661472,2.50662827745924],
        b=[-54.4760987982241,161.585836858041,-155.698979859887,66.8013118877197,-13.2806815528857],
        c=[-0.00778489400243029,-0.322396458041136,-2.40075827716184,-2.54973253934373,4.37466414146497,2.93816398269878],
        d=[0.00778469570904146,0.32246712907004,2.445134137143,3.75440866190742];
  const pl=0.02425,ph=1-pl; let q,r;
  if(p<pl){q=Math.sqrt(-2*Math.log(p));return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);}
  if(p>ph){q=Math.sqrt(-2*Math.log(1-p));return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);}
  q=p-0.5;r=q*q;return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
}
function costAt(t,s,P){  // 與窗口選項共用同一套五項成本；參照窗口 = HKG 過夜、在站庫存（不含計劃層耦合）
  const c=comp(t,{id:'ref',d:s,st:'HKG',g:99,kind:'night'},t.pool?'stock':'none',P);
  return {s,pf:c.pf,aog:c.aog,fuel:c.fuel,carbon:c.carbon,fuelT:c.fuelT,life:c.life,L:c.L,exec:c.exec,total:c.base};
}
function costCurve(t,W,P,opts){
  opts=opts||{};
  const S=opts.span||Math.max(P.horizon+4,(t.cls==='R'?t.mu+2.5*t.sig:P.horizon+4)), step=opts.step||0.25;
  const pts=[]; for(let s=0;s<=S+1e-9;s+=step) pts.push(costAt(t,+s.toFixed(3),P));
  // 窗口（W）上的實際總成本（含窗口執行成本、備件來源）
  const wopts=optionsFor(t,W,{...P,lock:{},exclude:{}}).filter(o=>o.w.kind!=='defer');
  const byWin={}; wopts.forEach(o=>{const k=o.w.id; if(!byWin[k]||o.base<byWin[k].base) byWin[k]=o;});
  const wins=Object.values(byWin).sort((a,b)=>a.w.d-b.w.d);
  const star=wins.length?wins.reduce((a,b)=>b.base<a.base?b:a):null;            // s* = argmin_{s∈W} C(s)
  const Cstar=star?costAt(t,star.w.d,P).total:Math.min(...pts.map(p=>p.total));
  const sRisk=t.cls==='R'?t.mu+t.sig*invNorm(P.riskCap):Infinity;               // F(s)=P_max
  const thr1=(1+P.epsEcon)*Cstar, thr2=(1+P.epsWarn)*Cstar;
  // 經濟區間：包含 s* 的連續段 {C(s) ≤ (1+ε)C(s*)} ∩ {s ≤ s_risk}
  const sd=star?star.w.d:0; let i0=pts.findIndex(p=>p.s>=sd); if(i0<0) i0=pts.length-1;
  let a=i0,b=i0; while(a>0&&pts[a-1].total<=thr1&&pts[a-1].s<=sRisk) a--; while(b<pts.length-1&&pts[b+1].total<=thr1&&pts[b+1].s<=sRisk) b++;
  let c=b; while(c<pts.length-1&&pts[c+1].total<=thr2&&pts[c+1].s<=sRisk) c++;
  const sMinCont=pts.reduce((x,y)=>y.total<x.total?y:x);
  // 邊際等待成本 dC/ds（HK$/天）
  const slope=(s)=>{const h=0.5;return (costAt(t,s+h,P).total-costAt(t,Math.max(0,s-h),P).total)/(s+h-Math.max(0,s-h));};
  return {pts,wins,star,Cstar,sRisk,econ:[pts[a].s,pts[b].s],warn:[pts[b].s,pts[c].s],accel:pts[c].s,sMinCont,
          mcw:{atLatest:slope(pts[b].s),atRisk:isFinite(sRisk)?slope(sRisk):null,today:slope(0)},thr1,thr2};
}

/* ================= 敏感度（龍捲風圖） ================= */
function getPath(o,p){return p.split('.').reduce((a,k)=>a==null?a:a[k],o);}
function setPath(o,p,v){const ks=p.split('.');let a=o;for(let i=0;i<ks.length-1;i++)a=a[ks[i]];a[ks[ks.length-1]]=v;}
function planSaving(T,W,P,tau){const B=solveBaseline(T,W,{...P,lock:{},exclude:{}},tau),J=solveJoint(T,W,{...P,lock:{},exclude:{}},{tau}).best;return J?{save:B.total-J.total,co2:B.co2-J.co2,B,J}:{save:NaN,co2:NaN,B,J:null};}
function sensitivity(T,W,P,metas,tau){
  const base=planSaving(T,W,P,tau);
  const rows=metas.filter(m=>m[5][0]!==m[5][1]).map(m=>{
    const run=v=>{const Q=JSON.parse(JSON.stringify(P)); setPath(Q,m[0],v); return planSaving(T,W,Q,tau);};
    const lo=run(m[5][0]), hi=run(m[5][1]);
    return {key:m[0],sym:m[1],name:m[2],unit:m[3],lo:m[5][0],hi:m[5][1],sLo:lo.save,sHi:hi.save,cLo:lo.co2,cHi:hi.co2,swing:Math.abs(hi.save-lo.save)};
  }).sort((a,b)=>b.swing-a.swing);
  return {base,rows};
}

/* ================= 五項成本對帳（基準 − 優化） ================= */
const COMP_KEYS=['aog','fuel','carbon','life','exec'];
function reconcile(B,J){
  const rows=COMP_KEYS.map(k=>({k,b:B.comps[k],j:J.comps[k],d:B.comps[k]-J.comps[k]}));
  const sumB=rows.reduce((s,r)=>s+r.b,0), sumJ=rows.reduce((s,r)=>s+r.j,0), sumD=rows.reduce((s,r)=>s+r.d,0);
  return {rows,sumB,sumJ,sumD,totalD:B.total-J.total,ok:Math.abs(sumB-B.total)<1e-6&&Math.abs(sumJ-J.total)<1e-6&&Math.abs(sumD-(B.total-J.total))<1e-6};
}
/* 任務層歸屬：每項任務的五項差額 + 計劃層耦合差額，合計 = 計劃總差額 */
function attribute(B,J,T){
  const tasks=T.map(t=>{const b=B.plan[t.id],j=J.plan[t.id];const c={};
    COMP_KEYS.forEach(k=>c[k]=(b?b[k]:0)-(j?j[k]:0));
    return {id:t.id,c,sum:COMP_KEYS.reduce((s,k)=>s+c[k],0),bKey:b?b.key:null,jKey:j?j.key:null,execJ:j?j.exec:0};});
  const coupling=(B.coupling||0)-(J.coupling||0);
  return {tasks,coupling,total:tasks.reduce((s,x)=>s+x.sum,0)+coupling};
}

/* ================= 現金流工具：NPV / IRR（處理無解、多重解、不符條件） ================= */
function npv(r,cf){return cf.reduce((s,c,i)=>s+c/Math.pow(1+r,i),0);}
function irr(cf){
  if(!cf.length||cf.some(x=>!isFinite(x))) return {status:'invalid',msg:'現金流含無效數值',roots:[]};
  const nz=cf.filter(x=>Math.abs(x)>1e-9); let changes=0; for(let i=1;i<nz.length;i++) if(Math.sign(nz[i])!==Math.sign(nz[i-1])) changes++;
  if(changes===0) return {status:'none',msg:'現金流沒有正負變號，IRR 無定義',roots:[],changes};
  const roots=[], f=r=>npv(r,cf); let lo=-0.99, flo=f(lo);
  for(let r=-0.99+0.0025;r<=3.0001;r+=0.0025){const fr=f(r);
    if(flo===0){roots.push(lo);} else if(Math.sign(fr)!==Math.sign(flo)&&isFinite(fr)&&isFinite(flo)){
      let a=lo,b=r,fa=flo; for(let k=0;k<80;k++){const m=(a+b)/2,fm=f(m); if(Math.sign(fm)===Math.sign(fa)){a=m;fa=fm;}else b=m;} roots.push((a+b)/2);}
    lo=r; flo=fr;}
  const uniq=[]; roots.forEach(x=>{if(!uniq.some(y=>Math.abs(y-x)<1e-6)) uniq.push(x);});
  if(!uniq.length) return {status:'none',msg:'在 −99% 至 300% 範圍內無解',roots:[],changes};
  if(uniq.length>1) return {status:'multiple',msg:'多重解（現金流多次變號），請以 NPV 判斷',roots:uniq,changes};
  if(cf[0]>=0) return {status:'atypical',msg:'首期非投資流出，IRR 解讀為「融資成本」而非回報率',roots:uniq,irr:uniq[0],changes};
  return {status:'ok',msg:'唯一解',roots:uniq,irr:uniq[0],changes};
}

/* ================= 飛機資產投資 / 租賃模型（US$；逐年現金流） ================= */
function defaultLease(){return {
  price:28e6, years:8, rentM:0.42e6, util:0.96, insurance:0.10e6, maint:0.60e6, other:0.10e6,
  residual:13e6, sellPct:0.02, disc:0.07, tax:0.165,
  opt:{capex:0.15e6, fee:0.012e6, maintCut:0.06, utilDays:3, rentPrem:0.0, residUp:0.015}
};}
function leaseCF(L,optimized){
  const o=optimized?L.opt:{capex:0,fee:0,maintCut:0,utilDays:0,rentPrem:0,residUp:0};
  const N=Math.max(1,Math.round(L.years)), util=Math.min(1,L.util+o.utilDays/365), resid=L.residual*(1+o.residUp);
  const dep=(L.price+o.capex-resid)/N;          // 直線折舊至殘值（非現金，只影響稅）
  const rows=[{y:0,rent:0,opex:0,ebitda:0,dep:0,ebit:0,tax:0,capex:-(L.price+o.capex),resid:0,cash:-(L.price+o.capex)}];
  for(let y=1;y<=N;y++){
    const rent=L.rentM*12*util*(1+o.rentPrem), opex=L.insurance+L.maint*(1-o.maintCut)+L.other+o.fee;
    const ebitda=rent-opex, ebit=ebitda-dep, tax=Math.max(0,ebit)*L.tax;   // 虧損年不退稅（保守簡化）
    const rv=y===N?resid*(1-L.sellPct):0;                                 // 出售淨額；香港不徵資本增值稅
    rows.push({y,rent,opex,ebitda,dep,ebit,tax,capex:0,resid:rv,cash:ebitda-tax+rv});
  }
  const cf=rows.map(r=>r.cash);
  return {rows,cf,npv:npv(L.disc,cf),irr:irr(cf),util,resid,dep};
}
function leaseCompare(L){
  const B=leaseCF(L,false), J=leaseCF(L,true), inc=J.cf.map((c,i)=>c-B.cf[i]);
  const pv=a=>a.reduce((s,c,i)=>s+c/Math.pow(1+L.disc,i),0);
  const incPos=inc.map(x=>Math.max(0,x)), incNeg=inc.map(x=>Math.min(0,x));
  return {B,J,inc,dNPV:J.npv-B.npv,incBenefit:pv(incPos),incCost:-pv(incNeg),incIRR:irr(inc)};
}
root.JointModelX={invNorm,costAt,costCurve,sensitivity,reconcile,attribute,npv,irr,defaultLease,leaseCF,leaseCompare,COMP_KEYS,planSaving,getPath,setPath,PARAM_META,FUEL_777_DAY};

root.JointModel={FUEL_DAY,comp,lifeTerms,makeOpt,repricePlan,defaultParams,defaultWindows,defaultTasks,optionsFor,evaluate,solveJoint,solveBaseline,solveSelfish,fuelTonnes,pFail,aogCost,Phi,USD};
})(typeof globalThis!=='undefined'?globalThis:this);
