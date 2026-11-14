(function(){
'use strict';
const JM=globalThis.JointModel, X=globalThis.JointModelX, USD=JM.USD;
const $=id=>document.getElementById(id);
const qa=(s,r)=>[...(r||document).querySelectorAll(s)];
const fmt=(x,d=0)=>Number(x).toLocaleString('zh-Hant',{maximumFractionDigits:d,minimumFractionDigits:d});
const HK=x=>{const a=Math.abs(x),s=x<0?'−':'';return a>=1e6?s+'HK$'+(a/1e6).toFixed(a>=1e8?0:2)+'M':s+'HK$'+fmt(Math.round(a/1000))+'k';};
const pct=(p,d)=>(p*100).toFixed(d==null?(Math.abs(p)<0.01&&p!==0?2:1):d)+'%';
const Dd=s=>'第 '+(Math.round(s*10)/10)+' 天';
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const hashStr=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');};
const CITY={HKG:'香港',BKK:'曼谷',SIN:'新加坡'};
const KIND={night:'過夜停場',rest:'30 小時輪休停場',out:'外站過夜',acheck:'A 檢（已預留機庫）',defer:'延至下次定檢',ded:'臨時抽調停場'};
const MODE={stock:'在站庫存',transfer:'跨站調撥',lease:'短期租用',none:'—'};
const COL={ok:'#34a26b',p:'#d9a514',warn:'#ef8a2c',crit:'#e5484d',jade:'#006564',base:'#c7ced1'};
const LV_COL=['#34a26b','#d9a514','#ef8a2c','#e5484d'], LV_TXT=['正常','性能關注','需決策','優先處理'];
const NOW_HK=()=>new Intl.DateTimeFormat('zh-Hant',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Hong_Kong'}).format(new Date());

// ---------------- 機隊（國泰航空 2026 年中期報告，2026-06-30） ----------------
const FLEET_TYPES=[['A321neo',16],['A330-300',43],['A350-900',30],['A350-1000',18],['777-300',17],['777-300ER',35],['747-400ERF',6],['747-8F',14]];
const FLEET=FLEET_TYPES.reduce((s,x)=>s+x[1],0);
// 國泰航空 2025 年報：溫室氣體 15.3 百萬噸 CO₂e、收入噸公里 20,461 百萬、淨碳強度 746 g/RTK（2019 年 761，2030 年目標 670）、可持續航空燃料佔 0.68%
const CX={ghg:15.3e6,rtk:20461e6,ci19:761,ci25:746,ci30:670,safPct:0.0068,util:11.3,maint:8508e6,fuelHK:28715e6};
CX.fuel=CX.ghg/3.16; CX.fuelAcDay=CX.fuel/FLEET/365; CX.saf=CX.fuel*CX.safPct;
CX.fuelPrice=CX.fuelHK/CX.fuel;

// ---------------- 數據與狀態 ----------------
const CMmap={}; (CMAPSS.engines||[]).forEach(e=>CMmap[e.reg]=e);
const W=JM.defaultWindows(), T=JM.defaultTasks(CMmap), byId=id=>T.find(t=>t.id===id);
let P=JM.defaultParams();
const SCN=[
 {k:'base',n:'基準',d:'目前資源與參數',f:Q=>Q},
 {k:'tight',n:'備用發動機緊張',d:'返修發動機延至 14 天後到貨，短期租用交付期 5 → 8 天',f:Q=>{Q.pools['GE90-ENG'].arrivals[0].day=20;Q.pools['GE90-ENG'].lease.lead=8;return Q;}},
 {k:'bay',n:'機庫減少一個',d:'香港可用機庫位 2 → 1',f:Q=>{Q.stations.HKG.bays=1;return Q;}},
 {k:'carbon',n:'減碳優先',d:'內部碳價 US$30 → US$250／噸，並增加一套清洗設備',f:Q=>{Q.carbonPriceUSD=250;Q.stations.HKG.wash=3;return Q;}}
];
const S={view:'overview',role:'mcc',scen:'base',plan:'J',sel:'R1',lineSel:null,over:{},excl:{}};
const LKEY='cx_aaas_v8';
const LG=(()=>{try{return JSON.parse(localStorage.getItem(LKEY))||{rec:{},audit:[]};}catch(e){return {rec:{},audit:[]};}})();
LG.rec=LG.rec||{}; LG.audit=LG.audit||[];
const persist=()=>{try{localStorage.setItem(LKEY,JSON.stringify(LG));}catch(e){}};
const audit=(a,n)=>{LG.audit.unshift({ts:NOW_HK(),a,n:n||'',role:roleName()});LG.audit=LG.audit.slice(0,80);persist();};
function solve(){
  P=SCN.find(x=>x.k===S.scen).f(JM.defaultParams()); for(const k in S.over) X.setPath(P,k,S.over[k]); SELF=null; CARB=null;
  S.B=JM.solveBaseline(T,W,{...P,exclude:{},lock:{}},7);
  let j=JM.solveJoint(T,W,{...P,exclude:S.excl,lock:{}},{tau:7});
  if(!j.best&&Object.keys(S.excl).length){S.excl={}; j=JM.solveJoint(T,W,{...P,exclude:{},lock:{}},{tau:7}); setTimeout(()=>toast('部分退回的時段無可替代方案，已保留原計劃'),0);}
  S.J=j.best; S.curves={};

  S.R=S.J?X.reconcile(S.B,S.J):null;
}
const curveOf=t=>S.curves[t.id]||(S.curves[t.id]=X.costCurve(t,W,P));
function phasesOf(c){const end=c.pts[c.pts.length-1].s, r=isFinite(c.sRisk)?Math.min(c.sRisk,end):end;
  const a=c.econ[0], b=Math.min(c.econ[1],r), w=Math.min(c.warn[1],r), out=[];
  if(a>0.01) out.push({k:'early',n:'過早',a:0,b:a}); out.push({k:'econ',n:'最佳區間',a,b});
  if(w>b+0.01) out.push({k:'warn',n:'臨界',a:b,b:w}); if(end>w+0.01) out.push({k:'risk',n:isFinite(c.sRisk)?'高風險':'成本上升',a:w,b:end}); return out;}
const PH={early:'#aeb4b9',econ:'#34a26b',warn:'#ef8a2c',risk:'#e5484d'};
const winTxt=o=>o.w.kind==='defer'?'下次定檢':`第 ${o.w.d} 天 · ${CITY[o.w.st]}`;
const winSub=o=>KIND[o.w.kind];
function level(t,o){if(t.cls!=='R') return 1; if(t.mel) return 2; return ((o&&o.pf>0.03)||(t.mu-1.645*t.sig<12))?3:2;}

// ---------------- 角色 ----------------
const ROLES={
  mcc:{n:'管理人員',en:'維修計劃與決策管理 · 內部工作空間',views:['overview','plan','twin','line','carbon','model'],can:['approve','scen','money','exec']},
  external:{n:'外部訂閱公司',en:'企業演示訂閱',views:['overview','plan','twin','line','carbon','model'],can:['approve','scen','money','exec']},
  eng:{n:'維修員工',en:'持證飛機工程師（LAE，Licensed Aircraft Engineer）',views:['line','twin'],can:['exec']}
};
const can=a=>ROLES[S.role].can.includes(a);
const roleName=()=>ROLES[S.role].n;
function toast(m){const e=$('toast');e.textContent=m;e.classList.add('on');clearTimeout(toast._t);toast._t=setTimeout(()=>e.classList.remove('on'),2400);}

// ---------------- Highcharts 外觀 ----------------
Highcharts.setOptions({chart:{style:{fontFamily:getComputedStyle(document.documentElement).getPropertyValue('--font')||'sans-serif'},backgroundColor:'transparent',animation:false,spacing:[24,18,18,12]},
  credits:{enabled:false},title:{text:null},accessibility:{enabled:false},exporting:{enabled:false},
  tooltip:{backgroundColor:'rgba(255,255,255,.98)',borderWidth:1,borderColor:'#d8e3e0',borderRadius:12,shadow:false,style:{fontSize:'14px',color:'#0d3a38'}},
  legend:{itemStyle:{fontSize:'13px',fontWeight:'400',color:'#445451'},symbolRadius:5,itemDistance:20,itemMarginTop:5,itemMarginBottom:5,padding:8,margin:20},
  xAxis:{lineColor:'#dce3e1',tickLength:0,tickPixelInterval:95,labels:{padding:8,style:{fontSize:'13px',color:'#53635f'}},title:{margin:20,style:{fontSize:'13px',color:'#53635f'}}},
  yAxis:{gridLineColor:'#edf1ef',tickPixelInterval:64,labels:{padding:8,style:{fontSize:'13px',color:'#53635f'}},title:{margin:22,style:{fontSize:'13px',color:'#53635f'}}},
  plotOptions:{series:{animation:false,states:{inactive:{opacity:1}},dataLabels:{allowOverlap:false,crop:true,overflow:'justify',padding:6,style:{fontSize:'13px',textOutline:'none'}}}}});
const charts={};
const chart=(id,o)=>{
  if(charts[id]){try{charts[id].destroy();}catch(e){}}
  const large=document.documentElement.classList.contains('a11y-lg'),font=large?'15px':'13px';
  const contrast=document.documentElement.classList.contains('a11y-hc'),ink=contrast?'#0d3a38':'#4f6a66';
  const h=(o.chart&&o.chart.height||360)+(large?80:0);
  const options=Highcharts.merge({},o,{chart:{height:h},
    xAxis:{labels:{style:{fontSize:font,color:ink}},title:{style:{fontSize:font,color:ink}}},
    yAxis:{labels:{style:{fontSize:font,color:ink}},title:{style:{fontSize:font,color:ink}}},
    legend:{itemStyle:{fontSize:font,color:ink}},
    plotOptions:{series:{dataLabels:{allowOverlap:false,style:{fontSize:font}}}},
    responsive:{rules:[{condition:{maxWidth:520},chartOptions:{chart:{height:h+90,spacing:[24,12,18,8]},
      legend:{layout:'vertical',align:'left',verticalAlign:'bottom',itemMarginTop:4,itemMarginBottom:4},
      xAxis:{tickPixelInterval:110,labels:{autoRotation:undefined}},
      yAxis:{tickPixelInterval:72},
      plotOptions:{column:{dataLabels:{enabled:false}},bar:{dataLabels:{enabled:false}}}}}]}});
  return charts[id]=Highcharts.chart(id,options);
};
// ===== 等待的代價（Cost-of-Waiting）· v8.2 版式 =====
  const COW_COMPONENTS = [
    ['aog', '停飛預期損失', '#e5484d'],
    ['fuel', '燃油', '#d9a514'],
    ['carbon', '碳成本', '#8fb8a8'],
    ['life', '未用壽命', '#8a9098'],
    ['exec', '維修執行', '#5b7c8c']
  ];
  const COW_PHASE_FALLBACK = {
    early: '#aeb4b9',
    econ: '#34a26b',
    warn: '#ef8a2c',
    risk: '#e5484d'
  };
  const COW_PHASE_LABEL = {
    early: '過早維修',
    econ: '最佳窗口',
    warn: '臨界點',
    risk: '高風險區'
  };

  const cowFinite = value => Number.isFinite(Number(value));
  const cowThousands = value => Number(value || 0) / 1000;
  const cowPhaseColor = key => (PH && PH[key]) || COW_PHASE_FALLBACK[key];
  const cowDay = value => cowFinite(value) ? Dd(value) : '—';
  const cowSignedHK = value => `${Number(value) >= 0 ? '+' : ''}${HK(Number(value) || 0)}`;
  const cowOptionText = option => option ? `${winTxt(option)} · ${MODE[option.m] || '—'}` : '—';

  function cowSpread(values, minGap, low, high) {
    if (!values.length) return [];
    if (values.length === 1) return [Math.max(low, Math.min(high, values[0]))];
    const indexed = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
    const room = Math.max(0, high - low);
    const gap = Math.min(minGap, room / Math.max(1, indexed.length - 1));
    const placed = indexed.map((entry, index) => Math.max(low + index * gap, Math.min(high, entry.value)));
    for (let index = placed.length - 2; index >= 0; index--) {
      placed[index] = Math.min(placed[index], placed[index + 1] - gap);
    }
    if (placed[0] < low) {
      const shift = low - placed[0];
      for (let index = 0; index < placed.length; index++) placed[index] += shift;
    }
    const output = new Array(values.length);
    indexed.forEach((entry, index) => { output[entry.index] = Math.max(low, Math.min(high, placed[index])); });
    return output;
  }

  function cowRange(phase) {
    if (!phase) return '—';
    return phase.k === 'risk' ? `> ${cowDay(phase.a)}` : `${cowDay(phase.a)} – ${cowDay(phase.b)}`;
  }

  function cowRenderPhase(task, curve, joint, baseline, hc, phaseId) {
    const host = document.getElementById(phaseId);
    if (!host || !curve || !curve.pts || !curve.pts.length || !hc) return;

    host.classList.add('cow-stage');
    const phases = phasesOf(curve);
    const xmax = Math.max(0.001, Number(curve.pts[curve.pts.length - 1].s) || 0.001);
    const plotWidth = Math.max(1, hc.plotWidth || 1);
    const position = day => Math.max(0, Math.min(1, Number(day || 0) / xmax)) * plotWidth;
    const labelPositions = cowSpread(phases.map(phase => position((phase.a + phase.b) / 2)), 76, 34, Math.max(34, plotWidth - 34));
    const windows = Array.isArray(curve.wins) ? curve.wins : [];
    const windowPositions = cowSpread(windows.map(option => position(option.w.d)), 30, 12, Math.max(12, plotWidth - 12));
    const econ = phases.find(phase => phase.k === 'econ');
    const star = curve.star || null;
    const starDay = star && star.w && cowFinite(star.w.d) ? Number(star.w.d) : null;
    const starActual = star && cowFinite(star.base) ? Number(star.base) : null;
    const refAtStar = cowFinite(curve.Cstar) ? Number(curve.Cstar) : null;
    const marginal = curve.mcw && cowFinite(curve.mcw.atLatest) ? Number(curve.mcw.atLatest) : null;
    const descriptions = {
      early: '提早更換造成的未用壽命損失仍偏高',
      econ: `參照總成本 ≤ (1 + ${P.epsEcon}) × C*`,
      warn: `成本已超出最佳區間，但尚未進入高風險區`,
      risk: task.cls === 'R' ? '成本加速上升／接近或超過工程風險上限' : '退化燃油與碳排持續累積'
    };

    host.innerHTML = `
      <div class="cow-summary">
        <div class="cow-summary-main">
          <span class="cow-pill">最佳經濟窗口</span>
          <strong>${econ ? cowRange(econ) : '未形成可行經濟窗口'}</strong>
          <span>${starDay == null ? '沒有可行停場窗口；曲線仍顯示參照成本' : `最低可行窗口 s* = ${cowDay(starDay)}`}</span>
        </div>
        <div class="cow-marginal">
          <small>超過最遲經濟日後，每多等一天</small>
          <b>${marginal == null ? '—' : `${cowSignedHK(marginal)}／天`}</b>
          <span>邊際等待成本 dC/ds</span>
        </div>
      </div>
      <div class="cow-compare">
        <span><i class="cow-key cow-key-joint"></i>聯合計劃：<b>${esc(cowOptionText(joint))}</b></span>
        <span><i class="cow-key cow-key-base"></i>現行做法：<b>${esc(cowOptionText(baseline))}</b></span>
        ${starActual == null ? '' : `<span class="cow-cost-note">s* 實際窗口成本 ${HK(starActual)}${refAtStar == null ? '' : `；同日參照曲線 ${HK(refAtStar)}`}</span>`}
      </div>
      <div class="cow-track" style="margin-left:${hc.plotLeft}px;width:${plotWidth}px">
        <div class="cow-window-marks">
          ${windows.map((option, index) => `<span style="left:${windowPositions[index]}px" title="${esc(`${option.w.id} · ${KIND[option.w.kind] || option.w.kind} · ${option.w.st} · ${MODE[option.m] || option.m} · 實際窗口成本 ${HK(option.base)}`)}">${esc(option.w.id)}</span>`).join('')}
        </div>
        <div class="cow-phase-bar">
          ${phases.map(phase => `<i style="width:${Math.max(0, (phase.b - phase.a) / xmax * 100)}%;background:${cowPhaseColor(phase.k)}" title="${esc(`${COW_PHASE_LABEL[phase.k]} ${cowRange(phase)}`)}"></i>`).join('')}
        </div>
        ${starDay == null ? '' : `<span class="cow-pin cow-pin-star" style="left:${position(starDay)}px" title="最低可行窗口 s* = ${cowDay(starDay)}"></span>`}
        ${cowFinite(curve.sRisk) && Number(curve.sRisk) < xmax ? `<span class="cow-pin cow-pin-risk" style="left:${position(curve.sRisk)}px" title="風險截止 ${cowDay(curve.sRisk)}"></span>` : ''}
        <div class="cow-phase-labels">
          ${phases.map((phase, index) => `<span style="left:${labelPositions[index]}px;color:${cowPhaseColor(phase.k)}">${COW_PHASE_LABEL[phase.k]}</span>`).join('')}
        </div>
      </div>
      <div class="cow-phase-legend">
        ${['early', 'econ', 'warn', 'risk'].map(key => {
          const phase = phases.find(item => item.k === key);
          return `<div style="border-left-color:${cowPhaseColor(key)}"><b>${COW_PHASE_LABEL[key]}</b><span>${phase ? cowRange(phase) : '本項無'} · ${descriptions[key]}</span></div>`;
        }).join('')}
      </div>
      <p class="cow-footnote">曲線為同一參照條件（香港過夜停場、在站庫存）下的五項成本；圓點為實際可行窗口，已包含站點、備件來源與執行成本，因此不一定落在參照曲線上。◆ 為最低可行窗口 s*；三角形表示數值超出圖表上限；紅線為風險截止 P(失效) = ${pct(P.riskCap)}。</p>`;
  }

  function renderWaiting(task, chartId, phaseId) {
    const chartHost = document.getElementById(chartId);
    const phaseHost = document.getElementById(phaseId);
    if (!chartHost || !phaseHost || !task || !S || !S.J || !S.J.plan) return null;

    chartHost.classList.add('cow-chart');
    const curve = curveOf(task);
    if (!curve || !Array.isArray(curve.pts) || !curve.pts.length) {
      chartHost.innerHTML = '<p class="cow-empty">沒有可用的等待成本曲線。</p>';
      phaseHost.innerHTML = '';
      return null;
    }

    const joint = S.J.plan[task.id] || null;
    const baseline = (S.B && S.B.plan && S.B.plan[task.id]) || joint;
    const points = curve.pts;
    const xmax = Math.max(0.001, Number(points[points.length - 1].s) || 0.001);
    const referenceMinimum = cowFinite(curve.Cstar)
      ? Number(curve.Cstar)
      : Math.min(...points.map(point => Number(point.total) || 0));
    const ymax = Math.max(referenceMinimum * 2.3, 1000) / 1000;
    const cap = value => Math.min(Number(value) || 0, ymax * 0.97);
    const clipped = value => (Number(value) || 0) > ymax * 0.97;
    const marker = (value, symbol, radius) => ({
      symbol: clipped(value) ? 'triangle' : symbol,
      radius
    });
    const phases = phasesOf(curve);
    const phaseBands = phases.map(phase => ({
      from: phase.a,
      to: phase.b,
      color: `${cowPhaseColor(phase.k)}16`
    }));
    const plotLines = [];
    if (curve.star && curve.star.w && cowFinite(curve.star.w.d)) {
      plotLines.push({value: Number(curve.star.w.d), color: '#006564', width: 1.5, dashStyle: 'ShortDash', zIndex: 4});
    }
    if (cowFinite(curve.sRisk) && Number(curve.sRisk) < xmax) {
      plotLines.push({
        value: Number(curve.sRisk),
        color: '#9f2d35',
        width: 2,
        zIndex: 4,
        label: {text: '風險截止', rotation: 0, y: 15, style: {color: '#9f2d35', fontSize: '11px', fontWeight: '600'}}
      });
    }

    const windows = (curve.wins || []).map(option => ({
      x: option.w.d,
      y: cap(cowThousands(option.base)),
      real: option.base,
      option,
      marker: marker(cowThousands(option.base), 'circle', 5.5)
    }));
    const starPoint = curve.star && curve.star.w ? [{
      x: curve.star.w.d,
      y: cap(cowThousands(curve.star.base)),
      real: curve.star.base,
      option: curve.star,
      marker: marker(cowThousands(curve.star.base), 'diamond', 9)
    }] : [];
    const jointPoint = joint && joint.w.kind !== 'defer' ? [{
      x: joint.w.d,
      y: cap(cowThousands(joint.base)),
      real: joint.base,
      option: joint,
      marker: marker(cowThousands(joint.base), 'circle', 11)
    }] : [];
    const baselinePoint = baseline && baseline.w.kind !== 'defer' && (!joint || baseline.key !== joint.key) ? [{
      x: baseline.w.d,
      y: cap(cowThousands(baseline.base)),
      real: baseline.base,
      option: baseline,
      marker: marker(cowThousands(baseline.base), 'square', 8)
    }] : [];

    const componentSeries = COW_COMPONENTS.map(([key, name, color]) => ({
      name,
      type: 'line',
      data: points.map(point => [point.s, cowThousands(point[key])]),
      color,
      lineWidth: 1.7,
      dashStyle: key === 'life' ? 'Dash' : key === 'exec' ? 'ShortDot' : 'Solid',
      tooltip: {
        pointFormatter() {
          return `<span style="color:${this.color}">●</span> ${esc(name)}：<b>${HK(this.y * 1000)}</b><br>`;
        }
      }
    }));

    return chart(chartId, {
      chart: {
        height: 420,
        spacingTop: 18,
        spacingRight: 16,
        events: {
          render() { cowRenderPhase(task, curve, joint, baseline, this, phaseId); }
        }
      },
      xAxis: {
        min: 0,
        max: xmax,
        tickInterval: 2,
        title: {text: '執行日 s（距今天數）'},
        plotBands: phaseBands,
        plotLines,
        labels: {formatter() { return `D+${this.value}`; }}
      },
      yAxis: {
        min: 0,
        max: ymax,
        title: {text: '預期成本（HK$ 千元）'},
        labels: {formatter() { return `HK$${fmt(this.value)}k`; }},
        plotLines: cowFinite(curve.thr1) ? [{value: cowThousands(curve.thr1), color: '#34a26b', width: 1, dashStyle: 'Dot', zIndex: 3}] : []
      },
      legend: {
        enabled: true,
        align: 'center',
        verticalAlign: 'bottom',
        itemDistance: 14,
        itemStyle: {fontSize: '11.5px'}
      },
      tooltip: {
        shared: false,
        useHTML: true,
        valueDecimals: 0,
        headerFormat: '<b>執行日 D+{point.key}</b><br>'
      },
      plotOptions: {
        series: {marker: {enabled: false}, states: {inactive: {opacity: 1}}}
      },
      series: [
        ...componentSeries,
        {
          name: '參照總成本 Cref(s)',
          type: 'line',
          data: points.map(point => [point.s, cowThousands(point.total)]),
          color: '#0d3a38',
          lineWidth: 4,
          zIndex: 6,
          tooltip: {
            pointFormatter() {
              const point = points[this.index];
              return `${COW_COMPONENTS.map(([key, name]) => `${esc(name)}：<b>${HK(point[key])}</b>`).join('<br>')}<br><span style="color:#006564">參照總成本：<b>${HK(point.total)}</b></span><br><small>香港過夜停場 · 在站庫存；不含計劃層資源耦合</small>`;
            }
          }
        },
        {
          name: '可行窗口（實際成本）',
          type: 'scatter',
          data: windows,
          zIndex: 7,
          color: '#69777c',
          marker: {enabled: true, symbol: 'circle', radius: 5.5, lineColor: '#fff', lineWidth: 1.5},
          tooltip: {
            pointFormatter() {
              const option = this.option;
              return `<b>${esc(option.w.id)} · ${esc(KIND[option.w.kind] || option.w.kind)}</b><br>${esc(option.w.st)} · ${esc(MODE[option.m] || option.m)}<br>實際窗口成本：<b>${HK(this.real)}</b><br><small>包含站點、備件來源與該窗口執行成本</small>`;
            }
          }
        },
        {
          name: '最低可行窗口 s*',
          type: 'scatter',
          data: starPoint,
          zIndex: 8,
          color: '#006564',
          marker: {enabled: true, symbol: 'diamond', radius: 9, lineColor: '#fff', lineWidth: 2},
          tooltip: {
            pointFormatter() {
              return `最低可行窗口 ${cowDay(this.x)}<br>實際窗口成本：<b>${HK(this.real)}</b>`;
            }
          }
        },
        {
          name: '聯合計劃選擇',
          type: 'scatter',
          data: jointPoint,
          zIndex: 9,
          color: '#006564',
          marker: {enabled: true, symbol: 'circle', radius: 11, fillColor: 'rgba(255,255,255,.08)', lineColor: '#006564', lineWidth: 3},
          tooltip: {
            pointFormatter() {
              return `聯合計劃 ${esc(cowOptionText(this.option))}<br>實際窗口成本：<b>${HK(this.real)}</b>`;
            }
          }
        },
        {
          name: '現行做法',
          type: 'scatter',
          data: baselinePoint,
          zIndex: 9,
          color: '#ef8a2c',
          marker: {enabled: true, symbol: 'square', radius: 8, fillColor: 'rgba(255,255,255,.08)', lineColor: '#ef8a2c', lineWidth: 2.5},
          tooltip: {
            pointFormatter() {
              return `現行做法 ${esc(cowOptionText(this.option))}<br>實際窗口成本：<b>${HK(this.real)}</b>`;
            }
          }
        }
      ],
      caption: {
        useHTML: true,
        text: `評估期 ${P.evalDays} 天 · HK$ · 1 US$ = ${USD} HK$ · 五項成本共同驅動聯合決策`
      }
    });
  }




function chartNotes(id,html){
  const host=$(id); if(!host)return;
  let note=$(id+'Notes'); if(!note){note=document.createElement('div');note.id=id+'Notes';note.className='chart-notes';host.before(note);}
  note.innerHTML=html;
}

// ================= 年化 =================
const PER=26; // 滾動排程：每 14 天重排一次，全年 26 期
const SAF_ABATE=(2872-1149)*USD/(3.16*0.8);   // 可持續航空燃料減排成本 HK$／噸 CO₂：溢價 US$1,723／噸（IATA 2026 估算）÷ 每噸減排 2.53 噸

// ================= 全年滾動模擬（v13） =================
const ROLL_KEY=()=>JSON.stringify({s:S.scen,o:S.over,e:Object.keys(S.excl||{}).sort()});
function rollFor(){
  if(S.rollLive&&S.rollLive.key===ROLL_KEY()) return S.rollLive.res;
  if(!Object.keys(S.over).length&&!Object.keys(S.excl||{}).length&&ROLL_PRE[S.scen]) return ROLL_PRE[S.scen];
  return null;
}
function rollParams(k,season){
  const Q=SCN.find(x=>x.k===S.scen).f(JM.defaultParams()); for(const p in S.over) X.setPath(Q,p,S.over[p]);
  if(season!==1) for(const d in Q.background.HKG){const b=Q.background.HKG[d]; b.B1=Math.round(b.B1*season); b.B2=Math.round(b.B2*season);}
  if(S.scen==='tight'&&k>0) for(const p in Q.pools) if(Q.pools[p].lease) Q.pools[p].lease.lead=8;
  return Q;
}
function annual(){
  const R=rollFor();
  if(R){const s=Roll.rollSum(R), comps={b:{},j:{}};
    ['aog','fuel','carbon','life','exec'].forEach(k=>{comps.b[k]=R.reduce((a,p)=>a+p.b.comps[k],0); comps.j[k]=R.reduce((a,p)=>a+p.j.comps[k],0);});
    return {save:s.save,co2:s.co2,fuelT:s.fuel,pct:s.pct,co2pct:s.co2pct,b:s.b,j:s.j,n:s.n,risk:s.risk,comps,roll:true,abate:-P.fuelPrice/3.16};}
  const B=S.B,J=S.J;
  return {save:(B.total-J.total)*PER,co2:(B.co2-J.co2)*PER,fuelT:(B.fuelT-J.fuelT)*PER,pct:(B.total-J.total)/B.total,co2pct:(B.co2-J.co2)/B.co2,b:B.total*PER,j:J.total*PER,n:T.length*PER,risk:J.riskMax,
    comps:{b:Object.fromEntries(Object.entries(B.comps).map(([k,v])=>[k,v*PER])),j:Object.fromEntries(Object.entries(J.comps).map(([k,v])=>[k,v*PER]))},roll:false,abate:-P.fuelPrice/3.16};
}
function rollRun(){
  if(S.rollBusy) return; const key=ROLL_KEY(); S.rollBusy=true;
  const cm={}; (CMAPSS.engines||[]).forEach(e=>cm[e.reg]=e);
  const sim=Roll.makeSim({T0:T,W0:W,paramsFor:rollParams,scen:S.scen,seed:20261116,nodeLimit:60000});
  const bar=$('rlProg'); if(bar) bar.hidden=false;
  const tick=()=>{ if(sim.done()){S.rollBusy=false; S.rollLive={key,res:sim.results.map(p=>({...p}))}; toast('全年模擬完成'); renderView(); return;}
    sim.step(); const k=sim.results.length; if(bar){bar.querySelector('i').style.width=(k/26*100)+'%'; bar.querySelector('span').textContent=`模擬第 ${k}／26 期…`;} setTimeout(tick,0);};
  setTimeout(tick,30);
}
function renderRoll(){
  const host=$('rlCard'); if(!host) return; const R=rollFor(), money=can('money');
  if(!R){host.innerHTML=`<div class="ch"><div><p class="eyebrow">全年滾動模擬</p><h2>參數已修改</h2></div></div><p class="muted">目前參數與預先計算的結果不同。重新模擬約需 20 秒。</p><div class="acts" style="margin-top:14px"><button class="btn pri" id="rlRun">按目前參數重新模擬</button></div><div class="rl-prog" id="rlProg" hidden><i></i><span></span></div>`;
    $('rlRun').onclick=rollRun; return;}
  const s=Roll.rollSum(R), A=annual();
  let cum=0; const cumS=R.map(p=>[p.k,(cum+=p.b.total-p.j.total)]);
  host.innerHTML=`<div class="ch"><div><p class="eyebrow">全年滾動模擬 · 26 期 × 14 天</p><h2>一年的實際效果</h2></div>${can('approve')?'<button class="btn sm" id="rlRun">重新模擬</button>':''}</div>
    <div class="rl-k">
      <div class="hl"><small>全年節省</small><b>${money?HK(s.save):'—'}</b><span>總成本降 ${pct(s.pct)}</span></div>
      <div class="eco"><small>全年減少 CO₂</small><b>${fmt(s.co2)}<i> 噸</i></b><span>少燒 ${fmt(s.fuel)} 噸燃油</span></div>
      <div><small>全年排程工作</small><b>${fmt(s.n)}<i> 項</i></b><span>其中換件 ${fmt(s.nR)} 項</span></div>
      <div><small>全年最高失效概率</small><b>${pct(s.risk)}</b><span>安全上限 ${pct(P.riskCap,0)}</span></div>
    </div>
    <div id="rlChart"></div>
    <div class="rl-prog" id="rlProg" hidden><i></i><span></span></div>
    <p class="note">第 1 期為本期 21 項實際工作；其後每期按機隊規模產生新工作（發動機平均在翼 4.5 年、保留故障與性能問題按頻率出現）。現行做法與聯合決策各自管理備件：用掉的備用發動機約 75 天後才修好回庫，跨期延續。旺季（1–2 月、8–10 月）其他飛機佔用較多工時。${R.length-R.filter(p=>p.complete).length?`其中 ${R.length-R.filter(p=>p.complete).length} 期組合較多，取搜尋上限內的最佳可行方案。`:''}</p>`;
  chart('rlChart',{chart:{height:300},xAxis:{categories:R.map(p=>{const d=new Date(p.date);return (d.getUTCMonth()+1)+'/'+d.getUTCDate();}),labels:{step:2,style:{fontSize:'11px'}},tickInterval:1},
    yAxis:[{title:{text:'每期節省'},labels:{formatter(){return money?'HK$'+(this.value/1e6).toFixed(1)+'M':'';}}},{title:{text:'累計節省'},opposite:true,labels:{formatter(){return money?'HK$'+(this.value/1e6).toFixed(0)+'M':'';}}}],
    legend:{align:'left',verticalAlign:'top'},tooltip:{shared:true,formatter(){const p=R[this.points[0].point.index];return `<b>第 ${p.k} 期 · ${p.date}</b><br>${p.n} 項工作（換件 ${p.nR}）<br>本期節省 <b>${money?HK(p.b.total-p.j.total):'—'}</b><br>本期減碳 <b>${fmt(p.b.co2-p.j.co2)} 噸</b><br>累計節省 <b>${money?HK(cumS[p.k-1][1]):'—'}</b>`;}},
    plotOptions:{column:{borderWidth:0,borderRadius:3,pointPadding:0.08,groupPadding:0.06}},
    series:[{type:'column',name:'每期節省',data:R.map(p=>({y:p.b.total-p.j.total,color:p.season>1.05?'#2f8f86':'#6fb3a5'})),color:'#6fb3a5'},
      {type:'spline',name:'累計節省',yAxis:1,data:cumS.map(x=>x[1]),color:'#006564',lineWidth:2.6,marker:{enabled:false}}]});
  const b=$('rlRun'); if(b) b.onclick=rollRun;
}


// ================= 等待的代價（Cost-of-Waiting）曲線 =================
const COMPS=[['exec','維修執行','#7d8f99'],['life','提早更換浪費的壽命','#c3c9cd'],['fuelc','燃油與碳','#d9a514'],['aog','停飛風險','#e5484d']];
const COW={id:'R1',day:null};
function cowData(t){const c=curveOf(t); return {c,pts:c.pts.map(p=>({s:p.s,exec:p.exec,life:p.life,fuelc:p.fuel+p.carbon,aog:p.aog,total:p.total,pf:p.pf}))};}
function cowRender(prefix,t,opts){
  opts=opts||{}; const {c}=cowData(t), j=S.J.plan[t.id], best=c.pts.reduce((a,b)=>b.total<a.total?b:a);
  const xmax=t.cls==='R'&&isFinite(c.sRisk)?Math.min(c.pts[c.pts.length-1].s,Math.ceil(c.sRisk+3)):Math.min(c.pts[c.pts.length-1].s,16);
  const pts=cowData(t).pts.filter(p=>p.s<=xmax+1e-9), ph=phasesOf(c).map(p=>({...p,b:Math.min(p.b,xmax)})).filter(p=>p.a<xmax);
  const ymax=t.cls==='R'?Math.max(best.total*3.2,pts[0].total*1.5):null;
  const money=can('money');
  const bands=ph.map(p=>({from:p.a,to:p.b,color:PH[p.k]+(p.k==='econ'?'26':'12')}));
  const lines=[];
  if(isFinite(c.sRisk)&&c.sRisk<=xmax) lines.push({value:c.sRisk,color:'#e5484d',dashStyle:'ShortDash',width:1.5,zIndex:6});
  if(j&&j.w.kind!=='defer') lines.push({value:j.w.d,color:'#006564',width:2.5,zIndex:7});
  chartNotes(prefix+'Chart',`<div class="chart-phase-key">${ph.map(p=>`<span><i style="background:${PH[p.k]}"></i>${p.n} · ${fmt(p.a,1)}–${fmt(p.b,1)} 天</span>`).join('')}</div><div class="chart-marker-key">${isFinite(c.sRisk)&&c.sRisk<=xmax?`<span><i class="risk-line"></i>安全上限 ${pct(P.riskCap,0)} · 第 ${fmt(c.sRisk,1)} 天</span>`:''}${j&&j.w.kind!=='defer'?`<span><i class="plan-line"></i>已安排 · 第 ${j.w.d} 天</span>`:''}<span>最低成本 · 第 ${fmt(best.s,1)} 天</span></div>`);
  chart(prefix+'Chart',{chart:{height:opts.h||380,spacingTop:18},
    xAxis:{min:0,max:xmax,title:{text:'執行日（由今天起第 n 天）'},plotBands:bands,plotLines:lines,crosshair:{color:'rgba(0,0,0,.15)'}},
    yAxis:{title:{text:null},min:0,max:ymax,endOnTick:false,labels:{formatter(){return money?'HK$'+(this.value/1e6).toFixed(1)+'M':'';}}},
    legend:{align:'left',verticalAlign:'bottom',y:0,itemMarginBottom:6},
    tooltip:{shared:true,formatter(){const p=pts.find(x=>Math.abs(x.s-this.x)<1e-6)||pts[0];
      return `<b>第 ${this.x} 天執行</b><br>`+COMPS.slice().reverse().map(([k,n,cl])=>`<span style="color:${cl}">●</span> ${n}　${money?HK(p[k]):'—'}`).join('<br>')+`<br><b>總成本　${money?HK(p.total):'—'}</b>${t.cls==='R'?`<br>失效概率　${pct(p.pf)}`:''}`;}},
    plotOptions:{area:{stacking:'normal',lineWidth:0,marker:{enabled:false},fillOpacity:0.85},series:{events:{click(e){cowSet(prefix,t,e.point.x);}}}},
    series:[...COMPS.map(([k,n,cl])=>({type:'area',name:n,data:pts.map(p=>[p.s,p[k]]),color:cl})),
      {type:'line',name:'總成本',data:pts.map(p=>[p.s,p.total]),color:'#0d3a38',lineWidth:2.6,marker:{enabled:false},zIndex:5},
      {type:'scatter',name:'最低點',data:[[best.s,best.total]],color:'#0d3a38',marker:{symbol:'circle',radius:6,lineWidth:3,lineColor:'#fff'},zIndex:8,showInLegend:false,
       dataLabels:{enabled:false}}]});
  const sl=$(prefix+'Day'); if(sl){sl.max=xmax; sl.step=0.5; const d0=COW.day!=null&&COW.day<=xmax?COW.day:(j&&j.w.kind!=='defer'?j.w.d:best.s); sl.value=d0; sl.oninput=()=>cowSet(prefix,t,+sl.value); cowSet(prefix,t,d0,true);}
}
function cowSet(prefix,t,d,init){
  const {c,pts}=cowData(t), p=pts.reduce((a,b)=>Math.abs(b.s-d)<Math.abs(a.s-d)?b:a), best=pts.reduce((a,b)=>b.total<a.total?b:a), money=can('money');
  if(!init) COW.day=p.s; const sl=$(prefix+'Day'); if(sl) sl.value=p.s;
  const ch=charts[prefix+'Chart']; if(ch){ch.xAxis[0].removePlotLine('cur'); ch.xAxis[0].addPlotLine({id:'cur',value:p.s,color:'#0d3a38',width:1,dashStyle:'Dot',zIndex:8});}
  const ph=phasesOf(c).find(x=>p.s>=x.a-1e-9&&p.s<=x.b+1e-9)||{n:'',k:'risk'};
  const diff=p.total-best.total;
  const out=$(prefix+'Out'); if(!out) return;
  out.innerHTML=`<div class="cw-day"><small>如果在</small><b>第 ${p.s} 天</b><span style="color:${PH[ph.k]}">● ${ph.n}</span></div>
    ${COMPS.slice().reverse().map(([k,n,cl])=>`<div class="cw-c"><small><i style="background:${cl}"></i>${n}</small><b>${money?HK(p[k]):'—'}</b></div>`).join('')}
    <div class="cw-t"><small>總成本</small><b>${money?HK(p.total):'—'}</b><span>${diff<500?'就是最低點':money?'比最低點多 '+HK(diff):'高於最低點'}${t.cls==='R'?' · 失效概率 '+pct(p.pf):''}</span></div>`;
}
function cowPills(prefix,ids){
  const box=$(prefix+'Pills'); if(!box) return;
  box.innerHTML=ids.map(id=>{const t=byId(id);return `<button class="${id===COW.id?'on':''}" data-id="${id}">${t.reg} · ${t.cls==='R'?(t.mel?'起動發電機':'換發動機'):t.name.replace('（雙發）','')}</button>`;}).join('');
  qa('#'+prefix+'Pills button').forEach(b=>b.onclick=()=>{COW.id=b.dataset.id; COW.day=null; cowPills(prefix,ids); cowRender(prefix,byId(COW.id),{h:prefix==='ow'?360:400}); const s=$(prefix+'Sum'); if(s) s.innerHTML=cowSummary(byId(COW.id));});
}
function cowSummary(t){const c=curveOf(t), j=S.J.plan[t.id];
  const inB=j&&j.w.kind!=='defer'&&j.w.d>=c.econ[0]-1e-9&&j.w.d<=c.econ[1]+1e-9;
  const joint=j&&j.w.kind!=='defer'&&!inB?`單看這一項，第 ${c.econ[0].toFixed(1)}–${c.econ[1].toFixed(1)} 天最劃算；但同期其他工作也要用同一${t.pool==='GE90-ENG'?'台備用發動機和機庫':'套資源'}，聯合決策把它安排在第 ${j.w.d} 天，整個機隊的總成本更低。`:`系統安排在${winTxt(j)}，正好落在最劃算的區間內。`;
  return t.cls==='R'?`<b>${t.reg} ${esc(t.name)}</b>：太早換，浪費仍可使用的壽命；太晚換，停飛風險急升。${isFinite(c.sRisk)?'第 '+c.sRisk.toFixed(1)+' 天後失效概率超過安全上限。':''}${joint}`
    :`<b>${t.reg} ${esc(t.name)}</b>：問題每天多燒約 ${t.f0.toFixed(2)} 噸燃油，越晚修總成本越高。現行做法等到定檢；系統安排在${winTxt(j)}。`;}

// ================= 聯合決策 =================
let SELF=null;
function selfish(){if(SELF&&SELF.scen===S.scen) return SELF; const s=JM.solveSelfish(T,W,{...P,exclude:{},lock:{}}); return SELF={scen:S.scen,...s};}
function violText(v){return v.replace('HKG','香港').replace(/D\+(\d+)/g,'第 $1 天').replace('水洗設備不足','清洗設備不夠').replace(/機庫位不足（(\d+)\/(\d+)）/,'機庫位不夠（需要 $1 個，只有 $2 個）').replace('777 備用發動機（GE90-115B）','備用發動機').replace('APU 起動發電機','起動發電機備件').replace('庫存不足','庫存不夠').replace(/：/,'：');}
function jointCards(boxId){
  const B=S.B,J=S.J,F=selfish(), money=can('money');
  const card=(cls,tag,name,desc,total,ok,extra)=>`<div class="jc ${cls}"><span class="jt">${tag}</span><h3>${name}</h3><p>${desc}</p><b>${money?HK(total*PER):'—'}<small> ／年</small></b><em class="${ok?'ok':'bad'}">${ok?'✓ 全部限制滿足':'✕ '+F.viol.length+' 處衝突'}</em>${extra||''}</div>`;
  $(boxId).innerHTML=card('','現行做法','固定門檻 · 先到先得','剩餘壽命低於門檻才排；備件按告警先後分配；耗油問題等定檢。',B.total,true)+
    card('self','逐項最優','每項工作各自挑最便宜的日子','只看自己，不理會其他工作也要用同一個機庫、同一套設備和同一台備用發動機。',F.total,false,`<ul>${F.viol.slice(0,4).map(v=>`<li>${esc(violText(v))}</li>`).join('')}</ul>`)+
    card('win','聯合決策','整個機隊一起排','在所有共用資源的限制下，找出總成本最低的組合。',J.total,true,`<div class="jw">${money?'比現行做法每年省 <b>'+HK((B.total-J.total)*PER)+'</b>':''}</div>`);
}
function resGrid(boxId){
  const F=selfish(), J=S.J, cap=P.stations.HKG, bg=d=>(P.background.HKG[d]||{bays:0});
  const row=(name,pl,key,capv,bgk)=>`<div class="rg-r"><span>${name}</span>${Array.from({length:14},(_,i)=>{const d=i+1,u=(pl.use['HKG|'+d]||{})[key]||0, v=u+(bgk?bg(d)[bgk]||0:0), over=v>capv; return `<i class="${over?'over':v?'use':''}" title="第 ${d} 天：${v}／${capv}">${v||''}</i>`;}).join('')}</div>`;
  $(boxId).innerHTML=`<div class="rg-h"><span></span>${Array.from({length:14},(_,i)=>`<em>${i+1}</em>`).join('')}</div>
    <div class="rg-g">逐項最優</div>${row('機庫位（上限 '+cap.bays+'）',F,'bays',cap.bays,'bays')}${row('清洗設備（上限 '+cap.wash+'）',F,'wash',cap.wash)}
    <div class="rg-g">聯合決策</div>${row('機庫位（上限 '+cap.bays+'）',J,'bays',cap.bays,'bays')}${row('清洗設備（上限 '+cap.wash+'）',J,'wash',cap.wash)}`;
}

// ================= 總覽 =================
function planAircraft(){const m={}; T.forEach(t=>{const o=S.J.plan[t.id]; const lv=level(t,o); (m[t.reg]=m[t.reg]||{reg:t.reg,type:t.type,lv:0,ts:[]}); m[t.reg].lv=Math.max(m[t.reg].lv,lv); m[t.reg].ts.push(t);}); return Object.values(m);}
function renderOverview(){
  const B=S.B,J=S.J, Y=annual(), ac=planAircraft(), money=can('money');
  const nR=T.filter(t=>t.cls==='R'&&!t.mel).length, nM=T.filter(t=>t.mel).length, nP=T.filter(t=>t.cls==='P').length;
  const appr=LG.rec.plan&&LG.rec.plan.scen===S.scen;
  $('ovHead').innerHTML=`<p class="eyebrow">國泰航空 · ${FLEET} 架 · ${SCN.find(x=>x.k===S.scen).n}情景</p><h1>每項維修，<br>落在最劃算的那一天。</h1>
    <div class="acts">${can('approve')?`<button class="btn pri" id="btnApprove" ${appr?'disabled':''}>${appr?'計劃已批准':'批准本期計劃'}</button>`:''}<button class="btn" data-go="plan">查看 14 天排程</button></div>`;
  const Z0=carbonTiers(), top=Z0.L[3];
  $('ovKpi').innerHTML=[
    ['每年節省成本',money?HK(Y.save):'—',`總成本降 ${pct(Y.pct)} · ${Y.roll?'26 期全年滾動模擬':'按 26 期估算'}`,'hl','plan'],
    ['每年減少 CO₂',fmt(Y.co2)+' 噸',`退化相關排放降 ${pct(Y.co2pct,0)} · 少燒 ${fmt(Y.fuelT)} 噸燃油`,'eco','plan'],
    ['完成 2030 減碳差距',`最多 ${top.pct.toFixed(0)}%`,`推廣到全集團後 · 每年減 ${fmt(top.co2/1000,0)} 千噸`,'','carbon'],
    ['最高失效概率',pct(Math.max(J.riskMax,Y.risk||0)),`安全上限 ${pct(P.riskCap,0)} · 全年 ${fmt(Y.n)} 項工作全部在上限內`,'','plan']
  ].map(([l,v,s,c,g])=>`<button class="kpi ${c}" data-go="${g}"><span>${l}</span><b>${v}</b><small>${s}</small></button>`).join('');
  // 等待的代價
  if(!byId(S.sel)) S.sel='R1';
  $('ovTask').innerHTML=T.map(t=>`<option value="${t.id}" ${t.id===S.sel?'selected':''}>${t.reg} · ${esc(t.name)}</option>`).join('');
  const drawW=()=>renderWaiting(byId(S.sel)||T[0],'ovWaiting','ovPhase');
  $('ovTask').onchange=e=>{S.sel=e.target.value; drawW();}; drawW();
  renderFeedback();
  // 聯合決策
  const st=P.stations.HKG; $('ovJointTxt').textContent=`${T.length} 項工作共用香港的 ${st.bays} 個機庫位、${st.wash} 套清洗設備、${P.pools['GE90-ENG'].stock.HKG} 台在站備用發動機和每天的工程師工時。每項各自挑最便宜的日子，就會在同一天搶同一套資源。`;
  jointCards('ovJoint'); resGrid('ovRes');
  // 機隊點陣
  const inv={}; ac.forEach(a=>{(inv[a.type]=inv[a.type]||[]).push(a);});
  $('ovFleet').innerHTML=FLEET_TYPES.map(([ty,n])=>{const L=(inv[ty]||[]).sort((a,b)=>b.lv-a.lv);
    const dots=Array.from({length:n},(_,i)=>{const a=L[i]; return a?`<i class="d" style="--c:${LV_COL[a.lv]}" title="${a.reg} · ${LV_TXT[a.lv]}" data-reg="${a.reg}"></i>`:'<i></i>';}).join('');
    return `<div class="fr"><div class="ft"><b>${ty}</b><span>${n} 架${L.length?` · <em>${L.length} 架有工作</em>`:''}</span></div><div class="fd">${dots}</div></div>`;}).join('');
  qa('#ovFleet i.d').forEach(e=>e.onclick=()=>{TW.reg=e.dataset.reg; TW.level='ac'; TW.part=null; TW.sub=null; showView('twin');});
  // 成本構成（全年）
  const K=[['aog','停飛風險','#e5484d'],['fuel','燃油','#d9a514'],['carbon','碳成本','#b8a35c'],['life','浪費的壽命','#c3c9cd'],['exec','維修執行','#7d8f99']];
  chart('ovCost',{chart:{type:'bar',height:290},xAxis:{categories:['現行做法','聯合決策'],labels:{style:{fontSize:'13px',color:'#0d3a38'}}},
    yAxis:{title:{text:null},labels:{formatter(){return money?'HK$'+(this.value/1e6).toFixed(0)+'M':'';}},reversedStacks:false},
    legend:{align:'left'},tooltip:{shared:true,pointFormatter(){return `<span style="color:${this.color}">●</span> ${this.series.name}：<b>${money?HK(this.y):'—'}</b><br>`;}},
    plotOptions:{bar:{stacking:'normal',borderWidth:0,pointWidth:30}},
    series:K.map(([k,n,c])=>({name:n,data:[Y.comps.b[k],Y.comps.j[k]],color:c}))});
  const ch=T.map(t=>{const b=B.plan[t.id],j=J.plan[t.id];return {t,b,j,d:(b?b.base:0)-(j?j.base:0)};}).filter(x=>x.b&&x.j&&(x.b.w.id!==x.j.w.id||x.b.m!==x.j.m)).sort((a,b)=>Math.abs(b.d)-Math.abs(a.d)).slice(0,5);
  $('ovChg').innerHTML=ch.map(x=>`<button class="chg" data-id="${x.t.id}"><span class="tg" style="--c:${LV_COL[level(x.t,x.j)]}"></span><div><b>${x.t.reg} · ${x.t.name}</b><small>${winTxt(x.b)} → <em>${winTxt(x.j)}</em>${x.t.pool&&x.b.m!==x.j.m?` · 備件 ${MODE[x.b.m]} → ${MODE[x.j.m]}`:''}</small></div><span class="dv ${x.d<0?'neg':''}">${money?(x.d>=0?'省 ':'多 ')+HK(Math.abs(x.d)):''}</span></button>`).join('');
  qa('#ovChg .chg').forEach(b=>b.onclick=()=>{S.sel=b.dataset.id;showView('plan');});
  const ba=$('btnApprove'); if(ba) ba.onclick=()=>{LG.rec.plan={ts:NOW_HK(),scen:S.scen,total:J.total}; audit('批准計劃',SCN.find(x=>x.k===S.scen).n); persist(); toast('計劃已批准，工作包已發布'); renderOverview();};
  qa('#v-overview [data-go]').forEach(b=>b.onclick=()=>{if(b.dataset.tab) MD.tab=b.dataset.tab; showView(b.dataset.go);});
}

// ================= 模型頁 =================
const MD={tab:'cow'};
const PLAIN=s=>String(s).replace(/AOG/g,'停飛').replace(/HKG/g,'香港').replace(/RUL/g,'剩餘壽命').replace(/SAF/g,'可持續航空燃料').replace(/SFC/g,'耗油').replace(/CORSIA/g,'國際航空碳抵銷機制（CORSIA）').replace(/EU ETS/g,'歐盟碳交易').replace(/FH/g,'飛行小時').replace(/MILP/g,'混合整數規劃');

// ================= 模型頁（v11：參考 v8.2 版式；公式統一編號、符號全部入表） =================
const ALGO={
  rul:'多層感知器集成（MLP Ensemble，Multilayer Perceptron Ensemble）＋分箱交叉共形預測區間（Cross-Conformal Prediction）',
  rulShort:'多層感知器集成＋共形區間',
  solver:'0-1 整數規劃（Binary Integer Programming）· 精確分支定界（Branch and Bound）',
  feat:'指數平滑與滾動斜率特徵（71 維）'
};
function mdNum(v){if(v==null||v==='') return '—'; if(typeof v!=='number') return esc(v); const a=Math.abs(v); return a>=1000?fmt(v):a>=1?fmt(v,a<10?2:1):fmt(v,a<0.1?3:2);}
function mdSymRows(){
  const ed=can('approve');
  let last='';
  return MODEL9.syms.map(r=>{
    const head=r.g!==last?`<tr class="sg"><th colspan="5">${esc(r.g)}</th></tr>`:''; last=r.g;
    let val;
    if(r.path){const v=X.getPath(P,r.path); val=ed?`<input type="number" step="any" data-p="${r.path}" value="${v}" aria-label="${esc(r.n)}">`:`<b>${mdNum(v)}</b>`;}
    else val=`<b>${esc(r.v||'—')}</b>`;
    return head+`<tr><td class="sym">${r.s}</td><td>${esc(r.n)}</td><td class="n">${val}</td><td class="muted">${esc(r.u||'')}</td><td class="muted small">${esc(r.src||'')}</td></tr>`;
  }).join('');
}
let modelMathObserver;
function observeModelMath(host){
  if(modelMathObserver) modelMathObserver.disconnect();
  const update=frame=>{
    const overflow=frame.scrollWidth>frame.clientWidth+1;
    frame.classList.toggle('has-overflow',overflow);
    frame.tabIndex=overflow?0:-1;
    frame.nextElementSibling.hidden=!overflow;
  };
  const frames=[...host.querySelectorAll('.eqf')];
  frames.forEach(update);
  if(typeof ResizeObserver!=='undefined'){
    modelMathObserver=new ResizeObserver(entries=>entries.forEach(({target})=>update(target)));
    frames.forEach(frame=>modelMathObserver.observe(frame));
  }
}
function renderModel(){
  const host=$('mdJoint'); if(!host) return;
  const num=(v,d=2)=>v==null?'—':Number(v).toLocaleString('zh-Hant',{maximumFractionDigits:d});
  const tbl=(heads,rows,cls)=>`<div class="model-table-wrap" tabindex="0" role="region"><table class="model-table ${cls||''}"><thead><tr>${heads.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
  const row=c=>'<tr>'+c.map(v=>`<td>${v}</td>`).join('')+'</tr>';
  const eq=e=>`<article class="eqr" id="model-equation-${e.n}" aria-labelledby="model-equation-title-${e.n}"><div class="eqhead"><h4 class="eqh" id="model-equation-title-${e.n}">${esc(e.h)}</h4><span class="eqn" aria-label="公式 ${e.n}">(${e.n})</span></div><div class="eqf" role="region" aria-label="公式 ${e.n}：${esc(e.h)}">${(e.parts||[e.mml]).map(svg=>`<div class="eqline">${svg}</div>`).join('')}</div><p class="eq-scroll-hint" hidden>↔ 左右滑動或使用方向鍵，查看完整公式</p><p class="eqdesc">${esc(e.p)}</p></article>`;
  const B=S.B,J=S.J,F=selfish(),money=can('money');
  const tasks=T.map(t=>row([`<b>${esc(t.reg)}</b> ${esc(t.name)}`,t.cls==='R'?num(t.mu,2):'—',t.cls==='R'?num(t.sig,2):'—',num(t.f0,3),num(t.k,4),t.cls==='R'?'—':num(t.r,2),num(t.v,0),num(t.dur,0),`${num(t.mh.B1,0)} / ${num(t.mh.B2,0)}`,`<span class="muted small">${esc(PLAIN(t.basis||''))}</span>`]));
  const caps=Object.entries(P.stations).map(([st,c])=>row([CITY[st]||st,num(c.bays,0),num(c.B1,0),num(c.B2,0),num(c.stand,0),num(c.wash,0),`${num(P.labour[st].B1,0)} / ${num(P.labour[st].B2,0)}`,num(P.hangarFee[st],0)]));
  const pools=Object.entries(P.pools).map(([id,p])=>row([esc(PLAIN(p.label)),Object.entries(p.stock).map(([s,n])=>`${CITY[s]||s} ${n}`).join('、')||'—',p.arrivals.map(a=>`第 ${a.day} 天 · ${CITY[a.station]||a.station} · ${a.qty} 件`).join('<br>')||'—',p.lease?`HK$${fmt(p.lease.cost)} · ${p.lease.lead} 天`:'—',p.transfer?`HK$${fmt(p.transfer.cost)} · ${p.transfer.lead} 天`:'—']));
  host.innerHTML=`
  <div class="card model-intro">
    <p class="eyebrow">方法</p><h2>三步得出全機隊最劃算的計劃</h2>
    <div class="model-flow">
      <div><small>① 預測</small><b>剩餘壽命與退化耗油</b><span>${ALGO.rulShort}</span></div>
      <div><small>② 單項時機</small><b>等待的代價曲線</b><span>五項成本逐日疊加，找出最佳區間與風險截止日</span></div>
      <div><small>③ 機隊聯合決策</small><b>日期 × 站點 × 備件</b><span>${ALGO.solver}</span></div>
    </div>
    <div class="model-status"><span>${J.viol.length===0?'全部資源限制滿足':'有 '+J.viol.length+' 處衝突'}</span><span>排程視窗 ${P.horizon} 天</span><span>評估期 ${P.evalDays} 天</span><span>安全上限 ${pct(P.riskCap,0)}</span><span>${T.length} 項工作 · ${planAircraft().length} 架飛機</span></div>
  </div>
  <div class="card" id="mdJointCmp"><div class="ch"><h2>三種排法，一年的總成本</h2><span class="muted small">每 14 天一期 × ${PER} 期</span></div><div id="mjBar"></div><div class="jcs" id="mjJoint"></div>
    <h3>香港每日資源佔用</h3><div class="rg" id="mjRes"></div><p class="note">紅色＝超過上限。逐項各自挑最便宜的日子，會同一天搶同一套清洗設備、機庫位和備用發動機；聯合決策在全部限制下求最低總成本。</p></div>
  <div class="card"><div class="ch"><h2>數學模型</h2><span class="muted small">${MODEL9.secs.reduce((s,x)=>s+x.eqs.length,0)} 條公式 · 編號連續 · 所有符號見下表</span></div>
    ${MODEL9.secs.map(sc=>`<section class="eqs"><h3 class="eqsec"><span>${sc.c}</span>${esc(sc.t)}</h3>${sc.eqs.map(eq).join('')}</section>`).join('')}</div>
  <div class="card"><div class="ch"><h2>符號與參數表</h2><button class="btn sm" id="mpReset" hidden>恢復預設</button></div>
    <p class="muted small" style="margin-bottom:12px">公式中出現的每一個符號都列在此表。${can('approve')?'有數值的參數可直接修改，整個計劃即時重算。':''}</p>
    ${tbl(['符號','含義','目前數值','單位','依據'],[mdSymRows()],'symtab')}</div>
  <details class="card model-details"><summary>本期工作的參數 <span>${T.length} 項 · μ、σ、f₀、λ、r、v、u、h</span></summary><div class="model-details-body">
    ${tbl(['工作','μ（天）','σ（天）','f₀（噸／天）','λ（噸／天²）','r','v（HK$／天）','u（小時）','h：B1 / B2（小時）','依據'],tasks)}</div></details>
  <details class="card model-details"><summary>共用資源與備件 <span>站點容量、工時費率、備件池</span></summary><div class="model-details-body">
    <h3>站點每日容量</h3>${tbl(['站點','機庫位','B1（小時）','B2（小時）','發動機架','清洗設備','費率 B1 / B2（HK$／小時）','機庫費（HK$）'],caps)}
    <h3>備件池</h3>${tbl(['備件','在站庫存','返修到貨','短期租用 · 交付期','跨站調撥 · 交付期'],pools)}</div></details>`;
  // 三種排法
  jointCards('mjJoint'); resGrid('mjRes');
  chart('mjBar',{chart:{type:'column',height:300},xAxis:{categories:['現行做法','逐項最優（不可行）','聯合決策'],labels:{rotation:0}},yAxis:{maxPadding:0.18,title:{text:null},labels:{formatter(){return money?'HK$'+(this.value/1e6).toFixed(0)+'M':'';}}},legend:{enabled:false},
    tooltip:{pointFormatter(){return money?'每年 <b>'+HK(this.y)+'</b>':'';}},plotOptions:{column:{borderWidth:0,borderRadius:6,maxPointWidth:64,dataLabels:{enabled:money,formatter(){return HK(this.y);},style:{fontSize:'13px',fontWeight:'600',textOutline:'none'}}}},
    series:[{data:[{y:B.total*PER,color:'#c7ced1'},{y:F.total*PER,color:'#f2b8ba'},{y:J.total*PER,color:'#006564'}]}]});
  // 參數編輯
  qa('#mdJoint .symtab input').forEach(i=>i.onchange=()=>{const v=+i.value; if(!isFinite(v)) return; S.over[i.dataset.p]=v; $('busy').classList.add('on'); setTimeout(()=>{solve(); $('busy').classList.remove('on'); toast('已按新參數重新計算'); renderModel();},30);});
  const r=$('mpReset'); if(r){r.hidden=!Object.keys(S.over).length; r.onclick=()=>{S.over={}; solve(); renderModel(); toast('已恢復預設參數');};}
  if(MD.tab==='joint'){MD.tab=null; setTimeout(()=>{const e=$('mdJointCmp'); if(e&&e.scrollIntoView) e.scrollIntoView({behavior:A11Y.rm?'auto':'smooth',block:'start'});},40);}
  renderRul();
  observeModelMath(host);
}

function renderParams(){
  const ed=can('approve');
  $('mpTab').innerHTML=`<table><thead><tr><th>參數</th><th class="n">數值</th><th>單位</th><th>依據</th></tr></thead><tbody>`+X.PARAM_META.map(m=>{const v=X.getPath(P,m[0]);
    return `<tr><td><b>${esc(PLAIN(m[2]))}</b></td><td class="n">${ed&&m[5][0]!==m[5][1]?`<input type="number" data-p="${m[0]}" value="${v}" step="any" aria-label="${esc(PLAIN(m[2]))}">`:fmt(v,v<1?2:0)}</td><td class="muted">${esc(PLAIN(m[3]).replace('h','小時'))}</td><td class="muted small">${esc(PLAIN(m[6]))}</td></tr>`;}).join('')+'</tbody></table>';
  qa('#mpTab input').forEach(i=>i.onchange=()=>{const v=+i.value; if(!isFinite(v)) return; S.over[i.dataset.p]=v; $('busy').classList.add('on'); setTimeout(()=>{solve(); $('busy').classList.remove('on'); toast('已按新參數重新計算'); renderModel();},30); audit('修改參數',i.dataset.p+' = '+v);});
  const r=$('mpReset'); if(r){r.hidden=!Object.keys(S.over).length; r.onclick=()=>{S.over={}; solve(); renderModel(); toast('已恢復預設參數');};}
  $('mtTab').innerHTML=`<table><thead><tr><th>工作</th><th>飛機</th><th class="n">${'剩餘壽命／每天多耗油'}</th><th class="n">恢復比例</th><th class="n">停場時長</th><th class="n">工時</th><th>依據</th></tr></thead><tbody>`+T.map(t=>`<tr><td><b>${esc(t.name)}</b></td><td>${t.reg} · ${t.type}</td><td class="n">${t.cls==='R'?t.mu.toFixed(1)+' ± '+t.sig.toFixed(1)+' 天':t.f0.toFixed(2)+' 噸／天'}</td><td class="n">${t.cls==='R'?'—':(t.r*100).toFixed(0)+'%'}</td><td class="n">${t.dur} 小時</td><td class="n">${t.mh.B1+t.mh.B2}</td><td class="muted small">${esc(PLAIN(t.basis||''))}</td></tr>`).join('')+'</tbody></table>';
}

// ================= 排程 =================
function renderPlan(){
  const B=S.B,J=S.J, days=14, rows=T.slice().sort((a,b)=>(a.cls===b.cls?0:a.cls==='R'?-1:1)||a.id.localeCompare(b.id,'en',{numeric:true}));
  $('scnSeg').innerHTML=SCN.map(x=>`<button class="${x.k===S.scen?'on':''}" data-s="${x.k}" title="${esc(x.d)}">${x.n}</button>`).join('');
  qa('#scnSeg button').forEach(b=>b.onclick=()=>{S.scen=b.dataset.s; $('busy').classList.add('on'); setTimeout(()=>{solve(); $('busy').classList.remove('on'); renderAll(); toast('已按「'+SCN.find(x=>x.k===S.scen).n+'」重新計算');},30);});
  $('scnNote').textContent=SCN.find(x=>x.k===S.scen).d;
  const X_=d=>Math.min(days+1,d)/(days+1)*100;
  const head=Array.from({length:days},(_,i)=>`<span style="left:${X_(i+1)}%">${i+1}</span>`).join('')+`<span class="df" style="left:${X_(days+1)}%">定檢</span>`;
  const bar=(o,cls)=>{if(!o) return ''; const d=o.w.kind==='defer'?days+0.7:o.w.d; return `<i class="${cls} k-${o.w.kind}" style="left:calc(${X_(d)}% - 9px)" title="${esc(winTxt(o)+' · '+winSub(o))}"></i>`;};
  $('gantt').innerHTML=`<div class="gh"><div></div><div class="gx">${head}</div></div>`+rows.map(t=>{const j=J.plan[t.id],b=B.plan[t.id],lv=level(t,j);
    const moved=b&&j&&(b.w.d!==j.w.d||b.w.kind!==j.w.kind);
    return `<button class="gr ${t.id===S.sel?'on':''}" data-id="${t.id}"><div class="gl"><span class="tg" style="--c:${LV_COL[lv]}"></span><b>${t.reg}</b><span>${esc(t.name)}</span></div>
      <div class="gx">${moved&&b&&j?`<s class="ln" style="left:${Math.min(X_(b.w.kind==='defer'?days+.7:b.w.d),X_(j.w.kind==='defer'?days+.7:j.w.d))}%;width:${Math.abs(X_(b.w.kind==='defer'?days+.7:b.w.d)-X_(j.w.kind==='defer'?days+.7:j.w.d))}%"></s>`:''}${bar(b,'b')}${bar(j,'j '+(t.cls==='R'?'r':'p'))}</div></button>`;}).join('');
  qa('#gantt .gr').forEach(r=>r.onclick=()=>{S.sel=r.dataset.id;renderPlan();});
  renderDetail(); renderRoll();
}
function whyText(t,j,b,c){
  const s=[];
  if(t.cls==='R'){
    s.push(`發動機剩餘使用壽命預測約 ${t.mu.toFixed(1)} 天（90% 區間 ${Math.max(0,t.mu-1.645*t.sig).toFixed(1)}–${(t.mu+1.645*t.sig).toFixed(1)} 天）。`);
    if(isFinite(c.sRisk)) s.push(`若晚於${Dd(c.sRisk)}，失效概率會超過 ${pct(P.riskCap,0)} 的安全上限。`);
    s.push(`安排在${winTxt(j)}，${winSub(j)}，執行時失效概率 ${pct(j.pf)}。`);
    if(t.pool) s.push(`備用發動機來源：${MODE[j.m]}。`);
  }else{
    s.push(`這項問題每天多耗油約 ${t.f0.toFixed(2)} 噸，修好後可恢復約 ${(t.r*100).toFixed(0)}%。`);
    s.push(j.w.kind==='defer'?'本期沒有足夠的停場時間或機庫位，延至下次定檢處理。':`安排在${winTxt(j)}，${winSub(j)}，比等到定檢少燒 ${fmt((b?b.fuelT:0)-j.fuelT,1)} 噸燃油。`);
  }
  if(b&&(b.w.id!==j.w.id||b.m!==j.m)) s.push(`現行做法會排在${winTxt(b)}${t.pool&&b.m!==j.m?`、備件用${MODE[b.m]}`:''}；改期是為了讓整個機隊共用的資源用得更好。`);
  return s;
}
function renderDetail(){
  const t=byId(S.sel)||T[0], j=S.J.plan[t.id], b=S.B.plan[t.id], c=curveOf(t), ph=phasesOf(c);
  const lv=level(t,j);
  $('dTitle').innerHTML=`<span class="tg" style="--c:${LV_COL[lv]}"></span>${t.reg} · ${esc(t.name)}`;
  $('dSub').textContent=`${t.type} · ${t.cls==='R'?'可靠性工作':'性能恢復工作'}`;
  $('dWhy').innerHTML=whyText(t,j,b,c).map(x=>`<p>${esc(x)}</p>`).join('');
  $('dFacts').innerHTML=[['安排',winTxt(j)],['停場類型',winSub(j)],[t.cls==='R'?'執行時失效概率':'每天多耗油',t.cls==='R'?pct(j.pf):t.f0.toFixed(2)+' 噸'],['備件',t.pool?MODE[j.m]:'不需要']].concat(can('money')?[['此項成本',HK(j.base)]]:[]).map(([k,v])=>`<div><small>${k}</small><b>${v}</b></div>`).join('');
  renderWaiting(t,'dCurve','dPhase');
  const opts=(JM.optionsFor(t,W,{...P,lock:{},exclude:{}})).sort((a,b2)=>a.base-b2.base).slice(0,5);
  $('dOpts').innerHTML=`<table><thead><tr><th>選項</th><th>停場</th>${t.pool?'<th>備件</th>':''}<th class="n">${t.cls==='R'?'失效概率':'多耗油（噸）'}</th>${can('money')?'<th class="n">成本</th>':''}</tr></thead><tbody>`+opts.map(o=>`<tr class="${o.key===j.key?'on':''}"><td>${winTxt(o)}</td><td>${winSub(o)}</td>${t.pool?`<td>${MODE[o.m]}</td>`:''}<td class="n">${t.cls==='R'?pct(o.pf):fmt(o.fuelT,1)}</td>${can('money')?`<td class="n">${HK(o.base)}</td>`:''}</tr>`).join('')+'</tbody></table>';
  $('dTwin').onclick=()=>{TW.reg=t.reg; TW.level='ac'; TW.part=null; TW.sub=null; const m=twMap(t)[0]; TW.selPart=m.p; showView('twin');};
}

// ================= 工作包 =================
function steps(t){
  if(t.tool==='stand') return ['確認備用發動機已到站，核對隨件適航文件','準備發動機架、吊具與機庫位','拆下舊發動機（按維修手冊程序）','安裝備用發動機，連接管路、電纜與引氣','試車並檢查漏油','完成技術記錄，由持證工程師簽署放行'];
  if(t.mel) return ['核對保留故障編號與期限','斷電並上鎖掛牌','更換起動發電機','起動輔助動力裝置並做負載測試','關閉保留故障並簽署'];
  if(t.lever==='engine') return ['核對清洗設備與清洗液批次','確認發動機已冷卻','執行核心清洗','乾轉與試車','記錄清洗前後排氣溫度與油耗'];
  if(t.lever==='bleed') return ['找出引氣管路漏氣位置','更換墊片或卡箍','管路壓力測試','記錄修復前後數據'];
  return ['量度間隙並拍照記錄','調整或更換密封件','複查間隙','記錄修復前後巡航油耗'];
}

// ================= 工作包（v11：一線工程師視角；接收 → 開始 → 完成，可退回或提出異議） =================
const WP_ST={new:['待接收','#86868b'],accepted:['已接收','#0a6ccf'],started:['進行中','#ef8a2c'],done:['已完成','#34a26b'],returned:['已退回','#e5484d'],disputed:['已提出異議','#9a5ad0']};
const RET_REASONS=['備件未到或不符','停場時間不夠','工具或設備不可用','人手不足','發現額外缺陷，需要擴大範圍','安全疑慮','其他'];
const DIS_REASONS=['建議提早處理（現場狀況比預測差）','建議延後（現場狀況比預測好）','建議改到其他站點或停場','工作內容與實際不符','其他'];
const WPF={f:'open'};
function wp(id){const r=LG.rec['wp_'+id]; if(r) return r; if(LG.rec['ex_'+id]) return {st:'done',ts:LG.rec['ex_'+id].ts,chk:[]}; return {st:'new',chk:[]};}
function wpSet(id,patch,act){const r={...wp(id),...patch,upd:NOW_HK(),by:roleName()}; LG.rec['wp_'+id]=r; if(patch.st==='done') LG.rec['ex_'+id]={ts:r.upd,role:roleName()}; persist(); if(act) audit(act,id+' '+(byId(id)||{}).reg);}
function wpTools(t){const a=[]; if(t.tool==='stand') a.push('發動機架','吊具'); if(t.tool==='wash') a.push('發動機清洗設備'); if(t.hangar) a.push('機庫位'); if(t.mel) a.push('外接電源與地面空調'); if(t.lever==='bleed') a.push('管路壓力測試儀'); if(t.lever==='airframe') a.push('間隙量規','相機'); return a.length?a:['常規工具'];}
function wpSafety(t){if(t.tool==='stand') return '吊裝期間清場；試車前確認進氣道與排氣區無人。';
  if(t.mel) return '工作前斷電並上鎖掛牌；完成後才關閉保留故障。'; if(t.lever==='engine') return '發動機須充分冷卻；清洗液按批次記錄。';
  if(t.lever==='bleed') return '確認引氣系統已釋壓。'; return '使用工作平台時佩戴防墜裝備。';}
function wpSpare(t,o){if(!t.pool) return '不需要'; const pl=P.pools[t.pool];
  if(o.m==='stock') return `在站庫存 · 已預留`; if(o.m==='lease') return `短期租用 · 約第 ${pl.lease.lead} 天到`; if(o.m==='transfer') return `跨站調撥 · 約 ${pl.transfer.lead} 天到`; return MODE[o.m]||'—';}
function wpList(){return T.map(t=>({t,o:S.J.plan[t.id],r:wp(t.id)})).filter(x=>x.o).sort((a,b)=>(a.o.w.kind==='defer'?99:a.o.w.d)-(b.o.w.kind==='defer'?99:b.o.w.d)||level(b.t,b.o)-level(a.t,a.o));}
function renderLine(){
  const all=wpList(), cnt=k=>all.filter(x=>k==='open'?['new','accepted','started'].includes(x.r.st):x.r.st===k).length;
  const soon=all.filter(x=>x.o.w.kind!=='defer'&&x.o.w.d<=2&&['new','accepted','started'].includes(x.r.st)).length;
  $('lineSum').innerHTML=[['未來 48 小時',soon,'項待做'],['進行中',cnt('started'),'項'],['已完成',cnt('done'),'項'],['已退回／異議',cnt('returned')+cnt('disputed'),'項']].map(([a,b,c],i)=>`<div class="ls ${i===0?'hl':''}"><small>${a}</small><b>${b}</b><span>${c}</span></div>`).join('');
  const F=[['open','待處理'],['all','全部'],['done','已完成'],['back','已退回／異議']];
  $('lineSeg').innerHTML=F.map(([k,n])=>`<button class="${WPF.f===k?'on':''}" data-f="${k}">${n}</button>`).join('');
  qa('#lineSeg button').forEach(b=>b.onclick=()=>{WPF.f=b.dataset.f; renderLine();});
  const L=all.filter(x=>WPF.f==='all'||(WPF.f==='open'?['new','accepted','started'].includes(x.r.st):WPF.f==='done'?x.r.st==='done':['returned','disputed'].includes(x.r.st)));
  if(!S.lineSel||!L.find(x=>x.t.id===S.lineSel)) S.lineSel=(L[0]||all[0]).t.id;
  const groups={}; L.forEach(x=>{const k=x.o.w.kind==='defer'?'下次定檢':x.o.w.d<=1?'第 1 天 · 今晚':'第 '+x.o.w.d+' 天'; (groups[k]=groups[k]||[]).push(x);});
  $('lineList').innerHTML=(L.length?Object.entries(groups).map(([g,xs])=>`<div class="lg"><span>${g}</span><em>${xs.length}</em></div>`+xs.map(x=>{const [sn,sc]=WP_ST[x.r.st];
    return `<button class="li ${x.t.id===S.lineSel?'on':''}" data-id="${x.t.id}"><span class="tg" style="--c:${LV_COL[level(x.t,x.o)]}"></span><div><b>${x.t.reg} · ${esc(x.t.name)}</b><small>${CITY[x.o.w.st]||''} · ${winSub(x.o)}</small></div><em class="wst" style="--c:${sc}">${sn}</em></button>`;}).join('')).join(''):'<p class="muted small" style="padding:16px">沒有符合條件的工作。</p>');
  qa('#lineList .li').forEach(b=>b.onclick=()=>{S.lineSel=b.dataset.id;renderLine();});
  const t=byId(S.lineSel), o=S.J.plan[t.id], r=wp(t.id), lv=level(t,o), st=steps(t), chk=(r.chk||[]).slice(0,st.length), nDone=chk.filter(Boolean).length, [sn,sc]=WP_ST[r.st];
  const why=whyText(t,o,S.B.plan[t.id],curveOf(t))[t.cls==='R'?1:0]||'';
  const canChk=r.st==='started', allDone=nDone===st.length;
  let acts='';
  if(r.st==='new') acts=`<button class="btn pri big" data-a="accept">接收工作</button><button class="btn" data-a="dispute">提出異議</button><button class="btn danger" data-a="return">退回</button>`;
  else if(r.st==='accepted') acts=`<button class="btn pri big" data-a="start">開始工作</button><button class="btn" data-a="dispute">提出異議</button><button class="btn danger" data-a="return">退回</button>`;
  else if(r.st==='started') acts=`<button class="btn pri big" data-a="done" ${allDone?'':'disabled'}>${allDone?'完成並簽署':'完成全部步驟後可簽署（'+nDone+'／'+st.length+'）'}</button><button class="btn danger" data-a="return">無法完成，退回</button>`;
  else if(r.st==='done') acts=`<span class="ok-badge">✓ ${esc(r.upd||r.ts||'')} 已簽署完成</span><button class="btn" data-a="undo">撤回完成</button>`;
  else acts=`<span class="back-badge" style="--c:${sc}">${sn}：${esc(r.reason||'')}${r.note?'。'+esc(r.note):''}</span><button class="btn" data-a="reopen">撤回，重新接收</button>`;
  $('lineCard').innerHTML=`<div class="lc-h"><div><p class="eyebrow" style="color:${LV_COL[lv]}">${LV_TXT[lv]}</p><h2>${t.reg} · ${esc(t.name)}</h2><p class="muted">${t.type}${t.unit?' · 測試發動機 #'+t.unit:''}</p></div><em class="wst lg" style="--c:${sc}">${sn}</em></div>
    ${['returned','disputed'].includes(r.st)?`<div class="lc-msg">已通知維修計劃。對方重新排程後，此工作會以新日期出現。</div>`:''}
    <div class="facts lc-facts">${[['時間',winTxt(o)],['停場',`${winSub(o)}${o.w.g?' · '+o.w.g+' 小時':''}`],['預計工時',`B1 ${t.mh.B1} · B2 ${t.mh.B2} 小時`],['備件',wpSpare(t,o)],['工具與設備',wpTools(t).join('、')],[t.cls==='R'?'執行時失效概率':'每天多耗油',t.cls==='R'?pct(o.pf):t.f0.toFixed(2)+' 噸']].map(([k,v])=>`<div><small>${k}</small><b>${v}</b></div>`).join('')}</div>
    <div class="lc-grid">${why?`<div class="lc-why"><b>為甚麼安排在這天</b><p>${esc(why)}</p></div>`:''}<div class="lc-safe"><b>安全提示</b><p>${esc(wpSafety(t))}</p></div></div>
    <div class="lc-steps"><div class="lc-steps-h"><h3>步驟</h3><span>${nDone}／${st.length}</span></div><div class="lc-bar"><i style="width:${st.length?nDone/st.length*100:0}%"></i></div>
    <ol class="chk">${st.map((s,i)=>`<li><label class="${canChk?'':'off'}"><input type="checkbox" data-i="${i}" ${chk[i]?'checked':''} ${canChk?'':'disabled'}><span>${esc(s)}</span></label></li>`).join('')}</ol>
    ${!canChk&&r.st!=='done'?'<p class="muted small lc-hint">開始工作後可逐步勾選。</p>':''}</div>
    <p class="note">步驟為示範內容。實際工作以核准的維修手冊為準，由持證工程師簽署放行。</p>
    <div class="lc-acts"><div class="lc-main">${acts}</div><button class="btn ghost" id="btnTw">在數字孿生中查看 →</button></div>`;
  qa('#lineCard .chk input').forEach(c=>c.onchange=()=>{const a=(wp(t.id).chk||[]).slice(); a[+c.dataset.i]=c.checked; wpSet(t.id,{chk:a}); renderLine();});
  qa('#lineCard [data-a]').forEach(b=>b.onclick=()=>{const a=b.dataset.a;
    if(a==='accept'){wpSet(t.id,{st:'accepted'},'接收工作'); toast('已接收');}
    else if(a==='start'){wpSet(t.id,{st:'started'},'開始工作'); toast('已開始，請逐步勾選');}
    else if(a==='done'){wpSet(t.id,{st:'done'},'完成並簽署'); toast('已完成並簽署');}
    else if(a==='undo'||a==='reopen'){wpSet(t.id,{st:'accepted',reason:'',note:''},a==='undo'?'撤回完成':'撤回退回'); delete LG.rec['ex_'+t.id]; persist(); toast('已撤回');}
    else if(a==='return'||a==='dispute') return wpDialog(t,o,a);
    renderLine();});
  $('btnTw').onclick=()=>{TW.reg=t.reg; TW.level='ac'; TW.part=null; TW.sub=null; TW.selPart=twMap(t)[0].p; showView('twin');};
}
function wpDialog(t,o,kind){
  const ret=kind==='return', R=ret?RET_REASONS:DIS_REASONS;
  openModal(`<h2>${ret?'退回這項工作':'對安排提出異議'}</h2><p class="muted">${t.reg} · ${esc(t.name)} · ${winTxt(o)}</p>
    <form id="wpForm" class="wpf"><fieldset><legend>${ret?'退回原因':'異議內容'}</legend>${R.map((x,i)=>`<label class="rd"><input type="radio" name="rs" value="${esc(x)}" ${i===0?'checked':''}><span>${esc(x)}</span></label>`).join('')}</fieldset>
    <label class="f"><span>補充說明（選填）</span><textarea id="wpNote" rows="3" maxlength="300" placeholder="例如：備件序號、現場照片編號、建議日期"></textarea></label>
    <div class="acts"><button class="btn ${ret?'danger':'pri'}" type="submit">${ret?'確認退回':'送出異議'}</button><button class="btn" type="button" id="wpCancel">取消</button></div>
    <p class="note">送出後會通知維修計劃人員，並記錄在審計紀錄。</p></form>`);
  $('wpCancel').onclick=()=>$('modal').classList.remove('on');
  $('wpForm').onsubmit=e=>{e.preventDefault(); const v=(qa('#wpForm input[name=rs]').find(x=>x.checked)||{}).value||''; const note=$('wpNote').value.trim().slice(0,300);
    wpSet(t.id,{st:ret?'returned':'disputed',reason:v,note,key:o.key},ret?'退回工作':'提出異議'); $('modal').classList.remove('on'); toast(ret?'已退回，已通知維修計劃':'已送出異議'); renderLine();};
}
// 維修計劃端：工程師回饋
function feedbackList(){return T.map(t=>({t,r:LG.rec['wp_'+t.id]})).filter(x=>x.r&&['returned','disputed'].includes(x.r.st));}
function renderFeedback(){
  const box=$('ovFb'); if(!box) return; const L=feedbackList();
  box.hidden=!L.length||!can('approve'); if(box.hidden) return;
  box.innerHTML=`<div class="ch"><div><p class="eyebrow" style="color:#e5484d">工程師回饋 · ${L.length} 項</p><h2>需要重新安排</h2></div><button class="btn pri sm" id="fbAll">依回饋重新排程</button></div>`+
    L.map(x=>{const [sn,sc]=WP_ST[x.r.st];return `<div class="fb"><em class="wst" style="--c:${sc}">${sn}</em><div><b>${x.t.reg} · ${esc(x.t.name)}</b><small>${esc(x.r.reason||'')}${x.r.note?' · '+esc(x.r.note):''} · ${esc(x.r.upd||'')}</small></div><button class="btn sm" data-id="${x.t.id}">標記已處理</button></div>`;}).join('');
  qa('#ovFb .fb button').forEach(b=>b.onclick=()=>{wpSet(b.dataset.id,{st:'new',reason:'',note:''},'處理回饋'); renderOverview();});
  $('fbAll').onclick=()=>{L.forEach(x=>{if(x.r.st==='returned'&&x.r.key) S.excl[x.r.key]=true; wpSet(x.t.id,{st:'new',reason:'',note:'',chk:[]},'依回饋重新排程');});
    $('busy').classList.add('on'); setTimeout(()=>{solve(); $('busy').classList.remove('on'); toast('已重新排程：退回的時段不再使用'); renderOverview();},30);};
}


// ================= 減碳 =================
let CARB=null;
let CARBON_REALIZATION=1;
// 2025 Sustainability Report, p.148: Group RTK includes HK Express and Air Hong Kong.
// Use this denominator for the Group target, not the Company's 20,461m RTK.
const CARBON_GROUP_RTK=22266e6;
function carbonCalc(){
  if(CARB) return CARB;
  const P0=JM.defaultParams(), Bb=JM.solveBaseline(T,W,{...P0,exclude:{},lock:{}},7), Jb=JM.solveJoint(T,W,{...P0,exclude:{},lock:{}},{tau:7}).best;
  const Pc=SCN.find(x=>x.k==='carbon').f(JM.defaultParams()), Jc=JM.solveJoint(T,W,{...Pc,exclude:{},lock:{}},{tau:7}).best;
  const expectedCost=x=>x.total-x.comps.carbon;
  const dStd=Bb.co2-Jb.co2, dC=Bb.co2-Jc.co2;
  // Original demo assumptions: these are not Cathay measured outcomes or verified literature values.
  const LEV=[{n:'發動機清洗時機',ev:4,pen:0.010,r:0.6,dd:20},{n:'機身氣動劣化',ev:1,pen:0.0045,r:0.9,dd:60},{n:'引氣與空調漏氣',ev:0.5,pen:0.006,r:0.9,dd:25},{n:'發動機模組性能恢復',ev:0.2,pen:0.02,r:0.5,dd:30}];
  const lev=LEV.map(l=>({...l,fuel:FLEET*l.ev*l.pen*CX.fuelAcDay*l.r*l.dd}));
  const levFuel=lev.reduce((s,x)=>s+x.fuel,0), levCO2=levFuel*P0.co2PerFuel;
  return CARB={scen:'base-comparison',Bb,Jb,Jc,dStd,dC,yStd:dStd*PER,yC:dC*PER,
    dCash:expectedCost(Jc)-expectedCost(Jb),baseCost:expectedCost(Bb),stdCost:expectedCost(Jb),carbonCost:expectedCost(Jc),
    evalDays:P0.evalDays,lev,levFuel,levCO2,groupRtk:CARBON_GROUP_RTK};
}



// ================= 減碳（v13：只講幫國泰完成 2030 目標的多少） =================
// 集團口徑：670 g/RTK 為集團目標，分母用集團 2025 年 RTK 22,266 百萬（2025 可持續發展報告 p.148）。
// 集團燃油按集團與國泰航空 RTK 比例由國泰航空燃油推算（22,266 ÷ 20,461）。
const GRP={rtk:22266e6, scale:22266/20461};
function carbonTiers(){
  const C=carbonCalc(), rr=CARBON_REALIZATION, fuelGrp=CX.fuel*GRP.scale, gi=x=>x*1e6/GRP.rtk, gap=CX.ci25-CX.ci30;
  const mk=(n,d,src,co2,fuel,save)=>({n,d,src,co2,fuel,save:save==null?fuel*CX.fuelPrice:save,g:gi(co2),pct:gi(co2)/gap*100});
  const R=ROLL_PRE.base, rs=Roll.rollSum(R);
  const L1=mk('本期排程，滾動一年',`${fmt(rs.n)} 項工作 · 26 期全年模擬`,'模型計算',rs.co2,rs.fuel,rs.save);
  const L2=mk('推廣到全集團 · 四項保守措施','清洗時機、氣動劣化、引氣漏氣、發動機模組恢復','文獻參數 × 機隊規模',C.levCO2*GRP.scale*rr,C.levFuel*GRP.scale*rr);
  const L3=mk('性能保持 · 機身 1%','回收機身氣動劣化的一半（未妥善維修時阻力 5 年內可升 2%）','Airbus《Getting to Grips with Fuel Economy》',fuelGrp*0.01*3.16*rr,fuelGrp*0.01*rr);
  const L4=mk('性能保持 · 機身＋發動機 2%','再加發動機清洗時機 1%（清洗可降 0.5–1.5% 油耗）','Airbus 手冊、AeroCore 運營數據',fuelGrp*0.02*3.16*rr,fuelGrp*0.02*rr);
  return {C,L:[L1,L2,L3,L4],gi,gap,fuelGrp};
}
function gateStats(){try{const rr=CARBON_REALIZATION; CARBON_REALIZATION=1; CARB=null; const L=carbonTiers().L[3]; CARBON_REALIZATION=rr;
  const e1=$('gs1'),e2=$('gs2'),e3=$('gs3'); if(e1) e1.textContent='HK$'+Math.round(L.save/1e6)+'M'; if(e2) e2.textContent=Math.round(L.co2/1e3)+'K 噸'; if(e3) e3.textContent=L.pct.toFixed(1)+'%';}catch(e){}}
function renderCarbon(){
  const Z=carbonTiers(), {C,L,gap}=Z, [L1,L2,L3,L4]=L, money=can('money'), rest=Math.max(0,gap-L4.g);
  $('cbHead').innerHTML=`<p class="eyebrow">降本減碳 · 國泰 2030 目標</p><h1>幫國泰完成<br>2030 減碳差距的 ${L4.pct>=19.5?'五分之一':L4.pct.toFixed(0)+'%'}。</h1>
    <div class="cb-hero three">
      <div class="hl"><small>完成 2030 剩餘差距</small><b>${L4.pct.toFixed(1)}<i>%</i></b><span>${gap} g 之中的 ${L4.g.toFixed(1)} g CO₂／收入噸公里</span></div>
      <div class="eco"><small>每年減少 CO₂</small><b>${fmt(L4.co2/1000,0)}<i> 千噸</i></b><span>少燒 ${fmt(L4.fuel/1000,0)} 千噸燃油</span></div>
      <div class="cost"><small>每年同時節省燃油</small><b>${money?HK(L4.save):'—'}</b><span>每減 1 噸 CO₂ 反而省 HK$${fmt(CX.fuelPrice/3.16)}</span></div>
    </div>`;
  const W_=g=>Math.max(0,g)/gap*100;
  $('cbBar').innerHTML=`<div class="cb-target-intro"><p>國泰集團要在 2030 年把碳強度由 <b>${CX.ci25}</b> 降到 <b>${CX.ci30}</b> g CO₂／收入噸公里（RTK，Revenue Tonne Kilometre），還差 <b>${gap} g</b>。</p>
      <label class="cb-realization" for="cbRealization">推廣落實比例<select id="cbRealization">${[[1,'100%'],[0.75,'75%'],[0.5,'50%']].map(([v,n])=>`<option value="${v}" ${CARBON_REALIZATION===v?'selected':''}>${n}</option>`).join('')}</select></label></div>
    <div class="gap2">
      <div class="g2-scale"><span>${CX.ci25} g · 2025 年</span><span>${CX.ci30} g · 2030 年目標</span></div>
      <div class="g2-bar">${[['s1',L1.g],['s2',L2.g-L1.g],['s3',L3.g-L2.g],['s4',L4.g-L3.g]].map(([c,g])=>`<i class="${c}" style="width:${W_(g)}%"></i>`).join('')}<i class="rest" style="width:${W_(rest)}%"><span>其他措施 ${rest.toFixed(1)} g</span></i>
        <em class="g2-flag" style="left:${W_(L4.g)}%"><b>${L4.pct.toFixed(1)}%</b><small>本方案</small></em></div>
      <div class="gb-key">${[['s1','① 本期排程'],['s2','② 全集團推廣'],['s3','③ 機身性能保持'],['s4','④ 加上發動機性能保持'],['rest','新飛機、營運改善等']].map(([c,n])=>`<span><i class="${c}"></i>${n}</span>`).join('')}</div>
    </div>
    <p class="note">換算：減排噸數 × 10⁶ ÷ 集團 RTK 22,266 百萬。①為模型計算；②–④為逐級擴大的推廣情景，後一級已包含前一級，不能相加。燃油節省未扣除額外維修與設備成本；②–④須以試點實測驗證。</p>`;
  $('cbRealization').onchange=e=>{const v=Number(e.target.value); if([1,0.75,0.5].includes(v)){CARBON_REALIZATION=v; renderCarbon();}};
  $('cbTiers').innerHTML=`<div class="ladder"><div class="ld-h"><span>級別</span><span>每年減 CO₂</span><span>碳強度</span><span>完成 2030 差距</span><span>每年節省</span></div>`+L.map((x,i)=>`<div class="ld-r ${i===3?'hi':''}"><div class="ld-n"><em class="s${i+1}">${i+1}</em><div><b>${esc(x.n)}</b><small>${esc(x.d)} · ${esc(x.src)}</small></div></div><span class="v">${fmt(x.co2/1000,1)}<small> 千噸</small></span><span>−${x.g.toFixed(2)} g</span><span class="p"><i style="width:${Math.min(100,x.pct*4)}%"></i><b>${x.pct.toFixed(1)}%</b></span><span>${money?HK(x.save):'—'}</span></div>`).join('')+`</div>`;
  const ps=T.filter(t=>t.cls==='P');
  chart('cbChart',{chart:{type:'bar',height:Math.max(420,ps.length*36),spacing:[16,24,20,12]},xAxis:{categories:ps.map(t=>t.reg+' · '+t.name.replace('（雙發）','')),labels:{style:{fontSize:'12px'}}},yAxis:{min:0,title:{text:'60 天額外 CO₂（噸）'}},
    tooltip:{shared:true,valueDecimals:1,valueSuffix:' 噸'},legend:{align:'left',verticalAlign:'top'},plotOptions:{bar:{borderWidth:0,borderRadius:3,groupPadding:0.16,pointPadding:0.05}},
    series:[{name:'現行做法',data:ps.map(t=>C.Bb.plan[t.id]?.co2||0),color:'#c4d3d1'},{name:'聯合排程',data:ps.map(t=>C.Jb.plan[t.id]?.co2||0),color:'#6fb3a5'},{name:'減碳優先',data:ps.map(t=>C.Jc.plan[t.id]?.co2||0),color:'#006564'}]});
  $('cbAct').innerHTML=`<p>減碳優先：內部碳價 US$250／噸，並增加一套清洗設備。本期同一批工作再多減 <b>${fmt(C.Jb.co2-C.Jc.co2,0)} 噸</b> CO₂${money?`，預期成本${C.dCash<=0?'再省':'增加'} <b>${HK(Math.abs(C.dCash))}</b>（未計設備購置）`:''}。</p><button type="button" class="btn pri" id="cbApplyPlan">套用減碳優先排程</button>`;
  $('cbApplyPlan').onclick=()=>{S.scen='carbon';S.over={};solve();showView('plan');toast('已載入減碳優先情景');};
  $('cbEq').innerHTML=[['① 試點','量度實際節油','清洗、漏氣修復、氣動恢復做前後比較，控制航段、載重與天氣。'],['② 接入工作包','把建議變成行動','維修記錄連到燃油結果；未執行的原因回饋到排程。'],['③ 全集團推廣','逐級擴大到 ④','以試點數據校準參數，再推廣到全部機型。']].map(([x,y,z])=>`<div><small>${x}</small><b>${y}</b><span>${z}</span></div>`).join('');
}


// ================= 模型 =================
function renderRul(){
  const c=CMAPSS.model_card;
  $('mdKpi').innerHTML=[['預測誤差',c.test_rmse_cycles+' 循環','均方根誤差（RMSE，Root Mean Square Error）· 100 台測試發動機 · '+ALGO.rulShort],['90% 區間實際覆蓋',c.picp_90+'%',`臨近失效（剩餘 <30 循環）的 ${c.n_near_failure} 台：${c.picp_90_near_failure}%`],['區間平均寬度',c.mean_width_cycles+' 循環','剩餘 30 循環以內時約 ±'+c.halfwidth_by_bin['0-29']+' 循環'],['NASA 評分',c.nasa_score,'越低越好；預測過晚的懲罰較重']].map(([l,v,s])=>`<div class="kpi"><span>${l}</span><b>${v}</b><small>${s}</small></div>`).join('');
  const sc=c.scatter;
  chart('mdScatter',{chart:{height:380},xAxis:{min:0,max:150,tickInterval:30,title:{text:'實際剩餘壽命（循環）'},gridLineWidth:0},yAxis:{min:0,max:140,title:{text:'預測（循環）'}},legend:{enabled:false},
    tooltip:{formatter(){return `實際 ${this.x} · 預測 ${this.y}`;}},
    series:[{type:'line',data:[[0,0],[140,140]],color:'#d2d7da',dashStyle:'Dash',enableMouseTracking:false,marker:{enabled:false}},
      {type:'errorbar',data:sc.map(r=>[r[0],Math.max(0,r[1]-r[2]),r[1]+r[2]]),color:'#c9d6d3',whiskerLength:0,stemWidth:1},
      {type:'scatter',data:sc.map(r=>[r[0],r[1]]),color:'#006564',marker:{radius:3.5}}]});
  const e=CMAPSS.engines[0], h=e.history;
  chart('mdTrend',{chart:{height:380},xAxis:{title:{text:'距今（循環）'}},yAxis:{min:0,title:{text:'剩餘壽命預測（循環）'}},legend:{enabled:false},tooltip:{shared:true,valueDecimals:1},
    series:[{type:'arearange',name:'90% 區間',data:h.cycle.map((x,i)=>[x,h.lo[i],h.hi[i]]),color:'#006564',fillOpacity:0.12,lineWidth:0,marker:{enabled:false}},
      {type:'line',name:'預測',data:h.cycle.map((x,i)=>[x,h.rul[i]]),color:'#006564',lineWidth:2.2,marker:{enabled:false}}]});
  $('mdTrendT').textContent=`${e.reg}（測試發動機 #${e.unit}）：最新預測 ${e.rul_cycles} 循環（約 ${(e.rul_cycles/e.cpd).toFixed(1)} 天），實際 ${e.true_rul_cycles} 循環`;
  $('mdAlgo').textContent=ALGO.rul;
  $('mdLit').innerHTML=`<table><thead><tr><th>方法（同一數據集 FD001）</th><th class="n">均方根誤差（循環）</th><th class="n">NASA 評分</th></tr></thead><tbody><tr class="on"><td><b>本平台：${ALGO.rul}</b><br><span class="muted small">${ALGO.feat}；15 個網絡（5 折 × 3 個隨機種子）平均</span></td><td class="n">${c.test_rmse_cycles}</td><td class="n">${c.nasa_score}</td></tr>${[['深度卷積神經網絡（DCNN，Deep Convolutional Neural Network），Li 等 2018',12.61,274],['長短期記憶網絡（LSTM，Long Short-Term Memory），Zheng 等 2017',16.14,338],['卷積神經網絡（CNN，Convolutional Neural Network），Babu 等 2016',18.45,1287]].map(([n,v,s])=>`<tr><td>${n}</td><td class="n">${v}</td><td class="n">${s}</td></tr>`).join('')}</tbody></table>`;
}

// ================= 數據來源 =================
const SRC=[
 ['Cathay 80 周年完整品牌標誌','<a href="https://www.cathaypacific.com/cx/en_HK/offers/80yearstogether.html" target="_blank" rel="noopener noreferrer">國泰官網 80 Years Together</a> · 保留官方 SVG 字型、比例及色彩','官方素材'],
 ['品牌使用參考','<a href="https://www.cxagents.com/content/dam/cathay-agents/hk/documents/CX%20Brand%20Guidelines.pdf" target="_blank" rel="noopener noreferrer">Cathay Agents 公開品牌指南</a> · 未能核實最新內部修訂日期；頁面尺寸與留白為介面設計選擇','公開資料'],
 ['機隊 179 架、機型構成','國泰航空 2026 年中期業績公告（截至 2026-06-30）','已核對'],
 ['日利用率 11.3 小時','國泰航空 2025 年報（營運數據）','已核對'],
 ['收入噸公里 20,461 百萬','國泰航空 2025 年報','已核對'],
 ['溫室氣體 15.3 百萬噸 CO₂e → 燃油約 484 萬噸','國泰航空 2025 年報；按每噸燃油 3.16 噸 CO₂ 換算','推算'],
 ['平均油價約 HK$5,930／噸','2025 年燃油成本 HK$287.15 億 ÷ 推算燃油量','推算'],
 ['集團碳強度 746 → 670 g／RTK（2030）；2025 集團 RTK 22,266 百萬','2026 年中期報告第 21 頁；2025 可持續發展報告第 148 頁','已核對'],
 ['可持續航空燃料佔 0.68%，2030 年目標 10%','國泰航空 2025 年報','已核對'],
 ['飛機維修開支 HK$85.08 億（國泰航空）','國泰航空 2025 年報','已核對'],
 ['剩餘壽命數據','美國太空總署發動機退化模擬數據（C-MAPSS，Commercial Modular Aero-Propulsion System Simulation）FD001','公開數據'],
 ['停飛每小時 US$4 萬','Boeing 估算區間 US$1–15 萬','假設'],
 ['四項維修推廣的頻率、油耗恢復比例及提早天數','團隊原 Demo 情景參數，待試點量測與去重校準','假設'],
 ['飛機編號、停場窗口、備件庫存、工時上限','團隊設定','合成數據']
];
const GLOSS=[['剩餘使用壽命','RUL，Remaining Useful Life','部件距離需要更換還有多久'],['停飛','AOG，Aircraft on Ground','飛機因故障不能飛'],['最低設備清單','MEL，Minimum Equipment List','允許某些設備暫時失效下繼續飛行，但有期限'],['輔助動力裝置','APU，Auxiliary Power Unit','機尾的小型發動機，地面供電與供氣'],['可持續航空燃料','SAF，Sustainable Aviation Fuel','以廢油等原料製成，可減少生命週期排放'],['收入噸公里','RTK，Revenue Tonne Kilometre','載運量 × 距離，衡量碳強度的分母'],['A 檢','A-check','約每 2–3 個月一次的例行檢查'],['孔探','Borescope Inspection','用細長鏡頭伸入發動機內部檢查']];
function openModal(h){$('mBody').innerHTML=h;$('modal').classList.add('on');}
function infoSources(){openModal(`<h2>數據來源</h2><table class="src"><thead><tr><th>數據</th><th>來源</th><th>性質</th></tr></thead><tbody>${SRC.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td><td><span class="pill-s s-${r[2]==='已核對'?'ok':r[2]==='合成數據'||r[2]==='假設'?'syn':'mid'}">${r[2]}</span></td></tr>`).join('')}</tbody></table>
  <h2 style="margin-top:28px">為甚麼是 20 架、21 項？</h2><p>國泰航空共有約 398 台發動機。按平均在翼 4–5 年估算，每 14 天約有 3–4 台需要換下，本期安排 3 台。性能類問題按每架每年數次發生估算，14 天內約 15–20 項。例行定檢由現有系統排程，不列入本計劃。</p>`);}
function infoGloss(){openModal(`<h2>名詞說明</h2><table class="src"><tbody>${GLOSS.map(g=>`<tr><td><b>${g[0]}</b></td><td>${g[1]}</td><td>${g[2]}</td></tr>`).join('')}</tbody></table>`);}

// ================= 維修助手 =================
const AI={open:false,busy:false,log:[]};
function aiAns(q){q=(q||'').trim(); const ql=q.toLowerCase(); const m=q.match(/(DEMO-\d+|[RP]\d+)/i); let t=null;
  if(m){const k=m[1].toUpperCase(); t=byId(k)||T.find(x=>x.reg===k)||null;} t=t||byId(S.sel)||T[0];
  const o=S.J.plan[t.id], nd=+((q.match(/(\d+)\s*天/)||[])[1])||3;
  if(/交班|摘要/.test(q)){const L=T.map(x=>({x,o:S.J.plan[x.id]})).filter(y=>y.o.w.kind!=='defer'&&y.o.w.d<=2);
    return `交班摘要（${NOW_HK()}）\n未來 48 小時共 ${L.length} 項：\n`+L.map((y,i)=>`${i+1}. ${y.x.reg} ${y.x.name}｜${winTxt(y.o)}｜${LG.rec['ex_'+y.x.id]?'已完成':'待執行'}`).join('\n')+'\n\n此為草稿，須由當班持證工程師核對後簽署。';}
  if(/延後|延后|推遲|延遲/.test(q)){const d0=o.w.kind!=='defer'?o.w.d:0, s=d0+nd;
    if(t.cls==='R'){const p0=JM.pFail(t,d0,P),p1=JM.pFail(t,s,P); return `${t.reg} ${t.name}：由第 ${d0} 天延後 ${nd} 天\n失效概率 ${pct(p0)} → ${pct(p1)}${p1>P.riskCap?`，超過安全上限 ${pct(P.riskCap,0)}，不建議延後。`:'，仍在安全上限內。'}`;}
    const dF=JM.fuelTonnes(t,s,P)-JM.fuelTonnes(t,d0,P); return `${t.reg} ${t.name}：延後 ${nd} 天\n多燒燃油約 ${fmt(dF,1)} 噸，多排 CO₂ 約 ${fmt(dF*3.16,1)} 噸。`;}
  if(/今晚|今天|48|要做/.test(q)){const L=T.map(x=>({x,o:S.J.plan[x.id]})).filter(y=>y.o.w.kind!=='defer'&&y.o.w.d<=2).sort((a,b)=>a.o.w.d-b.o.w.d);
    return `未來 48 小時共 ${L.length} 項：\n`+L.map(y=>`• ${winTxt(y.o)}｜${y.x.reg} ${y.x.name}`).join('\n');}
  if(/省|成本|價值|訂閱/.test(q)&&can('money')){const Y=annual(); return `全年（${Y.roll?'26 期滾動模擬':'按 26 期估算'}）：現行做法 ${HK(Y.b)}，聯合決策 ${HK(Y.j)}，節省 ${HK(Y.save)}（${pct(Y.pct)}）。CO₂ 每年減少 ${fmt(Y.co2)} 噸。`;}
  return whyText(t,o,S.B.plan[t.id],curveOf(t)).join('\n');}
function aiRender(){const b=$('aiLog'); b.innerHTML=AI.log.map(m=>`<div class="aim ${m.r}"><div class="aib">${esc(m.t).replace(/\n/g,'<br>')}</div></div>`).join(''); b.scrollTop=b.scrollHeight;}
function aiAsk(q){if(AI.busy||!q) return; AI.log.push({r:'me',t:q}); const full=aiAns(q), msg={r:'bot',t:''}; AI.log.push(msg); AI.busy=true; aiRender();
  if(A11Y.rm){msg.t=full;AI.busy=false;aiRender();return;} let i=0; const st=()=>{i=Math.min(full.length,i+8); msg.t=full.slice(0,i); aiRender(); if(i<full.length) setTimeout(st,14); else AI.busy=false;}; setTimeout(st,180);}
function aiToggle(on){AI.open=on==null?!AI.open:on; $('ai').classList.toggle('on',AI.open); $('ai').setAttribute('aria-hidden',AI.open?'false':'true');$('ai').inert=!AI.open;$('btnAI').setAttribute('aria-expanded',AI.open?'true':'false');
  if(AI.open){const t=byId(S.sel)||T[0]; $('aiChips').innerHTML=['未來 48 小時要做甚麼？',`為甚麼 ${t.reg} 這樣排？`,`${t.reg} 延後 3 天會怎樣？`,'生成交班摘要'].map(q=>`<button>${esc(q)}</button>`).join(''); qa('#aiChips button').forEach(b=>b.onclick=()=>aiAsk(b.textContent));
    if(!AI.log.length) AI.log.push({r:'bot',t:'可以問我工作安排、延後的影響，或生成交班摘要。回答根據目前計劃即時計算。'}); aiRender(); setTimeout(()=>{if(AI.open)$('aiIn').focus();},50);}}

// ================= 無障礙 =================
function accessMenu(on,focusFirst){$('a11yMenu').classList.toggle('on',!!on);$('btnA11y').setAttribute('aria-expanded',on?'true':'false');if(on&&focusFirst){const first=qa('#a11yMenu [data-a]')[0];if(first)first.focus();}}
const A11Y=(()=>{try{return JSON.parse(localStorage.getItem('cx_aaas_a11y'))||{};}catch(e){return {};}})();
function applyA11y(){const r=document.documentElement; ['lg','hc','rm'].forEach(k=>r.classList.toggle('a11y-'+k,!!A11Y[k])); try{localStorage.setItem('cx_aaas_a11y',JSON.stringify(A11Y));}catch(e){}
  qa('#a11yMenu [data-a]').forEach(b=>{b.setAttribute('aria-checked',A11Y[b.dataset.a]?'true':'false');});}

// ================= 登入 =================
const GATE={role:'mcc',attempt:0,payment:0,busy:false,returnFocus:null};
const SUB_KEY='cx_aaas_demo_subscription_v1';
let SUB_MEMORY=null;
function readSubscription(){
  let v=SUB_MEMORY;
  try{const raw=localStorage.getItem(SUB_KEY); if(raw) v=JSON.parse(raw);}catch(e){}
  if(!v||v.version!==1||v.demo!==true||v.status!=='active'||v.amount!==8800||v.currency!=='HKD'||
    typeof v.company!=='string'||!v.company.trim()||v.company.length>80||typeof v.contact!=='string'||!v.contact.trim()||v.contact.length>80||
    typeof v.email!=='string'||v.email.length>160||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)||
    !Number.isFinite(v.paidAt)||!Number.isFinite(v.expiresAt)||v.paidAt>Date.now()||v.expiresAt<=v.paidAt) return null;
  return v;
}
function activeSubscription(email){const sub=readSubscription();return sub&&sub.expiresAt>Date.now()&&(!email||sub.email===email.toLowerCase().trim())?sub:null;}
function subscriptionDate(t){return new Date(t).toLocaleDateString('zh-HK',{year:'numeric',month:'short',day:'numeric'});}
function gateCancel(){GATE.attempt++;GATE.busy=false;$('gForm').classList.remove('busy');$('gLogin').disabled=false;$('gUser').disabled=false;$('gPass').disabled=false;}
function gateShow(on){gateCancel();$('gate').classList.toggle('on',on);document.documentElement.classList.toggle('gated',on);
  $('main').inert=on;qa('header.top').forEach(el=>el.inert=on);
  if(on){$('gErr').textContent='';$('gStep').innerHTML='';gateRefresh();setTimeout(()=>{if($('gate').classList.contains('on')&&!$('gSales').classList.contains('on'))$('gUser').focus();},60);}
}
function gateRefresh(){const ext=GATE.role==='external',sub=readSubscription(),active=activeSubscription();
  $('gOffer').hidden=!ext;$('gTitle').textContent=ext?'公司登入':'員工登入';
  $('gIntro').textContent=ext?'訂閱後，以公司電郵登入。':'系統依帳戶自動進入對應工作台。';
  $('gUserLabel').textContent=ext?'公司電郵':'員工帳戶';$('gUser').type=ext?'email':'text';$('gUser').placeholder=ext?'訂閱時使用的公司電郵':'帳戶名稱';
  $('gLogin').textContent=ext?'登入企業工作空間':'員工登入';
  $('gHint').textContent=ext?'訂閱電郵 · 密碼 demo':'維修員工 demo1 · 管理人員 demo2 · 密碼 demo';
  $('gReg').textContent=active?'管理演示訂閱':sub?'續訂演示方案':'立即訂閱';
  $('gSubStatus').textContent=active?active.company+' · 演示訂閱有效至 '+subscriptionDate(active.expiresAt):sub?'演示訂閱已到期，請先續訂。':'';
}
function gateRole(r){gateCancel();GATE.role=r==='external'?'external':'mcc';
  qa('#gRole button').forEach(b=>{const on=b.dataset.r===GATE.role;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on?'true':'false');});
  $('gErr').textContent='';$('gStep').innerHTML='';$('gPass').value='';
  const sub=readSubscription();$('gUser').value=GATE.role==='external'&&sub?sub.email:'';gateRefresh();
}
function validExternalSession(){let email='';try{email=sessionStorage.getItem('cx_aaas_external_email')||'';}catch(e){}return !!email&&!!activeSubscription(email);}
function enter(role,quiet){
  if(!Object.prototype.hasOwnProperty.call(ROLES,role))return;
  if(role==='external'&&!validExternalSession()){gateShow(true);gateRole('external');$('gErr').textContent='請先完成模擬付款，並使用訂閱電郵登入。';return;}
  S.role=role;try{sessionStorage.setItem('cx_aaas_auth',role);if(role!=='external')sessionStorage.removeItem('cx_aaas_external_email');}catch(e){}
  gateShow(false);applyRole();showView(ROLES[role].views[0]);if(!quiet){audit('登入',ROLES[role].n);toast('歡迎，'+ROLES[role].n);}
}
function gateSubmit(ev){ev.preventDefault();if(GATE.busy)return;const u=$('gUser').value.trim().toLowerCase(),p=$('gPass').value;
  const role=GATE.role==='external'?'external':u==='demo1'?'eng':u==='demo2'?'mcc':null;
  if(role==='external'&&!activeSubscription(u)){$('gErr').textContent='此電郵尚未有有效訂閱，請先點選「立即訂閱」完成模擬付款。';return;}
  if(!role||p!=='demo'||!u){$('gErr').textContent=GATE.role==='external'?'帳戶或密碼不正確；演示密碼為 demo。':'帳戶或密碼不正確；維修員工請用 demo1，管理人員請用 demo2，密碼均為 demo。';$('gPass').select();return;}
  $('gErr').textContent='';GATE.busy=true;$('gForm').classList.add('busy');$('gLogin').disabled=true;$('gUser').disabled=true;$('gPass').disabled=true;
  const token=++GATE.attempt,st=role==='external'?['驗證公司帳戶','確認演示訂閱','載入工作空間']:['驗證員工帳戶',role==='eng'?'載入維修員工權限':'載入管理人員權限',role==='eng'?'開啟維修員工系統':'開啟管理人員系統'];
  $('gStep').innerHTML=st.map(t=>`<li>${t}</li>`).join('');const li=qa('#gStep li');let i=0;
  const tick=()=>{if(token!==GATE.attempt)return;if(i<li.length){li[i++].classList.add('ok');setTimeout(tick,A11Y.rm?40:220);return;}
    if(role==='external'){if(!activeSubscription(u)){gateCancel();$('gErr').textContent='訂閱已到期，請重新訂閱。';return;}try{sessionStorage.setItem('cx_aaas_external_email',u);}catch(e){gateCancel();$('gErr').textContent='瀏覽器無法保存登入狀態，請允許此頁面使用本機儲存。';return;}}
    enter(role);
  };setTimeout(tick,80);
}
function subscriptionReceipt(sub){$('gCheckout').hidden=true;$('gSuccess').hidden=false;$('gSales').setAttribute('aria-labelledby','gSuccessT');
  $('gReceiptCompany').textContent='公司：'+sub.company;$('gReceiptEmail').textContent='登入電郵：'+sub.email;$('gReceiptExpiry').textContent='有效至：'+subscriptionDate(sub.expiresAt);}
function subscriptionOpen(){gateCancel();GATE.returnFocus=document.activeElement;$('gPayErr').textContent='';$('gPay').disabled=false;$('gPay').textContent='模擬付款 HK$8,800 並訂閱';
  const sub=readSubscription(),active=activeSubscription();$('gForm').inert=true;$('gSales').classList.add('on');
  if(active){subscriptionReceipt(active);$('gSalesOk').focus();}
  else{$('gSales').setAttribute('aria-labelledby','gSalesT');$('gCheckout').hidden=false;$('gSuccess').hidden=true;
    if(sub){$('gCompany').value=sub.company;$('gContact').value=sub.contact;$('gEmail').value=sub.email;}$('gCompany').focus();}
}
function subscriptionClose(goLogin){GATE.payment++;$('gSales').classList.remove('on');$('gForm').inert=false;
  if(goLogin){gateRole('external');$('gPass').focus();}else{gateRefresh();if(GATE.returnFocus&&GATE.returnFocus.isConnected)GATE.returnFocus.focus();}
}
function subscriptionSubmit(ev){ev.preventDefault();if($('gPay').disabled)return;
  const company=$('gCompany').value.trim(),contact=$('gContact').value.trim(),email=$('gEmail').value.trim().toLowerCase();
  if(!company||!contact||!email||!$('gEmail').checkValidity()){$('gPayErr').textContent='請填寫公司名稱、聯絡人及有效的公司電郵。';(!company?$('gCompany'):!contact?$('gContact'):$('gEmail')).focus();return;}
  $('gPayErr').textContent='';$('gPay').disabled=true;$('gPay').textContent='正在模擬付款…';const token=++GATE.payment;
  setTimeout(()=>{if(token!==GATE.payment)return;const now=Date.now(),sub={version:1,demo:true,status:'active',company,contact,email,amount:8800,currency:'HKD',paidAt:now,expiresAt:now+30*86400000};
    try{localStorage.setItem(SUB_KEY,JSON.stringify(sub));SUB_MEMORY=sub;}catch(e){$('gPay').disabled=false;$('gPay').textContent='模擬付款 HK$8,800 並訂閱';$('gPayErr').textContent='無法保存演示訂閱，請允許此頁面使用本機儲存後重試。';return;}
    subscriptionReceipt(sub);gateRefresh();$('gSalesOk').focus();
  },A11Y.rm?40:600);
}
function gateKeydown(e){if(!$('gate').classList.contains('on'))return;const checkout=$('gSales').classList.contains('on');
  if(e.key==='Escape'&&checkout){e.preventDefault();subscriptionClose(false);return;}
  if(e.key!=='Tab')return;const scope=checkout?$('gSales'):$('gForm'),items=[...scope.querySelectorAll('button:not(:disabled),input:not(:disabled),a[href],[tabindex="0"]')].filter(el=>!el.hidden&&el.getClientRects().length);
  if(!items.length)return;const first=items[0],last=items[items.length-1];if(e.shiftKey&&(document.activeElement===first||!scope.contains(document.activeElement))){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||!scope.contains(document.activeElement))){e.preventDefault();first.focus();}
}

// ================= 導航 =================
function applyRole(){const R=ROLES[S.role]; qa('.nav[data-v]').forEach(n=>n.hidden=!R.views.includes(n.dataset.v)); $('who').textContent=R.n; $('whoSub').textContent='';
  document.documentElement.classList.toggle('r-eng',S.role==='eng');}
function showView(v){const R=ROLES[S.role]; if(!R.views.includes(v)) v=R.views[0]; S.view=v;
  qa('.nav[data-v]').forEach(n=>{const on=n.dataset.v===v; n.classList.toggle('on',on); n.setAttribute('aria-current',on?'page':'false');});
  qa('.view').forEach(e=>e.classList.toggle('on',e.id==='v-'+v)); renderView(); window.scrollTo&&window.scrollTo(0,0);}
function renderView(){const v=S.view; try{
  if(v==='overview') renderOverview(); else if(v==='plan') renderPlan(); else if(v==='line') renderLine(); else if(v==='carbon') renderCarbon(); else if(v==='model') renderModel(); else if(v==='twin') renderTwin();
  }catch(e){console.error(v,e);} }
function renderAll(){CARB=null; renderView();}

const NACA=x=>5*(0.2969*Math.sqrt(Math.max(x,0))-0.126*x-0.3516*x*x+0.2843*x*x*x-0.1036*x*x*x*x);
function twMaterials(){
  const P_=(o)=>new THREE.MeshPhysicalMaterial(o), S_=(o)=>new THREE.MeshStandardMaterial(o);
  TWR.M={
    paint:P_({color:0xf2f4f4,roughness:.3,metalness:.04,clearcoat:.8,clearcoatRoughness:.16}),
    wing:P_({color:0xc7cdd0,roughness:.38,metalness:.35,clearcoat:.35,clearcoatRoughness:.3}),
    jade:P_({color:0x006a70,roughness:.3,metalness:.08,clearcoat:.8,clearcoatRoughness:.14}),
    chrome:S_({color:0xe7ebec,metalness:1,roughness:.12}),
    metal:S_({color:0xa9b1b5,metalness:.9,roughness:.3}),
    dark:S_({color:0x2a2e31,metalness:.55,roughness:.42}),
    blade:S_({color:0x3b4247,metalness:.75,roughness:.28}),
    duct:S_({color:0x1d2124,metalness:.3,roughness:.6,side:THREE.BackSide}),
    hot:S_({color:0x9c7a55,metalness:.85,roughness:.38}),
    rubber:S_({color:0x151617,metalness:0,roughness:.92}),
    hub:S_({color:0xbfc6c9,metalness:.8,roughness:.32}),
    grey:S_({color:0x8f989c,metalness:.6,roughness:.4})
  };
}
function twMat(key,part,sub){const m=TWR.M[key].clone(); m.userData={part,sub,base:m.emissive?m.emissive.clone():null}; return m;}
function twMesh(geo,key,part,sub,opt){const me=new THREE.Mesh(geo,twMat(key,part,sub)); me.castShadow=!(opt&&opt.noShadow); me.receiveShadow=true; me.userData={part,sub}; TWR.pick.push(me); return me;}
function twSurface(secs,c0,c1,n,prof){
  c0=c0||0; c1=c1==null?1:c1; n=n||16;
  const xs=[]; for(let i=0;i<=n;i++){const b=Math.PI*i/n; xs.push(c0+(c1-c0)*(1-Math.cos(b))/2);}
  const loop=xs.map(x=>[x,1]).concat(xs.slice().reverse().map(x=>[x,-1])), M_=loop.length, pos=[], uv=[], idx=[];
  secs.forEach((s,k)=>{const tn=s.tn||[0,1,0], cd=s.cd||[0,0,-1];
    loop.forEach(([x,side])=>{const y=prof?prof(x,side,s):(0.016*4*x*(1-x)+side*s.t*NACA(x));
      pos.push(s.le[0]+cd[0]*x*s.c+tn[0]*y*s.c, s.le[1]+cd[1]*x*s.c+tn[1]*y*s.c, s.le[2]+cd[2]*x*s.c+tn[2]*y*s.c); uv.push(x,k/(secs.length-1));});});
  for(let k=0;k<secs.length-1;k++) for(let j=0;j<M_;j++){const a=k*M_+j,b=k*M_+(j+1)%M_,c=(k+1)*M_+j,d=(k+1)*M_+(j+1)%M_; idx.push(a,c,b,b,c,d);}
  for(const k of [0,secs.length-1]){const base=k*M_, cx=[0,0,0]; for(let j=0;j<M_;j++) for(let q=0;q<3;q++) cx[q]+=pos[(base+j)*3+q]/M_;
    const ci=pos.length/3; pos.push(...cx); uv.push(.5,.5); for(let j=0;j<M_;j++) idx.push(ci,base+j,base+(j+1)%M_);}
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function twLathe(pts,seg,phiS,phiL){const g=new THREE.LatheGeometry(pts.map(([r,z])=>new THREE.Vector2(Math.max(r,1e-4),z)),seg||64,phiS||0,phiL==null?Math.PI*2:phiL); g.rotateX(Math.PI/2); return g;}
function twMerge(geos){const gs=geos.map(g=>g.index?g.toNonIndexed():g); let n=0; gs.forEach(g=>n+=g.attributes.position.count);
  const p=new Float32Array(n*3),q=new Float32Array(n*3); let o=0; gs.forEach(g=>{p.set(g.attributes.position.array,o*3); q.set(g.attributes.normal.array,o*3); o+=g.attributes.position.count;});
  const m=new THREE.BufferGeometry(); m.setAttribute('position',new THREE.BufferAttribute(p,3)); m.setAttribute('normal',new THREE.BufferAttribute(q,3)); return m;}
function twSkinTex(M,reg){
  const Wc=4096,Hc=1024,cv=document.createElement('canvas'); cv.width=Wc; cv.height=Hc; const g=cv.getContext('2d');
  g.fillStyle='#f3f5f5'; g.fillRect(0,0,Wc,Hc);
  const gr=g.createLinearGradient(0,Hc*0.36,0,Hc*0.64); gr.addColorStop(0,'rgba(196,203,206,0)'); gr.addColorStop(.25,'#c9d0d3'); gr.addColorStop(.75,'#c9d0d3'); gr.addColorStop(1,'rgba(196,203,206,0)'); g.fillStyle=gr; g.fillRect(0,Hc*0.36,Wc,Hc*0.28);
  const X=f=>f*Wc, A=a=>a/(2*Math.PI)*Hc, R=M.W/2;
  g.strokeStyle='rgba(120,135,140,.16)'; g.lineWidth=2; for(let f=0.2;f<0.86;f+=6/M.L){g.beginPath();g.moveTo(X(f),0);g.lineTo(X(f),Hc);g.stroke();}
  for(const a of [0.55,2.2,4.08,5.73]){g.beginPath();g.moveTo(0,A(a));g.lineTo(Wc,A(a));g.stroke();}
  const doors=(M.L>70?[0.81,0.66,0.52,0.355,0.235]:M.L>60?[0.81,0.64,0.40,0.24]:[0.80,0.62,0.44,0.22]);
  const isDoor=f=>doors.some(d=>Math.abs(f-d)<0.012);
  const rr=(x,y,w,h,r)=>{g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();};
  const ww=0.27/M.L*Wc, wh=0.40/(2*Math.PI*R)*Hc, pitch=0.535/M.L;
  for(const ac of [1.29,2*Math.PI-1.29]) for(let f=0.21;f<0.845;f+=pitch){ if(isDoor(f)) continue; rr(X(f)-ww/2,A(ac)-wh/2,ww,wh,ww*0.45); g.fillStyle='#1b262c'; g.fill(); g.strokeStyle='#9aa6aa'; g.lineWidth=1.5; g.stroke();}
  const dw=1.07/M.L*Wc, dh=1.9/(2*Math.PI*R)*Hc;
  for(const ac of [Math.PI/2+0.05,3*Math.PI/2-0.05]) for(const d of doors){rr(X(d)-dw/2,A(ac)-dh/2,dw,dh,dw*0.18); g.strokeStyle='#9aa4a8'; g.lineWidth=3; g.stroke(); g.fillStyle='#1b262c'; rr(X(d)-ww/2,A(ac)-dh/2+dh*0.12,ww,wh,ww*.45); g.fill();}
  g.fillStyle='#16222a'; for(const [s,ac] of [[1,0.78],[-1,2*Math.PI-0.78]]) for(let k=0;k<1;k++){const f=0.953+k*0.0075,w=0.0068*Wc,h=0.06*Hc; g.save(); g.translate(X(f),A(ac)); g.beginPath(); g.moveTo(-w/2,-h/2+(k===0?6:0)*s); g.lineTo(w/2,-h/2); g.lineTo(w/2,h/2); g.lineTo(-w/2,h/2); g.closePath(); g.fill(); g.restore();}
  g.fillStyle='#00656b'; g.fillRect(X(0.205),A(1.62),X(0.64),3); g.fillRect(X(0.205),A(2*Math.PI-1.62)-3,X(0.64),3);
  if(reg){g.font='600 46px "Segoe UI",Arial'; g.fillStyle='#5d6a6e'; g.textBaseline='middle';
    g.save(); g.translate(X(0.13),A(1.75)); g.scale(-1,1); g.textAlign='center'; g.fillText(reg.replace('DEMO-','B-DM'),0,0); g.restore();
    g.save(); g.translate(X(0.13),A(2*Math.PI-1.75)); g.scale(1,-1); g.textAlign='center'; g.fillText(reg.replace('DEMO-','B-DM'),0,0); g.restore();}
  { // v7：機身前段 CATHAY PACIFIC 字樣（兩側均由機首向機尾正向閱讀）
    const fm_=M.L>60?0.95:0.72, fh=Math.round(fm_/(2*Math.PI*R)*Hc), f0=M.L>60?0.70:0.66, a0=1.29-(fm_*0.5+0.2+0.22)/R;
    g.font=`600 ${fh}px Candara,"Segoe UI",Arial`; g.fillStyle='#55625f'; g.textBaseline='middle'; g.textAlign='center';
    g.save(); g.translate(X(f0),A(a0)); g.scale(-1,1); g.fillText('CATHAY PACIFIC',0,0); g.restore();
    g.save(); g.translate(X(f0),A(2*Math.PI-a0)); g.scale(1,-1); g.fillText('CATHAY PACIFIC',0,0); g.restore(); }
  const tx=new THREE.CanvasTexture(cv); tx.colorSpace=THREE.SRGBColorSpace; tx.anisotropy=TWR.renderer.capabilities.getMaxAnisotropy(); return tx;
}
function twFloorTex(M){
  const N=2048,cv=document.createElement('canvas'); cv.width=cv.height=N; const g=cv.getContext('2d');
  g.fillStyle='#d6d9d9'; g.fillRect(0,0,N,N);
  for(let i=0;i<9000;i++){const x=Math.random()*N,y=Math.random()*N,v=200+Math.random()*30|0; g.fillStyle=`rgba(${v},${v+2},${v+2},.35)`; g.fillRect(x,y,2,2);}
  const m=N/160; g.strokeStyle='rgba(120,128,128,.35)'; g.lineWidth=2; for(let k=-80;k<=80;k+=7.5){g.beginPath();g.moveTo((k+80)*m,0);g.lineTo((k+80)*m,N);g.stroke();g.beginPath();g.moveTo(0,(k+80)*m);g.lineTo(N,(k+80)*m);g.stroke();}
  g.fillStyle='#e6b93a'; g.fillRect(80*m-0.12*m,0,0.24*m,N); g.fillRect(80*m-3*m,(80-M.L/2+4)*m,6*m,0.3*m);
  g.fillStyle='#e6b93a'; for(const s of [-1,1]){for(let z=-70;z<70;z+=3) g.fillRect((80+s*(M.B/2+6))*m,(z+80)*m,0.18*m,1.6*m);}
  const tx=new THREE.CanvasTexture(cv); tx.colorSpace=THREE.SRGBColorSpace; tx.anisotropy=8; return tx;
}
function twFade(){const N=512,cv=document.createElement('canvas');cv.width=cv.height=N;const g=cv.getContext('2d');const r=g.createRadialGradient(N/2,N/2,N*0.08,N/2,N/2,N/2);r.addColorStop(0,'#fff');r.addColorStop(.62,'#fff');r.addColorStop(1,'#000');g.fillStyle=r;g.fillRect(0,0,N,N);return new THREE.CanvasTexture(cv);}
function twFuselage(M,reg){
  const L=M.L,R=M.W/2,NS=110,NA=72,pos=[],uv=[],idx=[];
  const prof=f=>{let r=R,cy=0; if(f<0.2){const s=f/0.2; r=R*(0.15+0.85*Math.pow(Math.sin(s*Math.PI/2),1.15)); cy=R*0.5*Math.pow(1-s,1.7);} else if(f>0.855){const s=(f-0.855)/0.145; r=R*Math.pow(Math.max(0,1-Math.pow(s,2.3)),0.5); cy=-R*0.2*s*s;} return [r,cy];};
  for(let i=0;i<=NS;i++){const f=i/NS,z=-L/2+f*L,[r,cy]=prof(f); for(let j=0;j<=NA;j++){const a=j/NA*Math.PI*2; pos.push(r*Math.sin(a)*0.99,cy+r*Math.cos(a)*1.02,z); uv.push(f,1-j/NA);}}
  for(let i=0;i<NS;i++) for(let j=0;j<NA;j++){const a=i*(NA+1)+j,b=a+NA+1; idx.push(a,b,a+1,b,b+1,a+1);}
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); g.setIndex(idx); g.computeVertexNormals();
  const me=twMesh(g,'paint','body','panel'); me.material.map=twSkinTex(M,reg); me.material.needsUpdate=true; TWR.prof=prof; return me;
}
function twWingSec(M,s,t){const R=M.W/2,rootX=R*0.5,span=M.B/2-rootX,L=M.L,sw=Math.tan(M.sweep*Math.PI/180)*1.06,dih=Math.tan(5.5*Math.PI/180),cr=L*0.2,ck=L*0.105,ct=L*0.026,tk=0.32,y=t*span,c=t<tk?cr+(ck-cr)*t/tk:ck+(ct-ck)*(t-tk)/(1-tk);
  return {le:[s*(rootX+y),-R*0.42+y*dih,L*0.115-y*sw],c,t:0.15-0.055*t};}
function twTipSecs(M,s){const b=twWingSec(M,s,1),ct=b.c,P3=(dx,dy,dz)=>[b.le[0]+s*dx,b.le[1]+dy,b.le[2]+dz],tn=a=>[-s*Math.sin(a),Math.cos(a),0];
  if(M.tip==='raked') return [b,{le:P3(1.4,0.12,-1.7),c:ct*0.72,t:0.09},{le:P3(2.9,0.3,-4.2),c:ct*0.34,t:0.08}];
  if(M.tip==='curved') return [b,{le:P3(0.8,0.35,-0.9),c:ct*0.82,t:0.09,tn:tn(0.5)},{le:P3(1.25,1.4,-1.9),c:ct*0.58,t:0.09,tn:tn(1.2)},{le:P3(1.4,2.6,-2.8),c:ct*0.36,t:0.08,tn:tn(1.45)}];
  if(M.tip==='winglet') return [b,{le:P3(0.3,0.35,-0.5),c:ct*0.85,t:0.09,tn:tn(0.6)},{le:P3(0.6,2.6,-2.0),c:ct*0.44,t:0.08,tn:tn(1.38)}];
  if(M.tip==='plain') return [b,{le:P3(0.5,0.06,-0.7),c:ct*0.7,t:0.08},{le:P3(0.9,0.1,-1.3),c:ct*0.35,t:0.07}];
  return [b,{le:P3(0.35,0.4,-0.6),c:ct*0.85,t:0.09,tn:tn(0.7)},{le:P3(0.55,2.2,-1.6),c:ct*0.42,t:0.08,tn:tn(1.45)}];}
function twWing(M,s,part,detail){
  const grp=new THREE.Group(), S_=(t0,t1,k)=>{const a=[];for(let i=0;i<=k;i++)a.push(twWingSec(M,s,t0+(t1-t0)*i/k));return a;};
  const add=(sub,geo,mat,ex)=>{const m=twMesh(geo,mat,part,sub); const g=new THREE.Group(); g.add(m); g.userData={sub,ex:ex||[0,0,0]}; grp.add(g); return g;};
  add('wingbox',twSurface(S_(0,1,8),0.12,0.70,14),'wing');
  add('wingbox',twSurface(S_(0,0.12,2),0,0.12,8),'wing');
  for(const [a,b] of [[0,0.02],[0.64,0.68],[0.95,1]]) add('wingbox',twSurface(S_(a,b,1),0.70,1,8),'wing');
  add('wingbox',twSurface(twTipSecs(M,s),0,1,14),'wing');
  add('slat',twSurface(S_(0.12,1,7),0,0.12,8),'grey',[0,-0.5,1.1]);
  add('flap',twSurface(S_(0.02,0.64,5),0.705,1,10),'wing',[0,-0.9,-2.2]);
  add('aileron',twSurface(S_(0.68,0.95,3),0.705,1,10),'wing',[0,-0.3,-1.6]);
  add('spoiler',twSurface(S_(0.18,0.62,4),0.55,0.70,6,(x,side,sc)=>0.016*4*x*(1-x)+sc.t*NACA(x)+(side>0?0.007:0.0012)),'grey',[0,1.1,0]);
  return grp;
}
function twEngine(M,part,detail){
  const r=M.fan/2, grp=new THREE.Group(), add=(sub,obj,ex)=>{const g=new THREE.Group(); g.add(obj); g.userData={sub,ex:ex||[0,0,0]}; grp.add(g); return g;};
  const shell=[[1.03,1.30],[1.10,1.27],[1.17,1.12],[1.21,0.8],[1.23,0.2],[1.2,-0.4],[1.12,-1.05],[1.0,-1.55],[0.965,-1.55],[0.975,-1.0],[0.99,-0.2],[1.0,0.55],[0.995,1.05],[1.0,1.22],[1.03,1.30]].map(([a,b])=>[a*r,b*r]);
  if(!detail){
    const g=new THREE.Group(); g.add(twMesh(twLathe(shell,72),'paint',part,'nacelle'));
    const lip=twMesh(new THREE.TorusGeometry(1.035*r,0.035*r,12,72),'chrome',part,'nacelle'); lip.position.z=1.285*r; g.add(lip);
    const duct=twMesh(new THREE.CylinderGeometry(0.97*r,0.97*r,1.9*r,48,1,true).rotateX(Math.PI/2).translate(0,0,-0.5*r),'duct',part,'nacelle',{noShadow:true}); g.add(duct);
    add('nacelle',g);
  }else{
    const h1=twMesh(twLathe(shell,48,-Math.PI/2,Math.PI),'paint',part,'nacelle'), h2=twMesh(twLathe(shell,48,Math.PI/2,Math.PI),'paint',part,'nacelle');
    [h1,h2].forEach(h=>{h.material.transparent=true;h.material.opacity=1;}); TWR.shells=[h1,h2];
    add('nacelle',h1,[0,2.3*r,0.2*r]); add('nacelle',h2,[0,-2.3*r,0.2*r]);
  }
  const fan=new THREE.Group();
  fan.add(twMesh(twx().ring(M.blades,0.3*r,0.965*r,0.30*r,0.10,0.62*r,0.35,1.12,0.06,'fan'),'blade',part,'fan'));
  fan.add(twMesh(twLathe([[0.0001,1.06*r],[0.1*r,1.0*r],[0.2*r,0.88*r],[0.28*r,0.7*r],[0.32*r,0.5*r],[0.32*r,0.4*r],[0.0001,0.4*r]],48),'dark',part,'fan'));
  const disc=twMesh(new THREE.CylinderGeometry(0.33*r,0.33*r,0.1*r,40).rotateX(Math.PI/2).translate(0,0,0.42*r),'metal',part,'fan'); fan.add(disc);
  TWR.fans=TWR.fans||[]; TWR.fans.push(fan);
  add('fan',fan,[0,0,1.6*r]);
  if(!detail){
    const core=new THREE.Group();
    core.add(twMesh(twLathe([[0.62*r,-1.0*r],[0.66*r,-1.45*r],[0.6*r,-2.15*r],[0.48*r,-2.7*r],[0.44*r,-2.78*r],[0.40*r,-2.78*r],[0.4*r,-1.0*r]],56),'grey',part,'turbine'));
    core.add(twMesh(twLathe([[0.37*r,-2.7*r],[0.3*r,-3.1*r],[0.15*r,-3.45*r],[0.0001,-3.6*r]],40),'hot',part,'turbine'));
    add('turbine',core);
  }else{
    const EN=twx().ENG[M.engine]||{hpc:10,hpt:2,lpt:6}, hpc=new THREE.Group(), st=EN.hpc;
    for(let i=0;i<st;i++){const f=i/(st-1), z=(-0.22-1.05*f)*r, rh=(0.3+0.06*f)*r, rt=(0.52-0.1*f)*r;
      hpc.add(twMesh(twx().ring(Math.round(36+30*f),rh,rt,0.075*r,0.08,z,0.62,0.78,0.07,'cmp'),'metal',part,'hpc'));}
    hpc.add(twMesh(twLathe([[0.3*r,-0.12*r],[0.33*r,-0.7*r],[0.36*r,-1.35*r],[0.0001,-1.35*r],[0.0001,-0.12*r]],48),'grey',part,'hpc'));
    add('hpc',hpc,[0,0.15*r,0]);
    const burn=new THREE.Group();
    burn.add(twMesh(twLathe([[0.34*r,-1.42*r],[0.52*r,-1.42*r],[0.55*r,-1.6*r],[0.52*r,-1.82*r],[0.36*r,-1.82*r],[0.33*r,-1.6*r],[0.34*r,-1.42*r]],56),'hot',part,'burn'));
    for(let i=0;i<20;i++){const a=2*Math.PI*i/20,c=twMesh(new THREE.CylinderGeometry(0.018*r,0.018*r,0.16*r,8).rotateX(Math.PI/2),'metal',part,'burn'); c.position.set(Math.cos(a)*0.45*r,Math.sin(a)*0.45*r,-1.36*r); burn.add(c);}
    add('burn',burn,[0,0,-0.9*r]);
    const tur=new THREE.Group();
    const ns=EN.hpt+(EN.ipt||0)+EN.lpt; for(let i=0;i<ns;i++){const f=i/(ns-1), z=(-1.95-0.85*f)*r, rh=(0.36+0.02*f)*r, rt=(0.5+0.16*f)*r; tur.add(twMesh(twx().ring(i<EN.hpt?44:58+Math.round(10*f),rh,rt,0.07*r*(i<EN.hpt?1:0.9),0.2,z,-0.5,-0.7,0.15,'tur'),'hot',part,'turbine'));}
    tur.add(twMesh(twLathe([[0.37*r,-1.88*r],[0.38*r,-2.9*r],[0.3*r,-3.25*r],[0.12*r,-3.5*r],[0.0001,-3.62*r],[0.0001,-1.88*r]],48),'grey',part,'turbine'));
    add('turbine',tur,[0,0,-1.9*r]);
    const shaft=twMesh(new THREE.CylinderGeometry(0.07*r,0.07*r,4.2*r,16).rotateX(Math.PI/2).translate(0,0,-1.4*r),'dark',part,'turbine'); add('turbine',shaft,[0,0,-0.6*r]);
  }
  return grp;
}
function twPylon(M,part,s,ze,ye,sec){
  const r=M.fan/2, h=(sec.le[1]-sec.c*0.055)-ye, zl=sec.le[2]-ze, sh=new THREE.Shape();
  sh.moveTo(0.55*r,1.13*r); sh.lineTo(zl-0.4,h+0.15); sh.lineTo(zl-sec.c*0.6,h+0.05); sh.lineTo(-2.35*r,0.66*r); sh.lineTo(-1.3*r,1.05*r); sh.closePath();
  const g=new THREE.ExtrudeGeometry(sh,{depth:0.3*r,bevelEnabled:true,bevelThickness:0.05*r,bevelSize:0.06*r,bevelSegments:3,curveSegments:4});
  g.rotateY(-Math.PI/2); g.translate(0.15*r,0,0); const m=twMesh(g,'paint',part,'nacelle'); return m;
}
function twTail(M,detail){
  const L=M.L,R=M.W/2,grp=new THREE.Group(), add=(sub,geo,mat,ex)=>{const m=twMesh(geo,mat,'tail',sub); const g=new THREE.Group(); g.add(m); g.userData={sub,ex:ex||[0,0,0]}; grp.add(g);};
  const zr=-L*0.315, cr=L*0.15, H=M.fin, sw=Math.tan(40*Math.PI/180);
  const fin=[0,0.5,1].map(k=>({le:[0,R*0.72+k*(H+R*0.25),zr-k*(H+R*0.25)*sw],c:cr*(1-0.6*k),t:0.11,tn:[1,0,0]}));
  const fm=twMesh(twSurface(fin,0,0.7,12),'jade','tail','fin'), rm=twMesh(twSurface(fin,0.7,1,8),'jade','tail','rudder'); twTailTex([fm,rm]);
  [[fm,'fin',[0,0,0]],[rm,'rudder',[0.6,0,-1.2]]].forEach(([m,sub,ex])=>{const g=new THREE.Group(); g.add(m); g.userData={sub,ex}; grp.add(g);});
  for(const s of [1,-1]){const zs=-L*0.385, crs=L*0.095, half=M.B*0.165, sws=Math.tan(36*Math.PI/180), dh=Math.tan(7*Math.PI/180);
    const st=[0,0.5,1].map(k=>({le:[s*(R*0.25+k*half),R*0.18+k*half*dh,zs-k*half*sws],c:crs*(1-0.62*k),t:0.1}));
    add('stab',twSurface(st,0,0.72,12),'wing'); add('elevator',twSurface(st,0.72,1,8),'wing',[0,0,-1.2]);}
  return grp;
}
function twGear(M,detail){
  const R=M.W/2, yg=-R-M.clear, grp=new THREE.Group(), tr=M.tire, noseZ=M.L/2-M.L*0.068, mainZ=noseZ-M.wb;
  const leg=(x,z,ytop,n,nose)=>{const g=new THREE.Group(), axleY=yg+tr;
    const strut=new THREE.Group(); strut.userData={sub:'strut',ex:[0,0.6,0]};
    strut.add(twMesh(new THREE.CylinderGeometry(nose?0.11:0.17,nose?0.11:0.17,ytop-axleY,16).translate(0,(ytop+axleY)/2,0),'hub','gear','strut'));
    strut.add(twMesh(new THREE.CylinderGeometry(0.06,0.06,(ytop-axleY)*0.75,10).rotateX(0.5).translate(0,(ytop+axleY)/2+0.3,-0.6),'grey','gear','strut'));
    const bog=new THREE.Group(); bog.userData={sub:'bogie',ex:[0,-0.9,0]};
    const pitch=tr*2.2, zs=[]; for(let i=0;i<n;i++) zs.push((i-(n-1)/2)*pitch);
    if(n>1) bog.add(twMesh(new THREE.BoxGeometry(0.22,0.22,pitch*(n-1)+0.5).translate(0,axleY,0),'grey','gear','bogie'));
    for(const zz of zs) for(const sx of [-1,1]){const w=twMesh(new THREE.CylinderGeometry(tr,tr,nose?0.32:0.44,32).rotateZ(Math.PI/2),'rubber','gear','bogie'); w.position.set(sx*(nose?0.3:0.52),axleY,zz); bog.add(w);
      const hub=twMesh(new THREE.CylinderGeometry(tr*0.55,tr*0.55,nose?0.34:0.46,24).rotateZ(Math.PI/2),'hub','gear','bogie'); hub.position.copy(w.position); bog.add(hub);}
    bog.add(twMesh(new THREE.CylinderGeometry(0.07,0.07,(nose?0.6:1.04)+0.1,10).rotateZ(Math.PI/2).translate(0,axleY,zs[0]),'hub','gear','bogie'));
    g.add(strut); g.add(bog); g.position.set(x,0,z); return g;};
  if(detail){grp.add(leg(0,0,yg+tr+3.2,M.bogie,false)); return {grp,parts:grp.children[0].children};}
  for(const s of [1,-1]) grp.add(leg(s*M.track,mainZ,-R*0.42,M.bogie,false));
  grp.add(leg(0,noseZ,-R*0.8,1,true));
  return {grp,mainZ,noseZ};
}
function twApu(M,detail){
  const grp=new THREE.Group(), add=(sub,obj,ex)=>{const g=new THREE.Group(); g.add(obj); g.userData={sub,ex:ex||[0,0,0]}; grp.add(g);}, k=Math.max(0.6,M.W/6.19);
  if(!detail){const R=M.W/2, m=twMesh(new THREE.CylinderGeometry(0.15*R,0.13*R,0.6,32,1,true).rotateX(Math.PI/2),'dark','apu','exhaust'); m.position.set(0,R*0.5,-M.L/2+0.1); add('exhaust',m); return grp;}
  add('inlet',twMesh(twLathe([[0.32*k,1.6*k],[0.36*k,1.2*k],[0.42*k,0.8*k],[0.38*k,0.8*k],[0.3*k,1.2*k],[0.28*k,1.6*k]],40),'grey','apu','inlet'),[0,0.4,0.9]);
  const core=new THREE.Group(); core.add(twMesh(twLathe([[0.5*k,0.8*k],[0.55*k,0.2*k],[0.6*k,-0.4*k],[0.5*k,-0.9*k],[0.0001,-0.9*k],[0.0001,0.8*k]],48),'metal','apu','core'));
  core.add(twMesh(new THREE.BoxGeometry(0.9*k,0.5*k,0.7*k).translate(0,-0.6*k,0.2*k),'grey','apu','core')); add('core',core);
  add('generator',twMesh(new THREE.CylinderGeometry(0.26*k,0.26*k,0.65*k,32).rotateX(Math.PI/2).translate(0.62*k,-0.35*k,0.35*k),'hot','apu','generator'),[0.7,0,0]);
  add('exhaust',twMesh(twLathe([[0.36*k,-0.9*k],[0.32*k,-1.6*k],[0.28*k,-2.1*k],[0.25*k,-2.1*k],[0.3*k,-1.6*k],[0.33*k,-0.9*k]],40),'dark','apu','exhaust'),[0,0,-1.0]);
  return grp;
}
function twBodyDetail(M){
  const R=M.W/2, grp=new THREE.Group(), add=(sub,obj,ex)=>{const g=new THREE.Group(); g.add(obj); g.userData={sub,ex:ex||[0,0,0]}; grp.add(g);}, Lh=8;
  const pg=new THREE.Group(); for(let i=0;i<6;i++) for(let j=0;j<4;j++){const a0=-0.25+i*0.52, m=twMesh(new THREE.CylinderGeometry(R,R,Lh/4-0.06,24,1,true,a0,0.5).rotateX(Math.PI/2).translate(0,0,-Lh/2+Lh/8+j*Lh/4),'paint','body','panel'); m.material.side=THREE.DoubleSide;
    const g=new THREE.Group(); g.add(m); const mid=a0+0.25; g.userData={sub:'panel',ex:[Math.sin(mid)*1.2,Math.cos(mid)*1.2,0]}; grp.add(g);}
  const fr=new THREE.Group(); for(let z=-Lh/2;z<=Lh/2+1e-6;z+=0.53){const t=twMesh(new THREE.TorusGeometry(R*0.965,0.05,6,64,Math.PI*1.75),'grey','body','frame'); t.rotation.z=-Math.PI/2-0.3; t.position.z=z; fr.add(t);}
  add('frame',fr);
  const sg=new THREE.Group(); for(let a=-0.2;a<2.95;a+=0.16){const b=twMesh(new THREE.BoxGeometry(0.05,0.08,Lh),'metal','body','stringer'); b.position.set(Math.sin(a)*R*0.985,Math.cos(a)*R*0.985,0); b.rotation.z=-a; sg.add(b);}
  sg.add(twMesh(new THREE.BoxGeometry(R*1.9,0.12,Lh).translate(0,-R*0.25,0),'grey','body','stringer')); add('stringer',sg,[0,0,0]);
  return grp;
}
function twTailTex(ms){
  const N=1024, cv=document.createElement('canvas'); cv.width=N; cv.height=N; const g=cv.getContext('2d');
  g.fillStyle='#006564'; g.fillRect(0,0,N,N);
  const tx=new THREE.CanvasTexture(cv); tx.colorSpace=THREE.SRGBColorSpace; tx.anisotropy=8;
  const im=new Image(); im.onload=()=>{const w=N*0.52, h=w*23.7/19.6;
    g.save(); g.translate(N*0.5,N*0.47); g.drawImage(im,-w/2,-h/2,w,h); g.restore(); tx.needsUpdate=true;};
  try{const raw=atob(BRUSH_WHITE.split(',')[1]); im.src=raw.includes('width=')?BRUSH_WHITE:'data:image/svg+xml;base64,'+btoa(raw.replace('<svg ','<svg width="392" height="474" '));}catch(e){im.src=BRUSH_WHITE;}
  ms.forEach(m=>{m.material.map=tx; m.material.color.set(0xffffff); m.material.needsUpdate=true;});
}

// ================= 數字孿生 =================
const TWM={
  b777:{name:'Boeing 777-300ER',L:73.9,B:64.8,W:6.19,engine:'GE90-115B',fan:3.25,blades:22,tip:'raked',bogie:3,fin:9.1,sweep:31.6,clear:2.9,track:5.5,wb:31.2,tire:0.66,apu:'Honeywell 331-500'},
  b773:{name:'Boeing 777-300',L:73.9,B:60.9,W:6.19,engine:'Rolls-Royce Trent 892',fan:2.79,blades:26,tip:'plain',bogie:3,fin:9.1,sweep:31.6,clear:2.9,track:5.5,wb:31.2,tire:0.66,apu:'Honeywell 331-500'},
  a330:{name:'Airbus A330-300',L:63.69,B:60.3,W:5.64,engine:'Rolls-Royce Trent 700',fan:2.47,blades:26,tip:'winglet',bogie:2,fin:8.6,sweep:30,clear:2.6,track:5.4,wb:25.6,tire:0.62,apu:'Honeywell 331-350'},
  a350:{name:'Airbus A350-900',L:66.8,B:64.75,W:5.96,engine:'Rolls-Royce Trent XWB-84',fan:3.0,blades:22,tip:'curved',bogie:2,fin:8.9,sweep:31.9,clear:2.7,track:5.3,wb:28.7,tire:0.64,apu:'Honeywell HGT1700'},
  a35k:{name:'Airbus A350-1000',L:73.79,B:64.75,W:5.96,engine:'Rolls-Royce Trent XWB-97',fan:3.0,blades:22,tip:'curved',bogie:3,fin:8.9,sweep:31.9,clear:2.7,track:5.3,wb:31.6,tire:0.66,apu:'Honeywell HGT1700'},
  a321:{name:'Airbus A321neo',L:44.51,B:35.8,W:3.95,engine:'CFM LEAP-1A',fan:1.98,blades:18,tip:'sharklet',bogie:1,fin:5.9,sweep:25,clear:1.9,track:3.8,wb:16.9,tire:0.59,apu:'Honeywell 131-9A'}
};
const TYPE2M={'777-300ER':'b777','777-300':'b773','A330-300':'a330','A350-900':'a350','A350-1000':'a35k','A321neo':'a321'};
const TW_P=[
 {id:'e1',name:'1 號發動機',where:'左翼下方'},{id:'e2',name:'2 號發動機',where:'右翼下方'},
 {id:'wingL',name:'左翼',where:'縫翼、襟翼、副翼、擾流板'},{id:'wingR',name:'右翼',where:'縫翼、襟翼、副翼、擾流板'},
 {id:'apu',name:'輔助動力裝置',where:'機尾尾錐內'},{id:'tail',name:'尾翼',where:'垂直與水平尾翼'},
 {id:'gear',name:'起落架',where:'主起落架與前起落架'},{id:'body',name:'機身',where:'蒙皮、機身框、縱樑'}];
const TW_SUB={engine:{fan:'風扇葉片',hpc:'高壓壓氣機葉片',burn:'燃燒室',turbine:'渦輪葉片',nacelle:'短艙與引氣管'},wing:{slat:'前緣縫翼',wingbox:'翼盒',flap:'後緣襟翼',aileron:'副翼',spoiler:'擾流板'},
  tail:{fin:'垂直尾翼',rudder:'方向舵',stab:'水平尾翼',elevator:'升降舵'},body:{panel:'蒙皮與艙門',frame:'機身框',stringer:'縱樑'},
  apu:{inlet:'進氣道',core:'本體',generator:'起動發電機',exhaust:'排氣管'},gear:{strut:'支柱',bogie:'輪架與機輪'}};
const twSubs=id=>!id?null:(id==='e1'||id==='e2')?TW_SUB.engine:id.startsWith('wing')?TW_SUB.wing:TW_SUB[id];
const SPEC_OK=['fan','hpc','turbine','burn','generator','nacelle','flap','aileron','slat','spoiler'];
const TW={reg:null,mk:'b777',level:'ac',part:null,sub:null,selPart:null,delay:0,pmap:{}};
let TWR=null, TWXL=null; const twx=()=>TWXL||(TWXL=TWX_make(THREE));
function twMap(t){
  if(t.tool==='stand') return [{p:/1 號/.test(t.name)?'e1':'e2',sub:'hpc'}];
  if(t.mel) return [{p:'apu',sub:'generator'}];
  if(t.lever==='engine') return [{p:'e1',sub:'hpc'},{p:'e2',sub:'hpc'}];
  if(t.lever==='bleed') return [{p:/左/.test(t.name)?'e1':'e2',sub:'nacelle'}];
  if(/貨艙門/.test(t.name)) return [{p:'body',sub:'panel'}];
  if(/副翼/.test(t.name)) return [{p:'wingR',sub:'flap'},{p:'wingR',sub:'aileron'}];
  if(/襟翼/.test(t.name)) return [{p:'wingR',sub:'flap'}];
  if(/擾流板/.test(t.name)) return [{p:'wingL',sub:'slat'},{p:'wingL',sub:'spoiler'}];
  if(/縫翼|前緣/.test(t.name)) return [{p:'wingL',sub:'slat'}];
  return [{p:'body',sub:'panel'}];
}
function twParts(){
  const L=TW_P.map(p=>({...p,level:0,items:[],subLv:{}}));
  if(TW.reg&&S.J) for(const t of T.filter(t=>t.reg===TW.reg)){const o=S.J.plan[t.id], lv=level(t,o);
    for(const m of twMap(t)){const p=L.find(x=>x.id===m.p); p.items.push({t,o,sub:m.sub,lv}); p.level=Math.max(p.level,lv); p.subLv[m.sub]=Math.max(p.subLv[m.sub]||0,lv);}}
  return L;
}
const twPart=id=>twParts().find(p=>p.id===id);
function twAircraft(){return planAircraft().sort((a,b)=>b.lv-a.lv||a.reg.localeCompare(b.reg,'en',{numeric:true}));}

// ---------- 巡檢判讀（零件對比） ----------
const SPEC_DEF={hpc:{tip:['葉尖燒蝕與捲曲','前級葉片葉尖缺損並向一側捲曲，表面有過熱變色，前緣輕微磨損。會令排氣溫度上升、耗油增加。'],foul:['葉片積垢','葉片表面附著鹽分與污垢，翼型變粗糙，耗油上升。清洗後約可恢復六成。']},
  fan:{nick:['前緣撞擊缺口','風扇葉片前緣有異物撞擊造成的缺口，鈦合金護邊外露。按損傷限制決定打磨或更換。']},
  turbine:{tbc:['隔熱塗層剝落','渦輪葉片受壓面隔熱塗層剝落，葉尖氧化燒蝕，冷卻孔周邊變色。']},
  burn:{crack:['燃燒室熱裂紋','冷卻孔之間出現熱疲勞裂紋，周邊局部燒蝕變色。']},
  generator:{heat:['過熱變色與滲油','外殼有長期過熱的回火色，驅動端有滲油痕跡。']},
  nacelle:{leak:['引氣接頭漏氣','卡箍鬆脫，法蘭之間出現間隙，接縫周圍有煙跡。']},
  seal:{tear:['密封條撕裂','舵面邊緣的橡膠密封條撕裂並缺失一段，令氣流外漏、阻力增加。']}};
const specKey=s=>['flap','aileron','slat','spoiler'].includes(s)?'seal':s;
function twSpecInfo(){
  const p=twPart(TW.part)||{items:[]}, it=(p.items||[]).filter(i=>i.sub===TW.sub).sort((a,b)=>b.lv-a.lv)[0]||null, k=specKey(TW.sub);
  const dmg=k==='hpc'?(it&&it.t.lever==='engine'?'foul':'tip'):({fan:'nick',turbine:'tbc',burn:'crack',generator:'heat',nacelle:'leak',seal:'tear'}[k]);
  const d=(SPEC_DEF[k]||{})[dmg]||['缺陷',''], h=hashStr(String(TW.reg)+TW.part+TW.sub);
  const src=['generator'].includes(k)?'近距離影像檢查':['nacelle','seal'].includes(k)?'無人機外觀巡檢':'孔探（Borescope Inspection）機械臂';
  return {k,dmg,real:!!it,it,name:d[0],desc:d[1],conf:(0.86+(parseInt(h.slice(0,2),16)%12)/100).toFixed(2),src};
}
function twSpecimen(M){
  const X_=twx(), I=twSpecInfo(), f=X_.SPEC[TW.sub], grp=new THREE.Group();
  const specs=[{s:f(M.engine,null),ok:true},{s:f(M.engine,I.dmg),ok:false}], hz=!!specs[0].s.horiz;
  if(hz) specs.forEach(o=>{o.s.g.rotation.y=Math.PI/2; o.s.g.updateMatrixWorld(true);});
  const boxes=specs.map(o=>new THREE.Box3().setFromObject(o.s.g)), wid=Math.max(...boxes.map(b=>b.max.x-b.min.x)), dep=Math.max(...boxes.map(b=>b.max.z-b.min.z));
  const gap=hz?wid+0.9:Math.max(wid*1.7,dep*0.9,1.25);
  specs.forEach((o,i)=>{const b=boxes[i], x=(i?1:-1)*gap/2, g=new THREE.Group(); g.add(o.s.g);
    o.s.g.position.set(-(b.min.x+b.max.x)/2,-b.min.y+0.06,-(b.min.z+b.max.z)/2); g.position.x=x;
    o.s.g.traverse(m=>{if(m.isMesh){m.userData={part:TW.part,sub:TW.sub,noHeat:true}; TWR.pick.push(m);}});
    const cR=i?0xe5484d:0x34a26b, cT=i?0x3b3434:0x34393b;
    if(hz){const w=b.max.x-b.min.x+0.3, d=b.max.z-b.min.z+0.3;
      const ed=new THREE.Mesh(new THREE.BoxGeometry(w+0.05,0.05,d+0.05),new THREE.MeshBasicMaterial({color:cR})); ed.position.y=0.024; g.add(ed);
      const tp=new THREE.Mesh(new THREE.BoxGeometry(w,0.06,d),new THREE.MeshStandardMaterial({color:cT,metalness:.3,roughness:.6})); tp.position.y=0.03; tp.receiveShadow=true; g.add(tp);}
    else{const rad=Math.max(b.max.x-b.min.x,b.max.z-b.min.z)*0.62+0.08;
      const pd=new THREE.Mesh(new THREE.CylinderGeometry(rad,rad*1.04,0.06,48),new THREE.MeshStandardMaterial({color:cT,metalness:.3,roughness:.6})); pd.position.y=0.03; pd.receiveShadow=true; g.add(pd);
      const rg=new THREE.Mesh(new THREE.TorusGeometry(rad*1.02,0.012,8,64),new THREE.MeshBasicMaterial({color:cR})); rg.rotation.x=Math.PI/2; rg.position.y=0.062; g.add(rg);}
    grp.add(g);
    const top=b.max.y-b.min.y+0.06;
    TWR.labels.push({pos:new THREE.Vector3(x,top+(hz?0.35:0.22),0),cls:i?'bad':'ok',html:i?`<b>${I.real?'本機問題件':'缺陷參考'}</b><span>${I.real?I.it.t.reg:'典型樣本，非本機'}</span>`:'<b>正常件</b><span>同型號新件</span>'});
    if(!o.ok&&o.s.mark){const mk=o.s.mark.clone().applyEuler(o.s.g.rotation).add(o.s.g.position).add(g.position);
      const mm=new THREE.Mesh(new THREE.RingGeometry(0.085,0.105,40),new THREE.MeshBasicMaterial({color:0xe5484d,side:THREE.DoubleSide,depthTest:false,transparent:true,opacity:.95}));
      mm.position.copy(mk); mm.renderOrder=20; grp.add(mm); TWR.marks.push(mm);
      TWR.labels.push({pos:mk.clone().add(new THREE.Vector3(0.2,hz?-0.18:-0.1,0)),cls:'mk',html:`<b>${I.name}</b>`});}
  });
  TWR.specHoriz=hz; return grp;
}

// ---------- 介面 ----------
function renderTwin(){
  const ac=twAircraft();
  if(!TW.reg||!ac.find(a=>a.reg===TW.reg)){TW.reg=ac[0].reg; TW.level='ac'; TW.part=null; TW.sub=null;}
  const cur=ac.find(a=>a.reg===TW.reg); TW.mk=TYPE2M[cur.type]||'b777';
  $('twList').innerHTML=`<div class="tl-h">本期有工作的飛機</div>`+ac.map(a=>`<button class="tl ${a.reg===TW.reg?'on':''}" data-reg="${a.reg}"><span class="tg" style="--c:${LV_COL[a.lv]}"></span><div><b>${a.reg}</b><small>${a.type} · ${a.ts.length} 項</small></div></button>`).join('');
  qa('#twList .tl').forEach(b=>b.onclick=()=>{if(TW.reg===b.dataset.reg&&TW.level==='ac') return; TW.reg=b.dataset.reg; TW.level='ac'; TW.part=null; TW.sub=null; TW.selPart=null; TW.delay=0; renderTwin();});
  twUI(); twEnsure3D();
}
function twUI(){
  const ps=twParts(), M=TWM[TW.mk]; TW.pmap={}; ps.forEach(p=>TW.pmap[p.id]=p);
  if(!TW.selPart||!TW.pmap[TW.selPart]) TW.selPart=ps.slice().sort((a,b)=>b.level-a.level)[0].id;
  const p=TW.pmap[TW.part||TW.selPart], subs=twSubs(p.id)||{};
  // 麵包屑
  const cr=[`<button data-c="ac">${TW.reg} · ${M.name}</button>`]; if(TW.level!=='ac') cr.push(`<button data-c="part">${p.name}${p.id==='e1'||p.id==='e2'?' · '+M.engine:''}</button>`); if(TW.level==='cmp') cr.push(`<span>${subs[TW.sub]}</span>`);
  $('twCrumb').innerHTML=cr.join('<i>›</i>');
  qa('#twCrumb [data-c]').forEach(b=>b.onclick=()=>{if(b.dataset.c==='ac') twGo('ac'); else twGo('part',TW.part);});
  $('twBack').hidden=TW.level==='ac';
  $('twHint').textContent=TW.level==='ac'?'拖曳旋轉 · 滾輪縮放 · 點選部件，雙擊打開':TW.level==='part'?'點選零件查看狀態，雙擊進行零件對比':'左：正常件　右：問題件　紅圈為判讀位置';
  const card=it=>{const t=it.t,o=it.o; return `<div class="tw-task" style="--c:${LV_COL[it.lv]}"><b>${esc(t.name)}</b><small>${winTxt(o)} · ${winSub(o)}${t.pool?' · 備件：'+MODE[o.m]:''}</small>
      <div class="kv"><span>${t.cls==='R'?'剩餘壽命':'每天多耗油'}<b>${t.cls==='R'?t.mu.toFixed(1)+' 天':t.f0.toFixed(2)+' 噸'}</b></span><span>${t.cls==='R'?'執行時失效概率':'修復後可恢復'}<b>${t.cls==='R'?pct(o.pf):(t.r*100).toFixed(0)+'%'}</b></span></div></div>`;};
  const uniq=[...new Map(p.items.map(i=>[i.t.id,i])).values()];
  let h='';
  if(TW.level==='ac'){
    h=`<p class="eyebrow">${M.name}</p><h3>${TW.reg}</h3><p class="muted small">機長 ${M.L} 米 · 翼展 ${M.B} 米 · ${M.engine}</p>
      <div class="tw-parts">${ps.slice().sort((a,b)=>b.level-a.level).map(x=>`<button class="tp ${x.id===TW.selPart?'on':''}" data-p="${x.id}"><span class="tg" style="--c:${LV_COL[x.level]}"></span><b>${x.name}</b><em>${LV_TXT[x.level]}</em></button>`).join('')}</div>
      <div class="tw-sel"><h4>${p.name}<span style="color:${LV_COL[p.level]}"> · ${LV_TXT[p.level]}</span></h4><p class="muted small">${p.where}</p>${uniq.map(card).join('')||'<p class="muted small">本期沒有待處理工作。</p>'}
      <button class="btn pri sm" id="twOpen">打開${p.name}</button></div>`;
  }else if(TW.level==='part'){
    const sel=TW.sub;
    h=`<p class="eyebrow" style="color:${LV_COL[p.level]}">${LV_TXT[p.level]}</p><h3>${p.name}</h3><p class="muted small">${p.id==='e1'||p.id==='e2'?M.engine:p.id==='apu'?M.apu:p.where}</p>
      <div class="tw-subs">${Object.entries(subs).map(([k,n])=>{const lv=p.subLv[k]||0;return `<button class="ts ${k===sel?'on':''}" data-s="${k}"><span class="tg" style="--c:${LV_COL[lv]}"></span>${n}${SPEC_OK.includes(k)?'<em>可對比</em>':''}</button>`;}).join('')}</div>
      ${uniq.map(card).join('')||'<p class="muted small">本期沒有待處理工作。</p>'}
      ${sel&&SPEC_OK.includes(sel)?`<button class="btn pri sm" id="twCmp">對比正常件與問題件</button>`:''}
      ${uniq.length?`<div class="tw-sim"><h4>延後維修的影響</h4><input type="range" id="twDelay" min="0" max="14" value="${TW.delay}" aria-label="延後天數"><div id="twSimOut"></div></div>`:''}`;
  }else{
    const I=twSpecInfo();
    h=`<p class="eyebrow" style="color:#e5484d">${I.real?'本機發現':'缺陷參考樣本'}</p><h3>${I.name}</h3><p>${I.desc}</p>
      <div class="facts sm">${[['位置',p.name+' · '+subs[TW.sub]],['檢查方式',I.src],['影像判讀置信度',I.conf],['相關工作',I.real?I.it.t.name:'—']].map(([k,v])=>`<div><small>${k}</small><b>${esc(v)}</b></div>`).join('')}</div>
      <p class="note">零件模型與判讀結果為示範用合成數據。處置以持證工程師複核及維修手冊限制為準。</p>`;
  }
  $('twSide').innerHTML=h;
  qa('#twSide .tp').forEach(b=>b.onclick=()=>{TW.selPart=b.dataset.p; twUI();});
  qa('#twSide .ts').forEach(b=>b.onclick=()=>{TW.sub=b.dataset.s; twUI();});
  const o1=$('twOpen'); if(o1) o1.onclick=()=>twGo('part',TW.selPart);
  const o2=$('twCmp'); if(o2) o2.onclick=()=>twGo('cmp',TW.part,TW.sub);
  const dl=$('twDelay'); if(dl){dl.oninput=()=>{TW.delay=+dl.value; twSim();}; twSim();}
}
function twSim(){
  const p=TW.pmap[TW.part], it=p&&p.items.slice().sort((a,b)=>b.lv-a.lv)[0], out=$('twSimOut'); if(!it||!out) return;
  const {t,o}=it, d0=o.w.kind!=='defer'?o.w.d:0, s=d0+TW.delay;
  if(t.cls==='R'){const pf=JM.pFail(t,s,P); out.innerHTML=`<div class="sim"><span>延後 <b>${TW.delay}</b> 天 → 第 ${s} 天執行</span><span>失效概率 <b style="color:${pf>P.riskCap?'#e5484d':'inherit'}">${pct(pf)}</b>${pf>P.riskCap?'（超過上限）':''}</span></div>`;}
  else{const dF=JM.fuelTonnes(t,s,P)-JM.fuelTonnes(t,d0,P); out.innerHTML=`<div class="sim"><span>延後 <b>${TW.delay}</b> 天</span><span>多燒燃油 <b>${fmt(dF,1)}</b> 噸 · CO₂ <b>${fmt(dF*3.16,1)}</b> 噸</span></div>`;}
}
function twGo(level,part,sub){
  if(level==='ac'){TW.level='ac'; TW.part=null; TW.sub=null;}
  else if(level==='part'){TW.level='part'; TW.part=part; TW.selPart=part; const p=twPart(part); TW.sub=sub||(p.items.slice().sort((a,b)=>b.lv-a.lv)[0]||{}).sub||null;}
  else if(level==='cmp'){if(!SPEC_OK.includes(sub)){toast('此零件暫無對比樣本');return;} TW.level='cmp'; TW.part=part; TW.sub=sub;}
  TW.delay=0; twUI(); twEnsure3D();
}
function twBind(){
  $('twBack').onclick=()=>TW.level==='cmp'?twGo('part',TW.part,TW.sub):twGo('ac');
  $('twReset').onclick=()=>twFrame(true);
}

// ---------- WebGL ----------
function twEnsure3D(){
  if(S.view!=='twin') return;
  if(!TWR&&!twInit()) return;
  twResize();
  const key=[TW.mk,TW.reg,TW.level,TW.part,TW.level==='cmp'?TW.sub:''].join('|');
  if(TWR.key!==key){TWR.key=key; twBuild(); twFrame(true);}
}
function twInit(){
  const wrap=$('twCanvas');
  try{
    if(typeof THREE==='undefined') throw new Error('no three');
    const tc=document.createElement('canvas'); if(!(tc.getContext('webgl2')||tc.getContext('webgl'))) throw new Error('no webgl');
    const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.0;
    renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    wrap.innerHTML=''; wrap.appendChild(renderer.domElement);
    const scene=new THREE.Scene(), pm=new THREE.PMREMGenerator(renderer), env=new THREE.Scene();
    const room=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:0x7a8183,side:THREE.BackSide})); room.scale.set(120,40,120); room.position.y=16; env.add(room);
    const lamp=(w,h,x,y,z,rx,ry,i)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshLambertMaterial({color:0,emissive:0xffffff,emissiveIntensity:i,side:THREE.DoubleSide}));m.position.set(x,y,z);m.rotation.set(rx,ry,0);env.add(m);};
    for(let i=-2;i<=2;i++) lamp(70,3.2,0,34,i*16,Math.PI/2,0,5.5);
    lamp(40,18,-58,16,0,0,Math.PI/2,2.6); lamp(40,18,58,16,10,0,-Math.PI/2,1.8); lamp(60,14,0,12,-58,0,0,1.4);
    scene.environment=pm.fromScene(env,0.035).texture;
    scene.add(new THREE.HemisphereLight(0xffffff,0x80898b,0.6));
    const sun=new THREE.DirectionalLight(0xffffff,2.0); sun.castShadow=true; sun.shadow.mapSize.set(2048,2048); sun.shadow.bias=-0.0004; sun.shadow.normalBias=0.04; sun.shadow.radius=4;
    scene.add(sun); scene.add(sun.target);
    const camera=new THREE.PerspectiveCamera(32,1,0.05,1200);
    TWR={renderer,scene,camera,sun,root:null,pick:[],anchors:{},key:null,labels:[],marks:[],
      cam:{theta:-0.8,phi:1.2,dist:120,target:new THREE.Vector3(),tTheta:-0.8,tPhi:1.2,tDist:120,tTarget:new THREE.Vector3()},
      spread:0,t0:performance.now(),ray:new THREE.Raycaster(),M:{}};
    twMaterials(); twControls(renderer.domElement); twPins();
    if(typeof ResizeObserver!=='undefined') new ResizeObserver(()=>twResize()).observe(wrap);
    requestAnimationFrame(twLoop); return true;
  }catch(e){
    wrap.innerHTML='<div class="tw-nogl">此瀏覽器未啟用 WebGL，無法顯示 3D 模型。請使用 Chrome 或 Edge 並開啟硬件加速。</div>'; TWR=null; return false;
  }
}
function twResize(){if(!TWR) return; const el=$('twCanvas'), w=el.clientWidth||900, h=el.clientHeight||600; TWR.renderer.setSize(w,h,false); TWR.camera.aspect=w/h; TWR.camera.updateProjectionMatrix();}
function twBuild(){
  const R_=TWR; if(R_.root){R_.scene.remove(R_.root); R_.root.traverse(o=>{if(o.geometry)o.geometry.dispose(); if(o.material){(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{if(m.map)m.map.dispose(); m.dispose();});}});}
  R_.pick=[]; R_.anchors={}; R_.fans=[]; R_.shells=null; R_.subGroups=[]; R_.labels=[]; R_.marks=[]; R_.specHoriz=false;
  const M=TWM[TW.mk], root=new THREE.Group(), R=M.W/2, yg=-R-M.clear; R_.root=root; R_.scene.add(root);
  if(TW.level==='ac'){
    root.add(twFuselage(M,TW.reg));
    const cap=twMesh(new THREE.CircleGeometry(0.15*R,32).rotateY(Math.PI),'dark','apu','exhaust'); cap.position.set(0,R*0.5,-M.L/2); root.add(cap);
    root.add(twTail(M,false)); root.add(twApu(M,false));
    for(const s of [1,-1]){const part=s<0?'wingR':'wingL', eng=s<0?'e2':'e1'; root.add(twWing(M,s,part,false));   // 機首 +Z、上 +Y：右舷為 −X
      const sec=twWingSec(M,s,0.32), r=M.fan/2, ze=sec.le[2]+0.75*r, ye=sec.le[1]-sec.c*0.055-1.3*r-0.12;
      const e=twEngine(M,eng,false); e.position.set(sec.le[0],ye,ze); root.add(e);
      const py=twPylon(M,eng,s,ze,ye,sec); py.position.set(sec.le[0],ye,ze); root.add(py);
      R_.anchors[eng]=new THREE.Vector3(sec.le[0],ye+1.25*r,ze+1.1*r);
      const ws=twWingSec(M,s,0.62); R_.anchors[part]=new THREE.Vector3(ws.le[0],ws.le[1]+0.5,ws.le[2]-ws.c*0.5);}
    const gr=twGear(M,false); root.add(gr.grp);
    R_.anchors.gear=new THREE.Vector3(-M.track,yg+M.tire*2.6,gr.mainZ); R_.anchors.tail=new THREE.Vector3(0,R*0.72+M.fin*0.75,-M.L*0.315-M.fin*0.7);
    R_.anchors.body=new THREE.Vector3(0,R*1.05,M.L*0.22); R_.anchors.apu=new THREE.Vector3(0,R*0.55,-M.L/2+0.4);
  }else if(TW.level==='part'){
    const id=TW.part; let g;
    if(id==='e1'||id==='e2') g=twEngine(M,id,true);
    else if(id.startsWith('wing')) g=twWing(M,id==='wingR'?-1:1,id,true);
    else if(id==='tail') g=twTail(M,true);
    else if(id==='apu') g=twApu(M,true);
    else if(id==='gear') g=twGear(M,true).grp;
    else g=twBodyDetail(M);
    root.add(g);
  }else root.add(twSpecimen(M));
  root.traverse(o=>{if(o.userData&&o.userData.ex){R_.subGroups.push(o); o.userData.base=o.position.clone();}});
  const box=new THREE.Box3().setFromObject(root); R_.box=box;
  const floorY=TW.level==='ac'?yg:box.min.y-0.02;
  const fl=new THREE.Mesh(new THREE.PlaneGeometry(160,160),new THREE.MeshStandardMaterial({map:TW.level==='ac'?twFloorTex(M):null,color:TW.level==='ac'?0xffffff:0xe4e7e8,roughness:.85,metalness:0,alphaMap:twFade(),transparent:true}));
  fl.rotation.x=-Math.PI/2; fl.position.y=floorY; fl.receiveShadow=true; root.add(fl);
  const size=box.getSize(new THREE.Vector3()).length(), c=box.getCenter(new THREE.Vector3());
  R_.sun.position.set(c.x-size*0.45,c.y+size*0.75,c.z+size*0.35); R_.sun.target.position.copy(c);
  const sc=R_.sun.shadow.camera, hs=size*0.6; sc.left=-hs;sc.right=hs;sc.top=hs;sc.bottom=-hs;sc.near=0.1;sc.far=size*3; sc.updateProjectionMatrix();
  R_.spread=TW.level==='part'?0:0;
}
function twFrame(snap){
  if(!TWR||!TWR.box) return; const c=TWR.cam, box=TWR.box, ctr=box.getCenter(new THREE.Vector3()), sz=box.getSize(new THREE.Vector3());
  const rad=Math.max(sz.x,sz.y*1.6,sz.z)*0.5, base=rad/Math.tan(TWR.camera.fov*Math.PI/360);
  const eng=TW.part==='e1'||TW.part==='e2';
  c.tTarget.copy(ctr);
  if(TW.level==='ac'){c.tDist=base*0.9; c.tTheta=-0.66; c.tPhi=1.22;}
  else if(TW.level==='part'){c.tDist=base*(eng?1.35:1.2); c.tTheta=eng?(TW.part==='e2'?-1.15:1.15):TW.part==='wingL'?2.4:TW.part==='wingR'?-2.4:TW.part==='tail'?-2.3:-0.9; c.tPhi=eng?1.3:1.12;}
  else {c.tDist=base*(TWR.specHoriz?0.5:0.8); c.tTheta=TWR.specHoriz?0.2:0.42; c.tPhi=TWR.specHoriz?1.02:1.32;}
  if(snap){c.target.copy(c.tTarget);c.dist=c.tDist;c.theta=c.tTheta;c.phi=c.tPhi;}
}
function twHit(e){const el=TWR.renderer.domElement, r=el.getBoundingClientRect(), v=new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);
  TWR.ray.setFromCamera(v,TWR.camera); const hs=TWR.ray.intersectObjects(TWR.pick.filter(m=>m.visible),false); for(const h of hs){if(h.object.userData.part) return h.object.userData;} return null;}
function twControls(el){
  let p=null,last=null;
  el.addEventListener('pointerdown',e=>{p={x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,moved:false,pan:e.button===2||e.shiftKey}; try{el.setPointerCapture(e.pointerId);}catch(_){}});
  el.addEventListener('pointermove',e=>{if(!p) return; const c=TWR.cam, dx=e.clientX-p.x, dy=e.clientY-p.y; if(Math.hypot(e.clientX-p.sx,e.clientY-p.sy)>5) p.moved=true;
    if(p.moved){ if(p.pan){const k=c.dist*0.0016, rt=new THREE.Vector3().setFromMatrixColumn(TWR.camera.matrixWorld,0), up=new THREE.Vector3().setFromMatrixColumn(TWR.camera.matrixWorld,1); c.tTarget.addScaledVector(rt,-dx*k).addScaledVector(up,dy*k);}
      else {c.tTheta-=dx*0.006; c.tPhi=Math.max(0.08,Math.min(TW.level==='ac'?1.52:Math.PI-0.1,c.tPhi-dy*0.006));}}
    p.x=e.clientX;p.y=e.clientY;});
  el.addEventListener('pointerup',e=>{if(p&&!p.moved&&TW.level!=='cmp'){const hit=twHit(e);
      if(hit){const id=TW.level==='ac'?hit.part:hit.sub, now=e.timeStamp, dbl=last&&last.id===id&&now-last.t<450; last=dbl?null:{id,t:now};
        if(TW.level==='ac'){TW.selPart=hit.part; if(dbl) twGo('part',hit.part); else twUI();}
        else if(hit.sub){TW.sub=hit.sub; if(dbl&&SPEC_OK.includes(hit.sub)) twGo('cmp',TW.part,hit.sub); else twUI();}}
      else last=null;} p=null;});
  el.addEventListener('contextmenu',e=>e.preventDefault());
  el.addEventListener('wheel',e=>{e.preventDefault(); const c=TWR.cam; c.tDist=Math.max(0.8,Math.min(c.tDist*Math.exp(e.deltaY*0.0012),400));},{passive:false});
  el.tabIndex=0; el.setAttribute('aria-label','3D 模型，方向鍵旋轉，加減號縮放');
  el.addEventListener('keydown',e=>{const c=TWR.cam; if(e.key==='ArrowLeft')c.tTheta-=0.12; else if(e.key==='ArrowRight')c.tTheta+=0.12; else if(e.key==='ArrowUp')c.tPhi=Math.max(0.08,c.tPhi-0.1); else if(e.key==='ArrowDown')c.tPhi=Math.min(1.52,c.tPhi+0.1);
    else if(e.key==='+'||e.key==='=')c.tDist*=0.9; else if(e.key==='-')c.tDist*=1.1; else if(e.key==='Enter'&&TW.level==='ac') twGo('part',TW.selPart); else if(e.key==='Escape'&&TW.level!=='ac') $('twBack').click(); else return; e.preventDefault(); e.stopPropagation();});
}
function twPins(){const box=$('twPins'); box.innerHTML=TW_P.map(p=>`<button data-id="${p.id}" aria-label="${p.name}"></button>`).join('');
  qa('#twPins button').forEach(b=>{b.onclick=()=>{TW.selPart=b.dataset.id; twUI();}; b.ondblclick=()=>twGo('part',b.dataset.id);});}
function twLoop(now){
  requestAnimationFrame(twLoop);
  if(!TWR||S.view!=='twin'||document.hidden||!TWR.root) return;
  const c=TWR.cam, k=A11Y.rm?1:0.14; c.theta+=(c.tTheta-c.theta)*k; c.phi+=(c.tPhi-c.phi)*k; c.dist+=(c.tDist-c.dist)*k; c.target.lerp(c.tTarget,k);
  const cam=TWR.camera; cam.position.set(c.target.x+c.dist*Math.sin(c.phi)*Math.sin(c.theta),c.target.y+c.dist*Math.cos(c.phi),c.target.z+c.dist*Math.sin(c.phi)*Math.cos(c.theta)); cam.lookAt(c.target);
  const tgt=TW.level==='part'?1:0; TWR.spread+=(tgt-TWR.spread)*(A11Y.rm?1:0.1);
  for(const o of TWR.subGroups){const ex=o.userData.ex, b=o.userData.base; if(b) o.position.set(b.x+ex[0]*TWR.spread,b.y+ex[1]*TWR.spread,b.z+ex[2]*TWR.spread);}
  if(TWR.shells) TWR.shells.forEach(h=>{const op=TW.sub==='nacelle'?0.9:0.14; h.material.opacity+=(op-h.material.opacity)*0.12; h.material.depthWrite=h.material.opacity>0.85;});
  const t=(now-TWR.t0)/1000; if(!A11Y.rm) (TWR.fans||[]).forEach(f=>f.rotation.z=t*(TW.level==='ac'?0.9:0.3));
  const pm=TW.pmap;
  for(const m of TWR.pick){const ud=m.userData, p=pm[ud.part]; if(ud.noHeat||!p||!m.material.emissive) continue;
    const lv=TW.level==='ac'?p.level:(p.subLv[ud.sub]||0), sel=TW.level==='ac'?ud.part===TW.selPart:ud.sub===TW.sub;
    let col=null, ei=0;
    if(lv>0){col=LV_COL[lv]; ei=0.2+0.08*lv+(lv>=2&&!A11Y.rm?0.18*(0.5+0.5*Math.sin(t*(lv===3?5:3))):0); if(sel) ei+=0.12;}
    else if(sel){col='#00a6ad'; ei=0.16;}
    if(col){m.material.emissive.set(col); m.material.emissiveIntensity=ei;} else {m.material.emissive.setRGB(0,0,0); m.material.emissiveIntensity=0;}}
  if((TWR.marks||[]).length) TWR.marks.forEach(mm=>{mm.quaternion.copy(cam.quaternion); mm.scale.setScalar(A11Y.rm?1:1+0.14*Math.sin(now/240));});
  TWR.renderer.render(TWR.scene,cam);
  const W_=TWR.renderer.domElement.clientWidth,H_=TWR.renderer.domElement.clientHeight;
  qa('#twPins button').forEach(b=>{const a=TWR.anchors[b.dataset.id], p=pm[b.dataset.id];
    if(!a||TW.level!=='ac'||!p){b.hidden=true;return;} const v=a.clone().project(cam), x=(v.x+1)/2*W_, y=(1-v.y)/2*H_;
    b.hidden=v.z>1||x<14||x>W_-14||y<50||y>H_-40||(p.level===0&&b.dataset.id!==TW.selPart); b.style.left=x+'px'; b.style.top=y+'px'; b.style.setProperty('--c',LV_COL[p.level]); b.classList.toggle('on',b.dataset.id===TW.selPart);});
  const lb=$('twLabels'), L=TWR.labels||[];
  if(lb._key!==TWR.key){lb.innerHTML=L.map(l=>`<div class="twl ${l.cls}">${l.html}</div>`).join(''); lb._key=TWR.key;}
  const occupied=[];
  [...lb.children].forEach((el,i)=>{
    const l=L[i];if(!l)return;const v=l.pos.clone().project(cam),ax=(v.x+1)/2*W_,ay=(1-v.y)/2*H_;
    el.hidden=v.z>1||v.z< -1||ax<0||ax>W_||ay<0||ay>H_;if(el.hidden)return;
    const w=el.offsetWidth,h=el.offsetHeight,left=Math.max(12,Math.min(W_-w-12,ax-w/2));
    const top=Math.max(62,Math.min(H_-h-60,ay-h-12));
    const candidates=[top,top-h-8,top+h+8];
    const y=candidates.find(y=>y>=62&&y+h<=H_-52&&!occupied.some(r=>left<r.x+r.w+8&&left+w+8>r.x&&y<r.y+r.h+8&&y+h+8>r.y));
    if(y===undefined){el.hidden=true;return;}occupied.push({x:left,y,w,h});
    el.style.left=left+'px';el.style.top=y+'px';
  });
}


// ================= 初始化 =================
function init(){
  gateStats();
  qa('.g-brush').forEach(i=>i.src=BRUSH_WHITE); qa('.g-brush-g').forEach(i=>i.src=BRUSH_GREEN);
  qa('.nav[data-v]').forEach(n=>n.onclick=()=>showView(n.dataset.v));
  $('gForm').addEventListener('submit',gateSubmit); qa('#gRole button').forEach(b=>b.onclick=()=>gateRole(b.dataset.r));
  $('gReg').onclick=subscriptionOpen;$('gSalesClose').onclick=()=>subscriptionClose(false);$('gSalesOk').onclick=()=>subscriptionClose(true);
  $('gSubscribe').addEventListener('submit',subscriptionSubmit);$('gate').addEventListener('keydown',gateKeydown);
  $('gSales').onclick=e=>{if(e.target===$('gSales'))subscriptionClose(false);};
  $('btnOut').onclick=()=>{const role=S.role;try{sessionStorage.removeItem('cx_aaas_auth');sessionStorage.removeItem('cx_aaas_external_email');}catch(e){} audit('登出',roleName());aiToggle(false);gateRole(role);gateShow(true);};
  $('btnAI').onclick=()=>{accessMenu(false);aiToggle();}; $('aiClose').onclick=()=>{aiToggle(false);$('btnAI').focus();};
  $('aiForm').addEventListener('submit',e=>{e.preventDefault(); const q=$('aiIn').value; $('aiIn').value=''; aiAsk(q);});
  $('btnA11y').onclick=e=>{e.stopPropagation();accessMenu(!$('a11yMenu').classList.contains('on'),true);};
  $('btnA11y').onkeydown=e=>{if(e.key==='ArrowDown'){e.preventDefault();accessMenu(true,true);}};
  $('a11yMenu').onkeydown=e=>{const items=qa('#a11yMenu [data-a]'),i=items.indexOf(document.activeElement);if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?items.length-1:(i+(e.key==='ArrowDown'?1:-1)+items.length)%items.length;items[next].focus();}else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();accessMenu(false);$('btnA11y').focus();}};
  qa('#a11yMenu [data-a]').forEach(b=>b.onclick=e=>{e.stopPropagation(); A11Y[b.dataset.a]=!A11Y[b.dataset.a]; applyA11y();renderAll(); setTimeout(()=>{Object.values(charts).forEach(c=>{try{c.reflow();}catch(e){}}); twResize();},60);});
  document.addEventListener('click',e=>{if(!e.target.closest||!e.target.closest('.a11y'))accessMenu(false);});
  document.addEventListener('focusin',e=>{if(!e.target.closest||!e.target.closest('.a11y'))accessMenu(false);});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){const aiFocus=$('ai').contains(document.activeElement);aiToggle(false);if(aiFocus)$('btnAI').focus();$('modal').classList.remove('on');accessMenu(false);}});
  $('mClose').onclick=()=>$('modal').classList.remove('on'); $('modal').onclick=e=>{if(e.target.id==='modal') $('modal').classList.remove('on');};
  $('lnkSrc').onclick=e=>{e.preventDefault();infoSources();}; $('lnkGl').onclick=e=>{e.preventDefault();infoGloss();};
  twBind();
  applyA11y();
  let auth=null; try{auth=sessionStorage.getItem('cx_aaas_auth');}catch(e){}
  if(auth&&ROLES[auth]&&(auth!=='external'||validExternalSession())){gateRole(auth);enter(auth,true);}else{try{sessionStorage.removeItem('cx_aaas_auth');sessionStorage.removeItem('cx_aaas_external_email');}catch(e){}gateRole(auth==='external'?'external':'mcc');applyRole();gateShow(true);showView('overview');}
}
solve();
globalThis.__app={gateStats,rollParams,rollFor,rollRun,renderRoll,wpSet,wp,feedbackList,renderFeedback,renderLine,carbonTiers,cowRenderPhase,curveOf,byId,LG,S,MD,renderModel,COW,selfish,annual,cowData,T,W,get P(){return P},solve,showView,renderAll,enter,aiAns,TW,twParts,twBuild,twFrame,twSpecInfo,get TWR(){return TWR},set TWR(v){TWR=v},twMaterials,carbonCalc,planAircraft,level,twMap};
try{init();}catch(e){console.error('init',e);}
})();
