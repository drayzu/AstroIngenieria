(function(){let e=-.78,t=[.85,1.7,2.55],n=2.95,r=e=>{let t=.4+e*1.08*Math.PI*2,n=.58+1.86*e**.85,r=-.52+1.04*e+.07*Math.sin(e*Math.PI*3.2);return[Math.cos(t)*n,r,Math.sin(t)*n]},i=e=>{let t=1600,n=[0],i=r(0);for(let e=1;e<=t;e++){let a=r(e/t);n.push(n[e-1]+Math.hypot(a[0]-i[0],a[1]-i[1],a[2]-i[2])),i=a}let a=n[t],o=e=>{let r=e*a,i=0,o=t;for(;o-i>1;){let e=i+o>>1;n[e]<r?i=e:o=e}let s=n[o]>n[i]?(r-n[i])/(n[o]-n[i]):0;return(i+s)/t},s=[];for(let t=0;t<e;t++)s.push(r(o(e>1?t/(e-1):0)));let c=[],l=26*Math.max(1,e-1);for(let e=0;e<=l;e++){let t=e/l;c.push({p:r(o(t)),s:t})}return{points:s,route:c,length:a}},a=(e,t)=>[e[0]-t[0],e[1]-t[1],e[2]-t[2]],o=(e,t,n)=>[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n],s=e=>{let t=Math.hypot(e[0],e[1],e[2])||1;return[e[0]/t,e[1]/t,e[2]/t]},c=(e,t)=>[e[1]*t[2]-e[2]*t[1],e[2]*t[0]-e[0]*t[2],e[0]*t[1]-e[1]*t[0]],l=(e,t)=>e[0]*t[0]+e[1]*t[1]+e[2]*t[2],u=(e,t,n)=>{let r=s(a(e.eye,e.target)),i=s(c([0,1,0],r)),o=c(r,i),u=t.width/2,d=t.height/2,f=e.focal/u,p=e.focal/d,m=e.shift[0]/u,h=e.shift[1]/d,g=.05,_=-(80+g)/(80-g);-160*g/(80-g);let v=-l(i,e.eye),y=-l(o,e.eye),b=-l(r,e.eye),x=[[f*i[0]-m*r[0],f*i[1]-m*r[1],f*i[2]-m*r[2],f*v-m*b],[p*o[0]-h*r[0],p*o[1]-h*r[1],p*o[2]-h*r[2],p*y-h*b],[_*r[0],_*r[1],_*r[2],_*b+-.10006253908692933],[-r[0],-r[1],-r[2],-b]];for(let e=0;e<4;e++)for(let t=0;t<4;t++)n[e*4+t]=x[t][e];return n},d=e=>Math.min(1,Math.max(0,e)),f=(e,t,n)=>d((e-t)/(n-t)),p=e=>e*e*(3-2*e),m=e=>1-(1-e)**3,h=e=>e<.5?4*e*e*e:1-(-2*e+2)**3/2,g=7.6,_=Math.PI*2/24e4,v=e=>{let{region:t}=e,n=t.w<560?2.62:3.15;return{focal:Math.min(t.w*.5,t.h*.74)*g/n,shift:[t.x+t.w/2-e.width/2,e.height/2-(t.y+t.h/2)]}},y=()=>{let e=null,t=i(11),n=new Float32Array(16),r=new Float32Array(16),a=new Float32Array(16),s=new Float32Array(48),c=new Float32Array(64),l=(e,t)=>{let n=e.reduced?1:p(f(t-e.leanAt,0,1e3));return{v:o(e.leanFrom,e.leanTo,n),k:e.leanFromK+(e.leanToK-e.leanFromK)*n}},y=(e,t,n)=>{let r=p(f(n-e.focusAt,0,e.reduced?120:320));return e.focusFrom[t]+(e.focusTo[t]-e.focusFrom[t])*r},x=(e,t)=>{let n=t-e.openAt,r=e.reduced,i=r?1:1-(1-f(n,0,1100))**4,a=-.5+(r?0:n*_)-(1-i)*.85,s=.7+(1-i)*.42+(r?0:.035*Math.sin(n/8e3)),c=g*(1+(1-i)*1.15);if(e.closeAt!==null&&!r){let n=h(f(t-e.closeAt,0,440));c*=1+.32*n,s+=.12*n}let u=[0,0,0],d=[Math.cos(s)*Math.sin(a)*c,Math.sin(s)*c,Math.cos(s)*Math.cos(a)*c],p=r?null:l(e,t);if(p&&p.k>1e-4){let e=.22*p.k,t=[(p.v[0]-d[0])*e,(p.v[1]-d[1])*e,(p.v[2]-d[2])*e];d=[d[0]+t[0],d[1]+t[1],d[2]+t[2]],u=t}let m=[e.shift[0],e.shift[1]];if(e.diveAt!==null){let n=f(t-e.diveAt,0,e.diveMs),r=e.points[e.diveIndex]??[0,0,0],i=h(f(n,0,.6));u=o(u,r,i),d=o(r,d,Math.exp(-4.2*n*n)),m=[m[0]*(1-i),m[1]*(1-i)]}return{eye:d,target:u,shift:m,focal:e.focal}};return{handle:n=>{if(n.type===`map-open`){let r=Math.min(16,n.colors.length);t.points.length!==r&&(t=i(r));let a=v(n.view);e={openAt:n.at,closeAt:null,diveAt:null,diveMs:1,diveIndex:-1,reduced:n.reduced,colors:n.colors.slice(0,r),here:n.here,view:n.view,focal:a.focal,shift:a.shift,points:t.points,focusFrom:Array(r).fill(0),focusTo:Array(r).fill(0),focusAt:n.at,leanFrom:[0,0,0],leanFromK:0,leanTo:[0,0,0],leanToK:0,leanAt:n.at};return}if(e)if(n.type===`map-view`){let t=v(n.view);e.view=n.view,e.focal=t.focal,e.shift=t.shift}else if(n.type===`map-focus`){let t=e,r=n.at;t.focusFrom=t.focusFrom.map((e,n)=>y(t,n,r)),t.focusTo=t.focusTo.map((e,t)=>+(t===n.index)),t.focusAt=r;let i=l(t,r);t.leanFrom=i.v,t.leanFromK=i.k;let a=t.points[n.index];t.leanTo=a?[a[0],a[1],a[2]]:[0,0,0],t.leanToK=+!!a,t.leanAt=r}else n.type===`map-close`&&e.closeAt===null&&(e.closeAt=n.at)},dive:(t,n,r)=>{!e||t<0||t>=e.points.length||(e.diveAt=n,e.diveMs=r,e.diveIndex=t)},sample:t=>{let i=e;if(!i)return null;let a=t-i.openAt,o=0;if(i.closeAt!==null){let n=t-i.closeAt;if(n>=440)return e=null,null;o=n/440}let l=-1;if(i.diveAt!==null){let n=(t-i.diveAt)/i.diveMs;if(n>=1)return e=null,null;l=d(n)}let g=i.reduced,_=i.points.length,v=x(i,t);u(v,i.view,n),u(x(i,t-36),i.view,r);let S=g?1:p(f(a,0,860)),C=g?p(f(a,0,220)):1,w=l>=0?l:0,T=1-p(f(w,.3,.8)),E=1-p(f(w,.8,1));for(let e=0;e<_;e++){let n=_>1?e/(_-1):0,r=p(f(S,Math.min(n-.012,.95),Math.min(n+.05,1)))*C,a=e===i.here?p(f(S,Math.min(n+.03,.96),Math.min(n+.13,1))):0;c[e*4]=r;let o=e===i.diveIndex?p(f(w,0,.3)):0;c[e*4+1]=Math.max(y(i,e,t),o),c[e*4+2]=a*(1-p(f(w,0,.2))),c[e*4+3]=e===i.diveIndex?E:T;let l=i.colors[e];s[e*3]=l[0]/255,s[e*3+1]=l[1]/255,s[e*3+2]=l[2]/255}let D=o>0?1-p(f(o,0,.62)):1,O=o>0?1-h(f(o,.18,1)):g?p(f(a,0,200)):m(f(a,0,320)),k=i.colors[Math.max(0,i.here)]??[201,168,106],A=l>=0?i.colors[i.diveIndex]??k:k,j=p(f(w,0,.5)),M=[k[0]+(A[0]-k[0])*j,k[1]+(A[1]-k[1])*j,k[2]+(A[2]-k[2])*j],N=null;if(l>=0){let e=i.points[i.diveIndex],t=b(n,e,i.view);N=t?[t.x-i.view.width/2,t.y-i.view.height/2]:[0,0]}return{count:_,viewProj:n,prevViewProj:r,focal:i.focal,colors:s,points:c,alpha:D*C,lines:D*C*(1-p(f(w,.25,.75))),rings:(g?C:p(f(a,0,420)))*D*(1-p(f(w,.05,.55))),ringScale:g?1:.7+.3*m(f(a,0,1050)),dust:(g?C:p(f(a,0,380)))*D*(1-p(f(w,.6,1))),labels:(g?C:1)*(o>0?1-p(f(o,0,.4)):1)*(1-p(f(w,0,.22))),reveal:S,hereArc:_>1?Math.max(0,i.here)/(_-1):0,veil:l>=0?1:O,haze:(g?C:p(f(a,0,800)))*D*(1-p(f(w,.2,.85))),hazeCenter:[v.shift[0],-v.shift[1]],hazeColor:M,time:g?0:a/1e3,vanish:N,dive:l}},locate:(t,n)=>{let r=e;if(!r||r.closeAt!==null||r.diveAt!==null)return null;let i=r.points[t];return i?b(u(x(r,n),r.view,a),i,r.view):null},isStill:t=>!!(e?.reduced&&e.closeAt===null&&t-e.openAt>260&&t-e.focusAt>160),get count(){return e?.points.length??0}}},b=(e,t,n)=>{let r=e[0]*t[0]+e[4]*t[1]+e[8]*t[2]+e[12],i=e[1]*t[0]+e[5]*t[1]+e[9]*t[2]+e[13],a=e[3]*t[0]+e[7]*t[1]+e[11]*t[2]+e[15];return a<=.05?null:{x:(r/a+1)*.5*n.width,y:(1-i/a)*.5*n.height,depth:a}},x=`gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return;`,S=`vec3(0.96, 0.945, 0.91)`,C=`
precision highp float;
attribute vec3 aA;
attribute vec3 aB;
attribute vec2 aCorner;
attribute vec4 aStyle;
uniform mat4 uViewProj;
uniform vec2 uViewport;
uniform float uDpr;
uniform float uLines;
uniform float uRings;
uniform float uRingScale;
uniform float uCount;
uniform vec3 uColors[16];
uniform vec4 uPoints[16];
varying float vSide;
varying float vWidth;
varying vec3 vColor;
varying float vS;
varying float vKind;

vec3 palette(float s) {
  float u = clamp(s, 0.0, 1.0) * (uCount - 1.0);
  float i = floor(u);
  int a = int(i);
  int b = int(min(i + 1.0, uCount - 1.0));
  return mix(uColors[a], uColors[b], smoothstep(0.0, 1.0, u - i));
}

void main() {
  // Tipo: 0 anillos del plano, 1 tallo de una estrella, 2 ruta, 3 pie del tallo
  float kind = aStyle.x;
  vec3 a = aA;
  vec3 b = aB;
  vec3 color = ${S};
  float alpha = aStyle.w;
  float s = 0.0;
  float width = 0.5;
  if (kind < 0.5) {
    a.xz *= uRingScale;
    b.xz *= uRingScale;
    alpha *= uRings;
  } else if (kind < 1.5 || kind > 2.5) {
    int i = int(aStyle.y + 0.5);
    vec4 point = uPoints[i];
    if (kind < 1.5) {
      // El tallo baja de la estrella al plano a medida que se enciende
      b = mix(a, b, point.x);
      s = aCorner.x * length(b - a) * 11.0;
    }
    color = uColors[i];
    alpha *= point.x * point.w * (0.8 + 0.7 * point.y) * uLines;
  } else {
    s = mix(aStyle.y, aStyle.z, aCorner.x);
    color = palette(s);
    alpha *= uLines;
    width = 0.68;
  }
  vec4 ca = uViewProj * vec4(a, 1.0);
  vec4 cb = uViewProj * vec4(b, 1.0);
  if (min(ca.w, cb.w) < 0.12 || alpha <= 0.002) {
    ${x}
  }
  vec2 sa = ca.xy / ca.w * 0.5 * uViewport;
  vec2 sb = cb.xy / cb.w * 0.5 * uViewport;
  vec2 d = sb - sa;
  float len = length(d);
  vec2 dir = len > 1e-4 ? d / len : vec2(1.0, 0.0);
  vec2 n = vec2(-dir.y, dir.x);
  float w = width * uDpr;
  float reach = w + 1.0;
  // Medio píxel más en cada punta: los tramos no dejan huecos entre sí
  vec2 p = mix(sa, sb, aCorner.x) + dir * (aCorner.x * 2.0 - 1.0) * 0.5 + n * aCorner.y * reach;
  // Lo lejano se apaga: el plano se lee en perspectiva
  float depth = mix(ca.w, cb.w, aCorner.x);
  alpha *= mix(1.2, 0.38, smoothstep(5.0, 11.5, depth));
  gl_Position = vec4(p / (0.5 * uViewport), 0.0, 1.0);
  vSide = aCorner.y * reach;
  vWidth = w;
  vColor = color * alpha;
  vS = s;
  vKind = kind;
}
`,w=`
precision highp float;
attribute vec2 aCorner;
attribute vec4 aPoint;
uniform mat4 uViewProj;
uniform vec2 uViewport;
uniform float uDpr;
uniform float uFocal;
// Compartido con el fragmento: misma precisión en los dos
uniform mediump float uAlpha;
uniform float uCount;
uniform vec3 uColors[16];
uniform vec4 uPoints[16];
varying vec2 vLocal;
varying vec4 vState;
varying vec3 vColor;
varying float vKind;
varying float vGrow;
void main() {
  int i = int(aPoint.w + 0.5);
  vec4 state = uPoints[i];
  vec4 c = uViewProj * vec4(aPoint.xyz, 1.0);
  if (c.w < 0.06 || state.x * state.w * uAlpha <= 0.002) {
    ${x}
  }
  vec2 s = c.xy / c.w * 0.5 * uViewport;
  // Con la cámara encima (la zambullida) la estrella crece hasta atravesarla
  float grow = max(1.0, 0.05 * uFocal / c.w / 6.0);
  vLocal = aCorner * 50.0 * grow;
  vGrow = grow;
  vec2 p = s + aCorner * 50.0 * grow * uDpr;
  gl_Position = vec4(p / (0.5 * uViewport), 0.0, 1.0);
  vState = state;
  vColor = uColors[i];
  vKind = i == 0 ? 0.0 : (aPoint.w > uCount - 1.5 ? 2.0 : 1.0);
}
`,T=`
precision highp float;
attribute vec2 aCorner;
attribute vec4 aPos;
attribute vec3 aLook;
uniform mat4 uViewProj;
uniform mat4 uPrevViewProj;
uniform vec2 uViewport;
uniform float uDpr;
uniform float uFocal;
uniform float uDust;
uniform float uAlpha;
uniform vec3 uColors[16];
uniform vec4 uPoints[16];
varying vec2 vLocal;
varying float vLen;
varying float vRadius;
varying vec3 vColor;
void main() {
  vec4 h = uViewProj * vec4(aPos.xyz, 1.0);
  vec4 t = uPrevViewProj * vec4(aPos.xyz, 1.0);
  vec3 color;
  float r;
  if (aPos.w < -0.5) {
    color = mix(vec3(0.62, 0.73, 1.0), vec3(1.0, 0.87, 0.72), aLook.z) * aLook.y * uDust;
    // Muy cerca de la cámara se apaga antes de rozarla
    color *= smoothstep(0.5, 2.0, h.w);
    r = aLook.x * clamp(6.5 / h.w, 0.6, 1.9);
  } else {
    int i = int(aPos.w + 0.5);
    vec4 state = uPoints[i];
    color = mix(vec3(1.0), uColors[i], 0.3) * state.x * state.w * (1.45 + 0.6 * state.y) * uAlpha;
    r = max(2.1 + 0.6 * state.y, min(0.014 * uFocal / h.w, 9.0));
  }
  if (min(h.w, t.w) < 0.06 || dot(color, color) < 1e-6) {
    ${x}
  }
  r *= uDpr;
  vec2 head = h.xy / h.w * 0.5 * uViewport;
  vec2 tail = t.xy / t.w * 0.5 * uViewport;
  float len = length(head - tail);
  float cap = uViewport.y * 0.7;
  if (len > cap) {
    tail = head - (head - tail) * (cap / len);
    len = cap;
  }
  vec2 n = len > 1e-3 ? (head - tail) / len : vec2(1.0, 0.0);
  vec2 side = vec2(-n.y, n.x);
  vec2 p = mix(tail - n * r, head + n * r, aCorner.x) + side * aCorner.y * r;
  vLocal = vec2(mix(-r, len + r, aCorner.x), aCorner.y * r);
  vLen = len;
  vRadius = r;
  vColor = color;
  gl_Position = vec4(p / (0.5 * uViewport), 0.0, 1.0);
}
`,E=`
precision highp float;
attribute vec2 aCorner;
attribute vec4 aAnchor;
attribute vec4 aRect;
attribute vec4 aUv;
attribute vec2 aKind;
uniform mat4 uViewProj;
uniform vec2 uViewport;
uniform float uDpr;
uniform float uLabels;
uniform vec3 uColors[16];
uniform vec4 uPoints[16];
varying vec2 vUv;
varying vec3 vColor;
void main() {
  int i = int(aAnchor.w + 0.5);
  vec4 state = uPoints[i];
  float kind = aKind.x;
  vec2 offset = aRect.xy;
  float alpha;
  vec3 color;
  if (kind < 0.5) {
    alpha = state.x * (0.55 + 0.45 * state.y);
    color = mix(uColors[i], vec3(1.0), 0.18);
    offset.x += state.y * 4.0;
  } else if (kind < 1.5) {
    alpha = state.x * state.y;
    color = ${S};
    offset.x += 4.0 - (1.0 - state.y) * 8.0;
  } else {
    alpha = state.z * 0.85;
    color = ${S};
  }
  alpha *= uLabels * state.w;
  vec4 c = uViewProj * vec4(aAnchor.xyz, 1.0);
  if (c.w < 0.06 || alpha <= 0.003) {
    ${x}
  }
  vec2 screen = vec2(c.x, -c.y) / c.w * 0.5 * uViewport + 0.5 * uViewport;
  // Junto al borde derecho, número y título pasan al otro lado de la estrella
  // (si allí caben mejor)
  float right = uViewport.x / uDpr - 16.0 - (screen.x / uDpr + aKind.y);
  float left = screen.x / uDpr - aKind.y - 16.0;
  if (kind < 1.5 && right < 0.0 && left > right) {
    offset.x = -offset.x - aRect.z / uDpr;
  }
  vec2 corner = floor(screen + offset * uDpr + 0.5);
  vec2 q = corner + aCorner * aRect.zw;
  gl_Position = vec4(q.x / uViewport.x * 2.0 - 1.0, 1.0 - q.y / uViewport.y * 2.0, 0.0, 1.0);
  vUv = mix(aUv.xy, aUv.zw, aCorner);
  vColor = color * alpha;
}
`,D=[[0,-1],[1,-1],[1,1],[0,-1],[1,1],[0,1]],O=[[-1,-1],[1,-1],[1,1],[-1,-1],[1,1],[-1,1]],k=[[0,0],[1,0],[1,1],[0,0],[1,1],[0,1]],A=e=>()=>(e=e*1664525+1013904223>>>0,e/4294967296),j=(r,i)=>{let a=[],o=(e,t,n)=>{for(let[r,i]of D)a.push(e[0],e[1],e[2],t[0],t[1],t[2],r,i,...n)},s=(e,t,n,r,i=0,a=0)=>{for(let s=0;s<n;s++){let c=s/n*Math.PI*2,l=(s+1)/n*Math.PI*2;o([i+Math.cos(c)*e,t,a+Math.sin(c)*e],[i+Math.cos(l)*e,t,a+Math.sin(l)*e],r)}};t.forEach((t,n)=>s(t,e,120,[0,0,0,.12-n*.022])),s(n,e,160,[0,0,0,.075]);for(let t=0;t<72;t++){let r=t/72*Math.PI*2,i=t%6==0,a=n,s=n+(i?.17:.07);o([Math.cos(r)*a,e,Math.sin(r)*a],[Math.cos(r)*s,e,Math.sin(r)*s],[0,0,0,i?.14:.08])}r.forEach((t,n)=>{o(t,[t[0],e,t[2]],[1,n,0,.24]),s(.05,e,18,[3,n,0,.32],t[0],t[2])});for(let e=0;e<i.length-1;e++)o(i[e].p,i[e+1].p,[2,i[e].s,i[e+1].s,.62]);return new Float32Array(a)},M=(e,t)=>{let n=A(918273),r=new Float32Array((t+e.length)*D.length*9),i=0,a=(e,t,n,a,o)=>{for(let[s,c]of D)r.set([s,c,e[0],e[1],e[2],t,n,a,o],i),i+=9};for(let e=0;e<t;e++){let e;if(n()<.7){let t=.25+4.4*n()**.75,r=n()*Math.PI*2,i=(n()+n()+n()-1.5)*.55;e=[Math.cos(r)*t,i,Math.sin(r)*t]}else{let t=n()*2-1,r=n()*Math.PI*2,i=7+9*n(),a=Math.sqrt(1-t*t);e=[Math.cos(r)*a*i,t*i,Math.sin(r)*a*i]}a(e,-1,.55+1.05*n()**3,.14+.62*n()**2.4,n())}return e.forEach((e,t)=>a(e,t,0,0,0)),r},N=e=>{let t=new Float32Array(e.length*O.length*6),n=0;return e.forEach((e,r)=>{for(let[i,a]of O)t.set([i,a,e[0],e[1],e[2],r],n),n+=6}),t},P=(e,t,n,r)=>{let i=t.flatMap(t=>t.index<0?e.map((e,n)=>({...t,index:n})):e[t.index]?[t]:[]),a=new Float32Array(i.length*k.length*16),o=0;for(let t of i){let i=e[t.index],s=t.u/n,c=t.v/r,l=(t.u+t.w)/n,u=(t.v+t.h)/r;for(let[e,n]of k)a.set([e,n,i[0],i[1],i[2],t.index,t.ox,t.oy,t.w,t.h,s,c,l,u,t.kind,t.extent],o),o+=16}return{data:a,vertices:i.length*k.length}},F=(e,t,n)=>{let r=t(C,`
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform float uReveal;
uniform float uHere;
uniform float uTime;
varying float vSide;
varying float vWidth;
varying vec3 vColor;
varying float vS;
varying float vKind;
void main() {
  float a = clamp(vWidth + 0.5 - abs(vSide), 0.0, 1.0);
  if (vKind > 1.5 && vKind < 2.5) {
    // La ruta se traza sola; lo ya recorrido es continuo y lo que falta,
    // un trazo discontinuo que avanza despacio en el sentido del viaje
    a *= 1.0 - smoothstep(uReveal - 0.008, uReveal + 0.001, vS);
    if (vS > uHere + 0.002) a *= step(0.45, fract(vS * 150.0 - uTime * 0.22)) * 0.62;
  } else if (vKind > 0.5 && vKind < 1.5) {
    a *= step(0.45, fract(vS));
  }
  if (a <= 0.0) discard;
  gl_FragColor = vec4(vColor * a, 0.0);
}
`),a=t(w,`
precision mediump float;
uniform float uAlpha;
uniform float uTime;
varying vec2 vLocal;
varying vec4 vState;
varying vec3 vColor;
varying float vKind;
varying float vGrow;
float stroke(float d, float r) {
  return clamp(1.0 - abs(d - r) / 0.85, 0.0, 1.0);
}
void main() {
  // d en px reales; n escalado (el halo florece, los trazos siguen finos)
  float real = length(vLocal);
  float d = real / vGrow;
  float focus = vState.y;
  float here = vState.z;
  float light;
  if (vKind < 0.5) {
    // La portada: un círculo hueco, el punto de partida
    light = stroke(d, 4.5 + focus) * 0.6 + exp(-d * d / 5.0) * 0.3;
  } else if (vKind > 1.5) {
    // Vitrina y archivo: un rombo de línea al final del camino
    light = stroke(abs(vLocal.x) + abs(vLocal.y), 7.5 + 3.0 * focus) * (0.55 + 0.4 * focus);
    light += exp(-d * d / 9.0) * 0.32;
  } else {
    float sigma = 7.5 + 7.0 * focus;
    // Al florecer el halo se atenúa: llega al brillo del túnel sin pasarlo
    light = exp(-d * d / (2.0 * sigma * sigma)) * (0.3 + 0.32 * focus) / (1.0 + 0.035 * (vGrow - 1.0));
    light += stroke(real, (9.5 + 4.5 * focus) * vGrow) * (0.4 + 0.5 * focus) * min(vGrow, 1.6);
  }
  // Estás aquí: cuatro arcos que giran despacio y un pulso que se abre
  if (here > 0.001) {
    float angle = atan(vLocal.y, vLocal.x) + uTime * 0.42;
    float arcs = smoothstep(0.12, 0.32, cos(4.0 * angle));
    float reticle = stroke(d, 21.0 + (1.0 - here) * 10.0) * arcs;
    float phase = fract(uTime / 2.8);
    float ping = stroke(d, 13.0 + 30.0 * phase) * (1.0 - phase) * (1.0 - phase);
    light += (reticle * 0.8 + ping * 0.42) * here;
  }
  float a = light * vState.x * vState.w * uAlpha;
  if (a <= 0.001) discard;
  gl_FragColor = vec4(mix(vColor, vec3(1.0), 0.12) * a, 0.0);
}
`),o=t(T,n),s=t(E,`
precision mediump float;
uniform sampler2D uAtlas;
varying vec2 vUv;
varying vec3 vColor;
void main() {
  float a = texture2D(uAtlas, vUv).a;
  if (a <= 0.004) discard;
  gl_FragColor = vec4(vColor * a, 0.0);
}
`),c=e.createBuffer(),l=e.createBuffer(),u=e.createBuffer(),d=e.createBuffer(),f=e.createTexture(),p=(e,t)=>{let n=0;return t.map(([t,r])=>{let i=[e.attribute(t),r,n];return n+=r,i})},m=p(r,[[`aA`,3],[`aB`,3],[`aCorner`,2],[`aStyle`,4]]),h=p(a,[[`aCorner`,2],[`aPoint`,4]]),g=p(o,[[`aCorner`,2],[`aPos`,4],[`aLook`,3]]),_=p(s,[[`aCorner`,2],[`aAnchor`,4],[`aRect`,4],[`aUv`,4],[`aKind`,2]]),v=[m,h,g,_].flat(),y=0,b=0,x=0,S=0,D=0,O=0,k=[],A=null,F=(t,n)=>{e.bindBuffer(e.ARRAY_BUFFER,t),e.bufferData(e.ARRAY_BUFFER,n,e.STATIC_DRAW)},I=()=>{if(!A||!k.length){D=0;return}let e=P(k,A.labels,A.width,A.height);F(d,e.data),D=e.vertices},L=(e,t)=>{if(e===y&&t===O)return;let n=i(e);k=n.points;let r=j(k,n.route);F(c,r),b=r.length/12;let a=M(k,t);F(l,a),x=a.length/9;let o=N(k);F(u,o),S=o.length/6,y=e,O=t,I()},R=(t,n,r,i)=>{e.bindTexture(e.TEXTURE_2D,f),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),t?e.texImage2D(e.TEXTURE_2D,0,e.RGBA,e.RGBA,e.UNSIGNED_BYTE,t):e.texImage2D(e.TEXTURE_2D,0,e.RGBA,1,1,0,e.RGBA,e.UNSIGNED_BYTE,new Uint8Array(4)),t?.close(),A={labels:n,width:r,height:i},I()},z=(t,n,r)=>{e.bindBuffer(e.ARRAY_BUFFER,t);for(let[t]of v)t>=0&&e.disableVertexAttribArray(t);for(let[t,i,a]of n)t<0||(e.enableVertexAttribArray(t),e.vertexAttribPointer(t,i,e.FLOAT,!1,r*4,a*4))},B=(t,n,r,i)=>{e.useProgram(t.program),e.uniformMatrix4fv(t.uniform(`uViewProj`),!1,n.viewProj),e.uniform2f(t.uniform(`uViewport`),r[0],r[1]),e.uniform1f(t.uniform(`uDpr`),i),e.uniform3fv(t.uniform(`uColors`),n.colors),e.uniform4fv(t.uniform(`uPoints`),n.points),e.uniform1f(t.uniform(`uCount`),n.count)};return R(null,[],1,1),{draw:(t,n,i)=>{let p=Math.round(Math.min(950,Math.max(420,n[0]*n[1]/(i*i*1150))));L(t.count,p),t.rings+t.lines>.002&&(B(r,t,n,i),z(c,m,12),e.uniform1f(r.uniform(`uLines`),t.lines),e.uniform1f(r.uniform(`uRings`),t.rings),e.uniform1f(r.uniform(`uRingScale`),t.ringScale),e.uniform1f(r.uniform(`uReveal`),t.reveal),e.uniform1f(r.uniform(`uHere`),t.hereArc),e.uniform1f(r.uniform(`uTime`),t.time),e.drawArrays(e.TRIANGLES,0,b)),t.alpha>.002&&(B(a,t,n,i),z(u,h,6),e.uniform1f(a.uniform(`uFocal`),t.focal),e.uniform1f(a.uniform(`uAlpha`),t.alpha),e.uniform1f(a.uniform(`uTime`),t.time),e.drawArrays(e.TRIANGLES,0,S)),t.dust+t.alpha>.002&&(B(o,t,n,i),z(l,g,9),e.uniformMatrix4fv(o.uniform(`uPrevViewProj`),!1,t.prevViewProj),e.uniform1f(o.uniform(`uFocal`),t.focal),e.uniform1f(o.uniform(`uDust`),t.dust),e.uniform1f(o.uniform(`uAlpha`),t.alpha),e.drawArrays(e.TRIANGLES,0,x)),D&&t.labels>.002&&(B(s,t,n,i),z(d,_,16),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,f),e.uniform1i(s.uniform(`uAtlas`),0),e.uniform1f(s.uniform(`uLabels`),t.labels),e.drawArrays(e.TRIANGLES,0,D))},release:()=>{for(let[t]of v)t>=0&&e.disableVertexAttribArray(t)},setAtlas:R,prepare:L}},I=()=>performance.timeOrigin+performance.now(),L=e=>Math.min(1,Math.max(0,e)),R=(e,t,n)=>L((e-t)/(n-t)),z=e=>e*e*(3-2*e),B=e=>e*e*e,V=e=>1-(1-e)**3,H=()=>{let e=null,t=1/0,n=0,r=0,i=74;return{start:n=>{e=n,t=1/0,r=n.t0,i=74},arrive:e=>{t=e},sample:a=>{if(!e)return null;let{departMs:o,cruiseMs:s,direction:c}=e,l=a-e.t0,u=Math.min(.05,Math.max(0,(a-r)/1e3));r=a;let d=(e.map??-1)>=0,f=74*B(R(l,0,o)),p=z(d?R(l,o*.28,o*.9):R(l,0,160)),m=d?1:B(R(l,40,o-30)),h=d?1:z(R(l,0,300)),g=.75*V(d?R(l,o*.42,o+320):R(l,180,700)),_=0,v=.35;if(a<t)i=f;else{let n=a-t;if(n>720)return e=null,null;f=i*Math.exp(-n/85),p*=1-z(R(n,150,470)),m*=1-V(R(n,0,460)),h*=1-V(R(n,60,700)),g*=1-V(R(n,0,380));let r=R(n,0,520);_=.55*(r<.22?V(r/.22):1-V((r-.22)/.78)),v=.35+1.15*V(r)}n=((n+c*f*u)%12+12)%12;let y=z(R(l,o*.5,o+s)),b=[e.from[0]+(e.to[0]-e.from[0])*y,e.from[1]+(e.to[1]-e.from[1])*y,e.from[2]+(e.to[2]-e.from[2])*y],x=c*.22*z(R(l,0,o+s+720));return{dist:n,expo:c*f*.046,roll:x,stars:p,tint:b,veil:m,vignette:h,glow:g,flash:_,flashRadius:v,center:[0,0]}}}},U=`
precision highp float;
attribute vec2 aCorner;
attribute vec4 aStar;
attribute vec3 aLook;
uniform float uDist;
uniform float uExpo;
uniform float uRoll;
uniform float uStars;
uniform float uFocal;
uniform vec2 uViewport;
uniform vec2 uCenter;
uniform float uDpr;
uniform vec3 uTint;
varying vec2 vLocal;
varying float vLen;
varying float vRadius;
varying vec3 vColor;

const float DEPTH = ${12 .toFixed(1)};
const float NEAR = ${.45.toFixed(2)};

vec2 project(vec2 xy, float z) {
  return xy / z * uFocal * uViewport.y * 0.5;
}

void main() {
  float z = mod(aStar.z - uDist, DEPTH) + NEAR;
  float zTail = max(z + uExpo, NEAR * 0.6);
  float angle = aStar.x + uRoll;
  vec2 xy = vec2(cos(angle), sin(angle)) * aStar.y;
  vec2 h = project(xy, z);
  vec2 b = project(xy, zTail);
  float len = length(h - b);
  float cap = uViewport.y * 0.8;
  if (len > cap) {
    b = h - (h - b) * (cap / len);
    len = cap;
  }
  vec2 n = len > 1e-3 ? (h - b) / len : vec2(1.0, 0.0);
  vec2 side = vec2(-n.y, n.x);
  float r = aLook.z * clamp(2.4 / z, 0.55, 2.6) * uDpr * 0.5;
  vec2 p = mix(b - n * r, h + n * r, aCorner.x) + side * aCorner.y * r;
  vLocal = vec2(mix(-r, len + r, aCorner.x), aCorner.y * r);
  vLen = len;
  vRadius = r;
  // Aparecen desde la distancia y se apagan justo antes de rozar la cámara
  float far = 1.0 - smoothstep(DEPTH * 0.5, DEPTH + NEAR, z);
  float near = smoothstep(NEAR, NEAR + 0.35, z);
  vec3 base = mix(vec3(0.62, 0.74, 1.0), vec3(1.0, 0.86, 0.72), aLook.x);
  vColor = mix(base, uTint, aLook.y) * aStar.w * far * near * uStars * 1.8;
  // El túnel nace del punto de fuga: el centro, o la estrella elegida del mapa
  gl_Position = vec4((p + uCenter) / (0.5 * uViewport), 0.0, 1.0);
}
`,W=`
precision mediump float;
varying vec2 vLocal;
varying float vLen;
varying float vRadius;
varying vec3 vColor;
void main() {
  float x = clamp(vLocal.x, 0.0, vLen);
  float d = length(vec2(vLocal.x - x, vLocal.y));
  float core = 1.0 - smoothstep(vRadius * 0.2, vRadius, d);
  if (core <= 0.0) discard;
  float along = vLen > 1e-3 ? x / vLen : 1.0;
  float spread = (2.0 * vRadius) / (vLen + 2.0 * vRadius);
  float intensity = core * mix(0.08, 1.0, along * along) * (0.35 + 0.65 * spread);
  // Luz que suma sin tocar el alfa del lienzo
  gl_FragColor = vec4(vColor * intensity, 0.0);
}
`,G=[[0,-1],[1,-1],[1,1],[0,-1],[1,1],[0,1]],K=e=>()=>(e=e*1664525+1013904223>>>0,e/4294967296),q=e=>{let t=K(20251013),n=new Float32Array(e*G.length*9),r=0;for(let i=0;i<e;i++){let e=t()*Math.PI*2,i=.22+2.9*t()**.85,a=t()*12,o=.3+.7*t()**2.2,s=t(),c=t()<.34?.65+.35*t():.08+.2*t(),l=1.1+1.9*t()**3;for(let[t,u]of G)n.set([t,u,e,i,a,o,s,c,l],r),r+=9}return n},J=e=>{let t=e.getContext(`webgl`,{alpha:!0,premultipliedAlpha:!0,antialias:!1,depth:!1,stencil:!1,preserveDrawingBuffer:!1,powerPreference:`high-performance`});if(!t)return null;let n=(e,n)=>{let r=(e,n)=>{let r=t.createShader(e);if(t.shaderSource(r,n),t.compileShader(r),!t.getShaderParameter(r,t.COMPILE_STATUS))throw Error(t.getShaderInfoLog(r)??`warp shader`);return r},i=t.createProgram();if(t.attachShader(i,r(t.VERTEX_SHADER,e)),t.attachShader(i,r(t.FRAGMENT_SHADER,n)),t.linkProgram(i),!t.getProgramParameter(i,t.LINK_STATUS))throw Error(t.getProgramInfoLog(i)??`warp program`);let a=new Map;return{program:i,attribute:e=>t.getAttribLocation(i,e),uniform:e=>(a.has(e)||a.set(e,t.getUniformLocation(i,e)),a.get(e))}},r=n(`
attribute vec2 aCorner;
void main() {
  gl_Position = vec4(aCorner, 0.0, 1.0);
}
`,`
precision mediump float;
uniform vec2 uViewport;
uniform vec2 uCenter;
uniform vec3 uTint;
uniform float uVeil;
uniform float uVignette;
uniform float uGlow;
uniform float uFlash;
uniform float uFlashRadius;
uniform float uHaze;
uniform vec2 uHazeCenter;
uniform vec3 uHazeColor;
void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uViewport - uCenter) / uViewport.y;
  float r2 = dot(p, p);
  vec2 q = gl_FragCoord.xy / uViewport * 2.0 - 1.0;
  float edge = smoothstep(0.3, 1.3, length(q));
  float alpha = clamp(uVeil + (1.0 - uVeil) * uVignette * edge * 0.9, 0.0, 1.0);
  vec3 color = vec3(0.016, 0.02, 0.035) * alpha;
  color += uTint * (exp(-r2 / 0.03) * 0.5 + exp(-r2 / 0.2) * 0.16) * uGlow;
  float f2 = r2 / (uFlashRadius * uFlashRadius);
  color += mix(uTint, vec3(1.0, 0.98, 0.94), exp(-f2 * 26.0)) * exp(-f2 * 4.0) * uFlash;
  vec2 h = (gl_FragCoord.xy - 0.5 * uViewport - uHazeCenter) / uViewport.y;
  float h2 = dot(h, h);
  color += uHazeColor * (exp(-h2 / 0.045) * 0.055 + exp(-h2 / 0.3) * 0.04) * uHaze;
  // Tramado para que los degradados no formen escalones
  float noise = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  color += (noise - 0.5) / 255.0;
  gl_FragColor = vec4(max(color, 0.0), alpha);
}
`),i=n(U,W),a=null;try{a=F(t,n,W)}catch{a=null}let o=t.createBuffer();t.bindBuffer(t.ARRAY_BUFFER,o),t.bufferData(t.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),t.STATIC_DRAW);let s=t.createBuffer(),c=r.attribute(`aCorner`),l=[[i.attribute(`aCorner`),2,0],[i.attribute(`aStar`),4,2],[i.attribute(`aLook`),3,6]];t.useProgram(i.program),t.uniform1f(i.uniform(`uFocal`),1/Math.tan(72*Math.PI/360)),t.disable(t.DEPTH_TEST),t.enable(t.BLEND),t.blendFunc(t.ONE,t.ONE_MINUS_SRC_ALPHA),t.clearColor(0,0,0,0);let u=0,d=0,f=[1,1],p=1;return{resize:(n,r,i)=>{let a=Math.max(1,Math.round(n*i)),o=Math.max(1,Math.round(r*i));e.width!==a&&(e.width=a),e.height!==o&&(e.height=o),t.viewport(0,0,a,o),f=[a,o],p=i;let c=Math.round(Math.min(1300,Math.max(520,n*r/1050)));c!==d&&(d=c,t.bindBuffer(t.ARRAY_BUFFER,s),t.bufferData(t.ARRAY_BUFFER,q(c),t.STATIC_DRAW),u=c*G.length)},draw:(e,n=null)=>{let[d,m,h]=(e?.tint??n?.hazeColor??[255,255,255]).map(e=>e/255),g=e?.center??[0,0];t.clear(t.COLOR_BUFFER_BIT),t.useProgram(r.program),t.bindBuffer(t.ARRAY_BUFFER,o);for(let[e]of l)t.disableVertexAttribArray(e);if(a?.release(),t.enableVertexAttribArray(c),t.vertexAttribPointer(c,2,t.FLOAT,!1,0,0),t.uniform2f(r.uniform(`uViewport`),f[0],f[1]),t.uniform2f(r.uniform(`uCenter`),g[0]*p,-g[1]*p),t.uniform3f(r.uniform(`uTint`),d,m,h),t.uniform1f(r.uniform(`uVeil`),Math.max(e?.veil??0,n?.veil??0)),t.uniform1f(r.uniform(`uVignette`),e?.vignette??0),t.uniform1f(r.uniform(`uGlow`),e?.glow??0),t.uniform1f(r.uniform(`uFlash`),e?.flash??0),t.uniform1f(r.uniform(`uFlashRadius`),e?.flashRadius??1),n){let[e,i,a]=n.hazeColor.map(e=>e/255);t.uniform1f(r.uniform(`uHaze`),n.haze),t.uniform2f(r.uniform(`uHazeCenter`),n.hazeCenter[0]*p,-n.hazeCenter[1]*p),t.uniform3f(r.uniform(`uHazeColor`),e,i,a)}else t.uniform1f(r.uniform(`uHaze`),0);if(t.drawArrays(t.TRIANGLES,0,3),t.disableVertexAttribArray(c),n&&a&&(a.draw(n,f,p),a.release()),!(!e||e.stars<=.001)){t.useProgram(i.program),t.bindBuffer(t.ARRAY_BUFFER,s);for(let[e,n,r]of l)t.enableVertexAttribArray(e),t.vertexAttribPointer(e,n,t.FLOAT,!1,36,r*4);t.uniform2f(i.uniform(`uViewport`),f[0],f[1]),t.uniform2f(i.uniform(`uCenter`),g[0]*p,-g[1]*p),t.uniform1f(i.uniform(`uDpr`),p),t.uniform3f(i.uniform(`uTint`),d,m,h),t.uniform1f(i.uniform(`uDist`),e.dist),t.uniform1f(i.uniform(`uExpo`),e.expo),t.uniform1f(i.uniform(`uRoll`),e.roll),t.uniform1f(i.uniform(`uStars`),e.stars),t.drawArrays(t.TRIANGLES,0,u)}},clear:()=>t.clear(t.COLOR_BUFFER_BIT),setAtlas:(e,t,n,r)=>{a?a.setAtlas(e,t,n,r):e?.close()},hasMap:!!a}},Y={dist:0,expo:0,roll:0,stars:1,tint:[255,255,255],veil:0,vignette:0,glow:0,flash:0,flashRadius:1,center:[0,0]},X=(e,t,n)=>{let r=H(),i=y(),a=!1;e.resize(n.width,n.height,n.dpr),e.draw({...Y,stars:1e-4}),e.draw(Y);let o=y();o.handle({type:`map-open`,at:0,colors:Array.from({length:11},()=>[255,255,255]),here:1,reduced:!0,view:{...n,region:{x:0,y:0,w:n.width,h:n.height}}});let s=o.sample(1e3);s&&(e.setAtlas(null,[{index:1,kind:0,ox:0,oy:0,w:1,h:1,u:0,v:0,extent:1}],1,1),e.draw({...Y,stars:1e-4},{...s,alpha:.003,lines:.003,rings:.003,dust:.003,labels:.003,veil:0,haze:0}),e.setAtlas(null,[],1,1)),e.clear();let c=()=>{let n=I(),o=r.sample(n),s=i.sample(n);if(!o&&!s){a=!1,e.clear();return}if(o&&s?.vanish&&(o.center=s.vanish),e.draw(o,s),!o&&i.isStill(n)){a=!1;return}t(c)},l=()=>{a||(a=!0,c())};return{handle:t=>{switch(t.type){case`start`:{let{plan:n}=t;e.resize(t.width,t.height,t.dpr),r.start(n),n.map!==void 0&&n.map>=0&&i.dive(n.map,n.t0,n.departMs);break}case`arrive`:r.arrive(t.at);return;case`map-labels`:e.setAtlas(t.image,t.labels,t.width,t.height);break;case`map-open`:case`map-view`:e.resize(t.view.width,t.view.height,t.view.dpr),i.handle(t);break;default:i.handle(t)}l()}}},Z=self,Q=e=>{Z.requestAnimationFrame?Z.requestAnimationFrame(e):setTimeout(e,16)},$=null;Z.onmessage=e=>{let t=e.data;if(t.type===`init`){try{let e=J(t.canvas);if(!e)throw Error(`webgl`);$=X(e,Q,t),Z.postMessage({type:`ready`,map:e.hasMap})}catch{Z.postMessage({type:`failed`})}return}$?.handle(t)}})();