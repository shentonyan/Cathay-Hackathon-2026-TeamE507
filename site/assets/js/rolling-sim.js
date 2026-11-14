/* ================= 全年滾動模擬（26 期 × 14 天） =================
 * 每期：新工作到達（發動機更換、保留故障、性能類問題）→ 現行做法與聯合決策各自求解 →
 * 各自的備件庫存與返修件跨期延續（同一台備用發動機不能兩期重複使用）→ 進入下一期。
 * 第 1 期即本期 21 項實際工作。旺季（7–8 月、12–1 月）其他飛機的背景工時較高。
 */
(function(root){
const JM=root.JointModel;
const ROLL_CFG={
  periods:26, startISO:'2026-11-16', engYears:4.5, melRate:0.8, perfRate:17, tatEng:75, tatApu:30,
  eng:{
    '777-300ER':{pool:'GE90-ENG',label:'777-300ER 備用發動機（GE90-115B）',n:35,lease:2300000,v:51000,dur:36,mh:[300,60],seats:368,stock:1,shop:[38,66]},
    '777-300':{pool:'T892-ENG',label:'777-300 備用發動機（Trent 892）',n:17,lease:1600000,v:32000,dur:32,mh:[260,50],seats:398,stock:1,shop:[45]},
    'A350-900':{pool:'TXWB-ENG',label:'A350 備用發動機（Trent XWB）',n:30,lease:2000000,v:48000,dur:32,mh:[270,55],seats:280,stock:2,shop:[30,58]},
    'A350-1000':{pool:'TXWB-ENG',n:18,lease:2000000,v:48000,dur:32,mh:[270,55],seats:334},
    'A330-300':{pool:'T700-ENG',label:'A330 備用發動機（Trent 700）',n:43,lease:1500000,v:30000,dur:30,mh:[240,50],seats:317,stock:2,shop:[25,55]},
    'A321neo':{pool:'LEAP-ENG',label:'A321neo 備用發動機（LEAP-1A）',n:16,lease:900000,v:20000,dur:20,mh:[160,30],seats:202,stock:1,shop:[40]}
  },
  season:[1.00,1.02,1.12,1.10,1.00,0.96,0.95,0.98,1.00,1.06,1.14,1.12]   // 由 11 月起；背景工時倍數
};
function rng(seed){let a=seed>>>0;return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
function poisson(r,lam){const L=Math.exp(-lam);let k=0,p=1;do{k++;p*=r();}while(p>L);return k-1;}
const U=(r,a,b)=>a+(b-a)*r();
function winsFor(type,r){
  const nb=type==='A321neo', out=[]; let d=1+Math.floor(r()*2);
  while(d<=14){out.push({d,st:'HKG',g:nb?7:8+Math.round(r()),kind:'night'}); d+=nb?1+Math.floor(r()*2):2+Math.floor(r()*2);}
  if(!nb&&r()<0.5){const dd=3+Math.floor(r()*8); const i=out.findIndex(w=>w.d===dd); const w={d:dd,st:'HKG',g:30,kind:'rest'}; if(i>=0) out[i]=w; else out.push(w);}
  if(!nb&&r()<0.5){const dd=2+Math.floor(r()*11); if(!out.some(w=>w.d===dd)) out.push({d:dd,st:r()<0.5?'BKK':'SIN',g:9+Math.round(r()),kind:'out'});}
  if(r()<0.19){const dd=6+Math.floor(r()*9); const i=out.findIndex(w=>w.d===dd); const w={d:dd,st:'HKG',g:36,kind:'acheck'}; if(i>=0) out[i]=w; else out.push(w);}
  return out.sort((a,b)=>a.d-b.d).map((w,i)=>({id:'W'+(i+1),...w}));
}
function genPeriod(k,r,templates){
  const C=ROLL_CFG, T=[], W={}; let n=0; const FD=JM.FUEL_DAY||{};
  const regOf=(type)=>'S'+String(k).padStart(2,'0')+'-'+type.replace(/[^0-9A-Z]/gi,'').slice(0,5)+'-'+(++n);
  for(const [type,e] of Object.entries(C.eng)){
    const lam=e.n*2/(C.engYears*26), m=poisson(r,lam);
    for(let i=0;i<m;i++){const reg=regOf(type), mu=U(r,11,26), fd=(FD[type]||60)/2;
      T.push({id:`R${k}-${n}`,reg,type,cls:'R',name:(r()<0.5?'1':'2')+' 號發動機更換',src:'sim',mu,sig:2.34,f0:+(fd*U(r,0.002,0.012)).toFixed(3),k:0.005,r:1,v:e.v,
        dur:e.dur,mh:{B1:e.mh[0],B2:e.mh[1]},hangar:true,tool:'stand',pool:e.pool,hkgOnly:true,pax:Math.round(e.seats*0.85*2),deadline:null,alert:1+Math.floor(r()*4)});
      W[reg]=winsFor(type,r);}
  }
  const wide=['777-300ER','777-300','A350-900','A350-1000','A330-300'];
  for(let i=0,m=poisson(r,C.melRate);i<m;i++){const type=wide[Math.floor(r()*wide.length)], reg=regOf(type);
    T.push({id:`M${k}-${n}`,reg,type,cls:'R',name:'輔助動力裝置起動發電機更換',src:'sim',mu:U(r,7,12),sig:2,f0:0.12,k:0.004,r:1,v:4000,dur:4,mh:{B1:6,B2:6},hangar:false,tool:null,pool:'APU-SG',hkgOnly:false,pax:Math.round(300*0.85*2),deadline:10,mel:true,alert:5});
    W[reg]=winsFor(type,r);}
  for(let i=0,m=poisson(r,C.perfRate);i<m;i++){const tp=templates[Math.floor(r()*templates.length)], reg=regOf(tp.type), s=U(r,0.6,1.4);
    const t={...tp,id:`P${k}-${n}`,reg,src:'sim',f0:+(tp.f0*s).toFixed(3)}; delete t.bundleWith; delete t.bundleMH; T.push(t); W[reg]=winsFor(tp.type,r);}
  return {T,W};
}
function poolsFrom(inv,P0,day0){
  const pools={};
  for(const [pid,s] of Object.entries(inv)){
    const base=P0.pools[pid]||{}; const stock={...s.stock};
    s.arr=s.arr.filter(a=>{if(a.abs<=day0){stock[a.st]=(stock[a.st]||0)+a.qty; return false;} return true;});
    s.stock=stock;
    pools[pid]={label:s.label||base.label||pid,stock:{...stock},arrivals:s.arr.filter(a=>a.abs-day0<=14).map(a=>({day:a.abs-day0,station:a.st,qty:a.qty,note:'返修完成'})),
      lease:s.lease, transfer:s.transfer||null};
  }
  return pools;
}
function initInv(P0,scen){
  const C=ROLL_CFG, inv={}, lead=scen==='tight'?8:null;
  for(const [type,e] of Object.entries(C.eng)){ if(inv[e.pool]) continue;
    const p0=P0.pools[e.pool];
    const shop=(e.shop||[]).map(d=>({abs:d,st:'HKG',qty:1}));   // 送修中的備用發動機，按日期返回
    if(p0) inv[e.pool]={label:p0.label,stock:{...p0.stock},arr:(p0.arrivals||[]).map(a=>({abs:a.day,st:a.station,qty:a.qty})).concat(shop),lease:{...p0.lease},transfer:p0.transfer};
    else inv[e.pool]={label:e.label,stock:{HKG:e.stock},arr:shop,lease:{cost:e.lease,lead:lead||5},transfer:null};
  }
  const a=P0.pools['APU-SG']; inv['APU-SG']={label:a.label,stock:{...a.stock},arr:[],lease:{...a.lease},transfer:a.transfer};
  return inv;
}
function consume(inv,plan,T,day0,scen){
  const tat=scen==='tight'?1.5:1;
  for(const t of T){const o=plan[t.id]; if(!o||!t.pool||o.w.kind==='defer') continue; const s=inv[t.pool]; if(!s) continue;
    const back=Math.round((t.pool==='APU-SG'?ROLL_CFG.tatApu:ROLL_CFG.tatEng)*tat);
    if(o.m==='stock'){s.stock[o.w.st]=(s.stock[o.w.st]||0)-1; s.arr.push({abs:day0+o.w.d+back,st:o.w.st,qty:1});}
    else if(o.m==='transfer'){const src=Object.keys(s.stock).find(k=>k!==o.w.st&&s.stock[k]>0); if(src){s.stock[src]-=1; s.arr.push({abs:day0+o.w.d+back,st:src,qty:1});}}
  }
}
function summarize(ev,T){const L=T.filter(t=>t.pool&&ev.plan[t.id]&&ev.plan[t.id].m==='lease').length;
  return {total:ev.total,co2:ev.co2,fuel:ev.fuelT,lease:L,aog:ev.comps.aog,risk:ev.riskMax,comps:{...ev.comps},n:Object.keys(ev.plan).length};}
function makeSim(opts){
  // opts: {T0,W0,paramsFor(k,season)->P, scen, seed}
  const C=ROLL_CFG, r=rng(opts.seed||20261116), templates=opts.T0.filter(t=>t.cls==='P');
  const P1=opts.paramsFor(0,1), invB=initInv(P1,opts.scen), invJ=initInv(P1,opts.scen), out=[];
  let k=0;
  return {total:C.periods, done:()=>k>=C.periods, results:out, step(){
    const day0=k*14, mi=Math.floor((k*14)/30.4)%12, season=C.season[mi];
    const gen=k===0?{T:opts.T0,W:opts.W0}:genPeriod(k,r,templates);
    const Pk=opts.paramsFor(k,season);
    const PB={...Pk,pools:{...Pk.pools,...poolsFrom(invB,Pk,day0)},exclude:{},lock:{}}, PJ={...Pk,pools:{...Pk.pools,...poolsFrom(invJ,Pk,day0)},exclude:{},lock:{}};
    const t0=Date.now();
    const B=JM.solveBaseline(gen.T,gen.W,PB,7);
    const jr=JM.solveJoint(gen.T,gen.W,PJ,{tau:7,nodeLimit:opts.nodeLimit||60000});
    let J=jr.best; if(!J||Object.keys(J.plan).length<gen.T.length){const bJ=JM.solveBaseline(gen.T,gen.W,PJ,7); J=bJ;}
    consume(invB,B.plan,gen.T,day0,opts.scen); consume(invJ,J.plan,gen.T,day0,opts.scen);
    const d=new Date(Date.parse(C.startISO)+day0*864e5);
    out.push({k:k+1,date:d.toISOString().slice(0,10),month:d.getUTCMonth()+1,season,n:gen.T.length,nR:gen.T.filter(t=>t.cls==='R').length,
      b:summarize(B,gen.T),j:summarize(J,gen.T),complete:!!jr.complete,ms:Date.now()-t0,stockB:JSON.stringify(Object.fromEntries(Object.entries(invB).map(([p,s])=>[p,s.stock.HKG||0]))),stockJ:JSON.stringify(Object.fromEntries(Object.entries(invJ).map(([p,s])=>[p,s.stock.HKG||0])))});
    k++; return out[out.length-1];
  }};
}
function rollSum(res){const s={n:0,nR:0,b:0,j:0,bCO2:0,jCO2:0,bFuel:0,jFuel:0,leaseB:0,leaseJ:0,risk:0,aogB:0,aogJ:0,complete:0};
  res.forEach(p=>{s.n+=p.n;s.nR+=p.nR;s.b+=p.b.total;s.j+=p.j.total;s.bCO2+=p.b.co2;s.jCO2+=p.j.co2;s.bFuel+=p.b.fuel;s.jFuel+=p.j.fuel;s.leaseB+=p.b.lease;s.leaseJ+=p.j.lease;s.risk=Math.max(s.risk,p.j.risk);s.aogB+=p.b.aog;s.aogJ+=p.j.aog;s.complete+=p.complete?1:0;});
  s.save=s.b-s.j; s.co2=s.bCO2-s.jCO2; s.fuel=s.bFuel-s.jFuel; s.pct=s.save/s.b; s.co2pct=s.co2/s.bCO2; return s;}
root.Roll={ROLL_CFG,makeSim,rollSum,genPeriod,rng};
})(typeof globalThis!=='undefined'?globalThis:this);
