var e=`
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`,t=`
precision mediump float;
uniform sampler2D u_tex;
uniform vec2 u_mouse;
uniform float u_time;
uniform float u_strength;
uniform float u_aspect;
varying vec2 v_uv;

void main() {
  vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);
  vec2 m = u_mouse;
  float d = distance(vec2(uv.x * u_aspect, uv.y), vec2(m.x * u_aspect, m.y));
  float infl = smoothstep(0.55, 0.0, d) * u_strength;
  vec2 off = vec2(
    sin(uv.y * 22.0 + u_time * 2.6) + cos(uv.y * 7.0 - u_time * 1.4),
    cos(uv.x * 19.0 - u_time * 2.2) + sin(uv.x * 6.0 + u_time * 1.1)
  ) * 0.011 * infl;
  vec3 col = texture2D(u_tex, uv + off).rgb;
  col += infl * 0.06;
  gl_FragColor = vec4(col, 1.0);
}
`,n=({canvas:n,image:r,container:i})=>{let a=n.getContext(`webgl`,{alpha:!0,antialias:!1,powerPreference:`low-power`,preserveDrawingBuffer:!1});if(!a)return null;a.clearColor(0,0,0,0);let o=(e,t)=>{let n=a.createShader(e);return a.shaderSource(n,t),a.compileShader(n),n},s=a.createProgram();if(a.attachShader(s,o(a.VERTEX_SHADER,e)),a.attachShader(s,o(a.FRAGMENT_SHADER,t)),a.linkProgram(s),!a.getProgramParameter(s,a.LINK_STATUS))return null;a.useProgram(s);let c=a.createBuffer();a.bindBuffer(a.ARRAY_BUFFER,c),a.bufferData(a.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),a.STATIC_DRAW);let l=a.getAttribLocation(s,`a_pos`);a.enableVertexAttribArray(l),a.vertexAttribPointer(l,2,a.FLOAT,!1,0,0);let u=a.createTexture();a.bindTexture(a.TEXTURE_2D,u),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_WRAP_S,a.CLAMP_TO_EDGE),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_WRAP_T,a.CLAMP_TO_EDGE),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_MIN_FILTER,a.LINEAR),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_MAG_FILTER,a.LINEAR);let d=a.getParameter(a.MAX_TEXTURE_SIZE),f=Math.min(d??2048,1024),p=Math.min(1,f/r.naturalWidth,f/r.naturalHeight);if(p>=1)a.texImage2D(a.TEXTURE_2D,0,a.RGBA,a.RGBA,a.UNSIGNED_BYTE,r);else{let e=document.createElement(`canvas`);e.width=Math.max(2,Math.round(r.naturalWidth*p)),e.height=Math.max(2,Math.round(r.naturalHeight*p));let t=e.getContext(`2d`);if(!t)return null;t.drawImage(r,0,0,e.width,e.height),a.texImage2D(a.TEXTURE_2D,0,a.RGBA,a.RGBA,a.UNSIGNED_BYTE,e)}let m=a.getUniformLocation(s,`u_mouse`),h=a.getUniformLocation(s,`u_time`),g=a.getUniformLocation(s,`u_strength`),_=a.getUniformLocation(s,`u_aspect`),v=0,y=0,b=0,x=0,S=!0,C={x:.5,y:.5},w=()=>{if(!S)return;let e=i.getBoundingClientRect(),t=Math.min(window.devicePixelRatio||1,1.4);n.width=Math.max(2,Math.round(e.width*t)),n.height=Math.max(2,Math.round(e.height*t)),a.viewport(0,0,n.width,n.height),T()},T=()=>{S&&(a.uniform2f(m,C.x,C.y),a.uniform1f(h,y),a.uniform1f(g,b),a.uniform1f(_,n.width/n.height),a.drawArrays(a.TRIANGLES,0,3))};w();let E=2,D=()=>{S&&(y+=.016,x>0?(b+=(x-b)*.08,x*=.94,x<.003&&(x=0)):b>0&&(b+=(0-b)*.08,b<.002&&(b=0)),(b>0||E>0)&&(E>0&&--E,T()),v=requestAnimationFrame(D))};return v=requestAnimationFrame(D),n.addEventListener(`webglcontextlost`,e=>{e.preventDefault(),S=!1,cancelAnimationFrame(v),n.classList.remove(`is-live`),n.style.display=`none`}),{move(e,t){let n=i.getBoundingClientRect(),r=(e-n.left)/n.width,a=(t-n.top)/n.height,o=Math.hypot(r-C.x,a-C.y);x=Math.min(1.6,x*.85+o*14),C.x=r,C.y=a},destroy(){cancelAnimationFrame(v),a.getExtension(`WEBGL_lose_context`)?.loseContext()}}};export{n as mountDistort};