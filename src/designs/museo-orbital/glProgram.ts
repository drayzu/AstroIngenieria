/* Compilar un shader sin trabar la página. Preguntar por LINK_STATUS
   espera a que la compilación termine entera: el agujero negro detenía así
   el hilo principal casi un segundo. Con KHR_parallel_shader_compile el
   navegador compila en otro hilo y aquí solo se pregunta, de vez en cuando,
   si ya terminó; sin la extensión todo sigue como antes. */

export interface PendingProgram {
  program: WebGLProgram;
  /* Ya se puede usar sin esperar */
  ready: () => boolean;
  /* Espera lo que falte (bloquea si aún compila); null si no enlazó */
  finish: () => WebGLProgram | null;
}

export const startProgram = (gl: WebGLRenderingContext, vertex: string, fragment: string): PendingProgram => {
  const parallel = gl.getExtension('KHR_parallel_shader_compile');
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  };
  const shaders = [compile(gl.VERTEX_SHADER, vertex), compile(gl.FRAGMENT_SHADER, fragment)];
  const program = gl.createProgram()!;
  shaders.forEach((shader) => gl.attachShader(program, shader));
  gl.linkProgram(program);
  return {
    program,
    ready: () => !parallel || Boolean(gl.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR)),
    finish: () => {
      if (gl.getProgramParameter(program, gl.LINK_STATUS)) return program;
      shaders.forEach((shader) => {
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) console.warn(gl.getShaderInfoLog(shader));
      });
      return null;
    },
  };
};

/* Llama a `done` cuando el programa termina de compilar en segundo plano.
   Devuelve con qué cancelar la espera */
export const whenReady = (pending: PendingProgram, done: () => void) => {
  let timer = 0;
  const check = () => {
    if (pending.ready()) done();
    else timer = window.setTimeout(check, 50);
  };
  check();
  return () => window.clearTimeout(timer);
};
