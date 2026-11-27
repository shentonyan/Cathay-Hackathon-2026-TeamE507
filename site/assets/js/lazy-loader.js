/* global MODEL9 */
(function(){
'use strict';
// 僅在使用對應頁面時載入；組內逐一執行以維持依賴順序。
// Load only on activation; execute each group sequentially to preserve dependency order.
const groups={
  charts:{
    files:['assets/vendor/highcharts.js','assets/vendor/highcharts-more.js'],
    ready:()=>globalThis.Highcharts&&typeof globalThis.Highcharts.chart==='function'&&
      !!globalThis.Highcharts.seriesTypes.errorbar&&!!globalThis.Highcharts.seriesTypes.arearange
  },
  model:{
    files:['assets/data/model-formulas.js'],
    ready:()=>typeof MODEL9!=='undefined'&&Array.isArray(MODEL9.secs)&&Array.isArray(MODEL9.syms)
  },
  twin:{
    files:['assets/vendor/three.min.js','assets/js/part-specimens.js'],
    ready:()=>typeof globalThis.THREE!=='undefined'&&typeof globalThis.TWX_make==='function'
  }
};
const scripts=new Map(), pendingGroups=new Map(), loadedGroups=new Set();
function loadScript(src){
  if(scripts.get(src)===true) return Promise.resolve();
  if(scripts.has(src)) return scripts.get(src);
  const promise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    let done=false;
    const timer=setTimeout(()=>finish(new Error('載入逾時：'+src)),45000);
    function finish(error){
      if(done) return; done=true; clearTimeout(timer);
      script.onload=null; script.onerror=null;
      if(error){script.remove();reject(error);}else resolve();
    }
    script.async=false;
    script.src=src;
    script.onload=()=>finish();
    script.onerror=()=>finish(new Error('載入失敗：'+src));
    document.head.appendChild(script);
  });
  scripts.set(src,promise);
  promise.then(()=>scripts.set(src,true),()=>scripts.delete(src));
  return promise;
}
async function load(name){
  const group=groups[name];
  if(!group) throw new Error('未知的延遲載入群組：'+name);
  if(loadedGroups.has(name)) return;
  if(pendingGroups.has(name)) return pendingGroups.get(name);
  const promise=(async()=>{
    for(const src of group.files){
      await loadScript(src);
      if(scripts.get(src)!==true) throw new Error('載入未完成：'+src);
    }
    if(!group.ready()) throw new Error('資源初始化失敗：'+name);
    loadedGroups.add(name);
  })();
  pendingGroups.set(name,promise);
  try{await promise;}finally{pendingGroups.delete(name);}
}
globalThis.SiteAssets={load,isLoaded:name=>loadedGroups.has(name)};
})();
