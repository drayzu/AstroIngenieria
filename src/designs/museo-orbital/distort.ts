const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAG = `
precision mediump float;
uniform sampler2D u_tex;
uniform vec2 u_mouse;
uniform float u_time;
uniform float u_strength;
uniform float u_aspect;
varying vec2 v_uv;

void main() {
  vec2 uv = v_uv;
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
`;

export interface DistortHandle {
  move: (clientX: number, clientY: number) => void;
  destroy: () => void;
}

interface MountOptions {
  canvas: HTMLCanvasElement;
  image: HTMLImageElement;
  container: HTMLElement;
}

export const mountDistort = ({ canvas, image, container }: MountOptions): DistortHandle | null => {
  const gl = canvas.getContext('webgl', {
    alpha: true,
    antialias: false,
    powerPreference: 'low-power',
    preserveDrawingBuffer: false,
  });
  if (!gl) return null;
  gl.clearColor(0, 0, 0, 0);

  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  };

  const program = gl.createProgram()!;
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const locPos = gl.getAttribLocation(program, 'a_pos');
  gl.enableVertexAttribArray(locPos);
  gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, 0, 0);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

  const uMouse = gl.getUniformLocation(program, 'u_mouse');
  const uTime = gl.getUniformLocation(program, 'u_time');
  const uStrength = gl.getUniformLocation(program, 'u_strength');
  const uAspect = gl.getUniformLocation(program, 'u_aspect');

  let raf = 0;
  let time = 0;
  let strength = 0;
  let targetStrength = 0;
  const mouse = { x: 0.5, y: 0.5 };

  const resize = () => {
    const rect = container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.4);
    canvas.width = Math.max(2, Math.round(rect.width * dpr));
    canvas.height = Math.max(2, Math.round(rect.height * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
    drawFrame();
  };

  const drawFrame = () => {
    gl.uniform2f(uMouse, mouse.x, mouse.y);
    gl.uniform1f(uTime, time);
    gl.uniform1f(uStrength, strength);
    gl.uniform1f(uAspect, canvas.width / canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  resize();

  const frame = () => {
    time += 0.016;
    if (targetStrength > 0) {
      strength += (targetStrength - strength) * 0.08;
      targetStrength *= 0.94;
      if (targetStrength < 0.003) targetStrength = 0;
    } else if (strength > 0) {
      strength += (0 - strength) * 0.08;
      if (strength < 0.002) strength = 0;
    }
    drawFrame();
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return {
    move(clientX: number, clientY: number) {
      const rect = container.getBoundingClientRect();
      const nx = (clientX - rect.left) / rect.width;
      const ny = 1 - (clientY - rect.top) / rect.height;
      const speed = Math.hypot(nx - mouse.x, ny - mouse.y);
      targetStrength = Math.min(1.6, targetStrength * 0.85 + speed * 14);
      mouse.x = nx;
      mouse.y = ny;
    },
    destroy() {
      cancelAnimationFrame(raf);
      const lose = gl.getExtension('WEBGL_lose_context');
      lose?.loseContext();
    },
  };
};
