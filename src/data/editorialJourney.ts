import type { AstroChapter } from '../types';

type EditorialChapter = {
  id: string;
  visualFrom?: string;
  title: string;
  question: string;
  summary: string;
  groups: NonNullable<AstroChapter['groups']>;
  foundation?: { title: string; body: string };
};

export const editorialJourney: EditorialChapter[] = [
  {
    id: 'intro', title: 'Introducción',
    question: '¿Qué significa construir a escala cósmica?',
    summary: 'Una estación y una civilización que transforma estrellas comparten una pregunta: qué parte de su entorno podrían aprender a construir. Los capítulos reúnen todos los temas en grupos abiertos: puedes seguir su orden, pasar de una lectura a la siguiente o entrar directamente en la que te interese.',
    groups: [{ title: 'La ingeniería como paisaje', conceptIds: ['astroingenieria'] }],
  },
  {
    id: 'habitats', title: 'Hábitats espaciales',
    question: '¿Podemos construir un lugar donde vivir?',
    summary: 'Las estaciones actuales muestran qué exige vivir fuera de la Tierra. La gravedad artificial y el soporte vital permiten después comprender distintas arquitecturas habitables, desde una esfera o un toro hasta un cilindro, un anillo o el interior de un asteroide.',
    groups: [
      { title: 'Vivir fuera de la Tierra', conceptIds: ['iss', 'artificial-gravity', 'life-support'] },
      { title: 'Arquitecturas habitables', conceptIds: ['bernal-sphere', 'stanford-torus', 'oneill-cylinder', 'bishop-ring', 'mckendree-cylinder', 'asteroid-habitat'] },
      { title: 'Hábitats en la ciencia ficción', conceptIds: ['ringworld'] },
    ],
    foundation: {
      title: 'Un hogar necesita protección y mantenimiento',
      body: 'La forma del hábitat no basta. Su envolvente debe conservar el aire, limitar la exposición a radiación y proteger de impactos. Filtros, bombas y estructuras necesitan inspección y reparación: cerrar el ciclo del agua no elimina la necesidad de repuestos.',
    },
  },
  {
    id: 'infrastructure', title: 'Industria espacial',
    question: '¿De dónde salen los materiales y las máquinas?',
    summary: 'Lanzamientos, puertos y depósitos conectan la Tierra con una posible industria espacial. Las bases, la extracción de recursos y los astilleros muestran cómo construir allí; los grandes sistemas de transporte y la organización social completan esa red.',
    groups: [
      { title: 'Acceso y logística orbital', conceptIds: ['reusable-launch', 'orbital-ports', 'fuel-depots'] },
      { title: 'Recursos y fabricación', conceptIds: ['lunar-bases', 'isru', 'asteroid-mining', 'shipyards'] },
      { title: 'Grandes sistemas de transporte', conceptIds: ['space-elevator', 'tethers', 'skyhook', 'orbital-ring', 'launch-loop', 'mass-driver'] },
      { title: 'Organización de la actividad espacial', conceptIds: ['space-law'] },
    ],
    foundation: {
      title: 'Estar cerca no significa compartir una órbita',
      body: 'Una órbita es una trayectoria de caída alrededor de un cuerpo. Para encontrarse con un puerto no basta con alcanzar su altura: hay que ajustar trayectoria y velocidad. Combustible, depósitos y sistemas que intercambian movimiento convierten puntos del espacio en una red de transporte.',
    },
  },
  {
    id: 'planetary', title: 'Ingeniería planetaria',
    question: '¿Adaptarnos a un mundo o modificarlo?',
    summary: 'Conocer otros planetas y las condiciones de la vida permite distinguir entre construir un ambiente local y transformar un mundo entero. Marte y Venus concretan esas alternativas; el control de la luz, los materiales y la atmósfera conduce también a preguntas sobre biología y protección planetaria.',
    groups: [
      { title: 'Mundos y condiciones para la vida', conceptIds: ['exoplanets', 'astrobiology', 'habitable-zone', 'habitability'] },
      { title: 'Construir ambientes locales', conceptIds: ['paraterraforming', 'domed-cities', 'worldhouse'] },
      { title: 'Terraformación y alternativas planetarias', conceptIds: ['terraforming', 'mars-terraforming', 'venus-terraforming', 'floating-venus'] },
      { title: 'Intervenir sobre luz, atmósfera y materiales', conceptIds: ['orbital-mirrors', 'sunshades', 'volatile-import', 'magnetosphere'] },
      { title: 'Biología y protección planetaria', conceptIds: ['ecopoiesis', 'planetary-protection'] },
    ],
  },
  {
    id: 'energy', title: 'Energía estelar',
    question: '¿Cómo alimentar proyectos de esta escala?',
    summary: 'Captar luz, transportar energía y expulsar calor son partes de un mismo sistema. Desde la energía solar espacial, el capítulo avanza hasta las estructuras Dyson y compara las formas y los límites de aprovechar la radiación de una estrella.',
    groups: [
      { title: 'Captación, transmisión y calor', conceptIds: ['space-based-solar', 'microwave-power', 'radiators'] },
      { title: 'Estructuras Dyson', conceptIds: ['dyson-swarm', 'dyson-ring', 'dyson-bubble', 'dyson-shell'] },
    ],
  },
  {
    id: 'propulsion', title: 'Viaje interestelar',
    question: '¿Cómo llegar, frenar y sobrevivir al viaje?',
    summary: 'Los motores químicos, eléctricos y nucleares, junto con las velas y los haces de energía, ofrecen distintas formas de mover una nave. Las distancias interestelares añaden el problema de frenar y sostener una comunidad durante el viaje; las propuestas más especulativas permiten examinar los límites de esas ideas.',
    groups: [
      { title: 'Propulsión química', conceptIds: ['chemical-rockets'] },
      { title: 'Propulsión eléctrica', conceptIds: ['ion-engines', 'hall-thruster', 'solar-electric', 'nuclear-electric'] },
      { title: 'Propulsión nuclear y fuentes extremas', conceptIds: ['nuclear-thermal', 'project-orion', 'fusion-propulsion', 'antimatter', 'bussard-ramjet'] },
      { title: 'Velas y haces de energía', conceptIds: ['solar-sail', 'laser-sail', 'beamed-propulsion', 'magnetic-sail', 'electric-sail'] },
      { title: 'El viaje interestelar', conceptIds: ['relativistic-propulsion', 'interstellar-braking', 'worldship'] },
      { title: 'Propuestas especulativas y límites físicos', description: 'Estas lecturas examinan límites y propuestas de distinto respaldo. Un modelo matemático o una idea sugerente no demuestra la existencia de un motor realizable.', conceptIds: ['alcubierre', 'wormholes', 'reactionless'] },
    ],
    foundation: {
      title: 'Acelerar es solo una parte del viaje',
      body: 'El empuje cambia el movimiento de una nave al expulsar materia o interactuar con algo externo, como un haz de luz. Disponer de mucha energía no garantiza un gran empuje. Llegar a otro sistema exige además reducir la velocidad: el diseño del viaje debe incluir ese frenado desde el principio.',
    },
  },
  {
    id: 'stellar', title: 'Ingeniería estelar',
    question: '¿Podríamos intervenir sobre nuestro propio Sol?',
    summary: 'Entender una estrella como sistema físico abre preguntas sobre su movimiento, su materia y su evolución. Los motores estelares, la extracción y el procesamiento de plasma, y la ingeniería con agujeros negros exploran intervenciones muy alejadas de nuestra capacidad actual.',
    groups: [
      { title: 'Física y movimiento estelar', conceptIds: ['stellar-physics', 'stellar-engines', 'shkadov', 'caplan', 'stellar-navigation'] },
      { title: 'Materia y evolución estelar', conceptIds: ['star-lifting', 'plasma-processing', 'stellar-husbandry'] },
      { title: 'Ingeniería con agujeros negros', conceptIds: ['black-hole-engineering'] },
    ],
  },
  {
    id: 'civilizations', title: 'Civilizaciones cósmicas',
    question: '¿Qué formas de existencia permitiría todo esto?',
    summary: 'Las escalas de energía, la computación y las posibles formas de existencia plantean qué podría llegar a ser una civilización. Su expansión introduce distancias, tiempos de comunicación y decisiones colectivas que adquieren otra dimensión frente al futuro del universo.',
    groups: [
      { title: 'Escalas de actividad', conceptIds: ['kardashev', 'tipo-i', 'tipo-ii', 'tipo-iii'] },
      { title: 'Computación y otras formas de existencia', conceptIds: ['computronium', 'jupiter-brain', 'matrioshka-brain', 'civilizaciones-digitales', 'postbiological'] },
      { title: 'Expansión y comunicación', conceptIds: ['von-neumann', 'colonizacion-galactica', 'civilizaciones-y-luz'] },
      { title: 'Tiempo profundo y decisiones', conceptIds: ['deep-time', 'future-universe', 'cosmic-ethics'] },
    ],
  },
  {
    id: 'search', visualFrom: 'civilizations', title: 'Inteligencia extraterrestre',
    question: '¿Cómo reconoceríamos a quienes ya lo hicieron?',
    summary: 'La búsqueda de otras tecnologías conecta señales observables con los instrumentos y métodos para detectarlas. La paradoja de Fermi reúne después las preguntas sobre el silencio cósmico y las distintas hipótesis propuestas para interpretarlo.',
    groups: [
      { title: 'Señales y métodos de búsqueda', conceptIds: ['seti', 'technosignatures', 'radio-seti', 'optical-seti', 'stellar-technosignatures'] },
      { title: 'Fermi e interpretaciones del silencio', description: 'Escenarios para discutir supuestos y observaciones; ninguno debe leerse como una explicación confirmada del silencio cósmico.', conceptIds: ['fermi', 'great-filter', 'zoo-hypothesis', 'dark-forest', 'grabby-aliens', 'civilizaciones-silenciosas', 'berserker'] },
    ],
  },
];

/** Catalog names only: article titles and existing asset descriptions stay intact. */
const conceptTitles: Record<string, string> = {
  'bernal-sphere': 'Esfera de Bernal',
  'stanford-torus': 'Toro de Stanford',
  'bishop-ring': 'Anillo de Bishop',
  'mckendree-cylinder': 'Cilindro de McKendree',
  worldship: 'Naves generacionales',
  isru: 'Uso de recursos locales (ISRU)',
  tethers: 'Cables espaciales (tethers)',
  skyhook: 'Gancho orbital (skyhook)',
  'launch-loop': 'Bucle de lanzamiento (launch loop)',
  'mass-driver': 'Catapulta electromagnética (mass driver)',
  'dyson-swarm': 'Enjambre de Dyson',
  'dyson-ring': 'Anillo y red de Dyson',
  'dyson-bubble': 'Burbuja de Dyson y satélites suspendidos (statites)',
  'dyson-shell': 'Esfera rígida de Dyson',
  'matrioshka-brain': 'Cerebro Matrioshka',
  'jupiter-brain': 'Cerebro Júpiter',
  'hall-thruster': 'Motores Hall',
  'magnetic-sail': 'Velas magnéticas',
  'electric-sail': 'Velas eléctricas',
  'project-orion': 'Proyecto Orión',
  'bussard-ramjet': 'Estatorreactor de Bussard',
  'relativistic-propulsion': 'Propulsión relativista',
  alcubierre: 'Propulsión de Alcubierre',
  wormholes: 'Agujeros de gusano',
  reactionless: 'Motores sin reacción',
  worldhouse: 'Cubierta planetaria (worldhouse)',
  'stellar-engines': 'Motores estelares',
  shkadov: 'Motor de Shkadov',
  caplan: 'Motor de Caplan',
  'star-lifting': 'Extracción de materia estelar (star lifting)',
  'stellar-husbandry': 'Gestión de la evolución estelar',
  'radio-seti': 'SETI por radio',
  'optical-seti': 'SETI óptico',
  'great-filter': 'Gran filtro',
  'grabby-aliens': 'Civilizaciones expansivas (grabby aliens)',
  berserker: 'Sondas destructoras (berserker)',
};

/** Reassign editorial membership without regenerating assets or moving article files. */
export function organizeChapters(catalog: AstroChapter[]): AstroChapter[] {
  const concepts = new Map(catalog.flatMap(chapter => chapter.concepts).map(item => [item.id, item]));
  const assigned = new Set<string>();
  const result = editorialJourney.map((entry, index) => {
    const original = catalog.find(chapter => chapter.id === (entry.visualFrom ?? entry.id));
    if (!original) throw new Error(`Missing chapter resources: ${entry.id}`);
    const ids = entry.groups.flatMap(group => group.conceptIds);
    const members = ids.map(id => {
      const concept = concepts.get(id);
      if (!concept || assigned.has(id)) throw new Error(`Missing or duplicate editorial concept: ${id}`);
      assigned.add(id);
      return { ...concept, chapterId: entry.id, title: conceptTitles[id] ?? concept.title };
    });
    return {
      ...original,
      id: entry.id, number: String(index), title: entry.title, question: entry.question,
      summary: entry.summary, groups: entry.groups,
      sections: entry.foundation ? [{ title: entry.foundation.title, body: entry.foundation.body }] : [],
      concepts: members,
      sources: [...new Map(members.flatMap(concept => [
        ...(concept.sources ?? []),
        ...(catalog.find(chapter => chapter.id === concept.sourceChapterId)?.sources ?? []),
      ]).map(source => [source.url, source])).values()],
    };
  });
  if (assigned.size !== concepts.size) throw new Error('Editorial journey has orphaned concepts');
  return result;
}
