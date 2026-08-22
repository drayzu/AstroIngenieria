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
`,n=({canvas:n,image:r,container:i})=>{let a=n.getContext(`webgl`,{alpha:!0,antialias:!1,powerPreference:`low-power`,preserveDrawingBuffer:!1});if(!a)return null;a.clearColor(0,0,0,0);let o=(e,t)=>{let n=a.createShader(e);return a.shaderSource(n,t),a.compileShader(n),n},s=a.createProgram();if(a.attachShader(s,o(a.VERTEX_SHADER,e)),a.attachShader(s,o(a.FRAGMENT_SHADER,t)),a.linkProgram(s),!a.getProgramParameter(s,a.LINK_STATUS))return null;a.useProgram(s);let c=a.createBuffer();a.bindBuffer(a.ARRAY_BUFFER,c),a.bufferData(a.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),a.STATIC_DRAW);let l=a.getAttribLocation(s,`a_pos`);a.enableVertexAttribArray(l),a.vertexAttribPointer(l,2,a.FLOAT,!1,0,0);let u=a.createTexture();a.bindTexture(a.TEXTURE_2D,u),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_WRAP_S,a.CLAMP_TO_EDGE),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_WRAP_T,a.CLAMP_TO_EDGE),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_MIN_FILTER,a.LINEAR),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_MAG_FILTER,a.LINEAR),a.texImage2D(a.TEXTURE_2D,0,a.RGBA,a.RGBA,a.UNSIGNED_BYTE,r);let d=a.getUniformLocation(s,`u_mouse`),f=a.getUniformLocation(s,`u_time`),p=a.getUniformLocation(s,`u_strength`),m=a.getUniformLocation(s,`u_aspect`),h=0,g=0,_=0,v=0,y={x:.5,y:.5},b=()=>{let e=i.getBoundingClientRect(),t=Math.min(window.devicePixelRatio||1,1.4);n.width=Math.max(2,Math.round(e.width*t)),n.height=Math.max(2,Math.round(e.height*t)),a.viewport(0,0,n.width,n.height),x()},x=()=>{a.uniform2f(d,y.x,y.y),a.uniform1f(f,g),a.uniform1f(p,_),a.uniform1f(m,n.width/n.height),a.drawArrays(a.TRIANGLES,0,3)};b();let S=2,C=()=>{g+=.016,v>0?(_+=(v-_)*.08,v*=.94,v<.003&&(v=0)):_>0&&(_+=(0-_)*.08,_<.002&&(_=0)),(_>0||S>0)&&(S>0&&--S,x()),h=requestAnimationFrame(C)};return h=requestAnimationFrame(C),{move(e,t){let n=i.getBoundingClientRect(),r=(e-n.left)/n.width,a=(t-n.top)/n.height,o=Math.hypot(r-y.x,a-y.y);v=Math.min(1.6,v*.85+o*14),y.x=r,y.y=a},destroy(){cancelAnimationFrame(h),a.getExtension(`WEBGL_lose_context`)?.loseContext()}}};export{n as mountDistort};