/* Neptune water journey — installed in the Neptune app (neptune-treatment-train.html), with window.__journeySet bridge.
   Source: design handover file neptune-treatment-train.js.
   Original header follows.
   Neptune water journey (design handover v9, version 4).
   =====================================================================
   One WebGL scene on a light sky background, drawn as a living 3D sketch:
   1. Water: tens of thousands of particles whose positions are a pure function of a per-particle seed and time.
      Their routes are built from pipe "legs" (shared stretches of pipe), sampled on the CPU and handed to the
      shader as uniforms. Loaded, brown-red water enters on the left, settles in the clarifier, is desalinated in
      three linked RCDT stages, polished by UV and leaves on the right as clean, white-blue water. Sludge,
      concentrate and the UV flush line run into the concentrate management unit below the RCDT stages, which
      releases three streams: pure water, pure waste and valuable products.
   2. Equipment: 3D geometry (glass bodies with rim light, crisp anti-aliased line work, a blueprint plate),
      seen by an orthographic camera that tours the four stations on its own clock.
   ===================================================================== */
(function(){
'use strict';
var $=function(id){return document.getElementById(id)};
var viz=$('viz'),glc=$('water'),areaEl=$('vizArea'),labelsEl=$('labels'),heroCopy=$('heroCopy'),stage=$('stage'),
    panels=[].slice.call(document.querySelectorAll('.tp')),slots=[].slice.call(document.querySelectorAll('.slot__item')),
    stepDots=[].slice.call($('steps').children);
var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
var mqMobile=matchMedia('(max-width:900px)'),mqNoDetail=matchMedia('(max-width:1180px)'),mqHover=matchMedia('(hover:hover) and (pointer:fine)');
var RAD=Math.PI/180;
var NST=7;                                   /* number of stations on the tour */

function clamp(v,a,b){a=a===undefined?0:a;b=b===undefined?1:b;return v<a?a:v>b?b:v}
function lerp(a,b,t){return a+(b-a)*t}
function ss(a,b,x){var t=clamp((x-a)/(b-a));return t*t*(3-2*t)}
function v3(x,y,z){return[x,y,z]}
function add(a,b){return[a[0]+b[0],a[1]+b[1],a[2]+b[2]]}
function sub(a,b){return[a[0]-b[0],a[1]-b[1],a[2]-b[2]]}
function mul(a,s){return[a[0]*s,a[1]*s,a[2]*s]}
function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]}
function cross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}
function len(a){return Math.sqrt(dot(a,a))}
function norm(a){var l=len(a)||1;return[a[0]/l,a[1]/l,a[2]/l]}

/* ---------- world geometry. X: flow direction, Y: up, Z: towards the viewer ---------- */
var G={XL:-1800,XR:1400,FUN0:-1320,FUN1:-1040,JET0:680,FAN1:950,WZ:150,WZ2:146,R:24,GY:-330,SPIN:99999,
       /* RO pressure vessels */
       RV:44,RD:36,RT:8,YB:44,Y0:76,GAP:26,ND:5,YF:64,HR:22,
       /* UV polishing reactor */
       UX0:360,UX1:560,RU:42};
G.YT=G.Y0+G.ND*G.GAP+8;            /* top of a pressure vessel */
G.YC=G.YT-20;                      /* concentrate port */
var R=G.R;

/* ---------- camera: orthographic, yaw and pitch, fitted into a screen region ---------- */
var W=0,H=0,dpr=1,area={x:0,y:0,w:1,h:1};
var cam={yaw:0,pitch:20*RAD,shear:0,k:.6,c:[0,0,0],ax:0,ay:0,r:[1,0,0],u:[0,1,0],f:[0,0,-1],tx:0,ty:0};
var tgt={yaw:0,pitch:20*RAD,shear:0,k:.6,c:[0,0,0],ax:0,ay:0};
var k0=.6;
function camVectors(c){
  var cy=Math.cos(c.yaw),sy=Math.sin(c.yaw),cp=Math.cos(c.pitch),sp=Math.sin(c.pitch);
  /* shear=1 keeps the flow direction horizontal on screen (oblique drawing); shear=0 is a true rotation */
  c.r=[cy,0,-sy];c.u=[-sp*sy*(1-c.shear),cp,-sp*cy];c.f=mul(norm(cross(c.r,c.u)),-1);   /* f: direction of sight, also for the sheared drawing */
  /* depth axis for focus and depth fade: in the oblique overview the flow direction lies in the picture plane */
  c.dv=norm([-c.f[0]*(1-c.shear),-c.f[1],-c.f[2]]);
  c.tx=c.ax-c.k*dot(c.r,c.c);c.ty=c.ay+c.k*dot(c.u,c.c);
}
function project(p){return[cam.k*dot(cam.r,p)+cam.tx,-cam.k*dot(cam.u,p)+cam.ty]}

/* =====================================================================
   GEOMETRY BUILDERS
   Lines are stored as screen-space quads (crisp, anti-aliased, constant
   width at every zoom level). Bodies are small triangle meshes with a
   rim-light glass shader. Everything is static; movement comes from a few
   animation channels (uAnim) that shift or fade tagged vertices.
   ===================================================================== */
var LS=30,MS=18,Z3=[0,0,0];
var lineChunks=[],meshChunks=[],lv=[],ln=0,mvx=[],mix_=[],mn=0;
var DEF={a:.5,w:1.15,c:0,g:0,mode:0,dash:0,lod:0,mv:null,ch:0,flag:0,fxc:0,fxm:0,kind:0};
function S(base,o){var r={},k;base=base||DEF;for(k in DEF)r[k]=base[k]===undefined?DEF[k]:base[k];if(o)for(k in o)r[k]=o[k];return r}
function flushLines(){if(!ln)return;lineChunks.push({v:new Float32Array(lv),n:ln});lv=[];ln=0}
function flushMesh(){if(!mn)return;meshChunks.push({v:new Float32Array(mvx),i:new Uint16Array(mix_),n:mix_.length});mvx=[];mix_=[];mn=0}
function mReserve(n){if(mn+n>64000)flushMesh()}

function pushSeg(A,B,s,RA,RB,TA,TB,la,lb,ua,ub){
  var c,m=s.mv||Z3,ch=(s.ch||0)+(s.flag||0)*.25;
  for(c=0;c<4;c++)lv.push(A[0],A[1],A[2],RA,B[0],B[1],B[2],RB,TA[0],TA[1],TA[2],TB[0],TB[1],TB[2],
    s.a,s.w,s.c,s.g,c,s.mode,s.dash,c<2?la:lb,m[0],m[1],m[2],ch,s.fxc,s.fxm,s.lod,c<2?ua:ub);
  if(++ln>=16000)flushLines();
}
function SEG(a,b,s,rev){var d=len(sub(b,a));pushSeg(a,b,s,0,0,s.n||Z3,Z3,0,d,rev?rev(a):0,rev?rev(b):0)}
function PL(pts,s,closed,rev){
  var n=pts.length,i,acc=0,a,b,d;
  for(i=0;i<(closed?n:n-1);i++){a=pts[i];b=pts[(i+1)%n];d=len(sub(b,a));pushSeg(a,b,s,0,0,s.n||Z3,Z3,acc,acc+d,rev?rev(a):0,rev?rev(b):0);acc+=d}
}
function circ(c,ax,Rr,n,a0,a1){
  var pts=[],nr=[],i,a,cs,sn,d;n=n||48;a0=a0||0;a1=a1===undefined?Math.PI*2:a1;
  var full=Math.abs(a1-a0-Math.PI*2)<1e-6,cnt=full?n:n+1;
  for(i=0;i<cnt;i++){a=a0+(a1-a0)*i/n;cs=Math.cos(a);sn=Math.sin(a);d=ax==='x'?[0,cs,sn]:ax==='y'?[cs,0,sn]:[cs,sn,0];nr.push(d);pts.push(add(c,mul(d,Rr)))}
  return{p:pts,n:nr,closed:full};
}
/* ring: faced=true dims the half that points away from the viewer */
function RING(c,ax,Rr,s,n,faced,a0,a1){
  var o=circ(c,ax,Rr,n,a0,a1),i,m=o.p.length,cnt=o.closed?m:m-1,a,b,nn,acc=0,d,st=faced?S(s,{mode:1}):s;
  for(i=0;i<cnt;i++){a=o.p[i];b=o.p[(i+1)%m];nn=norm(add(o.n[i],o.n[(i+1)%m]));d=len(sub(b,a));pushSeg(a,b,st,0,0,nn,Z3,acc,acc+d,0,0);acc+=d}
}
/* silhouette lines of a tube: the shader offsets them sideways from the centre line, depending on the camera */
function SIL(path,s,side){
  var i,sg,a,b,st=S(s,{mode:2});
  for(sg=-1;sg<=1;sg+=2){if(side&&side!==sg)continue;
    for(i=0;i<path.length-1;i++){a=path[i];b=path[i+1];
      var s2=(a.mv||b.mv)?S(st,{mv:a.mv||b.mv,ch:a.ch||b.ch,flag:a.mv&&b.mv?0:(a.mv?1:2)}):st;
      pushSeg(a.p,b.p,s2,a.r*sg,b.r*sg,a.t,b.t,0,0,0,0)}}
}
function axisVec(ax){return ax==='x'?[1,0,0]:ax==='y'?[0,1,0]:[0,0,1]}
function cylPath(c0,ax,L,Rr,R2){var t=axisVec(ax);return[{p:c0,t:t,r:Rr},{p:add(c0,mul(t,L)),t:t,r:R2===undefined?Rr:R2}]}
function frames(path){
  var i,t,n,prev;
  for(i=0;i<path.length;i++){t=path[i].t;
    if(i===0){n=Math.abs(t[1])<.9?[0,1,0]:[1,0,0];n=norm(sub(n,mul(t,dot(n,t))))}else n=norm(sub(prev,mul(t,dot(prev,t))));
    path[i].n=n;path[i].b=cross(t,n);prev=n}
  return path;
}

/* ---------- meshes ---------- */
function MVX(p,n,col,a,s,m){m=m||s.mv||Z3;mvx.push(p[0],p[1],p[2],n[0],n[1],n[2],col[0],col[1],col[2],a,m[0],m[1],m[2],s.ch||0,s.g||0,s.kind||0,s.fxc||0,s.fxm||0);return mn++}
function QUAD(a,b,c,d){mix_.push(a,b,c,a,c,d)}
function mTube(path,col,a,s,nseg,alphaFn){
  nseg=nseg||24;frames(path);mReserve(path.length*(nseg+1));
  var i,j,rows=[],row,P,ang,d,aa;
  for(i=0;i<path.length;i++){P=path[i];row=[];aa=alphaFn?a*alphaFn(i/(path.length-1)):a;
    for(j=0;j<=nseg;j++){ang=j/nseg*Math.PI*2;d=add(mul(P.n,Math.sin(ang)),mul(P.b,Math.cos(ang)));row.push(MVX(add(P.p,mul(d,P.r)),d,col,aa,P.mv?S(s,{ch:P.ch}):s,P.mv))}
    rows.push(row)}
  for(i=0;i<rows.length-1;i++)for(j=0;j<nseg;j++)QUAD(rows[i][j],rows[i][j+1],rows[i+1][j+1],rows[i+1][j]);
}
function mCyl(c0,ax,L,Rr,col,a,s,nseg,R2){mTube(cylPath(c0,ax,L,Rr,R2),col,a,s,nseg)}
function mAnn(c,Rin,Rout,col,a,s,nseg,up,colIn){         /* horizontal ring face, optional radial colour gradient */
  nseg=nseg||48;mReserve((nseg+1)*2);var j,ang,cs,sn,i0=[],i1=[],n=[0,up===false?-1:1,0];
  for(j=0;j<=nseg;j++){ang=j/nseg*Math.PI*2;cs=Math.cos(ang);sn=Math.sin(ang);
    i0.push(MVX([c[0]+cs*Rin,c[1],c[2]+sn*Rin],n,colIn||col,a,s));i1.push(MVX([c[0]+cs*Rout,c[1],c[2]+sn*Rout],n,col,a,s))}
  for(j=0;j<nseg;j++)QUAD(i0[j],i1[j],i1[j+1],i0[j+1]);
}
function mCap(c,ax,Rr,col,a,s,nseg){                      /* disc facing along an axis */
  nseg=nseg||32;mReserve(nseg+2);var o=circ(c,ax,Rr,nseg),n=axisVec(ax),ci=MVX(c,n,col,a,s),ids=[],j;
  for(j=0;j<o.p.length;j++)ids.push(MVX(o.p[j],n,col,a,s));
  for(j=0;j<ids.length;j++)mix_.push(ci,ids[j],ids[(j+1)%ids.length]);
}
function mQuad(p0,p1,p2,p3,n,col,a,s,a2){mReserve(4);QUAD(MVX(p0,n,col,a,s),MVX(p1,n,col,a,s),MVX(p2,n,col,a2===undefined?a:a2,s),MVX(p3,n,col,a2===undefined?a:a2,s))}
function mBox(x0,y0,z0,x1,y1,z1,col,a,s,skip){
  skip=skip||'';
  if(skip.indexOf('b')<0)mQuad([x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[0,0,-1],col,a,s);
  if(skip.indexOf('l')<0)mQuad([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],[-1,0,0],col,a,s);
  if(skip.indexOf('r')<0)mQuad([x1,y0,z0],[x1,y0,z1],[x1,y1,z1],[x1,y1,z0],[1,0,0],col,a,s);
  if(skip.indexOf('d')<0)mQuad([x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1],[0,-1,0],col,a,s);
  if(skip.indexOf('t')<0)mQuad([x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1],[0,1,0],col,a,s);
  if(skip.indexOf('f')<0)mQuad([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],[0,0,1],col,a,s);
}
/* box edges: an edge is dimmed when both of its faces point away from the viewer */
function BOX(x0,y0,z0,x1,y1,z1,s){
  var X=[x0,x1],Y=[y0,y1],Z=[z0,z1],i,j,st=S(s,{mode:1}),q=Math.SQRT1_2,sx,sy,sz;
  for(i=0;i<2;i++)for(j=0;j<2;j++){sy=i?1:-1;sz=j?1:-1;pushSeg([x0,Y[i],Z[j]],[x1,Y[i],Z[j]],st,0,0,[0,sy*q,sz*q],Z3,0,x1-x0,0,0)}
  for(i=0;i<2;i++)for(j=0;j<2;j++){sx=i?1:-1;sz=j?1:-1;pushSeg([X[i],y0,Z[j]],[X[i],y1,Z[j]],st,0,0,[sx*q,0,sz*q],Z3,0,y1-y0,0,0)}
  for(i=0;i<2;i++)for(j=0;j<2;j++){sx=i?1:-1;sy=j?1:-1;pushSeg([X[i],Y[j],z0],[X[i],Y[j],z1],st,0,0,[sx*q,sy*q,0],Z3,0,z1-z0,0,0)}
}
/* a complete cylinder: glass or solid body, end rings, silhouettes */
function CYL(c0,ax,L,Rr,s,o){
  o=o||{};var t=axisVec(ax),c1=add(c0,mul(t,L)),path=cylPath(c0,ax,L,Rr,o.r2);
  if(o.mvA||o.mvB){path[0].mv=o.mvA;path[1].mv=o.mvB;path[0].ch=path[1].ch=s.ch}
  if(o.col)mTube(cylPath(c0,ax,L,Rr,o.r2).map(function(P,i){P.mv=i?o.mvB:o.mvA;P.ch=s.ch;return P}),o.col,o.ma===undefined?.2:o.ma,S(s,{kind:o.kind===undefined?1:o.kind}),o.nseg||28);
  if(o.cap)mCap(o.capAt==='start'?c0:c1,ax,o.r2===undefined?Rr:o.r2,o.capCol||o.col,o.capA===undefined?.3:o.capA,S(s,{kind:o.kind===undefined?1:o.kind,mv:o.capAt==='start'?o.mvA:(o.mvB||s.mv)}),28);
  var sA=S(s,{mv:o.mvA||s.mv}),sB=S(s,{mv:o.mvB||s.mv});
  if(ax==='y'){RING(c0,ax,Rr,sA,o.n||48,true);RING(c1,ax,o.r2===undefined?Rr:o.r2,sB,o.n||48,false)}
  else{RING(c0,ax,Rr,sA,o.n||40,true);RING(c1,ax,o.r2===undefined?Rr:o.r2,sB,o.n||40,true)}
  SIL(path,S(s,{a:Math.min(1,s.a*1.15)}));
}

/* =====================================================================
   THE SCENE — a configurable treatment train (stages and technologies as in the Neptune app, Treatment Solutions)
   groups: 0 always · 1..7 stations (pre, primary, secondary, tertiary, polishing & split, concentrate mgmt, ZLD) · 8..14 detail leaders
   animation channels (uAnim): 2 charts draw themselves · 3 UV intensity settles · 4 vessel shells fade · 6 UV lamp pulse
   line colours: 0 navy · 1 white · 2 blue · 3 dim · 4 UV violet · 5 green · 6 brown
   ===================================================================== */
var C_STEEL=[.9,.96,1],C_GLASS=[.92,.97,1],C_WHITE=[.96,.98,1],C_BLUE=[.07,.42,.72],C_LBLUE=[.29,.67,.87],C_METAL=[.3,.4,.5],C_DEEP=[.06,.16,.26],
    C_SLUDGE=[.45,.27,.14],C_GREEN=[.13,.6,.38],C_UV=[.62,.48,1],C_SAND=[.8,.68,.48],C_CARBON=[.16,.17,.2],C_AMBER=[.85,.55,.15],C_FRAME=[.6,.72,.84];
var PX0=-1080,PX1=760,PZ0=-150,PZ1=110,PY=G.GY,RO=R+5,RP=16;   /* RP: pipes between the stages */

/* ---------- the technology catalogue (Neptune app, Treatment Solutions) ---------- */
var STAGES=[
 {key:'pre',name:'Pre-treatment',st:0,opts:[
   {n:'Mechanical Screening & Grit Removal',ov:'Screening & grit',sh:'Screening & grit',tier:'Basic',capex:5000,rem:{TSS:.4,Oil:.2},d:'Low cost – protects downstream. Removes gross solids.'},
   {n:'Coagulation/Flocculation + Sand Filters',ov:'Coag. + sand',sh:'Coagulation + sand filter',tier:'Standard',capex:15000,rem:{TSS:.85,Oil:.5,Fe:.6},d:'Common for high-TSS influents. Effective solids removal.'},
   {n:'Ultrafiltration (UF)',ov:'UF',sh:'Ultrafiltration',tier:'Advanced',capex:35000,rem:{TSS:.99,Oil:.8,Fe:.9},d:'Improved solids & pathogen removal. Ideal pre-RO.'}]},
 {key:'pri',name:'Primary Treatment',st:1,opts:[
   {n:'Sedimentation',ov:'Sedimentation',sh:'Sedimentation',tier:'Basic',capex:8000,rem:{TSS:.6,Fe:.5},d:'Basic gravity settling.'},
   {n:'DAF (Dissolved Air Flotation)',ov:'DAF',sh:'Dissolved air flotation',tier:'Standard',capex:20000,rem:{TSS:.85,Oil:.92,Fe:.7},d:'Effective for solids and oils. Compact footprint.'},
   {n:'MBR (Primary)',ov:'MBR',sh:'MBR (primary)',tier:'Advanced',capex:60000,rem:{TSS:.99,Oil:.96,Fe:.95},d:'High effluent quality; suitable for RO feed.'}]},
 {key:'sec',name:'Secondary Treatment',st:2,opts:[
   {n:'Activated Sludge (CAS)',ov:'Activated sludge',sh:'Activated sludge',tier:'Basic',capex:25000,rem:{BOD:.9,COD:.8,TSS:.8},d:'Biological baseline. Effective BOD/COD removal.'},
   {n:'MBBR / Biofilm',ov:'MBBR',sh:'MBBR / biofilm',tier:'Standard',capex:30000,rem:{BOD:.92,COD:.85,TSS:.85},d:'Compact biological process. Good for variable loads.'},
   {n:'MBR (Membrane Bioreactor)',ov:'MBR',sh:'Membrane bioreactor',tier:'Advanced',capex:65000,rem:{BOD:.98,COD:.95,TSS:.99,Oil:.95},d:'High quality effluent ready for reuse or RO.'},
   {n:'AnMBR (Anaerobic MBR)',ov:'AnMBR',sh:'Anaerobic MBR',tier:'Advanced + Energy Recovery',capex:70000,rem:{BOD:.95,COD:.9,TSS:.95},d:'Energy recovery via biogas. Low sludge. Best for high-COD.'},
   {n:'Advanced Oxidation (AOP)',ov:'AOP',sh:'Advanced oxidation',tier:'Specialised',capex:80000,rem:{COD:.96,BOD:.96,Micro:.99},d:'Ozone/H₂O₂/UV for recalcitrant organics.'}]},
 {key:'ter',name:'Tertiary Treatment',st:3,opts:[
   {n:'NF / RO',ov:'NF / RO',sh:'NF / RO · three stages',tier:'Standard for Reuse',capex:50000,rem:{TDS:.95,TSS:.99,HM:.99,Zn:.99},d:'Central for high-quality water reuse and desalination.'},
   {n:'Activated Carbon + UV',ov:'GAC + UV',sh:'Activated carbon + UV',tier:'Polishing',capex:20000,rem:{Micro:.95,Bacteria:.9999,COD:.6},d:'Polishing for micropollutants, colour, odour.'},
   {n:'Ion Exchange / Electrodialysis',ov:'IX / ED',sh:'Ion exchange / ED',tier:'Selective',capex:40000,rem:{HM:.95,Zn:.99,Fe:.95,TDS:.5},d:'Selective ion removal. Ideal for Zn, Fe, heavy metals.'}]},
 {key:'cm',name:'Concentrate Management',st:5,opts:[
   {n:'Brine Concentration (Membrane)',sh:'Membrane brine concentration',tier:'Standard ZLD Step',capex:80000,rem:{},d:'Membrane pre-concentration before thermal.'},
   {n:'Electrodialysis',sh:'Electrodialysis',tier:'Energy Efficient',capex:70000,rem:{},d:'Energy-efficient for moderate salinity.'},
   {n:'MEE / Thermal Evaporation (MVR)',sh:'MEE / MVR evaporation',tier:'High Concentration',capex:150000,rem:{},d:'Multi-effect evaporation with MVR.'}]},
 {key:'zld',name:'ZLD (Zero Liquid Discharge)',st:6,opts:[
   {n:'None (no ZLD)',sh:'No ZLD',tier:'Standard Discharge',capex:0,rem:{},d:'Discharge treated effluent within permit limits.'},
   {n:'BrineX Pre-Concentration Stages',sh:'BrineX pre-concentration',tier:'Optimised ZLD',capex:250000,rem:{},d:'Membrane pre-concentration reduces thermal energy ~40%.'},
   {n:'Full ZLD Train',sh:'Full ZLD train',tier:'Full ZLD',capex:400000,rem:{},d:'Multi-stage RO + brine concentrator + thermal. Highest recovery.'}]}];
var SEL={pre:2,pri:1,sec:3,ter:0,cm:2,zld:2};
var STATION_NAMES=['Pre-treatment','Primary treatment','Secondary treatment','Tertiary treatment','Polishing & split','Concentrate management','Zero liquid discharge'];
function opt(key){var s=STAGES.filter(function(x){return x.key===key})[0];return s.opts[SEL[key]]}

/* ---------- layout: slots along the main line, a deck at DECK, the reject header at HDR, two units below ---------- */
var L_={XPRE:-890,XPRI:-630,XSEC:-325,XTER:60,XSPL:290,
        PRE0:-1000,PRE1:-780,PRI0:-740,PRI1:-520,SEC0:-480,SEC1:-170,TER0:-120,TER1:240,
        DECK:-100,HDR:-140,JX:-630,
        CM0:-790,CM1:-440,ZL0:-380,ZL1:-50,BY0:-300,BY1:-170,BZ0:-80,BZ1:70,OY:-268,OZ:145,REC:-70};
var VX=[-70,60,190];

/* ---------- polyline with rounded corners: used for the pipes and for the water routes that run inside them ---------- */
function fillet(nodes,er,seg){
  seg=seg||8;var out=[],i,k,A,B,C,d1,d2,l1,l2,e,t,P,T;
  function lerpN(a,b,u){var r={p:add(a.p,mul(sub(b.p,a.p),u))};['v','s'].forEach(function(key){if(a[key]!==undefined)r[key]=lerp(a[key],b[key],u)});
    if(a.c!==undefined)r.c=(a.c>1||b.c>1)?(u<.5?a.c:b.c):lerp(a.c,b.c,u);return r}
  out.push(Object.assign({},nodes[0],{t:norm(sub(nodes[1].p,nodes[0].p))}));
  for(i=1;i<nodes.length-1;i++){A=nodes[i-1];B=nodes[i];C=nodes[i+1];
    d1=sub(B.p,A.p);d2=sub(C.p,B.p);l1=len(d1);l2=len(d2);if(l1<1e-6||l2<1e-6)continue;d1=mul(d1,1/l1);d2=mul(d2,1/l2);
    if(dot(d1,d2)>.9995||er<=0){out.push(Object.assign({},B,{t:norm(add(d1,d2))}));continue}
    e=Math.min(er,l1*.5,l2*.5);
    var N1=lerpN(A,B,1-e/l1),N2=lerpN(B,C,e/l2);
    N1.t=d1;out.push(N1);
    for(k=1;k<seg;k++){t=k/seg;
      P=add(add(mul(N1.p,(1-t)*(1-t)),mul(B.p,2*(1-t)*t)),mul(N2.p,t*t));
      T=norm(add(mul(sub(B.p,N1.p),2*(1-t)),mul(sub(N2.p,B.p),2*t)));
      var q=lerpN(N1,N2,t);q.p=P;q.t=T;out.push(q)}
    N2.t=d2;out.push(N2)}
  var n=nodes.length;out.push(Object.assign({},nodes[n-1],{t:norm(sub(nodes[n-1].p,nodes[n-2].p))}));
  return out;
}
function N(p,v,s,c){return{p:p,v:v,s:s,c:c}}
function TUBE(pts,r,er,g,o){
  o=o||{};var path=fillet(pts.map(function(p){return{p:p}}),er).map(function(q){return{p:q.p,t:q.t,r:r}});
  mTube(path,C_GLASS,o.ma===undefined?.16:o.ma,S(null,{g:g,kind:1}),o.nseg||18);
  SIL(path,S(null,{g:g,a:o.a||.62,w:1.15,c:o.c||0}));
  return path;
}
function flangeAt(c,ax,rad,g){var t=axisVec(ax),s=S(null,{a:.72,g:g||0}),c0=sub(c,mul(t,3.5));
  mCyl(c0,ax,7,rad,C_METAL,.62,S(null,{g:g||0,kind:0}),28);RING(c0,ax,rad,s,32,true);RING(add(c0,mul(t,7)),ax,rad,s,32,true);SIL(cylPath(c0,ax,7,rad),s)}
/* small drawing helpers */
function gCyl(x,y0,y1,r,g,o){o=o||{};CYL([x,y0,o.z||0],'y',y1-y0,r,S(null,{g:g,a:o.a||.78,fxc:o.fxc||0,fxm:o.fxm||0}),{col:o.col||C_GLASS,ma:o.ma||.13,n:o.n||40,nseg:o.nseg||32,r2:o.r2,kind:o.kind,cap:o.cap,capA:o.capA,capCol:o.capCol})}
function gBox(x0,y0,z0,x1,y1,z1,g,o){o=o||{};mBox(x0,y0,z0,x1,y1,z1,o.col||C_GLASS,o.ma===undefined?.1:o.ma,S(null,{g:g,kind:o.kind===undefined?1:o.kind}));BOX(x0,y0,z0,x1,y1,z1,S(null,{g:g,a:o.a||.78,c:o.c||0,dash:o.dash||0}))}
function sBox(x0,y0,z0,x1,y1,z1,g,col,a){mBox(x0,y0,z0,x1,y1,z1,col||C_METAL,a===undefined?.7:a,S(null,{g:g,kind:0}));BOX(x0,y0,z0,x1,y1,z1,S(null,{g:g,a:.75}))}
function legs(x,z,y0,y1,g){SEG([x-2.5,y0,z],[x-2.5,y1,z],S(null,{g:g,a:.36}));SEG([x+2.5,y0,z],[x+2.5,y1,z],S(null,{g:g,a:.36}))}
function ringLegs(x,r,y0,g,n){for(var i=0;i<(n||4);i++){var a=(45+i*360/(n||4))*RAD;legs(x+Math.cos(a)*r,Math.sin(a)*r,y0,L_.DECK,g)}}
function motor(x,y,z,g){gCyl(x,y,y+16,9,g,{col:C_METAL,ma:.75,kind:0,cap:true,capA:.8,capCol:C_METAL,z:z,n:20,nseg:14})}
function valve(x,y,z,g,vertical){var s=S(null,{g:g,a:.9});if(vertical)PL([[x-7,y+7,z],[x+7,y-7,z],[x-7,y-7,z],[x+7,y+7,z]],s,true);else PL([[x-7,y-7,z],[x+7,y+7,z],[x+7,y-7,z],[x-7,y+7,z]],s,true)}
function bubblesLine(x0,x1,y,z0,z1,g){for(var x=x0;x<=x1;x+=14)SEG([x,y,z0],[x,y,z1],S(null,{g:g,a:.45,c:2,lod:1}))}
/* scattered small rings: MBBR carriers, resin beads, carbon grains */
function scatter(x0,x1,y0,y1,z0,z1,n,r,c,g,seed){var h=seed||1;function rnd(){h=(h*9301+49297)%233280;return h/233280}
  for(var i=0;i<n;i++)RING([lerp(x0,x1,rnd()),lerp(y0,y1,rnd()),lerp(z0,z1,rnd())],['x','y','z'][i%3],r,S(null,{g:g,a:.7,c:c,lod:1.1}),8,false)}
/* a horizontal pressure vessel */
function hVessel(x0,x1,y,z,r,g,o){o=o||{};CYL([x0,y,z],'x',x1-x0,r,S(null,{g:g,a:.8}),{col:o.col||C_GLASS,ma:o.ma||.16,n:24,nseg:20});
  CYL([x0-5,y,z],'x',5,r+3,S(null,{g:g,a:.8}),{col:C_METAL,ma:.65,kind:0,n:24,nseg:18,cap:true,capA:.6,capCol:C_METAL});
  CYL([x1,y,z],'x',5,r+3,S(null,{g:g,a:.8}),{col:C_METAL,ma:.65,kind:0,n:24,nseg:18,cap:true,capA:.6,capCol:C_METAL})}
/* an instrument panel with a chart that draws itself (channel fxc) */
function chartPanel(X0,X1,Y0,Y1,Zp,g,series,fxc){
  var s=S(null,{g:g,a:.8}),zf=Zp+2.4,i;
  mBox(X0,Y0,Zp-2,X1,Y1,Zp+2,C_DEEP,.85,S(null,{g:g,kind:2}));BOX(X0,Y0,Zp-2,X1,Y1,Zp+2,s);
  SEG([X0+10,Y1-9,zf],[X0+46,Y1-9,zf],S(s,{a:.95,c:1,w:1.7}));
  for(i=1;i<6;i++)SEG([lerp(X0,X1,i/6),Y0+6,zf],[lerp(X0,X1,i/6),Y1-18,zf],S(s,{a:.12,c:1,lod:1.5}));
  var rev=function(q){return(q[0]-X0)/(X1-X0)*.7};
  series.forEach(function(sr){var pts=[];for(i=0;i<=18;i++){var u=i/18;pts.push([lerp(X0+10,X1-10,u),lerp(Y0+8,Y1-22,sr.f(u)),zf])}
    PL(pts,S(s,{a:1,c:sr.c,w:1.8,fxc:fxc||2,fxm:2}),false,rev)});
}

/* intake and outlet: a wide, flat trumpet that follows the envelope of the water and fades away towards the open end */
function flare(xa,xb,isIn){
  var N=9,M=44,i,j,x,t,ip,rz,ry,fd,ids,prev=null,pp=[[],[],[],[]],GL=S(null,{g:0,kind:1});
  mReserve((N*3+1)*(M+1));
  for(i=0;i<=N*3;i++){t=i/(N*3);x=lerp(xa,xb,t);ip=isIn?ss(G.FUN0,G.FUN1,x):1-ss(G.JET0,G.FAN1,x);
    rz=lerp(G.WZ*1.07,RO,ip);ry=lerp(54,RO,ip);fd=isIn?ss(.04,.6,t):1-ss(.4,.96,t);
    ids=[];for(j=0;j<=M;j++){var ang=j/M*Math.PI*2,cy=Math.sin(ang),cz=Math.cos(ang),n=norm([0,cy/ry,cz/rz]);ids.push(MVX([x,cy*ry,cz*rz],n,C_STEEL,.15*fd,GL))}
    if(prev)for(j=0;j<M;j++)QUAD(prev[j],prev[j+1],ids[j+1],ids[j]);prev=ids;
    if(i%3===0&&fd>.02){var ring=[];for(j=0;j<M;j++){var a1=j/M*Math.PI*2;ring.push([x,Math.sin(a1)*ry,Math.cos(a1)*rz])}
      for(j=0;j<M;j++){var a0=(j+.5)/M*Math.PI*2;pushSeg(ring[j],ring[(j+1)%M],S(null,{a:.3*fd,mode:1}),0,0,norm([0,Math.sin(a0)/ry,Math.cos(a0)/rz]),Z3,0,0,0,0)}}
    pp[0].push([x,ry,0,fd]);pp[1].push([x,-ry,0,fd]);pp[2].push([x,0,rz,fd]);pp[3].push([x,0,-rz,fd]);
  }
  for(j=0;j<4;j++)for(i=0;i<pp[j].length-1;i++)SEG(pp[j][i],pp[j][i+1],S(null,{a:(j===3?.18:.45)*(pp[j][i][3]+pp[j][i+1][3])/2}));
}


/* =====================================================================
   UNIT LIBRARY
   Every technology draws itself into its slot and returns
     inP / outP      ports on the main line
     flows           water paths from inP to outP (variants: each particle takes one)
     rejects         sludge / concentrate / backwash paths, each ending above the reject header at x
     extras          internal movement (air bubbles, biogas, recirculation)
     labels          detail labels
   c: cleanliness 0 loaded ... 1 clean; codes SLUDGE, WASTE, PROD, BRINE, GAS, AIR
   ===================================================================== */
var SLUDGE=1.01,WASTE=1.02,PROD=1.03,BRINE=1.04,GAS=1.05,AIR=1.06;
function dropTo(x,y,g){TUBE([[x,y,0],[x,L_.HDR,0]],6,0,g,{ma:.2,a:.7})}
function rej(nodes,x){return{nodes:nodes,x:x}}
function lab(g,side,at,from,t,s){return{g:g-1,side:side,at:at,from:from,t:t,s:s}}

/* ---------------- PRE-TREATMENT ---------------- */
function preScreen(g,ci,co){
  var x0=L_.PRE0+10,x1=L_.PRE1-10,i,z;
  for(i=0;i<4;i++)legs(lerp(x0+20,x1-20,i/3),i%2?32:-32,-34,L_.DECK,g);
  gBox(x0,-34,-34,x1,34,34,g,{ma:.1});
  for(z=-28;z<=28;z+=7)SEG([-962,-32,z],[-934,44,z],S(null,{g:g,a:.85,w:1.3}));   /* inclined bar screen */
  SEG([-962,-32,-30],[-962,-32,30],S(null,{g:g,a:.7}));SEG([-934,44,-30],[-934,44,30],S(null,{g:g,a:.85,w:1.5}));
  sBox(-932,40,-16,-906,58,16,g,C_METAL,.55);                                       /* screenings skip */
  gCyl(-866,-74,-34,6,g,{r2:26,ma:.14});                                             /* grit hopper */
  mCyl([-866,-72,0],'y',22,6,C_SAND,.6,S(null,{g:g,kind:0}),24,20);
  dropTo(-866,-74,g);
  return{inP:[L_.PRE0,0,0],outP:[L_.PRE1,0,0],
    flows:[[N([L_.PRE0,0,0],80,R*.9,ci),N([-978,0,0],55,24,ci),N([-940,0,0],32,26,ci+.04),N([-866,-2,0],30,26,lerp(ci,co,.6)),N([-800,0,0],45,22,co),N([L_.PRE1,0,0],70,RP-2,co)]],
    rejects:[rej([N([-880,-14,0],14,18,SLUDGE),N([-866,-58,0],14,8,SLUDGE),N([-866,-74,0],24,4,SLUDGE),N([-866,L_.HDR,0],40,4,SLUDGE)],-866)],
    extras:[],
    labels:[lab(g,'L',[-1010,70,0],[-948,10,0],'Bar screen','Gross solids out'),lab(g,'T',[-919,96,0],[-919,58,0],'Screenings','to disposal'),lab(g,'B',[-866,-118,40],[-866,-90,0],'Grit chamber','Grit to reject header')]};
}
function preCoag(g,ci,co){
  var MX=-972,FX=-925,SX=-842,i;
  ringLegs(MX,16,-40,g,3);ringLegs(FX,20,-40,g,3);ringLegs(SX,28,-60,g,4);
  gCyl(MX,-40,40,20,g);gCyl(FX,-40,40,24,g);gCyl(SX,-60,70,34,g);
  /* impellers */
  SEG([MX,60,0],[MX,-24,0],S(null,{g:g,a:.7,w:1.4}));PL([[MX-12,-20,0],[MX+12,-28,0]],S(null,{g:g,a:.8,w:1.6}));PL([[MX,-24,-12],[MX,-24,12]],S(null,{g:g,a:.8,w:1.6}));motor(MX,40,0,g);
  SEG([FX,60,0],[FX,-28,0],S(null,{g:g,a:.7,w:1.4}));for(i=0;i<3;i++)PL([[FX-16,-20+i*18,0],[FX+16,-20+i*18,0]],S(null,{g:g,a:.6,w:1.2}));motor(FX,40,0,g);
  /* coagulant dosing */
  gCyl(-990,64,92,9,g,{col:C_AMBER,ma:.35});SEG([-990,64,0],[MX-6,40,0],S(null,{g:g,a:.6,dash:5,c:6}));
  /* sand filter: gravel, sand, underdrain */
  mCyl([SX,-52,0],'y',16,32,[.55,.5,.44],.75,S(null,{g:g,kind:0}),32);mCyl([SX,-36,0],'y',50,32,C_SAND,.6,S(null,{g:g,kind:0}),32);
  RING([SX,14,0],'y',33,S(null,{g:g,a:.6,c:6,dash:5}),40,false);
  TUBE([[MX+20,30,0],[FX-24,30,0]],7,0,g,{ma:.2});
  TUBE([[FX+24,30,0],[SX-20,56,0]],8,8,g,{ma:.2});
  TUBE([[SX+10,-60,0],[SX+10,-72,0],[-792,-72,0],[-792,0,0],[L_.PRE1,0,0]],RP,14,g,{ma:.16});
  TUBE([[L_.PRE0,0,0],[MX-20,0,0]],RP,0,g,{ma:.16});
  dropTo(SX-18,-62,g);
  return{inP:[L_.PRE0,0,0],outP:[L_.PRE1,0,0],
    flows:[[N([L_.PRE0,0,0],80,R*.9,ci),N([-990,0,0],50,14,ci),N([MX,-8,0],22,16,ci+.02),N([MX,28,0],22,14,ci+.05),N([MX+22,30,0],40,6,ci+.06),
            N([FX-10,24,0],18,18,ci+.08),N([FX-6,-24,0],16,16,ci+.1),N([FX+8,-24,0],16,16,ci+.11),N([FX+12,26,0],18,14,ci+.12),N([FX+26,30,0],40,6,ci+.13),
            N([SX-20,56,0],40,6,ci+.14),N([SX,46,0],20,26,ci+.15),N([SX,-30,0],14,26,lerp(ci,co,.8)),N([SX+10,-58,0],30,6,co),N([SX+10,-72,0],50,8,co),
            N([-792,-72,0],60,10,co),N([-792,-4,0],60,10,co),N([L_.PRE1,0,0],70,RP-2,co)]],
    rejects:[rej([N([SX,0,0],12,20,SLUDGE),N([SX-18,-50,0],16,6,SLUDGE),N([SX-18,-64,0],24,4,SLUDGE),N([SX-18,L_.HDR,0],40,4,SLUDGE)],SX-18)],
    extras:[],
    labels:[lab(g,'L',[-1012,96,0],[-990,80,0],'Coagulant dosing','Flocs form'),lab(g,'T',[FX,92,0],[FX,56,0],'Flocculation','Slow paddles'),lab(g,'R',[-770,60,0],[SX+34,40,0],'Sand filter','Backwash to reject header')]};
}
function preUF(g,ci,co){
  var MX=[-955,-922,-889,-856],i,fl=[];
  sBox(-972,-60,-26,-838,-56,26,g,C_FRAME,.25);legs(-972,-26,-60,L_.DECK,g);legs(-838,26,-60,L_.DECK,g);legs(-972,26,-60,L_.DECK,g);legs(-838,-26,-60,L_.DECK,g);
  TUBE([[-985,-46,0],[-842,-46,0]],9,0,g,{ma:.2});TUBE([[-972,104,0],[-842,104,0]],9,0,g,{ma:.2});
  MX.forEach(function(x){gCyl(x,-38,94,11,g,{ma:.16});for(var k=-7;k<=7;k+=3.5)SEG([x+k,-30,0],[x+k,88,0],S(null,{g:g,a:.35,c:2,lod:.8}));
    CYL([x,-40,0],'y',4,13,S(null,{g:g,a:.8}),{col:C_METAL,ma:.6,kind:0,n:20,nseg:14});CYL([x,92,0],'y',4,13,S(null,{g:g,a:.8}),{col:C_METAL,ma:.6,kind:0,n:20,nseg:14})});
  TUBE([[L_.PRE0,0,0],[-985,0,0],[-985,-46,0]],RP,10,g,{ma:.16});
  TUBE([[-842,104,0],[-806,104,0],[-806,0,0],[L_.PRE1,0,0]],RP,14,g,{ma:.16});
  dropTo(-842,-46,g);
  MX.forEach(function(x){fl.push([N([L_.PRE0,0,0],80,R*.9,ci),N([-985,0,0],50,12,ci),N([-985,-46,0],40,6,ci),N([x,-46,0],40,6,ci+.02),N([x,-30,0],20,8,ci+.04),
    N([x,86,0],22,8,co),N([x,104,0],40,5,co),N([-842,104,0],50,6,co),N([-806,104,0],60,10,co),N([-806,4,0],60,10,co),N([L_.PRE1,0,0],70,RP-2,co)])});
  return{inP:[L_.PRE0,0,0],outP:[L_.PRE1,0,0],flows:fl,
    rejects:[rej([N([-889,-46,0],30,5,SLUDGE),N([-842,-46,0],30,5,SLUDGE),N([-842,L_.HDR,0],40,4,SLUDGE)],-842)],extras:[],
    labels:[lab(g,'T',[-905,142,0],[-905,110,0],'UF membrane modules','Hollow fibre · pathogen barrier'),lab(g,'L',[-1012,-80,0],[-985,-46,0],'Feed manifold',''),lab(g,'R',[-770,-80,0],[-842,-70,0],'Backwash','to reject header')]};
}

/* ---------------- PRIMARY ---------------- */
function priSed(g,ci,co){
  var SX=L_.XPRI,SR=80,STOP=84,SBOT=-40,SAPEX=-112,s=S(null,{g:g,a:.8}),i,a;
  G.SPIN=SX;
  for(i=0;i<4;i++){a=(45+i*90)*RAD;legs(SX+Math.cos(a)*(SR-6),Math.sin(a)*(SR-6),SBOT,L_.DECK,g)}
  gCyl(SX,SBOT,STOP,SR,g,{n:64,nseg:48});gCyl(SX,SAPEX,SBOT,12,g,{r2:SR,n:48,nseg:40});
  mCyl([SX,SAPEX+3,0],'y',SBOT-SAPEX+8,10,C_SLUDGE,.42,S(null,{g:g,kind:0}),40,lerp(12,SR,(SBOT+8-SAPEX)/(SBOT-SAPEX)));
  gCyl(SX,8,STOP+6,24,g,{a:.55,ma:.1,n:32,nseg:24});
  RING([SX,STOP-14,0],'y',SR-9,S(s,{a:.6}),56,false);
  var vn=[];for(i=0;i<=96;i++){a=i/96*Math.PI*2;vn.push([SX+Math.cos(a)*(SR-9),STOP-14+(i%2?6:0),Math.sin(a)*(SR-9)])}PL(vn,S(s,{a:.55,c:2,w:1}));
  sBox(SX-SR-6,STOP,-6,SX+SR+6,STOP+6,6,g,C_METAL,.6);motor(SX,STOP+6,0,g);
  SEG([SX,STOP,0],[SX,SAPEX+14,0],S(s,{a:.7,w:1.6}));
  for(i=0;i<2;i++){var sg=i?-1:1,p0=[SX,SAPEX+16,0],p1=[SX+sg*(SR-12),SBOT+2,0];SEG(p0,p1,S(s,{a:.85,c:10,w:1.6}));
    for(var k=1;k<6;k++){var q=add(p0,mul(sub(p1,p0),k/6));SEG(q,[q[0]+sg*4,q[1]-7,0],S(s,{a:.6,c:10,lod:1.2}))}}
  chartPanel(SX-88,SX+88,150,240,-70,g,[{c:6,f:function(u){return .6+.18*Math.sin(u*14)+.1*Math.sin(u*7+1)}},{c:2,f:function(u){return .14+.03*Math.sin(u*9)}}]);
  SEG([SX-60,STOP+22,0],[SX-60,150,-70],S(s,{a:.45,dash:7}));
  TUBE([[L_.PRI0,0,0],[SX-SR,0,0]],RP,0,g,{ma:.16});TUBE([[SX+SR,64,0],[L_.PRI1,64,0]],RP,0,g,{ma:.16});
  TUBE([[SX-SR,0,0],[SX-24,0,0]],10,0,g,{ma:.12,a:.45});
  gCyl(SX,SAPEX-10,SAPEX,7,g,{col:C_METAL,ma:.6,kind:0,n:16,nseg:12});dropTo(SX,SAPEX-10,g);
  return{inP:[L_.PRI0,0,0],outP:[L_.PRI1,64,0],
    flows:[[N([L_.PRI0,0,0],70,RP-2,ci),N([SX-SR,0,0],60,20,ci),N([SX-50,-10,0],34,46,ci+.04),N([SX-5,-18,0],20,62,lerp(ci,co,.4)),N([SX+35,22,0],20,64,lerp(ci,co,.75)),
            N([SX+62,52,0],34,38,co),N([SX+SR,64,0],60,14,co),N([L_.PRI1,64,0],70,RP-2,co)]],
    rejects:[rej([N([SX-10,-46,0],14,40,SLUDGE),N([SX-2,-88,0],12,18,SLUDGE),N([SX,SAPEX,0],20,6,SLUDGE),N([SX,L_.HDR,0],30,4,SLUDGE)],SX)],extras:[],
    labels:[lab(g,'T',[SX,262,-70],[SX,240,-70],'Turbidity','Inflow → clarified water'),lab(g,'L',[-760,52,0],[SX-22,52,0],'Feed well','Calm inlet'),
            lab(g,'R',[-500,104,0],[SX+52,72,0],'Weir & launder','Clarified water out'),lab(g,'L',[-760,-96,0],[SX-14,-92,0],'Sludge hopper','to the reject header')]};
}
function priDAF(g,ci,co){
  var x0=-735,x1=-525,i;
  for(i=0;i<4;i++)legs(lerp(x0+12,x1-12,i/3),i%2?40:-40,-40,L_.DECK,g);
  gBox(x0,-40,-45,x1,48,45,g,{ma:.1});
  PL([[-690,-40,-45],[-672,30,-45],[-672,30,45],[-690,-40,45]],S(null,{g:g,a:.55}),true);        /* contact zone baffle */
  mQuad([-690,-40,-45],[-690,-40,45],[-672,30,45],[-672,30,-45],[1,0,0],C_GLASS,.18,S(null,{g:g,kind:1}));
  mBox(-672,38,-44,-548,47,44,C_SLUDGE,.45,S(null,{g:g,kind:0}));                                /* float layer */
  PL([[-700,56,0],[-548,56,0],[-548,64,0],[-700,64,0]],S(null,{g:g,a:.8}),true);                 /* skimmer chain */
  for(i=0;i<8;i++){var fx=lerp(-698,-552,i/7);SEG([fx,56,0],[fx,49,0],S(null,{g:g,a:.7,w:1.3}))}
  sBox(-546,28,-30,-528,52,30,g,C_METAL,.45);                                                     /* sludge launder */
  bubblesLine(-728,-692,-36,-40,40,g);
  hVessel(-720,-640,-70,-70,12,g);SEG([-640,-70,-70],[-710,-36,-30],S(null,{g:g,a:.55,dash:6,c:2}));  /* air saturator, recycle */
  TUBE([[L_.PRI0,0,0],[-735,-26,0]],RP,10,g,{ma:.16});TUBE([[-525,-26,0],[L_.PRI1,-26,0]],RP,0,g,{ma:.16});
  dropTo(-537,28,g);
  return{inP:[L_.PRI0,0,0],outP:[L_.PRI1,-26,0],
    flows:[[N([L_.PRI0,0,0],70,RP-2,ci),N([-735,-26,0],50,12,ci),N([-712,-30,0],24,18,ci+.02),N([-700,26,0],22,20,ci+.06),N([-660,30,0],20,24,lerp(ci,co,.4)),
            N([-610,-6,0],18,32,lerp(ci,co,.8)),N([-556,-26,0],30,14,co),N([-525,-26,0],50,8,co),N([L_.PRI1,-26,0],70,RP-2,co)]],
    rejects:[rej([N([-660,42,0],12,10,SLUDGE),N([-560,44,0],14,8,SLUDGE),N([-537,36,0],20,5,SLUDGE),N([-537,L_.HDR,0],40,4,SLUDGE)],-537)],
    extras:[{nodes:[N([-724,-36,0],22,22,AIR),N([-708,40,0],22,22,AIR)],w:.03}],
    labels:[lab(g,'L',[-760,52,0],[-712,0,0],'Contact zone','Micro-bubbles lift solids & oil'),lab(g,'T',[-624,100,0],[-624,64,0],'Skimmer','Float sludge removed'),
            lab(g,'L',[-760,-80,0],[-700,-70,-70],'Air saturator','Pressurised recycle'),lab(g,'R',[-500,60,0],[-537,52,0],'Float sludge','to the reject header')]};
}
function mbrTank(x0,x1,cx0,cx1,g,yIn){
  var i;for(i=0;i<4;i++)legs(lerp(x0+12,x1-12,i/3),i%2?40:-40,-50,L_.DECK,g);
  gBox(x0,-50,-45,x1,46,45,g,{ma:.1});
  for(i=0;i<6;i++){var px=lerp(cx0,cx1,i/5);mQuad([px,-34,-30],[px,-34,30],[px,30,30],[px,30,-30],[1,0,0],C_LBLUE,.28,S(null,{g:g,kind:2}));
    PL([[px,-34,-30],[px,-34,30],[px,30,30],[px,30,-30]],S(null,{g:g,a:.55,c:2,w:1}),true)}
  BOX(cx0-4,-36,-32,cx1+4,32,32,S(null,{g:g,a:.55}));
  bubblesLine(cx0,cx1,-44,-30,30,g);
}
function priMBR(g,ci,co){
  var cx=-625;mbrTank(-735,-525,-655,-595,g);
  TUBE([[L_.PRI0,0,0],[-735,0,0]],RP,0,g,{ma:.16});TUBE([[cx,32,0],[cx,64,0],[L_.PRI1,64,0]],10,10,g,{ma:.2});
  motor(-570,52,0,g);dropTo(-700,-50,g);
  return{inP:[L_.PRI0,0,0],outP:[L_.PRI1,64,0],
    flows:[[N([L_.PRI0,0,0],70,RP-2,ci),N([-735,0,0],50,14,ci),N([-700,0,0],18,34,ci+.04),N([-664,-12,0],16,30,lerp(ci,co,.4)),N([cx,-24,0],14,22,lerp(ci,co,.6)),
            N([cx,26,0],18,10,co),N([cx,64,0],40,6,co),N([-560,64,0],60,8,co),N([L_.PRI1,64,0],70,RP-2,co)]],
    rejects:[rej([N([-700,-30,0],14,20,SLUDGE),N([-700,-50,0],20,5,SLUDGE),N([-700,L_.HDR,0],40,4,SLUDGE)],-700)],
    extras:[{nodes:[N([cx,-42,0],26,26,AIR),N([cx,40,0],26,26,AIR)],w:.03}],
    labels:[lab(g,'T',[cx,104,0],[cx,64,0],'Permeate','through the membranes'),lab(g,'L',[-760,60,0],[-655,20,0],'Membrane cassette','submerged flat sheets'),lab(g,'B',[-700,-100,40],[-700,-70,0],'Waste sludge','to the reject header')]};
}

/* ---------------- SECONDARY ---------------- */
function secCAS(g,ci,co){
  var cx=-232,i,a;
  for(i=0;i<4;i++)legs(lerp(-468,-332,i/3),i%2?40:-40,-45,L_.DECK,g);
  gBox(-475,-45,-48,-322,40,48,g,{ma:.1});bubblesLine(-466,-332,-40,-40,40,g);
  for(i=0;i<4;i++){a=(45+i*90)*RAD;legs(cx+Math.cos(a)*52,Math.sin(a)*52,-30,L_.DECK,g)}
  gCyl(cx,-30,46,58,g,{n:48});gCyl(cx,-80,-30,8,g,{r2:58,n:40});gCyl(cx,0,50,16,g,{a:.5,ma:.08,n:24});
  RING([cx,38,0],'y',52,S(null,{g:g,a:.55,c:2}),48,false);sBox(cx-62,46,-5,cx+62,51,5,g,C_METAL,.55);
  TUBE([[L_.SEC0,0,0],[-475,0,0]],RP,0,g,{ma:.16});TUBE([[-322,20,0],[cx-16,20,0]],10,0,g,{ma:.2});TUBE([[cx+58,40,0],[L_.SEC1,40,0]],RP,0,g,{ma:.16});
  TUBE([[cx,-80,0],[cx,-90,0],[-460,-90,0],[-460,-45,0]],6,12,g,{ma:.2,a:.6});                     /* return activated sludge */
  dropTo(cx+20,-90,g);
  return{inP:[L_.SEC0,0,0],outP:[L_.SEC1,40,0],
    flows:[[N([L_.SEC0,0,0],70,RP-2,ci),N([-475,0,0],50,14,ci),N([-440,-4,0],18,40,ci+.04),N([-380,8,0],16,42,lerp(ci,co,.5)),N([-330,20,0],30,12,lerp(ci,co,.6)),
            N([cx-16,20,0],40,8,lerp(ci,co,.65)),N([cx-6,-14,0],16,14,lerp(ci,co,.7)),N([cx+16,22,0],14,44,lerp(ci,co,.9)),N([cx+50,40,0],30,12,co),N([L_.SEC1,40,0],70,RP-2,co)]],
    rejects:[rej([N([cx,-60,0],12,10,SLUDGE),N([cx,-82,0],20,4,SLUDGE),N([cx+20,-90,0],30,4,SLUDGE),N([cx+20,L_.HDR,0],40,4,SLUDGE)],cx+20)],
    extras:[{nodes:[N([-400,-40,0],24,60,AIR),N([-400,36,0],24,60,AIR)],w:.03},
            {nodes:[N([cx,-74,0],20,4,SLUDGE),N([cx,-90,0],30,4,SLUDGE),N([-460,-90,0],50,4,SLUDGE),N([-460,-50,0],30,4,SLUDGE)],w:.012}],
    labels:[lab(g,'T',[-398,82,0],[-398,40,0],'Aeration basin','Bacteria break down BOD/COD'),lab(g,'T',[cx,92,0],[cx,51,0],'Secondary clarifier',''),
            lab(g,'B',[-350,-120,40],[-350,-90,0],'Return sludge','RAS loop'),lab(g,'R',[-150,-60,0],[cx+20,-110,0],'Excess sludge','to the reject header')]};
}
function secMBBR(g,ci,co){
  var i;
  [[-475,-375],[-360,-260]].forEach(function(t,k){for(i=0;i<4;i++)legs(lerp(t[0]+10,t[1]-10,i/3),i%2?40:-40,-45,L_.DECK,g);
    gBox(t[0],-45,-45,t[1],44,45,g,{ma:.1});scatter(t[0]+8,t[1]-8,-38,36,-38,38,46,3.4,2,g,7+k*13);bubblesLine(t[0]+8,t[1]-8,-40,-38,38,g);
    PL([[t[1]-2,10,-14],[t[1]-2,36,-14],[t[1]-2,36,14],[t[1]-2,10,14]],S(null,{g:g,a:.6,dash:3}),true)});
  gCyl(-215,-40,40,30,g);gCyl(-215,-72,-40,6,g,{r2:30});ringLegs(-215,26,-40,g,3);
  TUBE([[L_.SEC0,0,0],[-475,0,0]],RP,0,g,{ma:.16});TUBE([[-375,24,0],[-360,24,0]],8,0,g,{ma:.2});TUBE([[-260,24,0],[-232,24,0]],8,0,g,{ma:.2});TUBE([[-185,30,0],[L_.SEC1,30,0]],RP,0,g,{ma:.16});
  dropTo(-215,-72,g);
  return{inP:[L_.SEC0,0,0],outP:[L_.SEC1,30,0],
    flows:[[N([L_.SEC0,0,0],70,RP-2,ci),N([-475,0,0],50,14,ci),N([-430,-6,0],16,38,ci+.05),N([-385,20,0],22,20,lerp(ci,co,.35)),N([-360,24,0],40,6,lerp(ci,co,.4)),
            N([-320,-4,0],16,38,lerp(ci,co,.6)),N([-268,22,0],22,16,lerp(ci,co,.75)),N([-232,24,0],40,6,lerp(ci,co,.8)),N([-215,-10,0],14,22,lerp(ci,co,.85)),N([-200,26,0],16,22,co),N([L_.SEC1,30,0],60,RP-2,co)]],
    rejects:[rej([N([-215,-40,0],12,16,SLUDGE),N([-215,-72,0],20,4,SLUDGE),N([-215,L_.HDR,0],40,4,SLUDGE)],-215)],
    extras:[{nodes:[N([-425,-40,0],24,40,AIR),N([-425,38,0],24,40,AIR)],w:.02},{nodes:[N([-310,-40,0],24,40,AIR),N([-310,38,0],24,40,AIR)],w:.02}],
    labels:[lab(g,'T',[-425,86,0],[-425,44,0],'Moving bed reactors','Biofilm on free-floating carriers'),lab(g,'T',[-215,84,0],[-215,40,0],'Settler',''),
            lab(g,'L',[-500,-80,0],[-440,-30,0],'Aeration','keeps carriers moving'),lab(g,'R',[-150,-60,0],[-215,-110,0],'Excess sludge','to the reject header')]};
}
function secMBR(g,ci,co){
  var i;for(i=0;i<4;i++)legs(lerp(-468,-352,i/3),i%2?40:-40,-50,L_.DECK,g);
  gBox(-475,-50,-45,-345,46,45,g,{ma:.1});bubblesLine(-466,-352,-44,-40,40,g);
  mbrTank(-335,-185,-290,-225,g);
  TUBE([[L_.SEC0,0,0],[-475,0,0]],RP,0,g,{ma:.16});TUBE([[-345,10,0],[-335,10,0]],10,0,g,{ma:.2});TUBE([[-258,32,0],[-258,64,0],[L_.SEC1,64,0]],10,10,g,{ma:.2});
  motor(-215,52,0,g);TUBE([[-200,-50,0],[-200,-80,0],[-440,-80,0],[-440,-50,0]],6,12,g,{ma:.2,a:.6});dropTo(-300,-80,g);
  return{inP:[L_.SEC0,0,0],outP:[L_.SEC1,64,0],
    flows:[[N([L_.SEC0,0,0],70,RP-2,ci),N([-475,0,0],50,14,ci),N([-440,-4,0],18,38,ci+.05),N([-370,8,0],16,38,lerp(ci,co,.5)),N([-335,10,0],40,8,lerp(ci,co,.55)),
            N([-300,-8,0],16,30,lerp(ci,co,.7)),N([-258,-24,0],14,22,lerp(ci,co,.8)),N([-258,26,0],18,10,co),N([-258,64,0],40,6,co),N([-200,64,0],60,8,co),N([L_.SEC1,64,0],70,RP-2,co)]],
    rejects:[rej([N([-300,-40,0],14,20,SLUDGE),N([-300,-80,0],20,4,SLUDGE),N([-300,L_.HDR,0],40,4,SLUDGE)],-300)],
    extras:[{nodes:[N([-410,-44,0],24,50,AIR),N([-410,40,0],24,50,AIR)],w:.025},{nodes:[N([-258,-42,0],26,26,AIR),N([-258,30,0],26,26,AIR)],w:.02}],
    labels:[lab(g,'T',[-410,86,0],[-410,46,0],'Aeration tank','Biology at high sludge age'),lab(g,'T',[-258,104,0],[-258,64,0],'Membrane tank','Permeate ready for reuse or RO'),
            lab(g,'R',[-150,-60,0],[-300,-110,0],'Waste sludge','to the reject header')]};
}
function secAnMBR(g,ci,co){
  var RX=-405,i;
  ringLegs(RX,54,-60,g,4);
  gCyl(RX,-60,140,62,g,{n:56,nseg:48});mCap([RX,140,0],'y',62,C_GLASS,.14,S(null,{g:g,kind:1}),48);
  RING([RX,140,0],'y',62,S(null,{g:g,a:.8}),56,false);
  mCyl([RX,-58,0],'y',36,58,C_SLUDGE,.35,S(null,{g:g,kind:0}),48);                                /* sludge bed */
  TUBE([[RX,150,0],[RX,200,0],[-300,200,0],[-300,240,0]],6,14,g,{ma:.2,a:.7,c:6});                /* biogas */
  gCyl(-300,240,262,5,g,{col:C_METAL,ma:.7,kind:0});
  [-30,0,30].forEach(function(y){hVessel(-320,-210,y,0,9,g,{col:C_LBLUE,ma:.22})});
  TUBE([[L_.SEC0,0,0],[-460,0,0],[-460,-40,0],[RX-62,-40,0]],RP,12,g,{ma:.16});
  TUBE([[RX+62,40,0],[-335,40,0],[-335,30,0],[-320,30,0]],10,8,g,{ma:.2});
  TUBE([[-205,30,0],[L_.SEC1,30,0]],RP,0,g,{ma:.16});
  TUBE([[-205,-30,0],[-195,-30,0],[-195,-62,0],[RX+30,-62,0],[RX+30,-60,0]],6,10,g,{ma:.2,a:.6});    /* retentate back */
  dropTo(RX-30,-60,g);
  return{inP:[L_.SEC0,0,0],outP:[L_.SEC1,30,0],
    flows:[[N([L_.SEC0,0,0],70,RP-2,ci),N([-460,0,0],50,12,ci),N([-460,-40,0],50,12,ci),N([RX-56,-40,0],30,14,ci+.02),N([RX,-20,0],12,52,ci+.06),
            N([RX,100,0],12,52,lerp(ci,co,.6)),N([RX+40,40,0],30,10,lerp(ci,co,.7)),N([-335,40,0],40,8,lerp(ci,co,.75)),N([-320,30,0],40,7,lerp(ci,co,.78)),N([-210,30,0],30,7,co),N([L_.SEC1,30,0],70,RP-2,co)]],
    rejects:[rej([N([RX-30,-40,0],10,16,SLUDGE),N([RX-30,-60,0],20,4,SLUDGE),N([RX-30,L_.HDR,0],40,4,SLUDGE)],RX-30)],
    extras:[{nodes:[N([RX,60,0],30,40,GAS),N([RX,148,0],30,10,GAS),N([RX,200,0],40,4,GAS),N([-300,200,0],40,4,GAS),N([-300,268,0],30,8,GAS)],w:.035},
            {nodes:[N([-205,-30,0],30,4,lerp(ci,co,.5)),N([-195,-30,0],30,4,lerp(ci,co,.5)),N([-195,-62,0],40,4,lerp(ci,co,.5)),N([RX+30,-62,0],40,4,lerp(ci,co,.5)),N([RX+30,-50,0],20,4,lerp(ci,co,.5))],w:.01}],
    labels:[lab(g,'L',[-500,120,0],[RX-62,110,0],'Anaerobic reactor','No aeration · COD → biogas'),lab(g,'T',[-300,290,0],[-300,262,0],'Biogas','Energy recovery'),
            lab(g,'B',[-262,-80,40],[-262,-36,0],'External membranes','Permeate out · retentate back'),lab(g,'L',[-500,-80,0],[RX-30,-80,0],'Low sludge','to the reject header')]};
}
function secAOP(g,ci,co){
  var C1=-440,C2=-372;
  ringLegs(C1,22,-50,g,3);ringLegs(C2,22,-50,g,3);
  gCyl(C1,-50,96,26,g);gCyl(C2,-50,96,26,g);
  sBox(-470,110,-90,-410,150,-50,g,C_DEEP,.85);SEG([-440,110,-70],[C1,96,0],S(null,{g:g,a:.6,dash:6,c:2}));      /* ozone generator */
  gCyl(-300,60,96,11,g,{col:C_LBLUE,ma:.35});SEG([-300,60,0],[-312,10,0],S(null,{g:g,a:.6,dash:5,c:2}));         /* H2O2 dosing */
  CYL([-330,0,0],'x',130,26,S(null,{g:g,a:.8}),{col:C_GLASS,ma:.12,n:36,nseg:30});
  [[10,10],[-10,-10],[10,-10],[-10,10]].forEach(function(q){mCyl([-322,q[0],q[1]],'x',114,4,C_UV,.32,S(null,{g:g,kind:1}),10);SEG([-318,q[0],q[1]],[-212,q[0],q[1]],S(null,{g:g,a:1,c:4,w:2.4,fxc:6,fxm:3}))});
  legs(-310,0,-26,L_.DECK,g);legs(-215,0,-26,L_.DECK,g);
  TUBE([[L_.SEC0,0,0],[-468,0,0],[-468,-36,0],[C1-10,-36,0]],RP,10,g,{ma:.16});
  TUBE([[C1+10,96,0],[C1+10,110,0],[C2-10,110,0],[C2-10,96,0]],8,8,g,{ma:.2});
  TUBE([[C2+16,-40,0],[-346,-40,0],[-346,0,0],[-330,0,0]],10,8,g,{ma:.2});TUBE([[-200,0,0],[L_.SEC1,0,0]],RP,0,g,{ma:.16});
  valve(-458,-36,0,g);
  return{inP:[L_.SEC0,0,0],outP:[L_.SEC1,0,0],
    flows:[[N([L_.SEC0,0,0],70,RP-2,ci),N([-468,0,0],50,12,ci),N([-468,-36,0],50,12,ci),N([C1,-40,0],16,22,ci+.04),N([C1,90,0],16,22,lerp(ci,co,.4)),
            N([C1+10,110,0],30,6,lerp(ci,co,.45)),N([C2-10,110,0],30,6,lerp(ci,co,.5)),N([C2,90,0],16,22,lerp(ci,co,.55)),N([C2,-34,0],16,22,lerp(ci,co,.7)),
            N([C2+16,-40,0],30,7,lerp(ci,co,.72)),N([-346,-40,0],40,8,lerp(ci,co,.74)),N([-346,0,0],40,8,lerp(ci,co,.76)),N([-326,0,0],26,20,lerp(ci,co,.8)),N([-204,0,0],24,20,co),N([L_.SEC1,0,0],70,RP-2,co)]],
    rejects:[],
    extras:[{nodes:[N([C1,-46,0],26,22,AIR),N([C1,92,0],26,22,AIR)],w:.02},{nodes:[N([C2,-46,0],26,22,AIR),N([C2,92,0],26,22,AIR)],w:.015}],
    labels:[lab(g,'L',[-500,30,0],[C1-26,30,0],'Ozone contactors','O₃ attacks recalcitrant organics'),lab(g,'T',[-440,186,-70],[-440,150,-70],'Ozone generator',''),
            lab(g,'T',[-300,132,0],[-300,96,0],'H₂O₂ dosing',''),lab(g,'B',[-265,-70,40],[-265,-26,0],'UV / H₂O₂','Hydroxyl radicals · no sludge')]};
}

/* ---------------- TERTIARY ---------------- */
function vessel(MX,g){
  var s=S(null,{g:g,a:.8}),MET=S(null,{g:g,kind:0}),i,j,a,y;
  for(i=0;i<3;i++){a=(90+i*120)*RAD;legs(MX+Math.cos(a)*(G.RV+4),Math.sin(a)*(G.RV+4),G.YB-6,L_.DECK,g)}
  CYL([MX,G.YB-6,0],'y',12,G.RV+9,s,{col:C_METAL,ma:.6,kind:0,cap:true,capA:.5,capCol:C_METAL,n:48,nseg:36});
  CYL([MX,G.YB+6,0],'y',G.YT+28-G.YB-6,G.RT,S(s,{a:.55}),{col:C_STEEL,ma:.22,n:20,nseg:16});
  for(i=0;i<G.ND;i++){y=G.Y0+i*G.GAP;
    mCyl([MX,y-4,0],'y',8,G.RD,[.05,.3,.55],.85,MET,48);mAnn([MX,y+4,0],G.RT+2,G.RD,[.12,.48,.78],.8,MET,48,true,[.04,.2,.4]);
    RING([MX,y+4,0],'y',G.RD,S(s,{a:.95,c:2,w:1.25,lod:-.6}),48,false);SIL(cylPath([MX,y-4,0],'y',8,G.RD),S(s,{a:.9,c:2,lod:-.6}));
    for(j=0;j<32;j++){a=(j+.5)/32*Math.PI*2;if(j%2)continue;SEG([MX+Math.cos(a)*(G.RT+7),y+4.2,Math.sin(a)*(G.RT+7)],[MX+Math.cos(a)*(G.RD-3),y+4.2,Math.sin(a)*(G.RD-3)],S(s,{a:j%8===0?.6:.2,c:1,lod:j%8===0?0:1.35}))}
    var yc=y+G.GAP/2;mCyl([MX,yc-1.5,0],'y',3,G.RD-11,C_WHITE,.5,S(MET,{kind:2}),40)}
  CYL([MX,G.YB+6,0],'y',G.YT-G.YB-12,G.RV,S(s,{a:.75,fxc:4,fxm:1}),{col:C_GLASS,ma:.13,n:48,nseg:36});
  CYL([MX,G.YT-6,0],'y',12,G.RV+9,s,{col:C_METAL,ma:.6,kind:0,cap:true,capA:.5,capCol:C_METAL,n:48,nseg:36});
  CYL([MX,G.YT+6,0],'y',10,14,s,{col:C_METAL,ma:.7,kind:0,cap:true,capA:.6,capCol:C_METAL,n:6,nseg:6});
  CYL([MX,G.HR-2,0],'y',G.YB-6-G.HR+2,9,S(s,{a:.7}),{col:C_GLASS,ma:.18,n:16,nseg:12});
}
function helix(cx,y0,y1,r,th0,turns,v,s,c0,c1){var n=Math.ceil(turns*20),out=[],k,t,th;
  for(k=0;k<=n;k++){t=k/n;th=th0+turns*Math.PI*2*t;out.push(N([cx+r*Math.cos(th),lerp(y0,y1,t),r*Math.sin(th)],v,s,lerp(c0,c1,t)))}return out}
function terRO(g,ci,co){
  var k,RH=(G.RT+G.RD)/2+2,yB=G.Y0+4,ymid=G.Y0+2.5*G.GAP,yTop=G.YT-18,out=L_.TER1;
  VX.forEach(function(x){vessel(x,g)});
  for(k=0;k<2;k++){var xs=VX[k]+G.RV+21;TUBE([[VX[k]+G.RV,G.YC,0],[xs,G.YC,0],[xs,G.YF,0],[VX[k+1]-G.RV,G.YF,0]],10,12,g,{ma:.2,a:.7})}
  var xc=VX[2]+G.RV+21;TUBE([[VX[2]+G.RV,G.YC,0],[xc,G.YC,0],[xc,-40,0]],10,12,g,{ma:.2,a:.7});TUBE([[xc,-40,0],[xc,L_.HDR,0]],7,0,g,{ma:.2,a:.7});
  TUBE([[L_.TER0,G.YF,0],[VX[0]-G.RV,G.YF,0]],RP,0,g,{ma:.16});TUBE([[VX[0]-14,0,0],[out,0,0]],G.HR,0,g,{ma:.16});mCap([VX[0]-14,0,0],'x',G.HR,C_METAL,.5,S(null,{g:g,kind:0}),24);
  function port(k,c){return N([VX[k]-G.RV,G.YF,0],50,12,c)}
  function perm(k,c){return[port(k,c)].concat(helix(VX[k],yB,ymid,RH,Math.PI,1.25,42,9,c,.72),[N([VX[k],ymid,0],30,4,.78),N([VX[k],G.YB-6,0],60,4,.8),N([VX[k],0,0],60,8,.8),N([VX[k]+12,0,0],70,14,.8)])}
  function conc(k,c,last){var h=[port(k,c)].concat(helix(VX[k],yB,yTop,RH,Math.PI,2.5,42,9,c,c-.08));
    return last?h.concat([N([VX[k]+G.RV,G.YC,0],55,7,BRINE),N([VX[k]+G.RV+21,G.YC,0],55,7,BRINE),N([VX[k]+G.RV+21,L_.HDR,0],60,6,BRINE)])
               :h.concat([N([VX[k]+G.RV,G.YC,0],55,7,c-.1),N([VX[k]+G.RV+21,G.YC,0],55,7,c-.1),N([VX[k]+G.RV+21,G.YF,0],60,7,c-.11)])}
  var tail=function(x){return[N([out,0,0],70,RP-2,.82)]};
  var cin=[ci,ci-.1,ci-.2];
  var f1=[N([L_.TER0,G.YF,0],70,RP-2,ci)].concat(perm(0,cin[0]),tail()),
      f2=[N([L_.TER0,G.YF,0],70,RP-2,ci)].concat(conc(0,cin[0]),perm(1,cin[1]),tail()),
      f3=[N([L_.TER0,G.YF,0],70,RP-2,ci)].concat(conc(0,cin[0]),conc(1,cin[1]),perm(2,cin[2]),tail());
  return{inP:[L_.TER0,G.YF,0],outP:[out,0,0],flows:[f1,f1,f2,f2,f3],
    rejects:[rej(conc(2,cin[2],true),xc)],extras:[],
    labels:[lab(g,'T',[VX[0],G.YT+48,0],[VX[0],G.YT+20,0],'Stage 1','Feed'),lab(g,'T',[VX[1],G.YT+48,0],[VX[1],G.YT+20,0],'Stage 2','Fed by stage 1'),
            lab(g,'T',[VX[2],G.YT+48,0],[VX[2],G.YT+20,0],'Stage 3','Fed by stage 2'),lab(g,'R',[300,-40,0],[xc,-40,0],'Concentrate','joins the sludge line'),
            lab(g,'B',[100,-60,40],[100,-G.HR,0],'Permeate header','from all three stages')]};
}
function terGAC(g,ci,co){
  var A=-55,B=40,out=L_.TER1;
  [A,B].forEach(function(x,k){ringLegs(x,28,-60,g,3);gCyl(x,-60,120,34,g);mCyl([x,-44,0],'y',118,31,C_CARBON,.35,S(null,{g:g,kind:0}),32);
    scatter(x-24,x+24,-40,70,-24,24,40,2.2,0,g,3+k*17);CYL([x,120,0],'y',8,36,S(null,{g:g,a:.8}),{col:C_METAL,ma:.6,kind:0,n:32,nseg:24,cap:true,capA:.6,capCol:C_METAL})});
  TUBE([[L_.TER0,0,0],[-100,0,0],[-100,136,0],[A,136,0],[A,128,0]],RP,12,g,{ma:.16});
  TUBE([[A,-60,0],[A,-74,0],[-8,-74,0],[-8,136,0],[B,136,0],[B,128,0]],12,12,g,{ma:.18});
  TUBE([[B,-60,0],[B,-74,0],[92,-74,0],[92,0,0],[110,0,0]],12,12,g,{ma:.18});
  CYL([110,0,0],'x',110,22,S(null,{g:g,a:.8}),{col:C_GLASS,ma:.12,n:32,nseg:26});
  [[8,8],[-8,-8]].forEach(function(q){mCyl([116,q[0],q[1]],'x',98,4,C_UV,.32,S(null,{g:g,kind:1}),10);SEG([120,q[0],q[1]],[212,q[0],q[1]],S(null,{g:g,a:1,c:4,w:2.4,fxc:6,fxm:3}))});
  legs(130,0,-22,L_.DECK,g);legs(200,0,-22,L_.DECK,g);TUBE([[220,0,0],[out,0,0]],RP,0,g,{ma:.16});
  dropTo(A-20,-74,g);TUBE([[A,-74,0],[A-20,-74,0]],6,0,g,{ma:.2});
  return{inP:[L_.TER0,0,0],outP:[out,0,0],
    flows:[[N([L_.TER0,0,0],70,RP-2,ci),N([-100,0,0],60,10,ci),N([-100,136,0],60,10,ci),N([A,136,0],50,8,ci),N([A,110,0],16,26,ci+.04),N([A,-50,0],14,26,lerp(ci,co,.4)),
            N([A,-74,0],40,8,lerp(ci,co,.45)),N([-8,-74,0],50,9,lerp(ci,co,.5)),N([-8,136,0],50,9,lerp(ci,co,.5)),N([B,136,0],50,8,lerp(ci,co,.55)),N([B,110,0],16,26,lerp(ci,co,.6)),
            N([B,-50,0],14,26,lerp(ci,co,.8)),N([B,-74,0],40,8,lerp(ci,co,.82)),N([92,-74,0],50,9,lerp(ci,co,.84)),N([92,0,0],50,9,lerp(ci,co,.86)),N([114,0,0],30,16,lerp(ci,co,.9)),N([216,0,0],26,16,co),N([out,0,0],70,RP-2,co)]],
    rejects:[rej([N([A,-56,0],14,12,SLUDGE),N([A,-74,0],20,5,SLUDGE),N([A-20,-74,0],20,4,SLUDGE),N([A-20,L_.HDR,0],40,4,SLUDGE)],A-20)],extras:[],
    labels:[lab(g,'T',[A,178,0],[A,140,0],'Lead GAC column','Micropollutants, colour, odour'),lab(g,'T',[B+40,178,0],[B,140,0],'Lag GAC column',''),
            lab(g,'B',[165,-60,40],[165,-22,0],'UV','Bacteria barrier'),lab(g,'L',[-140,-100,0],[A-20,-100,0],'Backwash','to the reject header')]};
}
function terIX(g,ci,co){
  var A=-55,B=35,out=L_.TER1,i;
  [[A,C_AMBER,6],[B,C_LBLUE,2]].forEach(function(q,k){ringLegs(q[0],24,-60,g,3);gCyl(q[0],-60,110,30,g);mCyl([q[0],-44,0],'y',110,27,q[1],.28,S(null,{g:g,kind:0}),32);
    scatter(q[0]-20,q[0]+20,-40,60,-20,20,46,2.6,q[2],g,5+k*11);CYL([q[0],110,0],'y',8,32,S(null,{g:g,a:.8}),{col:C_METAL,ma:.6,kind:0,n:32,nseg:24,cap:true,capA:.6,capCol:C_METAL})});
  gCyl(A,150,180,10,g,{col:C_AMBER,ma:.3,z:-70});gCyl(B,150,180,10,g,{col:C_LBLUE,ma:.35,z:-70});
  SEG([A,150,-70],[A,118,0],S(null,{g:g,a:.5,dash:5}));SEG([B,150,-70],[B,118,0],S(null,{g:g,a:.5,dash:5}));
  /* electrodialysis stack */
  for(i=0;i<12;i++){var px=110+i*9;mQuad([px,-30,-30],[px,-30,30],[px,40,30],[px,40,-30],[1,0,0],i%2?C_AMBER:C_LBLUE,.3,S(null,{g:g,kind:2}));PL([[px,-30,-30],[px,-30,30],[px,40,30],[px,40,-30]],S(null,{g:g,a:.5,c:i%2?6:2,w:1}),true)}
  sBox(102,-36,-34,108,46,34,g,[.7,.2,.2],.6);sBox(210,-36,-34,216,46,34,g,C_DEEP,.7);legs(110,0,-36,L_.DECK,g);legs(208,0,-36,L_.DECK,g);
  TUBE([[L_.TER0,0,0],[-96,0,0],[-96,126,0],[A,126,0],[A,118,0]],RP,12,g,{ma:.16});
  TUBE([[A,-60,0],[A,-72,0],[-10,-72,0],[-10,126,0],[B,126,0],[B,118,0]],12,12,g,{ma:.18});
  TUBE([[B,-60,0],[B,-72,0],[86,-72,0],[86,10,0],[102,10,0]],12,12,g,{ma:.18});TUBE([[216,10,0],[226,10,0],[226,0,0],[out,0,0]],RP,8,g,{ma:.16});
  TUBE([[160,-36,0],[160,-60,0]],6,0,g,{ma:.2});dropTo(160,-60,g);
  return{inP:[L_.TER0,0,0],outP:[out,0,0],
    flows:[[N([L_.TER0,0,0],70,RP-2,ci),N([-96,0,0],60,10,ci),N([-96,126,0],60,10,ci),N([A,126,0],50,8,ci),N([A,100,0],16,22,ci+.04),N([A,-50,0],14,22,lerp(ci,co,.4)),
            N([A,-72,0],40,8,lerp(ci,co,.45)),N([-10,-72,0],50,9,lerp(ci,co,.5)),N([-10,126,0],50,9,lerp(ci,co,.5)),N([B,126,0],50,8,lerp(ci,co,.55)),N([B,100,0],16,22,lerp(ci,co,.6)),
            N([B,-50,0],14,22,lerp(ci,co,.75)),N([B,-72,0],40,8,lerp(ci,co,.78)),N([86,-72,0],50,9,lerp(ci,co,.8)),N([86,10,0],50,9,lerp(ci,co,.82)),N([110,10,0],22,22,lerp(ci,co,.85)),
            N([210,10,0],22,22,co),N([226,10,0],40,8,co),N([226,0,0],50,10,co),N([out,0,0],70,RP-2,co)]],
    rejects:[rej([N([160,-20,0],16,16,BRINE),N([160,-36,0],20,5,BRINE),N([160,L_.HDR,0],40,4,BRINE)],160)],extras:[],
    labels:[lab(g,'T',[A,206,-70],[A,180,-70],'Cation resin','Zn, Fe, heavy metals'),lab(g,'T',[B+40,206,-70],[B,180,-70],'Anion resin',''),
            lab(g,'T',[165,84,0],[165,40,0],'Electrodialysis stack','Selective ion removal'),lab(g,'R',[250,-90,0],[160,-90,0],'Regenerant & ED brine','to the reject header')]};
}

/* ---------------- POLISHING & SPLIT (potable / process water recycle) ---------------- */
var LAMPS=[[16,16],[16,-16],[-16,16],[-16,-16]];
function polUV(g){
  var s=S(null,{g:g,a:.8}),X0=G.UX0,X1=G.UX1,bx0=X0+48,bx1=X1-38,by0=104,by1=154,zf=2.4,FL=S(null,{g:g,kind:2});
  mBox(bx0,by0,-2,bx1,by1,2,C_DEEP,.85,FL);BOX(bx0,by0,-2,bx1,by1,2,S(s,{a:.85}));
  SEG([bx0+8,by1-9,zf],[bx0+38,by1-9,zf],S(s,{a:.95,c:1,w:1.7}));
  mQuad([bx0+8,by0+24,zf],[bx1-8,by0+24,zf],[bx1-8,by0+34,zf],[bx0+8,by0+34,zf],[0,0,1],C_UV,.28,FL);
  var tr=[[0,13],[10,18],[20,24],[30,28],[40,30],[52,29],[64,30.5],[78,29.5],[98,30]];
  PL(tr.map(function(q){return[bx0+8+q[0],by0+q[1],zf]}),S(s,{a:1,c:4,w:1.9,fxc:3,fxm:2}),false,function(q){return(q[0]-bx0-8)/98});
  SEG([X0+105,G.RU+16,0],[X0+105,by0,0],S(s,{a:.7}));
  CYL([X0-20,0,0],'x',20,G.HR,s,{col:C_GLASS,ma:.14,r2:G.RU,n:40,nseg:32});CYL([X1,0,0],'x',20,G.RU,s,{col:C_GLASS,ma:.14,r2:RO,n:40,nseg:32});
  CYL([X0,0,0],'x',X1-X0,G.RU,s,{col:C_GLASS,ma:.12,n:48,nseg:40});flangeAt([X0,0,0],'x',G.RU+7,g);flangeAt([X1,0,0],'x',G.RU+7,g);
  LAMPS.forEach(function(q){mCyl([X0+12,q[0],q[1]],'x',X1-X0-24,5,C_UV,.32,S(null,{g:g,kind:1}),12);
    SEG([X0+16,q[0],q[1]],[X1-16,q[0],q[1]],S(s,{a:1,c:4,w:2.6,fxc:6,fxm:3}));SEG([X0+16,q[0],q[1]],[X1-16,q[0],q[1]],S(s,{a:.35,c:1,w:1}))});
  CYL([X0+105,G.RU-2,0],'y',18,6,S(s,{a:.8}),{col:C_METAL,ma:.75,kind:0,cap:true,capA:.8,capCol:C_METAL,n:16,nseg:12});
  [X0+20,X1-20].forEach(function(x){legs(x,0,-G.RU,L_.DECK,g)});
  var vy=-G.RU-14,fx=X0+100;PL([[fx-8,vy+7,0],[fx+8,vy-7,0],[fx-8,vy-7,0],[fx+8,vy+7,0]],S(s,{a:.9}),true);dropTo(fx,-G.RU,g);
  /* split: tee, valves, recycle branch */
  var SX=L_.XSPL;TUBE([[L_.TER1,0,0],[X0-20,0,0]],G.HR,0,g,{ma:.16});
  TUBE([[SX,-G.HR,0],[SX,L_.REC,0],[690,L_.REC,0]],12,14,g,{ma:.18});flangeAt([690,L_.REC,0],'x',19,g);
  valve(SX+30,0,G.HR+2,g);valve(SX,-50,12,g,true);gCyl(SX,G.HR-2,G.HR+14,8,g,{col:C_METAL,ma:.7,kind:0,cap:true,capA:.8,capCol:C_METAL});
  TUBE([[X1+20,0,0],[G.JET0,0,0]],RO,0,0);flare(G.JET0,G.FAN1-30,false);flangeAt([G.JET0,0,0],'x',RO+9,0);
  return{fx:fx,
    potable:[N([L_.TER1,0,0],80,16,.86),N([X0-20,0,0],80,16,.86),N([X0,0,0],50,30,.88),N([X1,0,0],42,30,1),N([X1+20,0,0],70,R*.9,1),N([G.JET0,0,0],87.5,R*.9,1)],
    recycle:[N([L_.TER1,0,0],80,16,.86),N([SX-12,0,0],60,10,.86),N([SX,-12,0],50,8,.86),N([SX,L_.REC,0],50,8,.86),N([690,L_.REC,0],70,9,.86),N([740,L_.REC-2,0],60,20,.86),N([860,L_.REC-10,0],55,46,.86)],
    flush:[N([fx,-24,0],30,6,.9),N([fx,-60,0],45,4,.9),N([fx,L_.HDR,0],50,4,.9)],
    labels:[lab(5,'L',[X0-40,-96,40],[X0+28,-16,16],'UV-C polishing','254 nm · potable water only'),lab(5,'T',[X0+105,182,0],[X0+105,154,0],'UV intensity','Dose verified continuously'),
            lab(5,'T',[SX,70,0],[SX,G.HR+14,0],'Split','Potable or process water'),lab(5,'B',[600,L_.REC-40,40],[600,L_.REC,0],'Process water recycle','back to production')]};
}

/* ---------------- CONCENTRATE MANAGEMENT (below primary / secondary) ---------------- */
function cmHousing(x0,x1,g){
  var y0=L_.BY0,y1=L_.BY1,z0=L_.BZ0,z1=L_.BZ1;
  [[x0+10,z0+10],[x1-10,z0+10],[x0+10,z1-10],[x1-10,z1-10]].forEach(function(q){SEG([q[0],y0-7,q[1]],[q[0],PY,q[1]],S(null,{g:g,a:.36}))});
  mBox(x0-4,y0-7,z0-4,x1+4,y0,z1+4,C_FRAME,.2,S(null,{g:g,kind:0}));BOX(x0-4,y0-7,z0-4,x1+4,y0,z1+4,S(null,{g:g,a:.7}));
  mBox(x0,y0,z0,x1,y1,z1,C_GLASS,.08,S(null,{g:g,kind:1}));BOX(x0,y0,z0,x1,y1,z1,S(null,{g:g,a:.75}));
}
function outlet(x,cc,g,code){
  TUBE([[x,L_.OY,L_.BZ1],[x,L_.OY,L_.OZ]],9,0,g,{ma:.2,a:.75});flangeAt([x,L_.OY,L_.BZ1+4],'z',14,g);flangeAt([x,L_.OY,L_.OZ-4],'z',14,g);
  RING([x,L_.OY,L_.OZ],'z',11,S(null,{g:g,a:1,c:cc,w:2.2}),24,false);
  return[N([x,L_.OY,10],22,5,code),N([x,L_.OY,L_.BZ1],40,6,code),N([x,L_.OY,L_.OZ],50,7,code),N([x,L_.OY-22,L_.OZ+40],55,10,code),N([x,L_.OY-70,L_.OZ+66],60,14,code)];
}
function cmMembrane(g){
  var x0=L_.CM0,x1=L_.CM1;cmHousing(x0,x1,g);
  [-200,-232,-264].forEach(function(y,k){hVessel(-735,-520,y,-10,13,g,{col:C_LBLUE,ma:.2})});
  gCyl(-760,-290,-250,14,g,{col:C_METAL,ma:.7,kind:0,cap:true,capA:.8,capCol:C_METAL});motor(-760,-250,0,g);
  TUBE([[-760,-250,0],[-760,-200,0],[-740,-200,-10]],6,8,g,{ma:.2});
  return{inside:[N([L_.JX,L_.BY1,0],30,6,BRINE),N([-660,-196,-10],30,10,BRINE),N([-520,-200,-10],26,10,BRINE),N([-520,-232,-10],26,10,BRINE),N([-735,-232,-10],26,10,BRINE),N([-735,-264,-10],26,10,BRINE),N([-520,-264,-10],26,10,BRINE)],
    waterX:-560,brineFrom:[-520,-264],
    labels:[lab(6,'T',[-628,-118,-60],[-628,-170,-60],'Inflow','Sludge, concentrate, backwash'),lab(6,'L',[-820,-200,0],[-735,-200,-10],'High-pressure vessels','Membrane pre-concentration')]};
}
function cmED(g){
  var x0=L_.CM0,x1=L_.CM1,i;cmHousing(x0,x1,g);
  for(i=0;i<14;i++){var px=-720+i*13;mQuad([px,-285,-50],[px,-285,40],[px,-190,40],[px,-190,-50],[1,0,0],i%2?C_AMBER:C_LBLUE,.28,S(null,{g:g,kind:2}));PL([[px,-285,-50],[px,-285,40],[px,-190,40],[px,-190,-50]],S(null,{g:g,a:.5,c:i%2?6:2,w:1}),true)}
  sBox(-730,-290,-54,-724,-186,44,g,[.7,.2,.2],.6);sBox(-532,-290,-54,-526,-186,44,g,C_DEEP,.7);
  gCyl(-480,-290,-210,20,g,{col:C_LBLUE,ma:.2});
  return{inside:[N([L_.JX,L_.BY1,0],30,6,BRINE),N([-660,-200,-30],24,12,BRINE),N([-560,-260,20],20,14,BRINE),N([-520,-264,0],26,8,BRINE)],
    waterX:-480,brineFrom:[-520,-264],
    labels:[lab(6,'T',[-628,-118,-60],[-628,-170,-60],'Inflow','Sludge, concentrate, backwash'),lab(6,'L',[-820,-220,0],[-726,-230,0],'ED stack','Alternating ion membranes · DC field')]};
}
function cmMEE(g){
  var x0=L_.CM0,x1=L_.CM1,E=[-735,-655,-575];cmHousing(x0,x1,g);
  E.forEach(function(x,k){gCyl(x,-290,-196,26,g,{n:36,nseg:28});mCap([x,-196,0],'y',26,C_GLASS,.14,S(null,{g:g,kind:1}),28);
    mCyl([x,-288,0],'y',30-k*6,24,C_SLUDGE,.3+k*.1,S(null,{g:g,kind:0}),28);
    if(k<2)PL([[x,-180,0],[x,-176,0],[E[k+1],-176,0],[E[k+1],-196,0]],S(null,{g:g,a:.6,dash:6,c:1}))});
  RING([-490,-215,0],'z',22,S(null,{g:g,a:.85,w:1.4}),28,true);for(var i=0;i<6;i++){var a=i/6*Math.PI*2;SEG([-490,-215,0],[-490+Math.cos(a)*18,-215+Math.sin(a)*18,0],S(null,{g:g,a:.7}))}
  PL([[-575,-176,0],[-490,-176,0],[-490,-193,0]],S(null,{g:g,a:.6,dash:6,c:1}));
  return{inside:[N([L_.JX,L_.BY1,0],30,6,BRINE),N([-700,-210,0],22,14,BRINE),N([-735,-270,0],18,16,BRINE),N([-655,-270,0],22,16,BRINE),N([-575,-272,0],22,14,BRINE),N([-520,-264,0],26,8,BRINE)],
    waterX:-490,brineFrom:[-520,-264],steam:true,
    labels:[lab(6,'T',[-628,-118,-60],[-628,-170,-60],'Inflow','Sludge, concentrate, backwash'),lab(6,'L',[-820,-220,0],[-735,-220,0],'Evaporator effects','Each effect heats the next'),
            lab(6,'R',[-420,-150,0],[-490,-193,0],'MVR compressor','Vapour re-used as heat')]};
}

/* ---------------- ZLD (below secondary / tertiary) ---------------- */
function zldNone(g){
  var x0=L_.ZL0,x1=L_.ZL1;BOX(x0,L_.BY0,L_.BZ0,x1,L_.BY1,L_.BZ1,S(null,{g:g,a:.35,dash:8}));
  return{none:true,labels:[lab(7,'T',[-215,-140,0],[-215,-170,0],'No ZLD','Brine discharged within permit limits')]};
}
function zldBrineX(g){
  var x0=L_.ZL0,x1=L_.ZL1;cmHousing(x0,x1,g);
  [[-360,-230,-196],[-345,-250,-228],[-330,-262,-260]].forEach(function(q,k){hVessel(q[0],q[1],q[2],-10,13-k*2,g,{col:C_LBLUE,ma:.2})});
  gCyl(-140,-262,-186,34,g);gCyl(-140,-292,-262,8,g,{r2:34});mCyl([-140,-288,0],'y',22,8,C_GREEN,.45,S(null,{g:g,kind:0}),24,30);
  return{inside:[N([L_.ZL0,-264,0],30,6,BRINE),N([-360,-196,-10],24,10,BRINE),N([-230,-196,-10],24,10,BRINE),N([-345,-228,-10],24,9,BRINE),N([-250,-228,-10],24,9,BRINE),
                 N([-330,-260,-10],24,8,BRINE),N([-262,-260,-10],24,8,BRINE),N([-160,-230,0],20,20,BRINE),N([-140,-270,0],18,14,PROD)],
    xs:[-300,-140,-90],
    labels:[lab(7,'L',[-400,-150,0],[-330,-196,-10],'BrineX stages','Membrane pre-concentration'),lab(7,'T',[-140,-140,0],[-140,-186,0],'Crystallizer','~40% less thermal energy')]};
}
function zldFull(g){
  var x0=L_.ZL0,x1=L_.ZL1,i;cmHousing(x0,x1,g);
  [-356,-322].forEach(function(x){gCyl(x,-288,-190,12,g,{col:C_LBLUE,ma:.2})});
  gCyl(-262,-292,-182,24,g);mCap([-262,-182,0],'y',24,C_GLASS,.14,S(null,{g:g,kind:1}),24);
  gCyl(-180,-262,-188,30,g);gCyl(-180,-292,-262,8,g,{r2:30});mCyl([-180,-288,0],'y',20,8,C_GREEN,.45,S(null,{g:g,kind:0}),24,28);
  sBox(-130,-262,-30,-66,-214,30,g,C_FRAME,.3);for(i=0;i<8;i++){var px=-124+i*8;SEG([px,-260,-28],[px,-216,-28],S(null,{g:g,a:.6}))}
  return{inside:[N([L_.ZL0,-264,0],30,6,BRINE),N([-356,-280,0],22,10,BRINE),N([-356,-200,0],22,10,BRINE),N([-322,-200,0],22,10,BRINE),N([-322,-280,0],22,10,BRINE),
                 N([-262,-270,0],18,18,BRINE),N([-262,-200,0],18,18,BRINE),N([-200,-210,0],22,16,BRINE),N([-180,-270,0],18,14,PROD),N([-100,-250,0],16,16,WASTE)],
    xs:[-330,-180,-98],
    labels:[lab(7,'T',[-339,-140,0],[-339,-190,0],'Multi-stage RO',''),lab(7,'T',[-262,-118,-60],[-262,-182,0],'Brine concentrator',''),
            lab(7,'T',[-180,-140,40],[-180,-188,0],'Crystallizer',''),lab(7,'R',[-30,-200,0],[-66,-238,0],'Filter press','Solids out')]};
}

/* =====================================================================
   ASSEMBLY: the selected technologies are placed in their slots, joined by pipes, and the water routes are built
   ===================================================================== */
var PREF=[preScreen,preCoag,preUF],PRIF=[priSed,priDAF,priMBR],SECF=[secCAS,secMBBR,secMBR,secAnMBR,secAOP],TERF=[terRO,terGAC,terIX],
    CMF=[cmMembrane,cmED,cmMEE],ZLF=[zldNone,zldBrineX,zldFull];
var LABELS=[],LEGS=[],ROUTES=[];
function leg(nodes,er){LEGS.push(fillet(nodes,er===undefined?10:er,8));return LEGS.length-1}
function legGroup(list,er){var b=LEGS.length;list.forEach(function(n){leg(n,er)});return b+1000*(list.length-1)}
function cat(){var out=[];for(var i=0;i<arguments.length;i++){var a=arguments[i];if(out.length&&a.length&&len(sub(out[out.length-1].p,a[0].p))<.5)a=a.slice(1);out=out.concat(a)}return out}
function connector(a,b,c,g){
  var pts=Math.abs(a[1]-b[1])>1?[a,[(a[0]+b[0])/2,a[1],0],[(a[0]+b[0])/2,b[1],0],b]:[a,b];
  TUBE(pts,RP,12,g||0,{ma:.16});
  return pts.map(function(p,i){return N(p,70,RP-2,c)});
}
function hdrPath(x){return x<=L_.JX?[N([x,L_.HDR,0],40,4,SLUDGE),N([L_.JX,L_.HDR,0],45,5,SLUDGE),N([L_.JX,L_.BY1,0],35,5,SLUDGE)]
                                    :[N([x,L_.HDR,0],40,4,SLUDGE),N([L_.JX,L_.HDR,0],45,5,SLUDGE),N([L_.JX,L_.BY1,0],35,5,SLUDGE)]}

function buildScene(){
  var i,x,z,pts;
  G.SPIN=99999;LABELS=[];LEGS=[];ROUTES=[];
  /* ---------------- blueprint plate ---------------- */
  function chamf(y){var c=26;return[[PX0+c,y,PZ0],[PX1-c,y,PZ0],[PX1,y,PZ0+c],[PX1,y,PZ1-c],[PX1-c,y,PZ1],[PX0+c,y,PZ1],[PX0,y,PZ1-c],[PX0,y,PZ0+c]]}
  mQuad([PX0,PY,PZ0],[PX1,PY,PZ0],[PX1,PY,PZ1],[PX0,PY,PZ1],[0,1,0],[.85,.94,1],.32,{g:0,kind:2},.42);
  mQuad([PX0+26,PY-9,PZ1],[PX1-26,PY-9,PZ1],[PX1-26,PY,PZ1],[PX0+26,PY,PZ1],[0,0,1],[.55,.75,.9],.5,{g:0,kind:2},.3);
  PL(chamf(PY),S(null,{a:.62,w:1.25}),true);PL(chamf(PY-9),S(null,{a:.25}),true);
  pts=chamf(PY);for(i=2;i<7;i++)SEG(pts[i],[pts[i][0],PY-9,pts[i][2]],S(null,{a:.25}));
  for(x=-1050;x<=740;x+=50)SEG([x,PY+.3,PZ0+8],[x,PY+.3,PZ1-8],S(null,{a:x%200===0?.16:.08,w:1}));
  for(z=-100;z<=100;z+=50)SEG([PX0+8,PY+.3,z],[PX1-8,PY+.3,z],S(null,{a:z===0?.16:.08,w:1}));
  var PLAN=S(null,{a:.6,w:1.1,c:2,g:0,fxc:2,fxm:2}),revX=function(q){return(q[0]-PX0)/(PX1-PX0)},yy=PY+.6,zz=PZ1-26;
  PL([[-1050,yy,zz],[720,yy,zz]],PLAN,false,revX);[-800,-400,0,400].forEach(function(ax){PL([[ax-9,yy,zz-6],[ax,yy,zz],[ax-9,yy,zz+6]],PLAN,false,revX)});
  /* ---------------- deck: the treatment line stands on it, concentrate management and ZLD sit below ---------------- */
  mBox(-1012,L_.DECK-5,-90,620,L_.DECK,90,C_FRAME,.12,S(null,{g:0,kind:0}));BOX(-1012,L_.DECK-5,-90,620,L_.DECK,90,S(null,{a:.45}));
  for(x=-1000;x<=600;x+=40)SEG([x,L_.DECK+.3,-88],[x,L_.DECK+.3,88],S(null,{a:.1,lod:1.2}));
  [-1012,-812,-410,-30,270,620].forEach(function(px){[-90,90].forEach(function(pz){SEG([px,L_.DECK-5,pz],[px,PY,pz],S(null,{a:.32}))})});

  /* ---------------- inlet ---------------- */
  flare(G.FUN0-40,G.FUN1,true);TUBE([[G.FUN1,0,0],[L_.PRE0,0,0]],RO,0,0);flangeAt([G.FUN1,0,0],'x',RO+9,0);

  /* ---------------- the treatment line ---------------- */
  var cl=[0,.22,.42,.62,.86];
  var U=[PREF[SEL.pre](1,cl[0],cl[1]),PRIF[SEL.pri](2,cl[1],cl[2]),SECF[SEL.sec](3,cl[2],cl[3]),TERF[SEL.ter](4,cl[3],cl[4])];
  var C=[];for(i=0;i<3;i++)C.push(connector(U[i].outP,U[i+1].inP,cl[i+1]));
  var pol=polUV(5);
  var cm=CMF[SEL.cm](6),zl=ZLF[SEL.zld](7);

  /* ---------------- reject header: everything removed upstream joins the sludge line under the primary stage ---------------- */
  var xs=[];U.forEach(function(u){u.rejects.forEach(function(r){xs.push(r.x)})});xs.push(pol.fx);
  var xmin=Math.min.apply(0,xs.concat([L_.JX])),xmax=Math.max.apply(0,xs.concat([L_.JX]));
  if(xmin<L_.JX)TUBE([[xmin,L_.HDR,0],[L_.JX,L_.HDR,0]],8,0,0,{ma:.2,a:.7});
  if(xmax>L_.JX)TUBE([[xmax,L_.HDR,0],[L_.JX,L_.HDR,0]],8,0,0,{ma:.2,a:.7});
  TUBE([[L_.JX,L_.HDR,0],[L_.JX,L_.BY1,0]],8,0,0,{ma:.2,a:.7});flangeAt([L_.JX,L_.BY1+10,0],'y',13,0);
  mCap([xmin,L_.HDR,0],'x',8,C_METAL,.6,S(null,{g:0,kind:0}),16);mCap([xmax,L_.HDR,0],'x',8,C_METAL,.6,S(null,{g:0,kind:0}),16);

  /* ---------------- concentrate management -> ZLD, outlets ---------------- */
  var outs=[];
  var cmWater=cat([N([-640,-236,0],20,14,.9),N([-580,-250,0],22,8,.92)],outlet(-580,2,6,.95));
  if(zl.none){outs.push({nodes:cat([N(cm.brineFrom.concat([0]),26,6,BRINE),N([-480,-264,0],24,5,BRINE)],outlet(-480,6,6,BRINE)),w:.03})}
  else{TUBE([[L_.CM1,-264,0],[L_.ZL0,-264,0]],7,0,6,{ma:.2,a:.7});
    outs.push({nodes:cat([N(cm.brineFrom.concat([0]),26,6,BRINE),N([L_.CM1,-264,0],40,5,BRINE)],zl.inside),w:.035});
    outs.push({nodes:cat([N([zl.xs[0]-10,-236,0],20,12,.9)],outlet(zl.xs[0],2,7,.95)),w:.025});
    outs.push({nodes:cat([N([zl.xs[1],-250,0],18,10,PROD)],outlet(zl.xs[1],5,7,PROD)),w:.025});
    outs.push({nodes:cat([N([zl.xs[2],-248,0],18,10,WASTE)],outlet(zl.xs[2],6,7,WASTE)),w:.025})}
  outs.push({nodes:cmWater,w:.03});

  /* ---------------- labels ---------------- */
  var tl=[[L_.XPRE-70,1],[L_.XPRI+20,2],[L_.XSEC,3],[L_.XTER,4],[(G.UX0+G.UX1)/2,5]];
  LABELS.push({g:'ov',side:'B',at:[-1220,-70,90],off:[0,14],t:'Inlet',s:'Loaded · brown, turbid',desk:1});
  var OVT=['Pre-treatment','Primary','Secondary','Tertiary','Polishing & split'];
  tl.forEach(function(q,k){LABELS.push({g:'ov',side:'T',at:[q[0],300,0],off:[0,-6],t:'0'+(k+1)+' · '+OVT[k],s:k<4?opt(STAGES[k].key).ov:'UV | recycle'})});
  LABELS.push({g:'ov',side:'T',at:[850,96,0],off:[0,-4],t:'Potable water',s:'after UV polishing',desk:1});
  LABELS.push({g:'ov',side:'B',at:[830,L_.REC-46,40],off:[0,10],t:'Process water',s:'recycled to production',desk:1});
  LABELS.push({g:'ov',side:'B',at:[-615,PY-6,L_.OZ+90],off:[0,14],t:'06 · Concentrate management',s:opt('cm').sh});
  LABELS.push({g:'ov',side:'B',at:[-215,PY-6,L_.OZ+90],off:[0,14],t:'07 · ZLD',s:opt('zld').sh});
  U.concat([pol,cm,zl]).forEach(function(u){(u.labels||[]).forEach(function(L){LABELS.push(L)})});
  LABELS.push({g:5,side:'B',at:[-580,-300,L_.OZ+40],from:[-580,L_.OY,L_.OZ],t:'Recovered water',s:'distillate / permeate'});
  if(zl.none)LABELS.push({g:5,side:'B',at:[-480,-330,L_.OZ+60],from:[-480,L_.OY,L_.OZ],t:'Brine discharge',s:'within permit limits'});
  else{LABELS.push({g:6,side:'B',at:[zl.xs[0],-300,L_.OZ+40],from:[zl.xs[0],L_.OY,L_.OZ],t:'Pure water',s:'recovered'});
    LABELS.push({g:6,side:'B',at:[zl.xs[1],-330,L_.OZ+60],from:[zl.xs[1],L_.OY,L_.OZ],t:'Valuable products',s:'salts · minerals'});
    LABELS.push({g:6,side:'B',at:[zl.xs[2],-300,L_.OZ+40],from:[zl.xs[2],L_.OY,L_.OZ],t:'Pure waste',s:'dry solids'})}
  LABELS.forEach(function(L){if(L.from)SEG(L.from,L.at,S(null,{g:8+L.g,a:.6,c:0,w:1}))});
  flushLines();flushMesh();

  /* ---------------- water routes ---------------- */
  var LG=U.map(function(u){return legGroup(u.flows,10)});
  var LC=C.map(function(n){return leg(n,12)});
  var main=[LG[0],LC[0],LG[1],LC[1],LG[2],LC[2],LG[3]];
  /* flags: 1 open inlet stream, 2 open outlet stream, 4 fade in, 8 fade out */
  ROUTES.push({legs:main.concat([leg(pol.potable,0)]),f:3,w:.27});
  ROUTES.push({legs:main.concat([leg(pol.recycle,12)]),f:1+8,w:.21});
  var cmIn=cm.inside;
  U.forEach(function(u,k){u.rejects.forEach(function(r){ROUTES.push({legs:[leg(cat(r.nodes,hdrPath(r.x),cmIn),12)],f:4+8,w:k===3?.05:.03})});
    u.extras.forEach(function(e){ROUTES.push({legs:[leg(e.nodes,10)],f:4+8,w:e.w})})});
  ROUTES.push({legs:[leg(cat(pol.flush,hdrPath(pol.fx),cmIn),12)],f:4+8,w:.012});
  outs.forEach(function(o){ROUTES.push({legs:[leg(o.nodes,14)],f:4+8,w:o.w})});
}

/* resample every leg at equal time steps; returns the uniform arrays for the water shader */
var SPD=87.5,TA=(G.FUN1-G.XL)/SPD,TK=(G.XR-G.JET0)/SPD;
function packRoutes(maxVec){
  var lt=LEGS.map(function(L){var t=0;for(var i=1;i<L.length;i++)t+=len(sub(L[i].p,L[i-1].p))/((L[i].v+L[i-1].v)/2);return Math.max(t,.05)});
  var tot=lt.reduce(function(a,b){return a+b},0),room=maxVec-ROUTES.length*5-LEGS.length-48,dt=Math.max(.1,tot/Math.max(60,room-LEGS.length*2));
  var S_=[],LG=[];
  LEGS.forEach(function(L,li){
    var n=Math.max(4,Math.round(lt[li]/dt)+1),dtl=lt[li]/(n-1),seg=0,t0=0,i;
    var tsec=[];for(i=1;i<L.length;i++)tsec.push(len(sub(L[i].p,L[i-1].p))/((L[i].v+L[i-1].v)/2));
    LG.push(S_.length/4,n,dtl,lt[li]);
    for(var k=0;k<n;k++){var t=Math.min(k*dtl,lt[li]-1e-6);
      while(seg<tsec.length-1&&t>t0+tsec[seg]){t0+=tsec[seg];seg++}
      var u=clamp((t-t0)/(tsec[seg]||1)),A=L[seg],B=L[seg+1],p=add(A.p,mul(sub(B.p,A.p),u)),sp=lerp(A.s,B.s,u),
          c=(A.c>1||B.c>1)?(u<.5?A.c:B.c):lerp(A.c,B.c,u);
      S_.push(p[0],p[1],p[2],Math.min(511,Math.max(0,sp))+512*Math.round(c*100))}
  });
  var RT=[],cw=0,wsum=ROUTES.reduce(function(a,r){return a+r.w},0);
  ROUTES.forEach(function(r){cw+=r.w/wsum;RT.push(r.legs.length,0,r.f,cw);for(var j=0;j<16;j++)RT.push(j<r.legs.length?r.legs[j]:0)});
  return{S:new Float32Array(S_),LG:new Float32Array(LG),RT:new Float32Array(RT),NS:S_.length/4,NL:LEGS.length,RN:ROUTES.length};
}

/* =====================================================================
   SHADERS
   ===================================================================== */
var CAMU='uniform vec3 uR,uU,uF;uniform float uK,uK0,uDpr;uniform vec2 uT,uRes;\n';

/* ---------- water ---------- */
var P_VERT=['precision highp float;',
'attribute vec4 aSeed;',
CAMU+'uniform float uTime,uWave,uGain,uFocus,uDofK,uLow,uLamp;uniform vec3 uDV;',
'uniform vec4 uS[@NS@];uniform vec4 uLg[@NL@];uniform vec4 uRt[@RN5@];',
'varying vec4 vCol;varying vec3 vShape;',
'const float XL=@XL@,XR=@XR@,FUN0=@FUN0@,FUN1=@FUN1@,JET0=@JET0@,FAN1=@FAN1@,WZ=@WZ@,WZ2=@WZ2@,R=@R@,UX0=@UX0@,UX1=@UX1@,RU=@RU@;',
'const float SPD=87.5,TA=(FUN1-XL)/SPD,TK=(XR-JET0)/SPD,LN=64.,AL=40.,PI=3.14159265;',
'float r0,r1,r2,r3,h1,h2,h3,h4,h5,li,lr,cell,ai,ringv,phiM;',
'float gAl,gIn,gC,gSp;',
'float ss(float a,float b,float x){float t=clamp((x-a)/(b-a),0.,1.);return t*t*(3.-2.*t);}',
/* open stream <-> round pipe cross-section */
'vec3 stream(float X,float ang,float radMax){',
'  float t=uWave;',
'  float inPipe=ss(FUN0,FUN1,X)*(1.-ss(JET0,FAN1,X));',
'  float chop=1.-ss(FUN0-200.,FUN1,X);',
'  float zr=((li+.5)/LN)*2.-1.+cell*(2./LN)*mix(.95,2.6,chop);',
'  float wave=15.*sin(.0100*X-1.15*t+zr*2.4)+8.*sin(.0210*X-1.9*t-zr*4.2+1.3)+9.*sin(.0046*X+.55*t+zr*1.3);',
'  float rest=sin(X*.052+lr*40.+t*1.9)*sin(X*.037-t*1.5+lr*31.);',
'  float Yr=(r2*2.-1.)*mix(1.6,7.,chop)+wave*mix(.55,1.,chop)+rest*9.*chop;',
'  float Zr=zr*mix(WZ,WZ2,step(0.,X));',
'  float rad=ringv*radMax;',
'  gIn=inPipe;',
'  return vec3(X,mix(Yr,rad*sin(ang),inPipe),mix(Zr,rad*cos(ang),inPipe));',
'}',
'vec4 smp(float i){return uS[int(i+.5)];}',
/* position on a leg after t seconds: Catmull-Rom through the samples, water spread around the centre line */
'vec3 onLeg(float L,float t){',
'  vec4 g=uLg[int(L+.5)];float off=g.x,n=g.y;',
'  float fi=clamp(t/g.z,0.,n-1.001),i1=floor(fi),f=fi-i1;',
'  float i0=max(i1-1.,0.),i2=min(i1+1.,n-1.),i3=min(i1+2.,n-1.);',
'  vec4 a=smp(off+i0),b=smp(off+i1),c=smp(off+i2),d=smp(off+i3);',
'  vec3 P=.5*((2.*b.xyz)+(-a.xyz+c.xyz)*f+(2.*a.xyz-5.*b.xyz+4.*c.xyz-d.xyz)*f*f+(-a.xyz+3.*b.xyz-3.*c.xyz+d.xyz)*f*f*f);',
'  vec3 T=normalize(mix(c.xyz-a.xyz,d.xyz-b.xyz,f)+vec3(1e-4,0.,0.));',
'  float qb=floor(b.w/512.),qc=floor(c.w/512.),sb=b.w-qb*512.,sc=c.w-qc*512.;',
'  gSp=mix(sb,sc,f);gC=(qb>100.5||qc>100.5)?(f<.5?qb:qc):mix(qb,qc,f);',
'  vec3 N2=normalize(cross(T,vec3(0.,1.,0.))+vec3(0.,0.,.002)),N1=normalize(cross(N2,T));',
'  return P+gSp*ringv*(sin(phiM)*N1+cos(phiM)*N2);',
'}',
/* position on a route after tau seconds. A leg entry may stand for a group of alternative legs (base + 1000*(count-1)):
   each particle keeps to one of them */
'float legAt(float ri,float k){vec4 v=uRt[int(ri*5.+1.+floor(k/4.)+.5)];float c=mod(k,4.);return c<.5?v.x:c<1.5?v.y:c<2.5?v.z:v.w;}',
'float pick(float e,float k){float m=floor(e/1000.+.0005)+1.;float b=e-(m-1.)*1000.;float h=fract(sin((r3*97.13+k*7.77+r0*3.3+r2*1.7)*12.9898)*43758.5453);return b+min(floor(h*m),m-1.);}',
'float routeT(float ri){vec4 m=uRt[int(ri*5.+.5)];float T=0.;if(mod(m.z,2.)>.5)T+=TA;if(mod(floor(m.z/2.),2.)>.5)T+=TK;',
'  for(int k=0;k<16;k++){if(float(k)>=m.x)break;T+=uLg[int(pick(legAt(ri,float(k)),float(k))+.5)].w;}return T;}',
'vec3 route(float ri,float tau,float T){',
'  vec4 m=uRt[int(ri*5.+.5)];',
'  float fl=m.z,inl=mod(fl,2.),outl=mod(floor(fl/2.),2.),fin=mod(floor(fl/4.),2.),fout=mod(floor(fl/8.),2.);',
'  gAl=1.;gIn=1.;gC=0.;',
'  if(fin>.5)gAl*=ss(0.,1.,tau);if(fout>.5)gAl*=1.-ss(T-1.,T,tau);',
'  if(inl>.5){if(tau<TA){gC=0.;return stream(XL+tau*SPD,phiM,R*.9);}tau-=TA;}',
'  for(int k=0;k<16;k++){',
'    if(float(k)>=m.x)break;',
'    float L=pick(legAt(ri,float(k)),float(k));',
'    float Tl=uLg[int(L+.5)].w;',
'    if(tau<Tl||float(k)>=m.x-1.&&outl<.5)return onLeg(L,tau);',
'    tau-=Tl;',
'  }',
'  gC=100.;return stream(JET0+tau*SPD,phiM,R*.9);',
'}',
/* colour of the water: loaded (brown-red) -> settled (tan) -> permeate (light blue) -> polished (white) */
'vec3 waterCol(float q){',
'  if(q>105.5)return vec3(1.,1.,1.);',
'  if(q>104.5)return vec3(.93,.9,.72);',
'  if(q>103.5)return vec3(.55,.42,.26);',
'  if(q>102.5)return vec3(.12,.62,.38);',            /* valuable products */
'  if(q>101.5)return vec3(.30,.20,.13);',            /* pure waste */
'  if(q>100.5)return vec3(.38,.19,.08);',            /* sludge */
'  float c=q/100.;',
'  vec3 c0=vec3(.50,.17,.08),c1=vec3(.58,.32,.15),c2=vec3(.76,.66,.52),c3=vec3(.9,.96,1.),c4=vec3(1.,1.,1.);',
'  if(c<.2)return mix(c0,c1,c/.2);if(c<.42)return mix(c1,c2,(c-.2)/.22);if(c<.8)return mix(c2,c3,ss(.42,.8,c));return mix(c3,c4,(c-.8)/.2);',
'}',
'void main(){',
'  r0=aSeed.x;r1=aSeed.y;r2=aSeed.z;r3=aSeed.w;',
'  h1=fract(r3*91.7);h2=fract(r3*37.3+r1*5.1);h3=fract(r2*53.9+r0*7.7);h4=fract(r1*71.3+r3*13.1);h5=fract(r0*47.1+r2*29.3);',
'  li=floor(r1*LN);lr=fract(li*.61803+.13);cell=fract(r1*LN)-.5;',
'  ai=floor(r1*AL);phiM=(ai+cell*.5+.5)/AL*2.*PI;',
'  ringv=sqrt((floor(r2*4.)+.5+(fract(r2*4.)-.5)*.5)/4.);',
'  float ri=0.;for(int k=0;k<@RN@;k++){if(r3>uRt[k*5].w)ri=float(k)+1.;}ri=min(ri,@RN@.-1.);',
'  float T=routeT(ri);',
'  float tau=fract(r0+uTime*(.86+.28*lr)/T)*T;',
'  vec3 P,Q;float round=0.,sizeK=1.;',
'  Q=route(ri,min(tau+.07,T),T);P=route(ri,tau,T);if(uLow>.5){Q=P+vec3(1.,0.,0.);}',
'  float q=gC,clean=q>100.5?(q>104.5?.9:0.):q/100.;float gas=step(104.5,q);',
'  vec3 col=waterCol(q);',
'  float a=mix(.5,.9,ss(.6,1.,clean))*mix(1.45,.7,gIn);',
'  float glint=step(.982,h2)*ss(.75,1.,clean);col=mix(col,vec3(1.),glint*.9);a+=glint*.25;',
'  float load=step(.88,h2)*(1.-ss(.3,.5,clean))*step(q,100.5);col=mix(col,vec3(.22,.1,.04),load*.85);',
/* UV reactor: the water glows violet-white where it passes the lamps */
'  float inUV=step(UX0,P.x)*step(P.x,UX1)*step(length(P.yz),RU);col=mix(col,vec3(.86,.8,1.),inUV*.45*uLamp);a+=inUV*.12*uLamp;',
'  round=max(glint,load*.6);',
/* depth of field and size */
'  float d=dot(uDV,P)-uFocus;float blur=min(2.4,pow(d*uDofK,2.));',
'  float persp=clamp(1.+d*.0016,.72,1.4);',
'  float haze=step(.955,h1);',
'  if(gas>.5){round=1.;sizeK=.75;a*=.8;}',
'  float size=(1.25+1.7*h2*h2)*persp*(1.+blur)*(1.+haze*5.)*sizeK;',
'  a*=mix(.55,1.,clamp(d/300.+.5,0.,1.))/((1.+blur)*(1.+blur)*(1.+max(0.,blur-1.)*.9))*(1.-haze*.9);',
'  vec2 s0=vec2(dot(uR,P),-dot(uU,P))*uK+uT,s1=vec2(dot(uR,Q),-dot(uU,Q))*uK+uT;',
'  vec2 sd=s1-s0;float sl=length(sd);sd=sl>1e-4?sd/sl:vec2(1.,0.);',
'  gl_Position=vec4(s0.x/uRes.x*2.-1.,1.-s0.y/uRes.y*2.,0.,1.);',
'  round=max(round,haze);',
'  float zoomS=pow(uK/uK0,.55);',
'  gl_PointSize=clamp(size*uDpr*zoomS*mix(3.,1.,round),1.5,110.*uDpr);',
'  vShape=vec3(round,sd);',
'  vCol=vec4(col,a*gAl*uGain*mix(.62,1.,round));',
'}'].join('\n');
var P_FRAG=['precision mediump float;varying vec4 vCol;varying vec3 vShape;',
'void main(){vec2 q=gl_PointCoord*2.-1.;vec2 d=vec2(q.x*vShape.y+q.y*vShape.z,-q.x*vShape.z+q.y*vShape.y);',
' float rr=dot(q,q);float ro=1.-clamp(rr,0.,1.);ro*=ro;',
' float st=exp(-d.x*d.x*2.4)*exp(-d.y*d.y*24.)*(1.-smoothstep(.8,1.,abs(d.x)));',
' float a=mix(st,ro,vShape.x);if(a<.004)discard;a=min(1.,a*vCol.a);',
' gl_FragColor=vec4(vCol.rgb*a,a);}'].join('\n');

var L_VERT=['precision highp float;',
'attribute vec4 aA,aB;attribute vec3 aTA,aTB;attribute vec4 aStyle,aExtra,aAnim,aFx;',
CAMU+'uniform float uAnim[8];uniform float uGA[15];uniform vec3 uPal[7];uniform float uFocus,uDepthK,uSpin,uMX;uniform vec3 uDV;',
'varying vec4 vCol;varying vec4 vL;varying vec2 vD;',
'void main(){',
'  float corner=aExtra.x,endB=step(1.5,corner),side=mod(corner,2.)*2.-1.;',
'  float ch=floor(aAnim.w+.01),flag=floor(fract(aAnim.w)*4.+.5);',
'  vec3 mv=aAnim.xyz*uAnim[int(ch)];',
'  vec3 A=aA.xyz+mv*((flag<.5||abs(flag-1.)<.5)?1.:0.),B=aB.xyz+mv*((flag<.5||abs(flag-2.)<.5)?1.:0.);',
'  float cc=aStyle.z,spin=floor(cc/10.+.01);cc-=spin*10.;',
'  if(spin>.5){float cs=cos(uSpin),sn=sin(uSpin);vec2 a=A.xz-vec2(uMX,0.),b=B.xz-vec2(uMX,0.);A.xz=vec2(a.x*cs-a.y*sn,a.x*sn+a.y*cs)+vec2(uMX,0.);B.xz=vec2(b.x*cs-b.y*sn,b.x*sn+b.y*cs)+vec2(uMX,0.);}',
'  vec3 V=-uF;float mode=aExtra.y;',
'  if(mode>1.5){A+=aA.w*normalize(cross(aTA,V)+vec3(1e-5));B+=aB.w*normalize(cross(aTB,V)+vec3(1e-5));}',
'  vec2 sa=vec2(dot(uR,A),-dot(uU,A))*uK+uT,sb=vec2(dot(uR,B),-dot(uU,B))*uK+uT;',
'  vec2 dir=sb-sa;float L=length(dir);dir=L>1e-4?dir/L:vec2(1.,0.);vec2 nrm=vec2(-dir.y,dir.x);',
'  float w=aStyle.y,hw=w*.5+1.;',
'  vec2 pos=mix(sa,sb,endB)+nrm*side*hw;',
'  gl_Position=vec4(pos.x/uRes.x*2.-1.,1.-pos.y/uRes.y*2.,0.,1.);',
'  float al=aStyle.x*uGA[int(aStyle.w+.01)];',
'  if(mode>.5&&mode<1.5){float fac=dot(aTA,V);al*=mix(.2,1.,smoothstep(-.18,.18,fac));}',
'  float lod=aFx.z;if(lod>.01)al*=smoothstep(lod*.72,lod*1.1,uK/uK0);else if(lod<-.01)al*=mix(-lod,1.,smoothstep(1.,1.9,uK/uK0));',   /* lod>0: detail that appears when close. lod<0: dense line work that is toned down from far away */
'  float dd=dot(uDV,mix(A,B,.5))-uFocus;al*=1.-uDepthK*(.5*smoothstep(90.,700.,-dd)+.62*smoothstep(170.,620.,dd));',
'  float fm=aFx.y,fv=uAnim[int(aFx.x+.01)];',
'  if(fm>.5&&fm<1.5)al*=1.-fv*.92;else if(fm>2.5)al*=fv;',
'  vCol=vec4(uPal[int(cc+.01)],al);',
'  vL=vec4(side*hw,w*.5,aExtra.w,aFx.w);',
'  vD=vec2(aExtra.z,(fm>1.5&&fm<2.5)?fv:2.);',
'}'].join('\n');
var L_FRAG=['#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\nvarying vec4 vCol;varying vec4 vL;varying vec2 vD;uniform float uTime,uAA;',
'void main(){float d=abs(vL.x);float a=1.-smoothstep(vL.y-uAA,vL.y+uAA,d);',
' if(vD.x>.5)a*=step(.5,fract(vL.z/vD.x));else if(vD.x<-.5)a*=step(.5,fract(vL.z/(-vD.x)-uTime));',
' float glow=0.;',
' if(vD.y<1.5){float rv=vD.y;a*=1.-smoothstep(rv,rv+.01,vL.w);float e=(rv-vL.w)/.03;glow=exp(-e*e)*step(rv,.995)*step(.005,rv);}',
' a*=vCol.a;if(a<.003)discard;',
' a=min(1.,a*(1.+glow));gl_FragColor=vec4(mix(vCol.rgb,vec3(1.),min(1.,glow*.6))*a,a);}'].join('\n');

/* ---------- glass and solid bodies ---------- */
var M_VERT=['precision highp float;',
'attribute vec3 aPos,aNor;attribute vec4 aCol,aAnim,aFx;',
CAMU+'uniform float uAnim[8];uniform float uGA[15];uniform float uFocus,uDepthK;uniform vec3 uDV;',
'varying vec3 vNor;varying vec4 vCol;varying float vKind;',
'void main(){',
'  vec3 P=aPos+aAnim.xyz*uAnim[int(aAnim.w+.01)];',
'  vec2 s=vec2(dot(uR,P),-dot(uU,P))*uK+uT;',
'  gl_Position=vec4(s.x/uRes.x*2.-1.,1.-s.y/uRes.y*2.,0.,1.);',
'  float al=aCol.a*uGA[int(aFx.x+.01)];',
'  float fm=aFx.w,fv=uAnim[int(aFx.z+.01)];',
'  if(fm>.5&&fm<1.5)al*=1.-fv*.92;else if(fm>2.5)al*=fv;',
'  float dd=dot(uDV,P)-uFocus;al*=1.-uDepthK*(.45*smoothstep(90.,700.,-dd)+.55*smoothstep(170.,620.,dd));',
'  vNor=aNor;vCol=vec4(aCol.rgb,al);vKind=aFx.y;',
'}'].join('\n');
var M_FRAG=['precision mediump float;varying vec3 vNor;varying vec4 vCol;varying float vKind;uniform vec3 uV,uLight;',
'void main(){vec3 n=normalize(vNor);float ndv=dot(n,uV);if(ndv<0.){n=-n;ndv=-ndv;}',
' float rim=pow(1.-ndv,2.4);vec3 col=vCol.rgb;float a=vCol.a;',
' if(vKind>1.5){gl_FragColor=vec4(col*a,a);}',                                   /* flat, unlit panel */
' else if(vKind>.5){float g=.25+1.9*rim;a=min(1.,a*g);gl_FragColor=vec4(col*a,a);}', /* glass with rim light */
' else{float lit=.38+.62*max(0.,dot(n,uLight));col=col*lit+rim*.1;gl_FragColor=vec4(col*a,a);}',
'}'].join('\n');

/* =====================================================================
   GL SETUP
   ===================================================================== */
var PK=null,gl=null,PP=null,LP=null,MP=null,COUNT=0,drawCount=0,seedBuf=null,glReady=false;
function compile(vsrc,fsrc,attrs,unis){
  function sh(type,s){var o=gl.createShader(type);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS)){console.error(gl.getShaderInfoLog(o));return null}return o}
  var vs=sh(gl.VERTEX_SHADER,vsrc),fs=sh(gl.FRAGMENT_SHADER,fsrc);if(!vs||!fs)return null;
  var pr=gl.createProgram();gl.attachShader(pr,vs);gl.attachShader(pr,fs);
  attrs.forEach(function(n,i){gl.bindAttribLocation(pr,i,n)});
  gl.linkProgram(pr);if(!gl.getProgramParameter(pr,gl.LINK_STATUS)){console.error(gl.getProgramInfoLog(pr));return null}
  var o={p:pr,u:{}};['uR','uU','uF','uK','uK0','uDpr','uT','uRes'].concat(unis).forEach(function(n){o.u[n]=gl.getUniformLocation(pr,n)});return o;
}
function initGL(){
  glReady=false;
  try{gl=glc.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,powerPreference:'high-performance'})}catch(e){gl=null}
  if(!gl)return false;
  LP=compile(L_VERT,L_FRAG,['aA','aB','aTA','aTB','aStyle','aExtra','aAnim','aFx'],['uAnim','uGA','uPal','uTime','uAA','uFocus','uDepthK','uDV','uSpin','uMX']);
  MP=compile(M_VERT,M_FRAG,['aPos','aNor','aCol','aAnim','aFx'],['uAnim','uGA','uV','uLight','uFocus','uDepthK','uDV']);
  if(!LP||!MP){gl=null;return false}
  COUNT=mqMobile.matches?34000:96000;drawCount=COUNT;
  var data=new Float32Array(COUNT*4);for(var i=0;i<data.length;i++)data[i]=Math.random();
  seedBuf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,seedBuf);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
  if(!uploadScene()){gl=null;return false}
  gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(0,0,0,0);
  glReady=true;return true;
}
/* geometry buffers and the water program depend on the selected technologies: rebuilt on every change */
function uploadScene(){
  lineChunks.concat(meshChunks).forEach(function(c){if(c.vb){gl.deleteBuffer(c.vb);gl.deleteBuffer(c.ib);c.vb=null}});
  lineChunks.forEach(function(c){
    c.vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,c.vb);gl.bufferData(gl.ARRAY_BUFFER,c.v,gl.STATIC_DRAW);
    var idx=new Uint16Array(c.n*6),k;for(k=0;k<c.n;k++){idx[k*6]=k*4;idx[k*6+1]=k*4+1;idx[k*6+2]=k*4+2;idx[k*6+3]=k*4+2;idx[k*6+4]=k*4+1;idx[k*6+5]=k*4+3}
    c.ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,c.ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,idx,gl.STATIC_DRAW)});
  meshChunks.forEach(function(c){
    c.vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,c.vb);gl.bufferData(gl.ARRAY_BUFFER,c.v,gl.STATIC_DRAW);
    c.ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,c.ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,c.i,gl.STATIC_DRAW)});
  var maxVec=gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS)||256;
  PK=packRoutes(Math.min(maxVec,3000)-40);
  var GG={};for(var gk in G)GG[gk]=G[gk];
  var src=P_VERT.replace(/@(\w+)@/g,function(m,k){if(k==='NS')return''+PK.NS;if(k==='NL')return''+PK.NL;if(k==='RN5')return''+PK.RN*5;if(k==='RN')return''+PK.RN;var v=GG[k];return(v%1===0?v+'.0':''+v)});
  if(PP)gl.deleteProgram(PP.p);
  PP=compile(src,P_FRAG,['aSeed'],['uTime','uWave','uGain','uFocus','uDofK','uLow','uLamp','uDV','uS','uLg','uRt']);
  if(!PP)return false;
  gl.useProgram(PP.p);gl.uniform4fv(PP.u.uS,PK.S);gl.uniform4fv(PP.u.uLg,PK.LG);gl.uniform4fv(PP.u.uRt,PK.RT);
  return true;
}
function camUniforms(o){
  gl.uniform3fv(o.u.uR,cam.r);gl.uniform3fv(o.u.uU,cam.u);gl.uniform3fv(o.u.uF,cam.f);
  gl.uniform1f(o.u.uK,cam.k);gl.uniform1f(o.u.uK0,k0);gl.uniform1f(o.u.uDpr,glc.width/W);gl.uniform2f(o.u.uT,cam.tx,cam.ty);gl.uniform2f(o.u.uRes,W,H);
}
function attribs(n){for(var i=0;i<8;i++){if(i<n)gl.enableVertexAttribArray(i);else gl.disableVertexAttribArray(i)}}
var ANIM=new Float32Array(8),GA=new Float32Array(15),PAL=new Float32Array([.07,.22,.36, 1,1,1, .02,.36,.68, .28,.42,.55, .48,.22,.9, .1,.56,.34, .52,.3,.14]);
var LIGHT=norm([-.45,.8,.4]);
function drawScene(){
  if(!gl||!glReady)return;
  var F=4,i,c;
  gl.viewport(0,0,glc.width,glc.height);gl.clear(gl.COLOR_BUFFER_BIT);
  /* bodies */
  gl.useProgram(MP.p);camUniforms(MP);gl.uniform1fv(MP.u.uAnim,ANIM);gl.uniform1fv(MP.u.uGA,GA);
  gl.uniform1f(MP.u.uFocus,dot(cam.dv,cam.c));gl.uniform3fv(MP.u.uDV,cam.dv);gl.uniform1f(MP.u.uDepthK,1-ov);gl.uniform3f(MP.u.uV,-cam.f[0],-cam.f[1],-cam.f[2]);gl.uniform3fv(MP.u.uLight,LIGHT);attribs(5);
  for(i=0;i<meshChunks.length;i++){c=meshChunks[i];gl.bindBuffer(gl.ARRAY_BUFFER,c.vb);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,c.ib);
    gl.vertexAttribPointer(0,3,gl.FLOAT,false,MS*F,0);gl.vertexAttribPointer(1,3,gl.FLOAT,false,MS*F,3*F);gl.vertexAttribPointer(2,4,gl.FLOAT,false,MS*F,6*F);
    gl.vertexAttribPointer(3,4,gl.FLOAT,false,MS*F,10*F);gl.vertexAttribPointer(4,4,gl.FLOAT,false,MS*F,14*F);
    gl.drawElements(gl.TRIANGLES,c.n,gl.UNSIGNED_SHORT,0)}
  /* water */
  gl.useProgram(PP.p);camUniforms(PP);attribs(1);gl.bindBuffer(gl.ARRAY_BUFFER,seedBuf);gl.vertexAttribPointer(0,4,gl.FLOAT,false,0,0);
  gl.uniform1f(PP.u.uTime,flowTime);gl.uniform1f(PP.u.uWave,waveTime);
  gl.uniform1f(PP.u.uGain,clamp(Math.pow(cam.k/k0,.62)*Math.pow(k0/.63,2)*(96000/drawCount)*.95,.2,2.6));
  gl.uniform1f(PP.u.uFocus,dot(cam.dv,cam.c));gl.uniform3fv(PP.u.uDV,cam.dv);gl.uniform1f(PP.u.uDofK,1/150);gl.uniform1f(PP.u.uLamp,ANIM[6]);
  gl.uniform1f(PP.u.uLow,level>=3?1:0);
  gl.drawArrays(gl.POINTS,0,drawCount);
  /* line work */
  gl.useProgram(LP.p);camUniforms(LP);gl.uniform1fv(LP.u.uAnim,ANIM);gl.uniform1fv(LP.u.uGA,GA);gl.uniform3fv(LP.u.uPal,PAL);
  gl.uniform1f(LP.u.uFocus,dot(cam.dv,cam.c));gl.uniform3fv(LP.u.uDV,cam.dv);gl.uniform1f(LP.u.uDepthK,1-ov);gl.uniform1f(LP.u.uSpin,(flowTime*.12)%(Math.PI*2));gl.uniform1f(LP.u.uMX,G.SPIN);gl.uniform1f(LP.u.uTime,(time*.8)%1);gl.uniform1f(LP.u.uAA,clamp(.5*W/glc.width+.2,.4,.75));attribs(8);
  for(i=0;i<lineChunks.length;i++){c=lineChunks[i];gl.bindBuffer(gl.ARRAY_BUFFER,c.vb);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,c.ib);
    gl.vertexAttribPointer(0,4,gl.FLOAT,false,LS*F,0);gl.vertexAttribPointer(1,4,gl.FLOAT,false,LS*F,4*F);gl.vertexAttribPointer(2,3,gl.FLOAT,false,LS*F,8*F);gl.vertexAttribPointer(3,3,gl.FLOAT,false,LS*F,11*F);
    gl.vertexAttribPointer(4,4,gl.FLOAT,false,LS*F,14*F);gl.vertexAttribPointer(5,4,gl.FLOAT,false,LS*F,18*F);gl.vertexAttribPointer(6,4,gl.FLOAT,false,LS*F,22*F);gl.vertexAttribPointer(7,4,gl.FLOAT,false,LS*F,26*F);
    gl.drawElements(gl.TRIANGLES,c.n*6,gl.UNSIGNED_SHORT,0)}
}

/* =====================================================================
   TOUR: views, tour channels, labels, clock, frame loop
   ===================================================================== */
var BOUNDS=[];for(var bi=0;bi<=NST;bi++)BOUNDS.push(.07+bi*.84/NST);   /* tour progress p where each tour step begins: stations 1-7, closing view */
/* view: target point, yaw and pitch in degrees, world frame (w x h) that has to fit the screen region [l,t,r,b];
   d*: change of yaw, pitch and target height while the tour dwells on the step.
   band: the region starts below the copy of that step (measured, see measureBands) */
var VIEWS_D=[
  {c:[-230,-50,0],yaw:-14,pitch:20,shear:1,w:2480,h:680,reg:[0,.45,1,.975],band:0},
  {c:[-890,40,0],yaw:-24,pitch:20,w:400,h:340,reg:[.42,.06,1,.96],dyaw:8,dpitch:3},
  {c:[-630,60,-20],yaw:-24,pitch:20,w:440,h:400,reg:[.42,.06,1,.96],dyaw:8,dpitch:3},
  {c:[-325,70,0],yaw:-26,pitch:20,w:500,h:430,reg:[.42,.06,1,.96],dyaw:8,dpitch:3},
  {c:[60,100,0],yaw:-28,pitch:18,w:580,h:430,reg:[.42,.06,1,.96],dyaw:8,dpitch:3},
  {c:[470,10,-10],yaw:-24,pitch:20,w:700,h:380,reg:[.42,.06,1,.96],dyaw:8,dpitch:3},
  {c:[-615,-232,40],yaw:-22,pitch:26,w:520,h:300,reg:[.42,.06,1,.96],dyaw:8,dpitch:3},
  {c:[-215,-232,40],yaw:-22,pitch:26,w:520,h:300,reg:[.42,.06,1,.96],dyaw:8,dpitch:3},
  {c:[-230,-54,0],yaw:-14,pitch:24,shear:1,w:2480,h:690,reg:[0,.45,1,.975],band:8}];
var VIEWS_P=[
  {c:[-230,-60,0],yaw:-40,pitch:28,w:1500,h:1100,reg:[0,.45,1,.97],band:0},
  {c:[-890,40,0],yaw:-24,pitch:20,w:400,h:340,reg:[0,.45,1,.97],dyaw:8,dpitch:3},
  {c:[-630,60,-20],yaw:-24,pitch:20,w:440,h:400,reg:[0,.45,1,.97],dyaw:8,dpitch:3},
  {c:[-325,70,0],yaw:-26,pitch:20,w:500,h:430,reg:[0,.45,1,.97],dyaw:8,dpitch:3},
  {c:[60,100,0],yaw:-28,pitch:18,w:580,h:430,reg:[0,.45,1,.97],dyaw:8,dpitch:3},
  {c:[470,10,-10],yaw:-24,pitch:20,w:700,h:380,reg:[0,.45,1,.97],dyaw:8,dpitch:3},
  {c:[-615,-232,40],yaw:-22,pitch:26,w:520,h:300,reg:[0,.45,1,.97],dyaw:8,dpitch:3},
  {c:[-215,-232,40],yaw:-22,pitch:26,w:520,h:300,reg:[0,.45,1,.97],dyaw:8,dpitch:3},
  {c:[-230,-60,0],yaw:-40,pitch:30,w:1500,h:1100,reg:[0,.45,1,.97],band:8}];
var VIEWS_M=[
  {c:[-230,-60,0],yaw:-40,pitch:28,w:1500,h:1000,reg:[0,0,1,1]},
  {c:[-890,40,0],yaw:-24,pitch:20,w:380,h:374,reg:[0,0,1,1],dyaw:8,dpitch:3},
  {c:[-630,60,-20],yaw:-24,pitch:20,w:418,h:440,reg:[0,0,1,1],dyaw:8,dpitch:3},
  {c:[-325,70,0],yaw:-26,pitch:20,w:475,h:473,reg:[0,0,1,1],dyaw:8,dpitch:3},
  {c:[60,100,0],yaw:-28,pitch:18,w:551,h:473,reg:[0,0,1,1],dyaw:8,dpitch:3},
  {c:[470,10,-10],yaw:-24,pitch:20,w:665,h:418,reg:[0,0,1,1],dyaw:8,dpitch:3},
  {c:[-615,-232,40],yaw:-22,pitch:26,w:494,h:330,reg:[0,0,1,1],dyaw:8,dpitch:3},
  {c:[-215,-232,40],yaw:-22,pitch:26,w:494,h:330,reg:[0,0,1,1],dyaw:8,dpitch:3},
  {c:[-230,-60,0],yaw:-40,pitch:30,w:1500,h:1000,reg:[0,0,1,1]}];

/* still image for browsers without WebGL: recorded from the overview with this camera */
var STILL={k:0.8372093,tx:714.7863,ty:662.0242,y0:375,w:1800},stillEl=$('still');
var VIEW_STILL={c:[170,45,0],yaw:-14,pitch:20,shear:1,w:1330,h:600,reg:[0,0,1,1]};
var p=0,foc=[0,0,0,0,0,0,0],ov=1,us=[0,0,0,0,0,0,0],started=false,time=0,flowTime=0,waveTime=0,boost=0,lastScrollY=0;
var chT=new Float32Array(8);                /* channel targets */
var pointer={x:-9999,y:-9999,tx:-9999,ty:-9999,on:0,nx:0,ny:0,sx:0,sy:0};
var portrait=false;

var bandTop=[0,0,0,0,0,0,0,0,0];
function bottomOf(el,vt){return el?el.getBoundingClientRect().bottom-vt:0}
function portraitNow(){return !mqMobile.matches&&area.h>area.w*1.05}
/* the figures panels (stations 2 and 3) sit 26px below the copy (home.js). Where the full panel would run past the bottom
   of the hero (shorter landscape screens) it takes its compact form, and if that is still too tall it drops the footnote. */
function fitHuds(){
  var vt=viz.getBoundingClientRect().top;
  [2,3].forEach(function(s){var h=$('hud'+s);if(!h)return;h.classList.remove('is-compact','is-min');
    if(mqMobile.matches||portraitNow())return;
    var room=H-14-(bottomOf(panels[s-1],vt)+26);
    if(h.offsetHeight>room){h.classList.add('is-compact');if(h.offsetHeight>room)h.classList.add('is-min')}});
}
function measureBands(){      /* free band below the copy of each step: the view of that step is fitted into it */
  var vt=viz.getBoundingClientRect().top,sl=bottomOf($('slot'),vt);
  portrait=portraitNow();
  bandTop[0]=Math.max(bottomOf(heroCopy,vt),sl);
  for(var s=1;s<=NST+1;s++)bandTop[s]=Math.max(bottomOf(panels[s-1],vt),s===NST+1?sl:0);
}
function viewParams(v,u){
  var reg=v.reg;
  if(v.band!==undefined&&!mqMobile.matches){var t=clamp((bandTop[v.band]+6)/area.h,.08,portrait?.72:.62);   /* .08: the film frame has no copy above the overview any more (was .3) */reg=[0,t,1,(area.h-(portrait?40:50))/area.h]}
  var rw=(reg[2]-reg[0])*area.w,rh=(reg[3]-reg[1])*area.h;
  return{yaw:(v.yaw+(v.dyaw||0)*(u-.5))*RAD,pitch:(v.pitch+(v.dpitch||0)*u)*RAD,shear:v.shear||0,k:Math.min(rw/v.w,rh/v.h),
    c:[v.c[0],v.c[1]+(v.dy||0)*u,v.c[2]],ax:area.x+(reg[0]+reg[2])/2*area.w,ay:area.y+(reg[1]+reg[3])/2*area.h};
}
function computeTarget(){
  var VS=mqMobile.matches?VIEWS_M:portrait?VIEWS_P:VIEWS_D,e=[],i,a,b,w,nb=BOUNDS.length;
  for(i=0;i<nb;i++)e.push(ss(BOUNDS[i]-.05,BOUNDS[i]+.05,p));
  for(i=0;i<NST;i++){a=BOUNDS[i]+.05;b=BOUNDS[i+1]-.05;us[i]=clamp((p-a)/(b-a))}
  var P=[viewParams(VS[0],0)];for(i=0;i<NST;i++)P.push(viewParams(VS[i+1],us[i]));P.push(viewParams(VS[NST+1],0));
  var t={yaw:P[0].yaw,pitch:P[0].pitch,shear:P[0].shear,lk:Math.log(P[0].k),c:P[0].c.slice(),ax:P[0].ax,ay:P[0].ay};
  for(i=0;i<nb;i++){w=e[i];t.yaw+=(P[i+1].yaw-P[i].yaw)*w;t.pitch+=(P[i+1].pitch-P[i].pitch)*w;t.shear+=(P[i+1].shear-P[i].shear)*w;t.lk+=(Math.log(P[i+1].k)-Math.log(P[i].k))*w;
    t.ax+=(P[i+1].ax-P[i].ax)*w;t.ay+=(P[i+1].ay-P[i].ay)*w;for(var j=0;j<3;j++)t.c[j]+=(P[i+1].c[j]-P[i].c[j])*w}
  tgt={yaw:t.yaw,pitch:t.pitch,shear:t.shear,k:Math.exp(t.lk),c:t.c,ax:t.ax,ay:t.ay};k0=P[0].k;
  for(i=0;i<NST;i++)foc[i]=e[i]*(1-e[i+1]);ov=1-Math.max.apply(0,foc);
  if(!gl){var P0=viewParams(mqMobile.matches?VIEW_STILL:VS[0],0);tgt=P0;k0=P0.k;for(i=0;i<NST;i++)foc[i]=0;ov=1}   /* without WebGL the overview stays, only the copy changes */
  /* tour channels */
  chT[4]=foc[3]*ss(.04,.5,us[3]);                        /* the RO vessel shells fade so the disc stacks show */
  chT[2]=lerp(1,clamp(us[1]*1.3),ss(.3,1,foc[1]));       /* the plan and the turbidity chart draw themselves */
  chT[3]=lerp(1,clamp(.12+us[4]*1.15),ss(.3,1,foc[4]));  /* the UV intensity settles */
}

/* ---------- labels (DOM, positioned from 3D anchors) ---------- */
function makeLabels(){
labelsEl.innerHTML='';var ordN={};
LABELS.forEach(function(L){
  if(L.g!=='ov'){ordN[L.g]=ordN[L.g]||0;L.ord=ordN[L.g]++}
  var el=document.createElement('div');
  el.className='lab '+(L.glow?'lab--glow ':'')+'lab--'+(L.side==='L'?'L':L.side==='R'?'R':'C')+(L.g==='ov'?' lab--ov':' lab--detail')+(L.desk?' lab--desk':'');
  el.innerHTML='<b>'+L.t.replace('&','&amp;')+'</b><span>'+L.s+'</span>';el.style.opacity=0;labelsEl.appendChild(el);L.el=el;L.o=0;
  if(L.from){var d=document.createElement('i');d.className='lab-dot';d.style.opacity=0;labelsEl.appendChild(d);L.dot=d}
});
}
function measureLabels(){LABELS.forEach(function(L){L.w=L.el.offsetWidth;L.h=L.el.offsetHeight})}
function animPoint(q){return q}
function hit(a,b){return a.x<b.x+b.w+6&&b.x<a.x+a.w+6&&a.y<b.y+b.h+3&&b.y<a.y+a.h+3}
function placeLabels(){
  /* up to 1180px the leader lines are hidden, so a label may move away from its anchor: every label is kept
     inside the drawing and clear of the labels already placed (no text runs off screen or over other text) */
  var fit=mqNoDetail.matches,boxes=[];
  for(var i=0;i<LABELS.length;i++){
    var L=LABELS[i],o=L.g==='ov'?ov:foc[L.g];o=L.g==='ov'?clamp((o-.4)/.6):ss(0,1,clamp((o-.42-.08*(L.ord||0))/.3));
    if(o<=0&&L.o<=0&&L.placed)continue;L.placed=true;
    var s=project(animPoint(L.at,L.lift)),x=s[0]+(L.off?L.off[0]:0)-(L.g==='ov'?0:(1-o)*18),y=s[1]+(L.off?L.off[1]:0);
    var tr;
    if(fit){
      if(!L.w){if(L.o!==0){L.el.style.opacity=0;L.o=0}continue}   /* hidden at this width */
      var w=L.w,h=L.h,bx=L.side==='L'?x-w:L.side==='R'?x:x-w/2,by=L.side==='T'?y-h:L.side==='B'?y:y-h/2,k,n,bb;
      var yMax=H-(mqMobile.matches?6:56)-h;   /* clear of the skip link and the step dots */
      bx=clamp(bx,8,W-8-w);by=clamp(by,6,yMax);
      if(o>.04){
        for(n=0;n<3;n++){var moved=false;
          for(k=0;k<boxes.length;k++){bb=boxes[k];if(hit({x:bx,y:by,w:w,h:h},bb)){
            by=(by+h/2<bb.y+bb.h/2)?bb.y-h-4:bb.y+bb.h+4;by=clamp(by,6,yMax);moved=true}}
          if(!moved)break}
        for(k=0;k<boxes.length;k++)if(hit({x:bx,y:by,w:w,h:h},boxes[k])){o=0;break}   /* no room: leave it out rather than overprint */
        if(o>0)boxes.push({x:bx,y:by,w:w,h:h});
      }
      x=bx;y=by;tr='';
    }else{
      tr=L.side==='L'?'translate(-100%,-50%)':L.side==='R'?'translate(0,-50%)':L.side==='T'?'translate(-50%,-100%)':'translate(-50%,0)';
    }
    L.el.style.transform='translate('+x.toFixed(1)+'px,'+y.toFixed(1)+'px) '+tr;
    if(L.dot){var f=project(animPoint(L.from,L.lift));L.dot.style.transform='translate('+f[0].toFixed(1)+'px,'+f[1].toFixed(1)+'px)'}
    if(Math.abs(o-L.o)>.004||o===0){L.el.style.opacity=o.toFixed(3);if(L.dot)L.dot.style.opacity=o.toFixed(3);L.o=o}
  }
}

/* ---------- frame ---------- */
function stationAlpha(i){return lerp(.66,lerp(.18,.84,foc[i]),1-ov)}   /* equipment sits back behind the water; the pipe (group 0) keeps full strength */
function render(dt,rdt){
  var i,f=1-Math.exp(-(rdt===undefined?dt:rdt)*6);
  time+=dt;
  var rate=lerp(1,k0/cam.k,.74);
  flowTime+=dt*rate*(1+boost*1.3);waveTime+=dt*lerp(1,k0/cam.k,.5);boost*=Math.exp(-dt*2.2);
  for(i=1;i<6;i++)ANIM[i]+=(chT[i]-ANIM[i])*(dt>0?f:1);
  ANIM[6]=.78+.22*Math.sin(time*5.1)*Math.sin(time*1.7+1.);   /* UV lamps flicker softly */
  GA[0]=1;for(i=0;i<NST;i++){GA[i+1]=stationAlpha(i);GA[i+8]=mqNoDetail.matches?0:clamp((foc[i]-.4)/.6)}   /* no leaders where the labels are hidden */
  pointer.x+=(pointer.tx-pointer.x)*Math.min(1,dt*9+.02);pointer.y+=(pointer.ty-pointer.y)*Math.min(1,dt*9+.02);
  pointer.sx+=(pointer.nx-pointer.sx)*Math.min(1,dt*2.5);pointer.sy+=(pointer.ny-pointer.sy)*Math.min(1,dt*2.5);
  camVectors(cam);
  if(gl)drawScene();else if(stillEl){var sc=cam.k/STILL.k;stillEl.style.width=(STILL.w*sc).toFixed(1)+'px';stillEl.style.transform='translate('+(cam.tx-STILL.tx*sc).toFixed(1)+'px,'+(cam.ty-(STILL.ty-STILL.y0)*sc).toFixed(1)+'px)'}
  placeLabels();
}

/* ---------- the tour clock ----------
   Every step dwells long enough to be read, then the camera travels to the next one; after the closing view the
   tour glides back to the overview. Seconds per step: overview with the headline, stations 1-3, closing view. */
/* 2026-10-02 (owner): faster, and visibly moving from the first frame */
/* 2026-10-03 (owner): no pauses — each station is read in about two seconds while its parts still animate, then the camera moves on */
var DWELL_D=[1.2,2.5,2.5,2.5,2.5,2.5,2.5,2.5,1.4],DWELL_M=[1,2.1,2.1,2.1,2.1,2.1,2.1,2.1,1.2],MOVE=1.2;
var clock=0,slowT=0,holdHover=false,holdFocus=false;
/* 2026-10-03 (owner): the journey plays on demand. At rest the overview drifts slowly; the "show me the process"
   button plays one round (stations 1-3, closing view, back to the overview) and the scene rests again. */
var playing=false;
function dwell(){return mqMobile.matches?DWELL_M:DWELL_D}
function dwellP(s){return s===0?[0,BOUNDS[0]-.05]:s===NST+1?[BOUNDS[NST]+.05,1]:[BOUNDS[s-1]+.05,BOUNDS[s]-.05]}   /* p range while the tour dwells on step s */
function stepStart(k){var D=dwell(),t=0;for(var i=0;i<k;i++)t+=D[i]+MOVE;return t}
function pAt(c){
  var D=dwell(),T=stepStart(NST+2),t=((c%T)+T)%T,i,a,b;
  for(i=0;i<NST+2;i++){
    if(t<D[i]){a=dwellP(i);return a[0]+(a[1]-a[0])*(t/D[i])}
    t-=D[i];
    if(t<MOVE){if(i===NST+1)return 0;a=dwellP(i)[1];b=dwellP(i+1)[0];return a+(b-a)*(t/MOVE)}   /* the last move: back to the overview */
    t-=MOVE}
  return 0;
}
function advance(dt){
  if(playing&&!holdHover&&!holdFocus)clock+=dt;
  if(playing&&clock>=stepStart(NST+2)){clock=0;playing=false;slowT=MOVE+.6;
    var ev;try{ev=new CustomEvent('journey:done')}catch(x){ev=document.createEvent('Event');ev.initEvent('journey:done',true,false)}viz.dispatchEvent(ev)}
  var np=pAt(clock);
  if(np<p-.5)slowT=MOVE+.6;   /* loop back to the overview: the camera glides instead of jumping */
  p=np;
}
/* jump to a step (step dots): the clock continues from the start of that step */
function goTo(k){
  clock=stepStart(k);slowT=MOVE+.4;
  if(reduce){var a=dwellP(k);p=k===0?0:k===NST+1?1:a[0]+(a[1]-a[0])*.85;update(true)}   /* reduced motion: the step is shown at once, still */
  else{p=pAt(clock);update()}
}

var FORCE=/[?&]q=(\d)/.exec(location.search);   /* ?q=0 pins full quality for reviews and screenshots */
var last=0,running=false,visible=true,level=FORCE?Math.min(5,+FORCE[1]):0,fN=0,fSamples=[];
var LEVELS=[[1,2],[.62,1.5],[.38,1.25],[.24,1],[.15,.85],[.1,.7]];   /* share of particles drawn, max canvas pixel ratio */
var downAt=-1e9,upAt=-1e9,wentUp=false,upLocked=false;
/* start light on integrated/mobile/software graphics or very large canvases, so the first frames are already smooth
   (owner saw a pause on an Intel UHD laptop while the governor stepped down from full quality) */
function guessLevel(){
  if(FORCE||!gl)return level;
  var r='';try{var e=gl.getExtension('WEBGL_debug_renderer_info');r=e?String(gl.getParameter(e.UNMASKED_RENDERER_WEBGL)):''}catch(x){}
  var g=/Intel|UHD|Iris|HD Graphics|SwiftShader|llvmpipe|Microsoft Basic|Mali|Adreno|PowerVR/i.test(r)?2:0;
  var d=Math.min(window.devicePixelRatio||1,2),px=viz.clientWidth*viz.clientHeight*d*d;
  if(px>3.2e6)g++;
  return Math.min(3,g);
}
function applyLevel(){drawCount=Math.round(COUNT*LEVELS[level][0]);sizeGL();fN=0;fSamples.length=0}
function sizeGL(){var gs=Math.min(dpr,LEVELS[level][1],W*H>1300000?1.5:2);glc.width=Math.max(2,Math.round(W*gs));glc.height=Math.max(2,Math.round(H*gs))}
/* slow, constant camera drift so the scene is never still while it plays (none with reduced motion: dt is 0) */
var driftT=0;
function stepCam(dt){
  var f=dt>0?1-Math.exp(-dt*(slowT>0?1.9:5.2)):1,par=mqMobile.matches?0:1;
  if(dt>0){slowT-=dt;driftT+=dt}
  var dy=dt>0||driftT>0?Math.sin(driftT*.55)*5*RAD:0,dp=dt>0||driftT>0?Math.sin(driftT*.37)*1.6*RAD:0;
  cam.shear+=(tgt.shear-cam.shear)*f;
  cam.yaw+=(tgt.yaw+dy+pointer.sx*2.2*RAD*par-cam.yaw)*f;cam.pitch+=(tgt.pitch+dp-pointer.sy*1.1*RAD*par-cam.pitch)*f;
  cam.k=Math.exp(Math.log(cam.k)+(Math.log(tgt.k)-Math.log(cam.k))*f);cam.ax+=(tgt.ax-cam.ax)*f;cam.ay+=(tgt.ay-cam.ay)*f;
  for(var j=0;j<3;j++)cam.c[j]+=(tgt.c[j]-cam.c[j])*f;
}
function tick(now){
  if(!running)return;
  var raw=(now-last)/1000||0,dt=Math.min(.05,raw),rdt=Math.min(.25,raw);last=now;
  /* governor: measure real frame times and step quality down on weak or software graphics */
  /* 2026-10-02: it also steps back UP when frames are fast, so it can start light on weak graphics (see guessLevel) */
  if(gl&&!FORCE&&raw>0&&raw<3){fN++;if(fN>2)fSamples.push(raw);
    if(fSamples.length>=5){fSamples.sort(function(x,y){return x-y});var med=fSamples[2];fSamples.length=0;   /* median: one long frame (tab switch) does not count */
      if(med>.09&&level<5){level=Math.min(5,level+3);downAt=now;if(wentUp)upLocked=true;applyLevel()}else if(med>.05&&level<5){level=Math.min(5,level+2);downAt=now;if(wentUp)upLocked=true;applyLevel()}else if(med>.031&&level<5){level++;downAt=now;if(wentUp)upLocked=true;applyLevel()}
      else if(med<.019&&level>0&&!upLocked&&now-downAt>3000&&now-upAt>1500){level--;wentUp=true;upAt=now;applyLevel()}}}
  advance(rdt);update();
  stepCam(rdt);render(dt,rdt);requestAnimationFrame(tick);
}
function start(){if(running||reduce||!visible||document.hidden)return;running=true;last=performance.now();fN=0;fSamples.length=0;requestAnimationFrame(tick)}
function stop(){running=false}
/* one round of the tour, from the first station; with reduced motion every press shows the next step, still */
function playOnce(){
  if(reduce){goTo((lastStep+1)%(NST+2));return}
  if(playing)return;
  clock=Math.max(0,dwell()[0]-.4);playing=true;slowT=0;visible=true;start();   /* the button sits under the frame: the frame is on screen, whatever the observer last said */
}
window.__journeyPlay=playOnce;
/* ---------- technology selection: the scene, the water routes, labels and panels are rebuilt ---------- */
function rebuild(){
  if(gl)lineChunks.concat(meshChunks).forEach(function(c){if(c.vb){gl.deleteBuffer(c.vb);gl.deleteBuffer(c.ib);c.vb=null}});
  lineChunks.length=0;meshChunks.length=0;lv=[];ln=0;mvx=[];mix_=[];mn=0;
  buildScene();makeLabels();updatePanels();
  if(gl&&!uploadScene()){gl=null;viz.classList.add('no-gl')}
  measureBands();measureLabels();lastStep=-1;update();if(!running)render(0);
}
function pct(v){return v>=.9999?'99.99%':Math.round(v*100)+'%'}
function eur(v){return'€'+String(v).replace(/\B(?=(\d{3})+(?!\d))/g,'.')}
function infoHTML(o){var r=Object.keys(o.rem).map(function(k){return'<i>'+k+' '+pct(o.rem[k])+'</i>'}).join('');
  return'<span class="ti">'+o.tier+'</span> '+o.d+'<span class="tf"><b>CAPEX '+eur(o.capex)+' per m³/h</b>'+(r?' · Removal '+r:'')+'</span>'}
function updatePanels(){
  STAGES.forEach(function(s){var el=panels[s.st];if(!el)return;var o=s.opts[SEL[s.key]];
    el.querySelector('.label').innerHTML='<b>0'+(s.st+1)+' / 0'+NST+'</b> '+STATION_NAMES[s.st];
    el.querySelector('.h2').textContent=o.n;el.querySelector('.tinfo').innerHTML=infoHTML(o)});
  var pe=panels[4];if(pe){pe.querySelector('.label').innerHTML='<b>05 / 0'+NST+'</b> Polishing & split';pe.querySelector('.h2').textContent='Potable water or process recycle';
    pe.querySelector('.tinfo').innerHTML='<span class="ti">Split</span> Water for drinking passes UV-C polishing (254 nm); recycled process water returns to production without it. Flush water joins the reject header.'}
  var ce=panels[NST];if(ce){ce.querySelector('.h2').textContent='Your treatment train';
    ce.querySelector('.tinfo').innerHTML=STAGES.map(function(s){return'<i>'+opt(s.key).sh+'</i>'}).join(' → ')}
  var b=document.querySelectorAll('.ncfg__opt');for(var i=0;i<b.length;i++){var on=SEL[b[i].dataset.k]===+b[i].dataset.i;b[i].classList.toggle('on',on);b[i].setAttribute('aria-pressed',on)}
}
function buildConfig(){
  var box=$('ncfg');if(!box)return;
  box.innerHTML='<div class="ncfg__hd"><b>Treatment Solutions</b><span>Select technology per stage · the scene rebuilds live</span></div><div class="ncfg__grid">'+
    STAGES.map(function(s){return'<div class="ncfg__st"><p>'+s.name+'</p>'+s.opts.map(function(o,i){return'<button type="button" class="ncfg__opt" data-k="'+s.key+'" data-i="'+i+'" title="'+o.d+'">'+o.n+'<small>'+o.tier+'</small></button>'}).join('')+'</div>'}).join('')+'</div>';
  box.addEventListener('click',function(e){var b=e.target.closest('.ncfg__opt');if(!b)return;var k=b.dataset.k,i=+b.dataset.i;if(SEL[k]===i)return;SEL[k]=i;
    rebuild();var st=STAGES.filter(function(s){return s.key===k})[0].st;if(!playing)goTo(st+1)});
}
/* ---------- Neptune app bridge: apply the technologies chosen on the Treatment Solutions page ---------- */
var STAGE_KEY={'Pre-treatment':'pre','Primary Treatment':'pri','Secondary Treatment':'sec','Tertiary Treatment':'ter',
               'Concentrate Management':'cm','ZLD (Zero Liquid Discharge)':'zld'};
window.__journeySet=function(byName,focus){
  var changed=[];
  Object.keys(byName||{}).forEach(function(name){
    var key=STAGE_KEY[name];if(!key)return;
    var s=STAGES.filter(function(x){return x.key===key})[0],i=-1;
    for(var j=0;j<s.opts.length;j++)if(s.opts[j].n===byName[name])i=j;
    if(i<0||SEL[key]===i)return;SEL[key]=i;changed.push(s.st);
  });
  if(!changed.length)return;
  rebuild();
  if(focus&&!playing&&changed.length===1)goTo(changed[0]+1);   /* one stage changed: the camera shows it */
};
window.__journeyPlaying=function(){return playing};

/* ---------- layout, copy and step dots ---------- */
function resize(){
  W=viz.clientWidth;H=viz.clientHeight;dpr=Math.min(window.devicePixelRatio||1,2);
  sizeGL();
  area={x:areaEl.offsetLeft,y:areaEl.offsetTop,w:areaEl.offsetWidth,h:areaEl.offsetHeight};
  measureBands();measureLabels();update(true);
}
var lastStep=-1;
function update(snap){
  computeTarget();
  if(window.__hud)window.__hud(foc,us);
  viz.style.setProperty('--scrim',(1-ov).toFixed(3));   /* the scrim behind the copy follows the camera */
  var step=0;for(var i=0;i<BOUNDS.length;i++)if(p>=BOUNDS[i]-.035)step=i+1;   /* copy changes as the camera starts to move */
  if(step!==lastStep){lastStep=step;
    heroCopy.classList.toggle('is-off',step!==0);
    panels.forEach(function(el){el.classList.toggle('is-off',+el.dataset.step!==step)});
    slots.forEach(function(el){var on=(','+el.dataset.steps+',').indexOf(','+step+',')>=0;el.classList.toggle('is-off',!on)});
    stepDots.forEach(function(el,i){el.classList.toggle('on',i===step);if(i===step)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current')});
    viz.classList.toggle('is-tour',step>0&&step<=NST);viz.classList.toggle('is-hud',false)}   /* is-hud: the figures panel takes the bottom-left corner */
  if(snap===true||reduce||!started){stepCam(0);for(var c=1;c<6;c++)ANIM[c]=chT[c];started=true;if(reduce||!running)render(0)}
}
stepDots.forEach(function(el,i){el.addEventListener('click',function(){goTo(i)})});
/* desktop: the tour holds while the pointer rests on a text panel or the keyboard is inside the copy, so it can be read */
[heroCopy].concat(panels,slots).forEach(function(el){if(!el)return;   /* only the visible copy takes the pointer (.is-off has pointer-events:none) */
  el.addEventListener('pointerenter',function(e){if(e.pointerType==='mouse'&&mqHover.matches)holdHover=true});
  el.addEventListener('pointerleave',function(e){if(e.pointerType==='mouse')holdHover=false})});
function kbFocus(el){try{return el.matches(':focus-visible')}catch(x){return true}}   /* a mouse click on a link does not hold the tour */
stage.addEventListener('focusin',function(e){holdFocus=!mqMobile.matches&&!!(e.target.closest&&e.target.closest('.col'))&&kbFocus(e.target)});
stage.addEventListener('focusout',function(e){var t=e.relatedTarget;holdFocus=!!(t&&stage.contains(t)&&t.closest('.col'))});
viz.addEventListener('pointermove',function(e){if(e.pointerType==='touch')return;var b=viz.getBoundingClientRect();pointer.tx=e.clientX-b.left;pointer.ty=e.clientY-b.top;
  pointer.nx=(pointer.tx/b.width)*2-1;pointer.ny=(pointer.ty/b.height)*2-1;if(!pointer.on){pointer.x=pointer.tx;pointer.y=pointer.ty}pointer.on=1});
viz.addEventListener('pointerleave',function(){pointer.on=0;pointer.nx=0;pointer.ny=0});
$('skip').addEventListener('click',function(e){e.preventDefault();var t=document.getElementById('problem');window.scrollTo({top:t.getBoundingClientRect().top+window.pageYOffset-parseInt(getComputedStyle(document.getElementById('viz')).getPropertyValue('--hd'))-10,behavior:'auto'})});
/* the frame loop only runs while the hero is on screen and the tab is in front */
if('IntersectionObserver'in window){new IntersectionObserver(function(en){visible=en[0].isIntersecting;if(visible)start();else stop()},{rootMargin:'120px'}).observe(viz)}
document.addEventListener('visibilitychange',function(){if(document.hidden)stop();else start()});
/* scrolling the page past the hero only livens up the water a little; it does not move the tour */
window.addEventListener('scroll',function(){var yNow=window.pageYOffset;if(running)boost=Math.min(1,boost+Math.abs(yNow-lastScrollY)/900);lastScrollY=yNow},{passive:true});
window.addEventListener('resize',resize);
if(mqMobile.addEventListener)mqMobile.addEventListener('change',function(){initGL();if(gl)applyLevel();resize()});
glc.addEventListener('webglcontextlost',function(e){e.preventDefault();glReady=false});
glc.addEventListener('webglcontextrestored',function(){initGL();if(gl)applyLevel();render(0)});
flowTime=400+Math.random()*60;waveTime=40+Math.random()*20;lastScrollY=window.pageYOffset;
window.__journeyCam=function(){return{k:cam.k,tx:cam.tx,ty:cam.ty,W:W,H:H,p:p,step:lastStep,clock:clock,running:running,held:holdHover||holdFocus,foc:foc.slice(),ov:ov,GA:[].slice.call(GA),ANIM:[].slice.call(ANIM),yaw:cam.yaw,pitch:cam.pitch,c:cam.c.slice(),level:level}};   /* inspection hook (also used once to record the still image for browsers without WebGL) */
buildScene();makeLabels();buildConfig();updatePanels();if(!/[?&]nogl=1/.test(location.search))initGL();if(gl){level=guessLevel();applyLevel()}else viz.classList.add('no-gl');resize();start();
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(resize);

})();
