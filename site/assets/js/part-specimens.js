/*TWX_START*/
// ===== 零件標本庫：參數化葉片、火焰筒、起動發電機、引氣管、舵面密封；正常件與問題件 =====
function TWX_make(THREE){
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)), sm=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
  const mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
  const hx=c=>[(c>>16&255)/255,(c>>8&255)/255,(c&255)/255];
  const nacaT=x=>5*(0.2969*Math.sqrt(Math.max(x,0))-0.126*x-0.3516*x*x+0.2843*x*x*x-0.1036*x*x*x*x);
  const cosSpace=n=>{const a=[];for(let i=0;i<=n;i++)a.push((1-Math.cos(Math.PI*i/n))/2);return a;};
  const noise=(x,y)=>{const s=Math.sin(x*12.9898+y*78.233)*43758.5453;return s-Math.floor(s);};
  const vnoise=(x,y)=>{const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);
    const a=noise(xi,yi),b=noise(xi+1,yi),c=noise(xi,yi+1),d=noise(xi+1,yi+1);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;};
  const fbm=(x,y)=>0.55*vnoise(x,y)+0.3*vnoise(x*2.1,y*2.1)+0.15*vnoise(x*4.3,y*4.3);
  const geo=(pos,idx,col,uv)=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    if(col) g.setAttribute('color',new THREE.Float32BufferAttribute(col,3)); if(uv) g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    g.setIndex(idx); g.computeVertexNormals(); return g;};

  // ---------- 葉片曲面（翼型放樣：弦長、安裝角、厚度、彎度、掠、傾沿葉高變化） ----------
  // 座標：Y = 徑向（葉高），Z = 軸向（+Z 為上游，氣流往 −Z），X = 周向。
  function bladeSurf(o){
    const nc=o.nc||28, ns=o.ns||28, us=cosSpace(nc), loop=[];
    us.forEach(u=>loop.push([u,1])); for(let i=us.length-2;i>=1;i--) loop.push([us[i],-1]);
    const M_=loop.length, pos=[], col=[], idx=[], one=()=>1;
    const F=k=>{const f=k/ns; return f;};
    for(let k=0;k<=ns;k++){
      const f=F(k);
      for(const [u0,side] of loop){
        let u=u0, fe=f;
        if(o.cut){const cu=o.cut(u); fe=Math.min(f,1-cu);}            // 葉尖燒蝕／缺損：超出缺損線的點收到缺損線上
        if(o.notch){const nt=o.notch, b=Math.max(0,1-Math.pow((fe-nt.f)/nt.w,2)); if(b>0){const d=nt.d*b; u=d+u*(1-d);}} // 前緣缺口
        const c=o.chord(fe), st=o.stagger(fe), t=o.thick(fe), m=o.camber(fe), r=o.rh+(o.rt-o.rh)*fe;
        const yc=m*4*u*(1-u), th=Math.atan(m*4*(1-2*u)), yt=t*nacaT(u);
        const xu=u-side*yt*Math.sin(th), yu=yc+side*yt*Math.cos(th), xc=(xu-0.5)*c, yn=yu*c;
        let X=(o.lean?o.lean(fe):0)+xc*Math.sin(st)+yn*Math.cos(st), Y=r, Z=(o.sweep?o.sweep(fe):0)-xc*Math.cos(st)+yn*Math.sin(st);
        if(o.curl){const q=o.curl(u,fe); X+=q;}                         // 葉尖捲曲（周向彎折）
        pos.push(X,Y,Z);
        col.push(...(o.color?o.color(u0,f,side,fe):[1,1,1]));
      }
    }
    for(let k=0;k<ns;k++) for(let j=0;j<M_;j++){const a=k*M_+j,b=k*M_+(j+1)%M_,c=(k+1)*M_+j,d=(k+1)*M_+(j+1)%M_; idx.push(a,b,c,b,d,c);}
    // 端蓋（根部朝 −Y，葉尖朝 +Y）
    for(const [k,flip] of [[0,true],[ns,false]]){const base=k*M_, cx=[0,0,0], cc=[0,0,0];
      for(let j=0;j<M_;j++) for(let q=0;q<3;q++){cx[q]+=pos[(base+j)*3+q]/M_; cc[q]+=col[(base+j)*3+q]/M_;}
      const ci=pos.length/3; pos.push(...cx); col.push(...cc);
      for(let j=0;j<M_;j++){const a=base+j,b=base+(j+1)%M_; flip?idx.push(ci,a,b):idx.push(ci,b,a);}}
    return geo(pos,idx,col);
  }
  // 方向自檢：返回朝外法線比例（用於驗收，無建模錯誤）
  function outwardRatio(g){
    const p=g.attributes.position.array, id=g.index.array; let ok=0,n=0; const ctr=new THREE.Vector3(); const bb=new THREE.Box3().setFromBufferAttribute(g.attributes.position);
    for(let i=0;i<id.length;i+=3){const a=new THREE.Vector3().fromArray(p,id[i]*3),b=new THREE.Vector3().fromArray(p,id[i+1]*3),c=new THREE.Vector3().fromArray(p,id[i+2]*3);
      const nn=new THREE.Vector3().subVectors(b,a).cross(new THREE.Vector3().subVectors(c,a)); if(nn.lengthSq()<1e-14) continue;
      ctr.set(0,(a.y+b.y+c.y)/3,0); // 同一葉高截面中心近似
      n++; }
    return {tris:id.length/3,bbox:bb};
  }

  // ---------- 根部：燕尾榫（壓氣機、風扇）與樅樹形榫頭（渦輪） ----------
  function rootGeo(kind,w,h,L,zc,y0){
    const s=new THREE.Shape();
    if(kind==='fir'){
      const lobes=3, step=h/(lobes+0.6);
      s.moveTo(-w*0.62,0); s.lineTo(w*0.62,0);
      let y=0, x=w*0.62;
      for(let i=0;i<lobes;i++){const xo=x, xi=xo-w*0.16; s.lineTo(xi,y-step*0.45); s.lineTo(xo-w*0.02,y-step*0.7); s.lineTo(xi-w*0.06,y-step); y-=step; x=xo-w*0.12;}
      s.lineTo(w*0.14,y-step*0.5); s.lineTo(-w*0.14,y-step*0.5);
      y=0; x=w*0.62; const pts=[]; for(let i=0;i<lobes;i++){const xo=x, xi=xo-w*0.16; pts.push([xi,y-step*0.45],[xo-w*0.02,y-step*0.7],[xi-w*0.06,y-step]); y-=step; x=xo-w*0.12;}
      for(let i=pts.length-1;i>=0;i--) s.lineTo(-pts[i][0],pts[i][1]);
      s.lineTo(-w*0.62,0);
    }else{
      s.moveTo(-w*0.36,0); s.lineTo(w*0.36,0); s.lineTo(w*0.36,-h*0.28); s.lineTo(w*0.62,-h*0.86); s.lineTo(w*0.5,-h); s.lineTo(-w*0.5,-h); s.lineTo(-w*0.62,-h*0.86); s.lineTo(-w*0.36,-h*0.28); s.lineTo(-w*0.36,0);
    }
    const g=new THREE.ExtrudeGeometry(s,{depth:L,bevelEnabled:true,bevelThickness:L*0.02,bevelSize:w*0.02,bevelSegments:2,curveSegments:2});
    g.translate(0,y0,zc-L/2); g.computeVertexNormals(); return g;
  }
  function boxAt(w,h,d,x,y,z){const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);return g;}

  // ---------- 標準材料 ----------
  const mat={
    vc:(m,r)=>new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,metalness:m==null?.7:m,roughness:r==null?.32:r}),
    metal:()=>new THREE.MeshStandardMaterial({color:0xb9c0c4,metalness:.85,roughness:.3}),
    nickel:()=>new THREE.MeshStandardMaterial({color:0xa79f93,metalness:.8,roughness:.36}),
    dark:()=>new THREE.MeshStandardMaterial({color:0x2c3136,metalness:.5,roughness:.45}),
    rubber:()=>new THREE.MeshStandardMaterial({color:0x1b1c1e,metalness:0,roughness:.85}),
    paint:()=>new THREE.MeshStandardMaterial({color:0xe9ecec,metalness:.05,roughness:.4}),
    steel:()=>new THREE.MeshStandardMaterial({color:0x8c959b,metalness:.9,roughness:.28})
  };
  const mesh=(g,m)=>{const me=new THREE.Mesh(g,m);me.castShadow=true;me.receiveShadow=true;return me;};

  // ---------- 各類葉片參數（依發動機型號） ----------
  const ENG={
    'GE90-115B':{fan:{n:22,mat:'composite',hub:0.33},booster:3,hpc:9,hpt:2,lpt:6,shafts:2},
    'Rolls-Royce Trent XWB-84':{fan:{n:22,mat:'ti',hub:0.30},ipc:8,hpc:6,hpt:1,ipt:2,lpt:6,shafts:3},
    'Rolls-Royce Trent 700':{fan:{n:26,mat:'ti',hub:0.32},ipc:8,hpc:6,hpt:1,ipt:1,lpt:4,shafts:3},
    'CFM LEAP-1A':{fan:{n:18,mat:'composite',hub:0.30},booster:3,hpc:10,hpt:2,lpt:7,shafts:2},
    'Rolls-Royce Trent 892':{fan:{n:26,mat:'ti',hub:0.32},ipc:8,hpc:6,hpt:1,ipt:1,lpt:5,shafts:3},
    'Rolls-Royce Trent XWB-97':{fan:{n:22,mat:'ti',hub:0.30},ipc:8,hpc:6,hpt:1,ipt:2,lpt:6,shafts:3}
  };
  const COL={ti:hx(0xb7bec2),comp:hx(0x2a2e33),nick:hx(0xc4c6c4),tbc:hx(0xd9d2c2),burn:hx(0x3a2a22),blue:hx(0x4a5a78),straw:hx(0xb59a5c),soot:hx(0x26221f),foul:hx(0x8a6d4a),bare:hx(0xe2e6e8)};

  // 風扇葉片（寬弦、後掠；複合材料葉片帶鈦合金前緣）
  function fanBladeSpec(eng,dmg){
    const E=ENG[eng]||ENG['GE90-115B'], comp=E.fan.mat==='composite', rh=0.0, rt=1.0;
    const o={nc:30,ns:34,rh,rt,
      chord:f=>0.30+0.30*Math.sin(Math.min(1,f*1.2)*Math.PI/2)-0.07*sm(0.86,1,f),
      stagger:f=>0.30+0.85*Math.pow(f,0.85), thick:f=>0.12-0.085*f, camber:f=>0.08-0.05*f,
      sweep:f=>-0.16*f*f+0.03*f, lean:f=>0.04*f*f};
    const nk=dmg?{f:0.72,w:0.07,d:0.11}:null; if(nk) o.notch=nk;
    o.color=(u,f,side)=>{let c=comp?(u<0.07?COL.ti:COL.comp):COL.ti;
      if(comp&&u>=0.07&&u<0.09) c=mix(COL.ti,COL.comp,(u-0.07)/0.02);
      const n=fbm(u*30,f*30)*0.06; c=c.map(x=>clamp(x+n-0.03,0,1));
      if(nk){const b=Math.max(0,1-Math.pow((f-nk.f)/(nk.w*1.6),2)); if(b>0&&u<0.25) c=mix(c,COL.bare,b*sm(0.25,0.02,u));}
      return c;};
    const g=new THREE.Group(), blade=mesh(bladeSurf(o),mat.vc(comp?.45:.8,comp?.42:.28));
    g.add(blade);
    const c0=o.chord(0), L=c0*Math.cos(o.stagger(0))*1.05+0.04, zc=0;
    g.add(mesh(boxAt(0.17,0.03,L,0,-0.015,zc),mat.metal()));
    g.add(mesh(rootGeo('dove',0.13,0.12,L,zc,-0.03),mat.metal()));
    return {g,size:{h:1.12},info:{realH:Math.round(((ENG[eng]?1:1)*(1-E.fan.hub))*({'GE90-115B':3.25,'Rolls-Royce Trent XWB-84':3.0,'Rolls-Royce Trent XWB-97':3.0,'Rolls-Royce Trent 892':2.79,'Rolls-Royce Trent 700':2.47,'CFM LEAP-1A':1.98}[eng]||3)/2*100)},
      mark:dmg?new THREE.Vector3(o.lean(nk.f)+(-0.5*o.chord(nk.f))*Math.sin(o.stagger(nk.f)),rh+(rt-rh)*nk.f,(o.sweep(nk.f))+0.5*o.chord(nk.f)*Math.cos(o.stagger(nk.f))):null};
  }
  // 壓氣機葉片（高壓壓氣機前級；問題件：葉尖燒蝕與捲曲＋前緣侵蝕；或積垢）
  function hpcBladeSpec(eng,dmg){
    const o={nc:26,ns:30,rh:0,rt:1,
      chord:f=>0.66-0.16*f, stagger:f=>0.55+0.30*f, thick:f=>0.09-0.035*f, camber:f=>0.08-0.03*f, sweep:f=>-0.06*f, lean:f=>0.03*f*f};
    const tipLoss=dmg==='tip', foul=dmg==='foul';
    if(tipLoss){
      o.cut=u=>0.05+0.16*Math.pow(1-u,1.4)+0.07*Math.pow(u,3)+0.03*fbm(u*9,3.1);
      o.curl=(u,f)=>-0.09*sm(0.74,1,f)*(1-u)*(1-u);
      o.notch={f:0.55,w:0.30,d:0.045};
    }
    o.color=(u,f,side,fe)=>{let c=COL.nick; const n=fbm(u*25,f*25)*0.08; c=c.map(x=>clamp(x+n-0.04,0,1));
      if(tipLoss){const tf=sm(0.70,0.92,f); c=mix(c,COL.straw,tf*0.8); c=mix(c,COL.blue,sm(0.82,0.96,f)*0.7); c=mix(c,COL.burn,sm(0.9,1,f)*(0.6+0.4*fbm(u*14,7)));
        if(u<0.08) c=mix(c,COL.bare,0.35*sm(0.3,0.85,f));}
      if(foul&&side<0){const d=fbm(u*8,f*8); c=mix(c,COL.foul,clamp(0.45+0.5*d,0,0.9));}
      if(foul&&side>0){const d=fbm(u*7+3,f*7); c=mix(c,COL.foul,clamp(0.3+0.4*d,0,0.65));}
      return c;};
    const g=new THREE.Group(); g.add(mesh(bladeSurf(o),mat.vc(.82,.3)));
    const L=o.chord(0)*Math.cos(o.stagger(0))*1.08+0.04;
    g.add(mesh(boxAt(0.36,0.05,L,0,-0.025,0),mat.vc(.8,.34)));
    g.children[1].geometry.setAttribute('color',new THREE.Float32BufferAttribute(new Array(g.children[1].geometry.attributes.position.count).fill(0).flatMap(()=>COL.nick),3));
    g.add(mesh(rootGeo('dove',0.24,0.22,L,0,-0.05),mat.metal()));
    const mk=tipLoss?new THREE.Vector3(o.lean(0.9),0.9,o.sweep(0.9)+0.15):foul?new THREE.Vector3(0.05,0.5,0.0):null;
    return {g,size:{h:1.27},info:{},mark:mk};
  }
  // 高壓渦輪葉片（單晶鎳基＋熱障塗層、氣膜冷卻孔、樅樹形榫頭；問題件：塗層剝落＋葉尖燒蝕）
  function hptBladeSpec(eng,dmg){
    const o={nc:30,ns:24,rh:0,rt:0.66,
      chord:f=>0.70-0.05*f, stagger:f=>-0.42-0.12*f, thick:f=>0.30-0.06*f, camber:f=>0.20-0.03*f, sweep:f=>0, lean:f=>0};
    const bad=!!dmg;
    if(bad){o.cut=u=>0.02+0.07*sm(0.55,1,u)*(0.7+0.3*fbm(u*11,2));}
    o.color=(u,f,side)=>{let c=COL.tbc; c=mix(c,COL.straw,0.25*fbm(u*6,f*6));
      // 前緣噴淋冷卻孔與壓力面氣膜孔排
      const holeRow=(uc,du)=>Math.abs(u-uc)<du;
      const fr=(f*24)%1;
      if((holeRow(0.012,0.008)||holeRow(0.05,0.006)&&side>0||holeRow(0.3,0.006)&&side<0||holeRow(0.62,0.006)&&side<0)&&fr>0.35&&fr<0.65) c=hx(0x2a2622);
      if(u>0.94) c=mix(c,hx(0x6f6a62),0.6);
      if(bad){const sp=fbm(u*9+1.7,f*9); const spall=side<0&&u>0.15&&u<0.65&&f>0.35&&f<0.85&&sp>0.55;
        if(spall) c=mix(hx(0x8b7f6c),hx(0x5a4f45),fbm(u*30,f*30));
        c=mix(c,COL.burn,sm(0.86,0.98,f)*sm(0.45,0.9,u)); c=mix(c,COL.blue,sm(0.75,0.9,f)*0.25);}
      return c;};
    const g=new THREE.Group(); g.add(mesh(bladeSurf(o),mat.vc(.35,.55)));
    const L=0.70*Math.cos(0.42)*1.12+0.05;
    g.add(mesh(boxAt(0.50,0.06,L,0,-0.03,0),mat.nickel()));                  // 平台
    g.add(mesh(boxAt(0.17,0.16,L*0.9,0,-0.14,0),mat.nickel()));              // 柄部
    g.add(mesh(rootGeo('fir',0.28,0.30,L*0.92,0,-0.22),mat.nickel()));        // 樅樹形榫頭
    return {g,size:{h:1.2},info:{},mark:bad?new THREE.Vector3(0.05,0.42,-0.02):null};
  }
  // 燃燒室火焰筒段（多孔冷卻壁板；問題件：熱裂紋＋燒蝕變色）
  function linerSpec(eng,dmg){
    const R=1.6, th0=-0.42, th1=0.42, H=1.1, nA=90, nH=60, t=0.035, pos=[], col=[], idx=[];
    const bad=!!dmg, crack=(a,h)=>{const cx=0.05*Math.sin(h*9)+0.03*Math.sin(h*23); return Math.abs(a-cx-0.02)<0.012*(1-Math.abs(h-0.5)*1.4)&&h>0.18&&h<0.86;};
    const colAt=(a,h)=>{let c=hx(0xa49a8a); c=mix(c,hx(0x6e5f50),0.35*fbm(a*8,h*8));
      const ga=(a*40)%1, gh=(h*28)%1; if(ga>0.42&&ga<0.58&&gh>0.42&&gh<0.58) c=hx(0x2a2421);
      if(bad){const d=Math.hypot(a*1.2,h-0.55); c=mix(c,hx(0x3b2c24),sm(0.32,0.05,d)*0.85); c=mix(c,hx(0x4c5d7c),sm(0.42,0.25,d)*0.35); if(crack(a,h)) c=hx(0x0d0b0a);}
      return c;};
    for(const [rr,s] of [[R,1],[R-t,-1]]) for(let i=0;i<=nH;i++) for(let j=0;j<=nA;j++){const h=i/nH, th=th0+(th1-th0)*j/nA, a=(j/nA-0.5);
      pos.push(rr*Math.sin(th),h*H,rr*Math.cos(th)-R); col.push(...colAt(a,h));}
    const N=(nH+1)*(nA+1);
    for(let i=0;i<nH;i++) for(let j=0;j<nA;j++){const a=i*(nA+1)+j,b=a+1,c=a+nA+1,d=c+1; idx.push(a,c,b,b,c,d); idx.push(N+a,N+b,N+c,N+b,N+d,N+c);}
    const edge=(ids)=>{for(let k=0;k<ids.length-1;k++){const a=ids[k],b=ids[k+1]; idx.push(a,b,N+a,b,N+b,N+a);}};
    const bot=[],top=[],l=[],r=[]; for(let j=0;j<=nA;j++){bot.push(j);top.push(nH*(nA+1)+j);} for(let i=0;i<=nH;i++){l.push(i*(nA+1));r.push(i*(nA+1)+nA);}
    edge(bot.slice().reverse()); edge(top); edge(l); edge(r.slice().reverse());
    const g=new THREE.Group(); g.add(mesh(geo(pos,idx,col),mat.vc(.6,.5)));
    return {g,size:{h:H},info:{},mark:bad?new THREE.Vector3(R*Math.sin(0.02*(th1-th0)),0.55*H,R*Math.cos(0.02)-R+0.05):null};
  }
  // APU 起動發電機（散熱鰭片、接線盒、驅動花鍵；問題件：過熱變色＋驅動端滲油）
  function generatorSpec(eng,dmg){
    const bad=!!dmg, g=new THREE.Group();
    const prof=[[0.0001,0.62],[0.16,0.62],[0.2,0.58],[0.34,0.56],[0.36,0.5],[0.36,-0.42],[0.40,-0.46],[0.40,-0.52],[0.30,-0.56],[0.10,-0.58],[0.0001,-0.58]];
    const lg=new THREE.LatheGeometry(prof.map(([r,y])=>new THREE.Vector2(r,y)),72); const n=lg.attributes.position.count, cc=[];
    for(let i=0;i<n;i++){const x=lg.attributes.position.getX(i),y=lg.attributes.position.getY(i),z=lg.attributes.position.getZ(i),a=Math.atan2(z,x);
      let c=hx(0x9aa2a6); c=mix(c,hx(0x7d868b),0.4*fbm(a*3,y*6));
      if(bad){const hot=sm(0.6,-0.1,y); c=mix(c,COL.straw,hot*0.8); c=mix(c,COL.blue,sm(0.15,-0.3,y)*0.7*(0.6+0.4*Math.cos(a-0.6)));
        const streak=Math.abs(a-0.9)<0.18&&y<-0.05; if(streak) c=mix(c,hx(0x2a2016),0.75*sm(-0.05,-0.5,y));}
      cc.push(...c);}
    lg.setAttribute('color',new THREE.Float32BufferAttribute(cc,3)); lg.computeVertexNormals();
    g.add(mesh(lg,mat.vc(.75,.38)));
    for(let i=0;i<24;i++){const a=2*Math.PI*i/24,f=new THREE.BoxGeometry(0.012,0.78,0.07); f.translate(0,0.02,0.39); f.rotateY(a); g.add(mesh(f,mat.vc(.75,.38)));
      const k=g.children[g.children.length-1].geometry, m=k.attributes.position.count, c2=[]; for(let j=0;j<m;j++){const y=k.attributes.position.getY(j); let c=hx(0x9aa2a6); if(bad){c=mix(c,COL.straw,sm(0.6,-0.1,y)*0.75);c=mix(c,COL.blue,sm(0.1,-0.3,y)*0.65);} c2.push(...c);} k.setAttribute('color',new THREE.Float32BufferAttribute(c2,3));}
    g.add(mesh(new THREE.BoxGeometry(0.26,0.22,0.16).translate(0,0.25,0.5),mat.dark()));                      // 接線盒
    for(const x of [-0.07,0,0.07]) g.add(mesh(new THREE.CylinderGeometry(0.018,0.018,0.06,12).rotateX(Math.PI/2).translate(x,0.27,0.6),mat.steel()));
    g.add(mesh(new THREE.CylinderGeometry(0.07,0.07,0.22,24).translate(0,-0.68,0),mat.steel()));               // 驅動花鍵軸
    for(let i=0;i<16;i++){const a=2*Math.PI*i/16; g.add(mesh(new THREE.BoxGeometry(0.014,0.2,0.02).translate(0,-0.69,0.075).rotateY(a),mat.steel()));}
    for(let i=0;i<8;i++){const a=2*Math.PI*i/8+0.2; g.add(mesh(new THREE.CylinderGeometry(0.022,0.022,0.04,10).translate(Math.cos(a)*0.37,-0.53,Math.sin(a)*0.37),mat.steel()));}
    return {g,size:{h:1.4},info:{},mark:bad?new THREE.Vector3(0.36*Math.cos(0.9),-0.25,0.36*Math.sin(0.9)):null};
  }
  // 引氣管接頭（V 型卡箍＋法蘭；問題件：卡箍鬆脫、接縫間隙、煙跡）
  function bleedSpec(eng,dmg){
    const bad=!!dmg, g=new THREE.Group(), R=0.16, gap=bad?0.035:0.0;
    const tube=(z0,z1,bend)=>{const pts=[];for(let i=0;i<=24;i++){const t=i/24,z=z0+(z1-z0)*t; pts.push(new THREE.Vector3(bend*Math.pow(t,2)*0.0,0,z));}
      const cv=new THREE.CatmullRomCurve3(pts), tg=new THREE.TubeGeometry(cv,40,R,40,false), n=tg.attributes.position.count, cc=[];
      for(let i=0;i<n;i++){const z=tg.attributes.position.getZ(i), x=tg.attributes.position.getX(i), y=tg.attributes.position.getY(i); let c=hx(0xb7b2a5); c=mix(c,hx(0x8d8679),0.35*fbm(Math.atan2(y,x)*2,z*5));
        if(bad){const d=Math.abs(z); c=mix(c,COL.soot,sm(0.6,0.0,d)*(0.7+0.3*fbm(Math.atan2(y,x)*3,z*7))*(y>-0.05?1:0.75));}
        cc.push(...c);} tg.setAttribute('color',new THREE.Float32BufferAttribute(cc,3)); return tg;};
    g.add(mesh(tube(-1.1,-0.03-gap/2,0),mat.vc(.8,.35))); g.add(mesh(tube(0.03+gap/2,1.1,0),mat.vc(.8,.35)));
    for(const s of [-1,1]){const f=new THREE.CylinderGeometry(R+0.05,R+0.05,0.05,48).rotateX(Math.PI/2).translate(0,0,s*(0.03+gap/2)-s*0.012); g.add(mesh(f,mat.steel()));}
    const clamp_=new THREE.TorusGeometry(R+0.065,0.03,10,64,Math.PI*1.86); clamp_.rotateZ(Math.PI/2+0.14); if(bad){clamp_.translate(0.03,-0.04,0.07);} g.add(mesh(clamp_,mat.steel()));
    const tb=new THREE.BoxGeometry(0.06,0.11,0.07); tb.translate(-(R+0.1),0,0); if(bad) tb.translate(0.03,-0.04,0.07); g.add(mesh(tb,mat.steel()));
    const bolt=new THREE.CylinderGeometry(0.014,0.014,0.16,12); bolt.translate(-(R+0.1),0,0); if(bad) bolt.translate(0.03,-0.04,0.07); g.add(mesh(bolt,mat.steel()));
    g.rotation.x=0; return {g,size:{h:2.2},info:{},mark:bad?new THREE.Vector3(0,R+0.02,0):null,horiz:true};
  }
  // 舵面後緣密封（舵面段＋橡膠密封條；問題件：密封條撕裂缺失）
  function sealSpec(eng,dmg){
    const bad=!!dmg, g=new THREE.Group(), span=1.6, c=0.9;
    const N=40, pts=[]; for(let i=0;i<=N;i++){const u=i/N; pts.push(new THREE.Vector2(u*c,0.09*nacaT(u)*c*2));} for(let i=N-1;i>=1;i--){const u=i/N; pts.push(new THREE.Vector2(u*c,-0.09*nacaT(u)*c*2));}
    const s2=new THREE.Shape(pts); const ex=new THREE.ExtrudeGeometry(s2,{depth:span,bevelEnabled:false,curveSegments:2}); ex.translate(-c/2,0,-span/2);
    const n=ex.attributes.position.count, cc=[]; for(let i=0;i<n;i++){const x=ex.attributes.position.getX(i), z=ex.attributes.position.getZ(i); let col=hx(0xdfe3e4); col=mix(col,hx(0xc5ccce),0.4*fbm(x*6,z*6)); if(bad&&x<-0.1) col=mix(col,hx(0x7a7468),0.35*sm(0.3,0,Math.abs(z-0.2))*fbm(x*12,z*3)); cc.push(...col);} ex.setAttribute('color',new THREE.Float32BufferAttribute(cc,3)); ex.computeVertexNormals();
    g.add(mesh(ex,mat.vc(.1,.45)));
    const seal=(z0,z1)=>{const gg=new THREE.CylinderGeometry(0.035,0.035,z1-z0,16).rotateX(Math.PI/2).translate(-c/2-0.03,0.0,(z0+z1)/2); return mesh(gg,mat.rubber());};
    if(bad){g.add(seal(-span/2,-0.05)); g.add(seal(0.42,span/2));
      const flap=new THREE.BoxGeometry(0.02,0.08,0.16); flap.rotateY(0.6); flap.translate(-c/2-0.06,-0.04,0.02); g.add(mesh(flap,mat.rubber()));}
    else g.add(seal(-span/2,span/2));
    for(let k=-3;k<=3;k++) g.add(mesh(new THREE.CylinderGeometry(0.012,0.012,0.02,10).translate(-c/2+0.06,0.03,k*0.22),mat.steel()));
    return {g,size:{h:1.6},info:{},mark:bad?new THREE.Vector3(-c/2-0.03,0.04,0.18):null,horiz:true};
  }
  // ---------- 發動機級葉環（全機拆解視圖用；翼型葉片取代方塊） ----------
  function ring(n,rh,rt,chord,thick,z,st0,st1,camber,kind){
    const o={nc:kind==='fan'?14:8,ns:kind==='fan'?14:3,rh,rt,chord:f=>chord*(kind==='fan'?(0.8+0.45*f):(1-0.15*f)),stagger:f=>st0+(st1-st0)*f,thick:f=>thick*(1-0.4*f),camber:f=>camber,sweep:f=>kind==='fan'?-0.08*chord*f*f:0};
    const one=bladeSurf(o); one.deleteAttribute('color');
    const gs=[]; for(let i=0;i<n;i++){const g=one.clone(); g.rotateZ(2*Math.PI*i/n); g.translate(0,0,z); gs.push(g);}
    // 合併
    let cnt=0; gs.forEach(g=>cnt+=g.attributes.position.count); const P=new Float32Array(cnt*3), Nn=new Float32Array(cnt*3), I=[]; let off=0;
    gs.forEach(g=>{P.set(g.attributes.position.array,off*3); Nn.set(g.attributes.normal.array,off*3); for(const v of g.index.array) I.push(v+off); off+=g.attributes.position.count;});
    const m=new THREE.BufferGeometry(); m.setAttribute('position',new THREE.BufferAttribute(P,3)); m.setAttribute('normal',new THREE.BufferAttribute(Nn,3)); m.setIndex(I); return m;
  }
  const SPEC={fan:fanBladeSpec,hpc:hpcBladeSpec,turbine:hptBladeSpec,burn:linerSpec,generator:generatorSpec,nacelle:bleedSpec,flap:sealSpec,aileron:sealSpec,slat:sealSpec,spoiler:sealSpec};
  return {ENG,SPEC,ring,bladeSurf,outwardRatio,COL};
}
/*TWX_END*/
