export type Family = 'Luz' | 'Materia' | 'Estrellas' | 'Estructuras';
export type NewTool = 'aurora' | 'eclipse' | 'lens' | 'prism' | 'interference' | 'mirrors' | 'rings' | 'accretion' | 'tidal' | 'resonance' | 'asteroids' | 'meteors' | 'pulsar' | 'quasar' | 'kilonova' | 'pinwheel' | 'butterfly' | 'bow' | 'web' | 'swarm' | 'dyson' | 'engine' | 'elevator' | 'vortex';
export type LabTool = 'hand' | 'hole' | 'nebula' | 'plasma' | 'galaxy' | 'echo' | 'portal' | 'wave' | 'sail' | NewTool;
export interface Tool { id: LabTool; name: string; hint: string; category: Family; icon: string; color: string; creation: 'point' | 'drag' | 'pair'; key?: string; fresh?: boolean }
const fresh = (id: NewTool, name: string, category: Family, icon: string, color: string, hint: string, creation: Tool['creation'] = 'point'): Tool => ({ id, name, category, icon, color, hint, creation, fresh: true });
export const NEW_TOOLS: Tool[] = [
  fresh('aurora', 'Aurora viva', 'Luz', '≋', '#71efbc', 'Arrastra los extremos de la cortina. El plasma enciende sus pliegues.'),
  fresh('eclipse', 'Eclipse y corona', 'Luz', '◐', '#ffce8e', 'Arrastra la luna oscura sobre el sol para revelar la corona.'),
  fresh('lens', 'Lente gravitatoria', 'Luz', '◎', '#acbbff', 'Mueve el centro; arrastra el tirador exterior para cambiar la deformación.'),
  fresh('prism', 'Prisma cósmico', 'Luz', '△', '#d6acff', 'Gira el tirador del cristal para dirigir el arcoíris hacia las velas.'),
  fresh('interference', 'Interferencia luminosa', 'Luz', '◉', '#81dfef', 'Acerca o separa los dos emisores para transformar sus franjas.'),
  fresh('mirrors', 'Espejos solares', 'Luz', '⌁', '#fff1ae', 'Mueve los centros de los espejos y gira sus tiradores para encadenar rebotes.'),
  fresh('rings', 'Planeta anillado', 'Materia', '♄', '#e4c49a', 'Arrastra el tirador para inclinar los anillos. Los cometas abren surcos.'),
  fresh('accretion', 'Acreción planetaria', 'Materia', '◌', '#ffb783', 'Pasea la semilla por los escombros: crece y gana pequeños satélites.'),
  fresh('tidal', 'Desgarro de marea', 'Materia', '◔', '#b5b9ee', 'Arrastra la luna hacia el planeta hasta romperla en una corriente orbital.'),
  fresh('resonance', 'Órbitas resonantes', 'Materia', '❋', '#93e2dd', 'Arrastra las lunas para cambiar radios, ritmos y rosetas.'),
  fresh('asteroids', 'Cinturón de asteroides', 'Materia', '⁙', '#c9b79e', 'Arrastra para dibujar el cinturón. Después mueve sus extremos; responde a impactos, gravedad y portales.', 'drag'),
  fresh('meteors', 'Lluvia de meteoros', 'Materia', '☄', '#9ad7ff', 'Arrastra para orientar la lluvia: un gesto largo abre el abanico. Reorienta su tirador después.', 'drag'),
  fresh('pulsar', 'Púlsar faro', 'Estrellas', '✣', '#9ccaff', 'Arrastra el tirador alrededor del núcleo: cambia el eje y la velocidad de giro.'),
  fresh('quasar', 'Cuásar dirigible', 'Estrellas', '↟', '#d9adff', 'Gira el eje de los chorros. Alimenta el núcleo con cometas para intensificarlos.'),
  fresh('kilonova', 'Kilonova', 'Estrellas', '✷', '#ffd38a', 'Acerca los dos núcleos hasta fusionarlos y desplegar una nube dorada.'),
  fresh('pinwheel', 'Espiral de polvo binaria', 'Estrellas', '✺', '#f2b4a0', 'Arrastra la compañera para cambiar la separación y el giro del molinete.'),
  fresh('butterfly', 'Nebulosa mariposa', 'Estrellas', '⋈', '#c5a6f3', 'Estira los extremos de los lóbulos; los cometas ondulan sus bordes.'),
  fresh('bow', 'Onda de proa', 'Estrellas', '⌒', '#83e5e3', 'Arrastra la estrella: su velocidad curva el frente y empuja el gas cercano.'),
  fresh('web', 'Red cósmica', 'Estructuras', '⌘', '#8fd4fa', 'Mueve los nudos para deformar la red. Los impactos envían pulsos por sus ramas.'),
  fresh('swarm', 'Enjambre orbital', 'Estructuras', '⠿', '#bce5dd', 'Mueve la guía con suavidad para reunir satélites; un giro brusco los dispersa.'),
  fresh('dyson', 'Esfera de Dyson', 'Estructuras', '⊛', '#f5d88d', 'Pulsa los sectores para abrir colectores. Gira el tirador para dirigir la energía acumulada.'),
  fresh('engine', 'Motor estelar', 'Estructuras', '☀', '#ffbb88', 'Gira el reflector: la estrella cambia lentamente de rumbo y arrastra el gas.'),
  fresh('elevator', 'Ascensor orbital', 'Estructuras', '↥', '#a5d4ed', 'Arrastra la estación; el cable vibra mientras transporta cargas luminosas.'),
  fresh('vortex', 'Vórtice toroidal', 'Estructuras', '⊚', '#b6a3fc', 'Aprieta el tirador hacia el centro y suelta para liberar una corriente.'),
];
