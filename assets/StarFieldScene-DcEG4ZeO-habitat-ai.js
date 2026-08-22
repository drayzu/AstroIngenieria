import{n as e,s as t,t as n}from"./jsx-runtime-BYMBCOCa-habitat-ai.js";import{a as r,h as i,i as a,n as o,o as s,r as c,t as l}from"./react-three-fiber.esm-Pvy6P5HU-habitat-ai.js";var u=t(e(),1),d=n(),f=(e,t)=>{if(t<=0)return 0;let n=(e-t)/1e3;return n<0||n>1.6?0:Math.min(1,n/.12)*Math.exp(-Math.max(0,n-.12)*2.6)},p=`
  uniform float uTime;
  uniform float uWarp;
  attribute float aSeed;
  varying float vSeed;
  varying float vFade;
  void main() {
    vec3 p = position;
    float speed = 3.5 + aSeed * 4.5;
    p.z = mod(p.z + uTime * speed * (1.0 + uWarp * 34.0), 260.0) - 250.0;
    vSeed = aSeed;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float size = (1.05 + aSeed * 2.3) * (1.0 + uWarp * 1.9);
    gl_PointSize = size * (150.0 / max(1.0, -mv.z));
    vFade = smoothstep(-250.0, -215.0, p.z) * smoothstep(8.0, -16.0, p.z);
  }
`,m=`
  uniform float uTime;
  uniform float uWarp;
  varying float vSeed;
  varying float vFade;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float alpha = smoothstep(0.5, 0.04, d);
    vec3 cool = vec3(0.60, 0.78, 1.0);
    vec3 warm = vec3(1.0, 0.85, 0.64);
    vec3 col = mix(cool, warm, step(0.84, fract(vSeed * 13.7)));
    col = mix(col, vec3(0.86, 0.96, 1.0), 0.22);
    float twinkle = 0.72 + 0.28 * sin(uTime * (0.8 + vSeed * 2.2) + vSeed * 40.0);
    gl_FragColor = vec4(col, alpha * vFade * twinkle * mix(0.62, 1.0, uWarp));
  }
`;function h({count:e,warpSignal:t}){let n=(0,u.useRef)(null),i=(0,u.useMemo)(()=>{let t=new Float32Array(e*3),n=new Float32Array(e);for(let r=0;r<e;r+=1)t[r*3]=(Math.random()-.5)*150,t[r*3+1]=(Math.random()-.5)*100,t[r*3+2]=10-Math.random()*260,n[r]=Math.random();let i=new r;return i.setAttribute(`position`,new a(t,3)),i.setAttribute(`aSeed`,new a(n,1)),i},[e]),s=(0,u.useMemo)(()=>({uTime:{value:0},uWarp:{value:0}}),[]);return o(e=>{n.current&&(s.uTime.value=e.clock.elapsedTime,s.uWarp.value=f(performance.now(),t.current))}),(0,d.jsx)(`points`,{geometry:i,frustumCulled:!1,children:(0,d.jsx)(`shaderMaterial`,{ref:n,uniforms:s,vertexShader:p,fragmentShader:m,transparent:!0,depthWrite:!1,blending:2})})}var g=`
  uniform float uTime;
  uniform float uWarp;
  attribute float aSeed;
  attribute float aEnd;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    float speed = 3.5 + aSeed * 4.5;
    p.z = mod(p.z + uTime * speed * (1.0 + uWarp * 34.0), 260.0) - 250.0;
    p.z -= aEnd * (4.0 + 130.0 * uWarp);
    vAlpha = (1.0 - aEnd * 0.88) * smoothstep(-250.0, -225.0, p.z);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
  }
`,_=`
  uniform float uWarp;
  varying float vAlpha;
  void main() {
    vec3 col = mix(vec3(0.55, 0.9, 1.0), vec3(1.0, 0.75, 0.95), 0.35);
    gl_FragColor = vec4(col, vAlpha * uWarp * 0.8);
  }
`;function v({count:e,warpSignal:t}){let n=(0,u.useRef)(null),i=(0,u.useMemo)(()=>{let t=new Float32Array(e*6),n=new Float32Array(e*2),i=new Float32Array(e*2);for(let r=0;r<e;r+=1){let e=(Math.random()-.5)*120,a=(Math.random()-.5)*80,o=10-Math.random()*260,s=Math.random();for(let c=0;c<2;c+=1){let l=(r*2+c)*3;t[l]=e,t[l+1]=a,t[l+2]=o,n[r*2+c]=s,i[r*2+c]=c}}let o=new r;return o.setAttribute(`position`,new a(t,3)),o.setAttribute(`aSeed`,new a(n,1)),o.setAttribute(`aEnd`,new a(i,1)),o},[e]),s=(0,u.useMemo)(()=>({uTime:{value:0},uWarp:{value:0}}),[]);return o(e=>{n.current&&(s.uTime.value=e.clock.elapsedTime,s.uWarp.value=f(performance.now(),t.current))}),(0,d.jsx)(`lineSegments`,{geometry:i,frustumCulled:!1,children:(0,d.jsx)(`shaderMaterial`,{ref:n,uniforms:s,vertexShader:g,fragmentShader:_,transparent:!0,depthWrite:!1,blending:2})})}var y=(e,t)=>{let n=document.createElement(`canvas`);n.width=256,n.height=256;let r=n.getContext(`2d`),a=r.createRadialGradient(128,128,0,128,128,128);a.addColorStop(0,e),a.addColorStop(.35,t),a.addColorStop(1,`rgba(0,0,0,0)`),r.fillStyle=a,r.fillRect(0,0,256,256);let o=new s(n);return o.colorSpace=i,o};function b(){let e=(0,u.useRef)(null),t=(0,u.useMemo)(()=>{let e=y(`rgba(38,68,160,0.85)`,`rgba(20,34,90,0.35)`),t=y(`rgba(120,42,168,0.7)`,`rgba(58,18,92,0.3)`),n=y(`rgba(24,140,150,0.6)`,`rgba(12,66,74,0.26)`),r=y(`rgba(255,238,210,0.95)`,`rgba(255,190,120,0.32)`);return[{map:e,position:[-70,26,-190],scale:240,opacity:.5},{map:t,position:[86,-30,-220],scale:300,opacity:.44},{map:n,position:[30,52,-170],scale:200,opacity:.36},{map:r,position:[10,6,-230],scale:70,opacity:.85}]},[]);return o(t=>{e.current&&(e.current.rotation.z=Math.sin(t.clock.elapsedTime*.02)*.05)}),(0,d.jsx)(`group`,{ref:e,children:t.map((e,t)=>(0,d.jsx)(`sprite`,{position:[...e.position],scale:[e.scale,e.scale,1],children:(0,d.jsx)(`spriteMaterial`,{map:e.map,opacity:e.opacity,transparent:!0,depthWrite:!1,blending:2})},t))})}function x({warpSignal:e}){let{camera:t}=c();return o(n=>{let r=t,i=f(performance.now(),e.current),a=n.clock.elapsedTime,o=n.pointer.x*2.4+Math.sin(a*.06)*.7,s=-n.pointer.y*1.5+Math.cos(a*.05)*.45;r.position.x+=(o-r.position.x)*.045,r.position.y+=(s+1.1-r.position.y)*.045,r.lookAt(0,0,-80),r.rotation.z+=i*Math.sin(a*24)*.018;let c=72+i*27;r.fov+=(c-r.fov)*.14,r.updateProjectionMatrix()}),null}function S({warpSignal:e}){let t=typeof window<`u`&&window.innerWidth<900;return(0,d.jsxs)(l,{dpr:[1,1.75],camera:{position:[0,1.1,16],fov:72,near:.1,far:700},gl:{antialias:!0,powerPreference:`high-performance`},style:{position:`absolute`,inset:0,pointerEvents:`none`},children:[(0,d.jsx)(`color`,{attach:`background`,args:[`#03040a`]}),(0,d.jsx)(b,{}),(0,d.jsx)(h,{count:t?2600:5200,warpSignal:e}),(0,d.jsx)(v,{count:t?180:420,warpSignal:e}),(0,d.jsx)(x,{warpSignal:e})]})}export{S as default};