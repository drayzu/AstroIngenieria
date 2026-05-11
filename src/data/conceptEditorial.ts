import type {
  AstroConcept,
  AstroScale,
  ConceptDossierItem,
  ConceptDossierSection,
  ConceptNarrative,
  ConceptReadingSection,
  DossierEvidence,
  Plausibility,
  SourceRef,
} from '../types';
import { createConceptLongRead } from './conceptLongReads';

type ConceptEditorialInput = Pick<
  AstroConcept,
  | 'id'
  | 'chapterId'
  | 'title'
  | 'category'
  | 'scale'
  | 'plausibility'
  | 'summary'
  | 'keyIdea'
  | 'mentalImage'
  | 'mechanism'
  | 'advantages'
  | 'difficulties'
  | 'metrics'
  | 'visualNotes'
> & {
  sources?: SourceRef[];
};

const scaleLabels: Record<AstroScale, string> = {
  nave: 'nave',
  habitat: 'hábitat',
  orbital: 'infraestructura orbital',
  planetaria: 'ingeniería planetaria',
  estelar: 'escala estelar',
  galactica: 'escala galáctica',
};

const scaleDescriptions: Record<AstroScale, string> = {
  nave: 'opera desde el tamaño de una nave o sistema de vuelo, donde cada kilogramo y cada watt cambian el diseño.',
  habitat: 'intenta convertir una estructura cerrada en un lugar vivible, con aire, luz, protección y algún tipo de gravedad o sustituto.',
  orbital: 'pertenece a la red de puertos, rutas, estaciones y maquinaria que permite trabajar fuera de la superficie de un planeta.',
  planetaria: 'interviene mundos completos o regiones de mundos, por lo que mezcla clima, geología, biología, energía y política.',
  estelar: 'trabaja con luz, calor, plasma o movimiento alrededor de una estrella, una escala donde la termodinámica domina el relato.',
  galactica: 'aparece cuando una civilización piensa en miles de años, muchas estrellas y señales que podrían cruzar una galaxia entera.',
};

const plausibilityDescriptions: Record<Plausibility, string> = {
  actual: 'Existe hoy como tecnología, ciencia o fenómeno observado, aunque su versión futura pueda crecer mucho más.',
  plausible: 'No exige romper la física conocida, pero sí requiere industria, coordinación y madurez técnica muy superiores a las actuales.',
  frontera: 'Está en el borde de lo imaginable con ciencia conocida: depende de materiales, energía, control o economía todavía no disponibles.',
  especulativo: 'Funciona como herramienta para pensar límites, riesgos y posibilidades, más que como proyecto de ingeniería listo para ejecutarse.',
};

const metricDescriptions: Record<keyof AstroConcept['metrics'], string> = {
  energia: 'energía necesaria o gestionada',
  materiales: 'masa, fabricación y materiales',
  madurez: 'madurez tecnológica',
  maravilla: 'potencia visual y capacidad de asombro',
};

const readingSection = (id: string, title: string, body: string | string[]): ConceptReadingSection => ({
  id,
  title,
  body: Array.isArray(body) ? body : [body],
});

type ReadingStyle = {
  title: (concept: ConceptEditorialInput) => string;
  lead: (concept: ConceptEditorialInput) => string;
  firstImage: (concept: ConceptEditorialInput) => string | string[];
  form: (concept: ConceptEditorialInput) => string | string[];
  operation: (concept: ConceptEditorialInput) => string | string[];
  importance: (concept: ConceptEditorialInput) => string | string[];
  requirements: (concept: ConceptEditorialInput) => string | string[];
  limits: (concept: ConceptEditorialInput) => string | string[];
  closing: (concept: ConceptEditorialInput) => string;
};

const capabilityPressure = (concept: ConceptEditorialInput) => {
  const needs = [
    concept.metrics.energia >= 4 ? 'energía abundante y bien controlada' : null,
    concept.metrics.materiales >= 4 ? 'fabricación y materiales de gran escala' : null,
    concept.metrics.madurez <= 2 ? 'automatización robusta y pruebas graduales' : null,
    concept.metrics.maravilla >= 5 ? 'una cultura capaz de sostener proyectos de largo aliento' : null,
  ].filter((item): item is string => Boolean(item));

  return needs.length > 0
    ? `${listAsText(needs)}`
    : 'Operaciones sostenidas, mantenimiento, redundancia y una economía capaz de repetir el sistema sin depender de misiones únicas.';
};

const readingStyles: Record<string, ReadingStyle> = {
  intro: {
    title: (concept) => `${concept.title}: el mapa antes del viaje`,
    lead: (concept) =>
      `${sentence(concept.summary)} Aquí el valor está en ordenar la imaginación: convertir una palabra enorme en una herramienta para pensar escalas, límites y posibilidades.`,
    firstImage: (concept) =>
      `${concept.mentalImage} La escena sirve como puerta de entrada: no muestra una sola máquina, sino la forma en que una civilización empieza a medir su futuro con planetas, estrellas y tiempo profundo.`,
    form: (concept) => [
      `Como marco, ${concept.title} se ve menos como un objeto y más como un mapa mental. Reúne vocabulario, escalas, tecnologías y preguntas que luego aparecen repartidas en hábitats, energía, propulsión, planetas y civilizaciones.`,
      `Su estructura práctica es comparativa: permite mirar conceptos muy distintos con la misma pregunta de fondo, qué exige, qué resuelve y qué revela sobre la relación entre humanidad y cosmos.`,
    ],
    operation: (concept) =>
      `${sentence(concept.mechanism)} Funciona como una lente: separa lo que ya existe, lo que parece plausible, lo que vive en la frontera y lo que sirve como experimento mental.`,
    importance: (concept) =>
      `${sentence(concept.keyIdea)} Importa porque evita que el atlas sea solo una colección de ideas espectaculares; lo convierte en una progresión donde cada concepto prepara el siguiente.`,
    requirements: (concept) =>
      `Para usarlo bien harían falta pensamiento crítico, comparación entre escalas, lectura de fuentes y una disciplina básica: distinguir posibilidad física, ingeniería disponible, economía y narrativa. ${capabilityPressure(concept)}`,
    limits: (concept) =>
      `${listAsText(concept.difficulties)} Su mayor riesgo es dar una falsa sensación de certeza: un mapa conceptual ayuda a orientarse, pero no reemplaza la física, los datos ni las decisiones sociales.`,
    closing: (concept) =>
      `${concept.title} prepara la mirada: antes de imaginar mundos artificiales, hay que aprender a leer las escalas que los harían posibles.`,
  },
  habitats: {
    title: (concept) => `${concept.title}: arquitectura para respirar en el vacío`,
    lead: (concept) =>
      `${sentence(concept.summary)} La pregunta no es solo cómo se construiría, sino cómo se sentiría vivir dentro de una estructura que debe fabricar suelo, aire, luz y rutina.`,
    firstImage: (concept) =>
      `${concept.mentalImage} En un hábitat, la primera imagen siempre tiene dos capas: la belleza exterior de la estructura y la fragilidad interior de todo lo que permite que alguien despierte, trabaje y vuelva a dormir lejos de la Tierra.`,
    form: (concept) => [
      `${concept.title} se imaginaría como un entorno habitable antes que como una simple pieza de maquinaria. Como ${concept.category.toLocaleLowerCase('es')}, necesitaría volumen presurizado, zonas de servicio, circulación, almacenamiento, energía, radiadores y espacios donde la escala humana no se pierda dentro de la ingeniería.`,
      `La vida diaria dependería de detalles poco heroicos: iluminación, ruido, mantenimiento, reciclaje, zonas comunes, alimentos, privacidad y la sensación de tener un suelo confiable bajo los pies, incluso cuando todo el sistema está rodeado por vacío.`,
    ],
    operation: (concept) =>
      `${sentence(concept.mechanism)} La plausibilidad aparece al conectar estructura, presión, control térmico, soporte vital y protección contra radiación; no basta con que la forma sea hermosa, debe comportarse como una ecología técnica estable.`,
    importance: (concept) =>
      `${sentence(concept.keyIdea)} Importa porque transforma la exploración en permanencia: permite pasar de visitar el espacio a construir lugares donde comunidades completas podrían desarrollar una vida continua.`,
    requirements: (concept) =>
      `Harían falta ensamblaje espacial, soporte vital regenerativo, blindaje, control de calor, repuestos, robótica de mantenimiento y una logística capaz de sostener años de operación. ${capabilityPressure(concept)} Las cifras del atlas aquí son comparativas y aproximadas, no presupuestos reales.`,
    limits: (concept) =>
      `${listAsText(concept.difficulties)} Además, cualquier hábitat concentra riesgo: una fuga, una falla ecológica o una cadena de mantenimiento rota puede convertir una arquitectura brillante en un sistema vulnerable.`,
    closing: (concept) =>
      `${concept.title} interesa porque convierte una pregunta abstracta en una escena concreta: cómo se diseña un lugar donde el espacio deje de ser solo exterior.`,
  },
  infrastructure: {
    title: (concept) => `${concept.title}: la logística que vuelve normal al espacio`,
    lead: (concept) =>
      `${sentence(concept.summary)} Es el tipo de concepto que parece menos romántico que una nave o un hábitat, pero sin él casi nada del resto podría sostenerse.`,
    firstImage: (concept) =>
      `${concept.mentalImage} La escena tiene algo industrial: rutas, nodos, vehículos, depósitos, anclajes o superficies de trabajo que convierten el espacio en un lugar con continuidad operativa.`,
    form: (concept) => [
      `${concept.title} se vería como parte de una red. Como ${concept.category.toLocaleLowerCase('es')}, no funcionaría aislado, sino conectado a lanzamientos, puertos, talleres, recursos locales, estaciones, rutas lunares o tráfico orbital.`,
      `Su diseño tendría que ser repetible y mantenible: interfaces claras, accesos para robots o tripulaciones, margen para fallos, control de tráfico y piezas que puedan cambiarse sin reinventar la misión completa.`,
    ],
    operation: (concept) =>
      `${sentence(concept.mechanism)} La física importante suele estar en órbitas, transferencia de momento, almacenamiento, acoplamiento, energía y mantenimiento: menos espectáculo inmediato, más continuidad.`,
    importance: (concept) =>
      `${sentence(concept.keyIdea)} Importa porque una civilización espacial no nace de misiones únicas, sino de sistemas que permiten llegar, reparar, repostar, construir y volver a intentarlo.`,
    requirements: (concept) =>
      `Harían falta cadencia de lanzamiento, estándares de acoplamiento, automatización, vigilancia orbital, energía disponible y mercados o misiones que justifiquen operar de forma rutinaria. ${capabilityPressure(concept)}`,
    limits: (concept) =>
      `${listAsText(concept.difficulties)} El límite de fondo es económico y operacional: si no hay tráfico suficiente, una infraestructura espacial se vuelve una obra aislada en vez de una red viva.`,
    closing: (concept) =>
      `${concept.title} es interesante porque cambia el verbo principal del espacio: de lanzar a operar.`,
  },
  energy: {
    title: (concept) => `${concept.title}: energía, calor y escala`,
    lead: (concept) =>
      `${sentence(concept.summary)} La belleza de estos conceptos está en que la energía deja de ser fondo invisible y se vuelve arquitectura visible.`,
    firstImage: (concept) =>
      `${concept.mentalImage} La escena no solo habla de potencia: habla de luz capturada, calor expulsado y sistemas que deben obedecer a la termodinámica incluso cuando parecen enormes.`,
    form: (concept) => [
      `${concept.title} se vería como una combinación de superficies activas, colectores, emisores, radiadores, transmisores o sustratos de cómputo, según su papel como ${concept.category.toLocaleLowerCase('es')}. Cada parte tendría una función: interceptar energía, moverla, usarla o deshacerse del calor residual.`,
      `A gran escala, su forma final sería menos un edificio y más un paisaje térmico. La geometría estaría dictada por órbitas, orientación, sombras, disipación y mantenimiento.`,
    ],
    operation: (concept) =>
      `${sentence(concept.mechanism)} La regla esencial es simple: toda energía útil termina degradándose en calor, así que los radiadores, la emisión infrarroja y la gestión térmica son parte central del concepto.`,
    importance: (concept) =>
      `${sentence(concept.keyIdea)} Importa porque casi toda astroingeniería ambiciosa tiene un cuello de botella energético: construir, vivir, viajar, computar o modificar mundos exige flujos de potencia estables.`,
    requirements: (concept) =>
      `Harían falta colectores eficientes, materiales resistentes a radiación, control orbital, transmisión segura, mantenimiento autónomo y diseño térmico desde el primer día. ${capabilityPressure(concept)} Cuando el atlas habla de dificultad energética, lo hace como estimación aproximada comparativa.`,
    limits: (concept) =>
      `${listAsText(concept.difficulties)} También hay un límite inevitable: capturar más energía hace más visible el problema de disipar calor y coordinar infraestructura.`,
    closing: (concept) =>
      `${concept.title} recuerda que una civilización avanzada no solo consume energía: aprende a darle forma.`,
  },
  propulsion: {
    title: (concept) => `${concept.title}: mover masa contra el abismo`,
    lead: (concept) =>
      `${sentence(concept.summary)} En propulsión, la narración siempre empieza con una restricción brutal: para ir más lejos hay que pagar con energía, masa de reacción, tiempo o infraestructura externa.`,
    firstImage: (concept) =>
      `${concept.mentalImage} La imagen importa porque una nave no es solo una flecha; es un balance delicado entre motor, combustible, radiadores, estructura, tripulación o carga y el destino que intenta alcanzar.`,
    form: (concept) => [
      `${concept.title} se vería como una arquitectura dominada por el sistema de empuje. Su categoría de ${concept.category.toLocaleLowerCase('es')} marcaría la silueta: tanques, toberas, campos, velas, reactores, radiadores o superficies reflectantes antes que cualquier gesto decorativo.`,
      `La experiencia de usarlo dependería de la misión: salir de un pozo gravitatorio, maniobrar durante meses, cruzar el sistema solar o intentar que una carga sobreviva a velocidades interestelares.`,
    ],
    operation: (concept) =>
      `${sentence(concept.mechanism)} Lo técnico se concentra en impulso, eficiencia, potencia, masa de reacción, calor y control: cada mejora suele desplazar el problema a otra parte de la nave.`,
    importance: (concept) =>
      `${sentence(concept.keyIdea)} Importa porque la distancia espacial no se resuelve solo con mapas. Sin propulsión adecuada, los recursos, hábitats y mundos del atlas quedan separados por tiempos impracticables.`,
    requirements: (concept) =>
      `Harían falta motores fiables, fuentes de energía compatibles, materiales que resistan temperatura y radiación, navegación precisa y arquitectura de misión honesta sobre tiempos de viaje. ${capabilityPressure(concept)}`,
    limits: (concept) =>
      `${listAsText(concept.difficulties)} El límite recurrente es que no hay impulso gratis: incluso las ideas más elegantes deben cerrar cuentas de energía, momento, calor y seguridad.`,
    closing: (concept) =>
      `${concept.title} importa porque traduce el deseo de viajar en una pregunta de ingeniería: qué estamos dispuestos a cargar para cambiar de mundo.`,
  },
  planetary: {
    title: (concept) => `${concept.title}: diseñar condiciones para un mundo`,
    lead: (concept) =>
      `${sentence(concept.summary)} Aquí la unidad de diseño no es una nave ni una estación, sino un ambiente completo: atmósfera, suelo, luz, clima, biología y riesgo.`,
    firstImage: (concept) =>
      `${concept.mentalImage} La imagen es poderosa porque mezcla paisaje y maquinaria: un mundo que no se vuelve habitable por magia, sino por intervenciones lentas, medibles y muchas veces irreversibles.`,
    form: (concept) => [
      `${concept.title} se vería como una capa de sistemas superpuesta al planeta o región objetivo. Según su categoría de ${concept.category.toLocaleLowerCase('es')}, podría tomar la forma de domos, espejos, fábricas atmosféricas, blindajes, sensores, reservas de volátiles, laboratorios biológicos o ciudades cerradas.`,
      `La escala humana aparecería en los bordes: esclusas, cultivos, trajes, asentamientos, normas de contaminación y la tensión entre vivir dentro de refugios y modificar el exterior.`,
    ],
    operation: (concept) =>
      `${sentence(concept.mechanism)} La plausibilidad depende de balances lentos: energía, química atmosférica, presión, temperatura, radiación, ciclos de agua y compatibilidad con cualquier biosfera posible.`,
    importance: (concept) =>
      `${sentence(concept.keyIdea)} Importa porque pregunta si la humanidad debe adaptarse a mundos hostiles, transformar esos mundos o aprender a habitar parcialmente sin borrar lo que podría existir allí.`,
    requirements: (concept) =>
      `Harían falta conocimiento geológico y atmosférico, energía sostenida, protección biológica, infraestructura de superficie, monitoreo de largo plazo y reglas éticas claras. ${capabilityPressure(concept)}`,
    limits: (concept) =>
      `${listAsText(concept.difficulties)} El límite más delicado es la irreversibilidad: cambiar un ambiente planetario puede resolver una necesidad humana y al mismo tiempo destruir información científica o posibilidades de vida local.`,
    closing: (concept) =>
      `${concept.title} obliga a mirar un planeta no como escenario pasivo, sino como un sistema que responde.`,
  },
  stellar: {
    title: (concept) => `${concept.title}: ingeniería frente a una estrella`,
    lead: (concept) =>
      `${sentence(concept.summary)} En esta escala, la ingeniería deja de parecer construcción tradicional y empieza a parecer negociación con plasma, gravedad, radiación y tiempo estelar.`,
    firstImage: (concept) =>
      `${concept.mentalImage} La escena es extrema porque todo ocurre cerca de fuentes de energía inmensas: cualquier estructura debe sobrevivir a luz, partículas, calor y fuerzas que hacen pequeña a la tecnología humana.`,
    form: (concept) => [
      `${concept.title} se vería como infraestructura desplegada alrededor o cerca de una estrella. Como ${concept.category.toLocaleLowerCase('es')}, podría usar espejos, colectores, campos magnéticos, plataformas, radiadores, motores, estaciones de observación o sistemas de extracción de plasma.`,
      `La forma estaría dictada por distancia, orientación, disipación térmica y estabilidad orbital. Nada podría tratarse como permanente sin mantenimiento y control continuo.`,
    ],
    operation: (concept) =>
      `${sentence(concept.mechanism)} La física dominante es estelar: radiación, viento solar, magnetismo, masa, momento y calor residual marcan lo que una civilización podría intentar sin romper las reglas conocidas.`,
    importance: (concept) =>
      `${sentence(concept.keyIdea)} Importa porque muestra el salto entre usar una estrella como fuente pasiva de luz y tratarla como sistema físico manipulable.`,
    requirements: (concept) =>
      `Harían falta materiales resistentes, control remoto o autónomo, energía abundante, modelos estelares precisos, radiadores enormes y tolerancia a proyectos que se miden en generaciones. ${capabilityPressure(concept)}`,
    limits: (concept) =>
      `${listAsText(concept.difficulties)} El límite central es la escala: cerca de una estrella, los errores no son pequeños y el calor no perdona narrativas elegantes.`,
    closing: (concept) =>
      `${concept.title} convierte una estrella en algo más inquietante que un sol: un sistema que quizá podría ser administrado.`,
  },
  civilizations: {
    title: (concept) => `${concept.title}: leer civilizaciones en escala cósmica`,
    lead: (concept) =>
      `${sentence(concept.summary)} Estos conceptos importan porque cambian la pregunta: no solo qué puede construir una civilización, sino cuánto dura, cuánto se deja ver y qué decide no hacer.`,
    firstImage: (concept) =>
      `${concept.mentalImage} Es una escena menos mecánica y más inquietante: estrellas, señales, silencios, expansiones o decisiones que se vuelven visibles solo cuando pensamos en tiempo profundo.`,
    form: (concept) => [
      `Como ${concept.category.toLocaleLowerCase('es')}, ${concept.title} no siempre tendría forma de estructura. A veces sería una señal, una ausencia, una estrategia, una frontera ética o un patrón estadístico repartido por muchas estrellas.`,
      `Su escala humana aparece por contraste: nuestras decisiones locales sobre energía, comunicación, riesgo y expansión se vuelven pequeñas, pero no irrelevantes, cuando se proyectan a miles o millones de años.`,
    ],
    operation: (concept) =>
      `${sentence(concept.mechanism)} Funciona como modelo para pensar detectabilidad, comunicación, expansión, supervivencia y sesgos de observación; no ofrece una respuesta cerrada, sino un marco para hacer mejores preguntas.`,
    importance: (concept) =>
      `${sentence(concept.keyIdea)} Importa porque conecta astroingeniería con destino civilizatorio: energía, tecnología y tiempo no dicen nada por sí solos sin decisiones, valores y riesgos.`,
    requirements: (concept) =>
      `Harían falta observaciones amplias, modelos prudentes, búsqueda de tecnofirmas, teoría de riesgos y una separación clara entre evidencia, hipótesis y deseo narrativo. ${capabilityPressure(concept)}`,
    limits: (concept) =>
      `${listAsText(concept.difficulties)} El límite principal es la incertidumbre: una galaxia silenciosa puede significar ausencia, baja detectabilidad, mala búsqueda, prudencia o peligros que todavía no entendemos.`,
    closing: (concept) =>
      `${concept.title} hace que el atlas mire hacia afuera y hacia adentro al mismo tiempo: al cosmos, y a la clase de civilización que podríamos llegar a ser.`,
  },
  complements: {
    title: (concept) => `${concept.title}: el contexto que sostiene el atlas`,
    lead: (concept) =>
      `${sentence(concept.summary)} No todos los conceptos son una máquina; algunos son el suelo científico, social o ético que decide si una máquina debería construirse.`,
    firstImage: (concept) =>
      `${concept.mentalImage} La escena amplía el foco: muestra que la astroingeniería no vive sola, sino rodeada por biología, observación, cultura, derecho, ficción y futuro cósmico.`,
    form: (concept) => [
      `${concept.title} se presentaría como una capa de interpretación alrededor de los sistemas técnicos. Como ${concept.category.toLocaleLowerCase('es')}, puede ser un campo científico, un marco legal, una pregunta moral, una tradición imaginativa o una visión de tiempo profundo.`,
      `Su forma práctica aparece en decisiones: qué mundos estudiar antes de tocar, qué señales buscar, qué ficciones ayudan a sentir escala y qué reglas hacen posible convivir con poder tecnológico extremo.`,
    ],
    operation: (concept) =>
      `${sentence(concept.mechanism)} Funciona como soporte del atlas porque da criterios: evidencia, plausibilidad, responsabilidad, comparación y lenguaje común para no confundir asombro con permiso.`,
    importance: (concept) =>
      `${sentence(concept.keyIdea)} Importa porque la astroingeniería sin contexto puede volverse una lista de proyectos enormes; con contexto, se vuelve una conversación sobre mundos, vida y responsabilidad.`,
    requirements: (concept) =>
      `Harían falta investigación interdisciplinaria, fuentes claras, debate público, modelos comparables y cuidado al traducir ideas especulativas en decisiones reales. ${capabilityPressure(concept)}`,
    limits: (concept) =>
      `${listAsText(concept.difficulties)} Su límite está en la ambigüedad: cuanto más amplio es el marco, más necesario es separar ciencia, imaginación, valores y predicción.`,
    closing: (concept) =>
      `${concept.title} mantiene el atlas conectado con una pregunta básica: qué significa construir cuando el escenario es el cosmos.`,
  },
};

const genericReadingStyle: ReadingStyle = {
  title: (concept) => `${concept.title} como escena de astroingeniería`,
  lead: (concept) =>
    `${sentence(concept.summary)} La pregunta interesante no es solo qué es, sino qué tipo de mundo, máquina o civilización nos obliga a imaginar.`,
  firstImage: (concept) =>
    `${concept.mentalImage} Esa imagen funciona porque ${concept.title} no es una palabra aislada del glosario: es una forma de mirar la relación entre tecnología, escala y supervivencia.`,
  form: (concept) =>
    `Como ${scaleLabels[concept.scale]}, ${scaleDescriptions[concept.scale]} En la práctica se leería por su forma, sus zonas activas, sus sistemas de soporte y la manera en que organiza materia, energía y personas alrededor de una función concreta.`,
  operation: (concept) =>
    `El principio central es este: ${sentence(concept.mechanism)} La clave es distinguir la imagen espectacular del mecanismo real que la sostiene: fuerzas, órbitas, calor, materiales, control y mantenimiento.`,
  importance: (concept) =>
    `${sentence(concept.keyIdea)} Resuelve o ilumina un problema de fondo: cómo extender capacidades humanas y tecnológicas más allá de los límites inmediatos de un planeta, una nave o una infraestructura aislada.`,
  requirements: (concept) =>
    `Harían falta avances coordinados en automatización, operaciones sostenidas, diseño redundante y una economía capaz de mantener sistemas durante mucho tiempo. ${capabilityPressure(concept)}`,
  limits: (concept) =>
    `Sus límites principales son claros: ${listAsText(concept.difficulties)} Esa fricción es parte del valor del concepto, porque lo mantiene unido a ingeniería, riesgo y tiempo profundo.`,
  closing: (concept) =>
    `${concept.title} importa porque condensa una posibilidad: ${concept.visualNotes}`,
};

const getReadingStyle = (concept: ConceptEditorialInput): ReadingStyle =>
  readingStyles[concept.chapterId] ?? genericReadingStyle;

const buildDefaultReadingSections = (concept: ConceptEditorialInput): ConceptReadingSection[] => {
  const style = getReadingStyle(concept);

  return [
    readingSection('primera-imagen', 'Primera imagen', style.firstImage(concept)),
    readingSection('como-seria', 'Cómo sería', style.form(concept)),
    readingSection('como-funciona', 'Cómo funciona', style.operation(concept)),
    readingSection('por-que-importaria', 'Por qué importaría', style.importance(concept)),
    readingSection('que-haria-falta', 'Qué haría falta', style.requirements(concept)),
    readingSection('limites', 'Límites', style.limits(concept)),
  ];
};

const narrativeOverrides: Record<string, ConceptNarrative> = {
  iss: {
    title: 'El primer borrador de vivir fuera de la Tierra',
    lead:
      'Antes de imaginar cilindros con ríos en el cielo, hay que mirar esta máquina pequeña, llena de cables, paneles, módulos y rutinas: una estación real orbitando sobre un planeta real.',
    paragraphs: [
      'La Estación Espacial Internacional no parece una ciudad. No tiene parques curvándose hacia el techo ni mares interiores iluminados por espejos. Vista desde lejos, parece una criatura hecha de aluminio, radiadores y alas solares, cruzando la noche terrestre a una velocidad absurda. Pero precisamente por eso importa: no es una promesa lejana, es el primer laboratorio donde aprendimos que vivir en órbita no es una idea poética, sino una lista interminable de problemas físicos.',
      'Dentro, cada cosa que en la Tierra ocurre sin esfuerzo debe ser diseñada. Respirar significa controlar presión, química del aire y dióxido de carbono. Beber significa reciclar agua. Dormir significa sujetarse. Trabajar significa aceptar que una herramienta mal puesta no cae al suelo: flota, se esconde y puede terminar bloqueando un filtro. La estación convierte la vida cotidiana en ingeniería visible.',
      'Su escala es humilde comparada con un cilindro de O Neill, pero su lección es enorme. Un hábitat espacial no empieza con paisajes artificiales; empieza con módulos presurizados, mantenimiento, acoplamientos, energía, radiadores, soporte vital y personas aprendiendo a moverse en un ambiente que no perdona descuidos. La grandeza de una estación actual está en mostrar cuánto cuesta sostener incluso una pequeña burbuja humana sobre la Tierra.',
      'También revela una verdad incómoda: el espacio no se vuelve habitable por entusiasmo. Se vuelve habitable por redundancia, piezas de repuesto, procedimientos, cooperación y logística constante. Cada nave que llega, cada panel que orienta, cada filtro que se cambia, empuja un poco más lejos la frontera entre visitar el espacio y permanecer en él.',
      'Por eso la ISS y estaciones similares son el prólogo necesario de los mundos artificiales. No son el destino final, sino el banco de pruebas donde una civilización aprende el vocabulario básico de sobrevivir fuera de su planeta.',
    ],
    sections: [
      readingSection('primera-imagen', 'Primera imagen', 'Un laboratorio modular cruza la noche terrestre como una ciudad reducida a sus sistemas esenciales: presión, energía, radiadores, acoplamientos, filtros y personas viviendo dentro de una máquina que nunca puede apagarse.'),
      readingSection('como-seria', 'Cómo sería', 'Sería compacta, técnica y densa. Módulos presurizados conectados como túneles, paneles solares extendidos, radiadores para expulsar calor, puertos de acoplamiento y zonas interiores donde cada pared es almacenamiento, laboratorio o soporte vital.'),
      readingSection('como-funciona', 'Cómo funciona', 'Funciona manteniendo una pequeña atmósfera artificial dentro de módulos sellados. La energía llega de paneles solares, el calor se expulsa por radiadores, el aire se controla químicamente, el agua se recicla y las naves visitantes sostienen logística, tripulación y mantenimiento.'),
      readingSection('por-que-importaria', 'Por qué importaría', 'Importa porque demuestra los problemas reales de vivir fuera de la Tierra. Antes de construir hábitats gigantes hay que aprender a sostener una burbuja humana pequeña, reparar fallos, reciclar recursos y operar durante años en microgravedad.'),
      readingSection('que-haria-falta', 'Qué haría falta', 'Para convertir estaciones actuales en hábitats mayores harían falta lanzamientos frecuentes, ensamblaje orbital, soporte vital más cerrado, protección contra radiación, mejores sistemas de mantenimiento y una economía que no dependa de misiones excepcionales.'),
      readingSection('limites', 'Límites', 'No ofrece gravedad artificial, depende de reabastecimiento y exige mantenimiento constante. Su valor no está en ser el destino final, sino en mostrar la lista concreta de obstáculos que cualquier hábitat más ambicioso tendrá que resolver.'),
    ],
    closing:
      'Si los grandes hábitats son futuros continentes, las estaciones actuales son las primeras habitaciones donde aprendimos a cerrar la puerta y respirar.',
  },
  'bernal-sphere': {
    title: 'Una esfera para ensayar un mundo',
    lead:
      'Una Bernal Sphere imagina algo más íntimo que un cilindro gigante: una burbuja habitable, compacta y rotatoria, donde una comunidad entera podría vivir dentro de una arquitectura cerrada.',
    paragraphs: [
      'Desde fuera, una Bernal Sphere podría verse como una perla técnica suspendida en órbita: una envolvente presurizada, espejos, radiadores, anillos de servicio y naves pequeñas entrando por puertos discretos. No intenta parecer un planeta. Su belleza está en ser una primera forma de mundo artificial, lo bastante grande para imaginar vida cotidiana y lo bastante compacta para entender sus partes.',
      'En el interior, la zona habitable se concentraría cerca del ecuador. Allí la rotación daría una sensación de peso, mientras que hacia el eje central la gravedad artificial disminuiría. El paisaje no sería infinito: sería una arquitectura curva, con terrazas, agricultura controlada, barrios densos y luz administrada por espejos o ventanas.',
      'Su física central es la gravedad por rotación. La estructura gira y las personas sienten una aceleración hacia el suelo interior. No es gravedad real producida por masa, sino una forma práctica de crear un entorno donde el cuerpo pueda vivir mejor que en microgravedad continua.',
      'Como concepto, resuelve una pregunta inicial: cómo pasar de estaciones pequeñas a comunidades permanentes. No necesita imaginar continentes cilíndricos ni materiales extremos; sirve como puente entre laboratorio orbital y colonia espacial cerrada.',
      'La dificultad está en que incluso una esfera pequeña sigue siendo una obra industrial enorme. Presurizarla, blindarla, iluminarla, estabilizar su giro, cerrar ciclos de agua y aire, y mantener una ecología funcional convertiría el diseño en una prueba completa de civilización orbital.',
    ],
    sections: [
      readingSection('primera-imagen', 'Primera imagen', 'Imagina una esfera metálica y luminosa sobre la Tierra, con espejos alrededor y una superficie interior donde el suelo se curva suavemente hacia arriba. No es un planeta: es una habitación enorme intentando convertirse en mundo.'),
      readingSection('como-seria', 'Cómo sería', [
        'Su forma principal sería una esfera presurizada. La vida se organizaría cerca del ecuador interno, donde la rotación produce mayor gravedad artificial. Hacia el centro habría zonas de baja gravedad, útiles para transporte, servicios o acoplamiento.',
        'Dentro no habría un horizonte abierto como en un planeta. Habría una geografía compacta: terrazas, cultivos, espacios comunes, barrios pequeños, tuberías, iluminación controlada y una estructura que siempre recuerda al habitante que vive dentro de una máquina cerrada.',
      ]),
      readingSection('como-funciona', 'Cómo funciona', 'La esfera rota para generar aceleración centrípeta. La gente vive pegada a la superficie interior, mientras la estructura, los espejos, los radiadores y el soporte vital mantienen presión, temperatura, luz, agua y aire respirable.'),
      readingSection('por-que-importaria', 'Por qué importaría', 'Importaría porque es una escala inicial razonable para pensar colonias espaciales. Enseña los principios de los hábitats rotatorios sin saltar inmediatamente a megaestructuras continentales.'),
      readingSection('que-haria-falta', 'Qué haría falta', 'Harían falta ensamblaje orbital, materiales estructurales ligeros, blindaje contra radiación, control de vibraciones, soporte vital cerrado, agricultura controlada, energía estable y una logística capaz de mantener la esfera durante años.'),
      readingSection('limites', 'Límites', 'Sus límites son la escala industrial, la distribución irregular de gravedad, el control de luz y calor, el riesgo de fugas, la estabilidad del giro y la complejidad de mantener una biosfera pequeña sin que dependa por completo de la Tierra.'),
    ],
    closing:
      'La Bernal Sphere es poderosa porque no promete un continente en el espacio: promete el primer ensayo serio de una comunidad viviendo dentro de una forma artificial.',
  },
  'dyson-swarm': {
    title: 'Una estrella convertida en infraestructura',
    lead:
      'Un Dyson Swarm no es una cáscara imposible alrededor del Sol; es una multitud de máquinas orbitando una estrella hasta que la luz deja de ser paisaje y se convierte en recurso.',
    paragraphs: [
      'Imagina mirar una estrella y descubrir que ya no brilla sola. A su alrededor hay puntos, velas, paneles, estaciones, fábricas y radiadores, cada uno siguiendo una órbita precisa, cada uno capturando una fracción de luz que antes se perdía en el espacio. No hay una esfera sólida, no hay un muro perfecto: hay una ecología artificial de satélites.',
      'La idea central es simple y brutal. Una estrella emite cantidades enormes de energía durante miles de millones de años. Una civilización que aprende a vivir en el espacio puede empezar con paneles solares, después estaciones de potencia, luego industrias orbitales, y finalmente enjambres enteros. El salto no es mágico; es acumulativo. Se construye como una ciudad que nunca deja de agregar barrios.',
      'Pero capturar energía no es el final de la historia. Toda energía usada termina como calor, y ese calor debe salir por alguna parte. Por eso un Dyson Swarm no solo sería una maravilla de ingeniería: también sería una firma térmica. Desde lejos, una civilización de Tipo II no tendría que enviar un mensaje; su forma de usar una estrella podría alterar cómo esa estrella se ve en el infrarrojo.',
      'Lo fascinante es que el concepto une casi todo el atlas: minería de asteroides, fabricación orbital, transporte, radiadores, computación, hábitats y política energética. Un enjambre así no es una máquina aislada. Es un sistema solar reorganizado alrededor de una pregunta: qué puede hacer una civilización cuando deja de vivir de la energía que cae sobre un planeta y empieza a tomarla directamente de su estrella.',
      'Su dificultad es proporcional a su belleza. Control orbital, colisiones, mantenimiento, materiales, transmisión de energía y disipación térmica convierten el sueño en una operación civilizatoria. Pero como idea, el Dyson Swarm marca un umbral: el momento en que una estrella deja de ser solo cielo.',
    ],
    sections: [
      readingSection('primera-imagen', 'Primera imagen', 'Una estrella rodeada por incontables puntos artificiales: colectores, fábricas, estaciones y radiadores siguiendo órbitas distintas. No hay una cáscara sólida, sino una nube de infraestructura trabajando con luz.'),
      readingSection('como-seria', 'Cómo sería', 'Sería un sistema distribuido. Millones o más unidades podrían ocupar órbitas alrededor de la estrella, algunas capturando energía, otras transmitiéndola, otras fabricando, computando o disipando calor. La forma final sería menos una esfera y más una civilización orbital.'),
      readingSection('como-funciona', 'Cómo funciona', 'Cada colector intercepta una fracción de radiación estelar. Esa energía puede usarse localmente, transmitirse por haces o alimentar industria y computación. Como toda energía termina en calor residual, los radiadores y la emisión infrarroja son tan importantes como los paneles.'),
      readingSection('por-que-importaria', 'Por qué importaría', 'Importaría porque cambia la escala energética de una civilización. En vez de depender de la energía que llega a un planeta, una sociedad podría usar directamente una parte significativa de la producción de su estrella.'),
      readingSection('que-haria-falta', 'Qué haría falta', 'Harían falta minería de asteroides, manufactura autónoma, control orbital masivo, transmisión de energía, mantenimiento robótico, gestión de colisiones y una economía capaz de crecer por etapas durante siglos o milenios.'),
      readingSection('limites', 'Límites', 'Los límites principales son control orbital, materiales, coordinación, colisiones, degradación por radiación, calor residual y detectabilidad. Capturar energía estelar también implica decidir quién controla una infraestructura con poder civilizatorio.'),
    ],
    closing:
      'Un Dyson Swarm es la imagen de una civilización que ya no habita únicamente mundos: habita la luz.',
  },
  fermi: {
    title: 'La pregunta que vuelve extraño al cielo',
    lead:
      'La paradoja de Fermi no empieza con naves extraterrestres; empieza con una incomodidad mucho más silenciosa: el universo parece demasiado grande, demasiado viejo y demasiado fértil para estar tan callado.',
    paragraphs: [
      'Miras una galaxia con cientos de miles de millones de estrellas. Muchas son más antiguas que el Sol. Muchas tienen planetas. Algunas podrían haber tenido millones o miles de millones de años de ventaja. Si incluso una pequeña fracción desarrollara tecnología, expansión o megaestructuras, el cielo debería contener señales difíciles de ignorar. Y sin embargo, no vemos una respuesta clara.',
      'Esa tensión es lo que hace poderosa a la paradoja. No demuestra que estemos solos. Tampoco demuestra que haya civilizaciones ocultas. Lo que hace es obligarnos a ordenar nuestras intuiciones: cuánto tarda la vida en aparecer, cuánto tarda la inteligencia, cuánto dura una civilización tecnológica, cuánto desea expandirse y cuánto deja ver.',
      'La paradoja se vuelve más profunda cuando entra la astroingeniería. Si una civilización puede construir enjambres Dyson, mover estrellas, lanzar sondas autorreplicantes o colonizar sistemas durante millones de años, su ausencia aparente necesita explicación. Tal vez la vida es rara. Tal vez la inteligencia tecnológica es frágil. Tal vez las civilizaciones avanzadas son discretas. Tal vez buscamos las señales equivocadas.',
      'Por eso Fermi no es solo una pregunta sobre extraterrestres; es una pregunta sobre nosotros. Nos obliga a pensar en riesgo existencial, duración cultural, energía, detectabilidad, ética de expansión y límites físicos. Cada respuesta posible cambia la forma en que entendemos nuestro futuro.',
      'Lo inquietante no es el silencio en sí. Lo inquietante es que ese silencio tiene demasiadas explicaciones plausibles, y algunas son esperanzadoras mientras otras son profundamente alarmantes.',
    ],
    sections: [
      readingSection('primera-imagen', 'Primera imagen', 'Una galaxia inmensa, antigua, llena de estrellas, pero sin señales inequívocas. La imagen no es una máquina: es un silencio que parece demasiado grande para ser trivial.'),
      readingSection('como-seria', 'Cómo sería', 'Como concepto, no describe una estructura sino una tensión. Si las civilizaciones tecnológicas pueden expandirse o dejar tecnofirmas, deberíamos esperar algún indicio. La paradoja nace cuando esa expectativa choca con la ausencia de evidencia clara.'),
      readingSection('como-funciona', 'Cómo funciona', 'Funciona como argumento probabilístico: muchas estrellas, mucho tiempo, muchos planetas posibles y tecnologías que podrían volverse visibles. Cada variable puede fallar, y por eso la paradoja abre un abanico de hipótesis.'),
      readingSection('por-que-importaria', 'Por qué importaría', 'Importa porque conecta astronomía con supervivencia. Preguntar dónde están todos también pregunta cuánto duran las civilizaciones, si se autodestruyen, si se esconden, si son raras o si no estamos buscando correctamente.'),
      readingSection('que-haria-falta', 'Qué haría falta', 'Para estudiarla mejor harían falta búsquedas más amplias de tecnofirmas, mejores catálogos de exoplanetas, observación infrarroja, modelos de expansión civilizatoria y cautela para no convertir ausencia de evidencia en conclusión apresurada.'),
      readingSection('limites', 'Límites', 'El límite principal es la incertidumbre. No conocemos la frecuencia de vida, inteligencia, tecnología, duración civilizatoria ni preferencias de expansión. La paradoja es potente precisamente porque no tiene una única respuesta segura.'),
    ],
    closing:
      'La paradoja de Fermi convierte el cielo nocturno en una pregunta abierta: no qué hay allá fuera, sino por qué todavía no lo sabemos.',
  },
  'oneill-cylinder': {
    title: 'Un paisaje construido dentro de una máquina',
    lead:
      'El cilindro de O Neill toma una idea casi imposible de sostener en la imaginación: construir no una estación, sino un mundo interior que gira para fabricar gravedad.',
    paragraphs: [
      'Desde fuera, el cilindro parece una pieza de industria colosal: espejos, radiadores, paneles, ejes, esclusas y naves pequeñas que apenas sirven como escala. Pero su verdadera escena está adentro. Allí el suelo no termina en un horizonte plano; se curva hacia arriba hasta convertirse en cielo, y al otro lado del aire aparecen campos, edificios y nubes suspendidas por geometría.',
      'La rotación es el truco esencial. En vez de llevar personas a otro planeta, se construye un suelo que empuja a sus habitantes hacia afuera mientras el cilindro gira. El radio permite que esa gravedad artificial se sienta más natural, y los espejos exteriores llevan luz al interior como si el día fuera una pieza de maquinaria ajustable.',
      'La fuerza del concepto no está solo en su tamaño, sino en su cambio de perspectiva. Un hábitat así no sería una cápsula ni una base; sería una geografía diseñada. Clima, agricultura, barrios, agua, transporte y ecología tendrían que funcionar dentro de una estructura que nunca puede olvidar que está rodeada por vacío.',
      'Sus límites son enormes. Fabricar la masa, ensamblarla en órbita, protegerla de radiación e impactos, estabilizar ecosistemas cerrados y mantener seguridad estructural son desafíos de civilización industrial avanzada. Pero por eso mismo el cilindro de O Neill sigue siendo tan potente: muestra cómo la ingeniería podría convertir espacio vacío en territorio habitable.',
      'En el atlas, este concepto es un punto de inflexión. Después de él, vivir en el espacio deja de significar sobrevivir en módulos y empieza a significar diseñar mundos.',
    ],
    sections: [
      readingSection('primera-imagen', 'Primera imagen', 'Un cilindro enorme gira en órbita. Afuera parece maquinaria pesada; adentro, el suelo se curva hasta convertirse en cielo y las ciudades aparecen sobre la cabeza como si el mundo se hubiera doblado.'),
      readingSection('como-seria', 'Cómo sería', 'Tendría una superficie interior habitable, ventanas o franjas de luz, espejos solares, radiadores, puertos de acoplamiento, zonas agrícolas, barrios, transporte interno y sistemas de soporte vital distribuidos por toda la estructura.'),
      readingSection('como-funciona', 'Cómo funciona', 'La rotación genera aceleración centrípeta, que se siente como gravedad en la pared interior. Los espejos dirigen luz, los radiadores expulsan calor, el casco protege de vacío y radiación, y la ecología interior intenta cerrar ciclos de aire, agua y alimento.'),
      readingSection('por-que-importaria', 'Por qué importaría', 'Importaría porque permite imaginar población, agricultura y ciudades fuera de planetas. No es solo una estación grande: es la idea de fabricar territorio habitable donde antes solo había órbita y vacío.'),
      readingSection('que-haria-falta', 'Qué haría falta', 'Harían falta minería espacial, fabricación orbital, ensamblaje robotizado, materiales masivos, control de giro, blindaje, espejos, soporte vital cerrado, mantenimiento permanente y una economía espacial madura.'),
      readingSection('limites', 'Límites', 'Sus límites son masa, estabilidad estructural, impactos, radiación, ecología cerrada, seguridad ante fallos y escala industrial. La belleza del concepto depende de resolver problemas que todavía superan por mucho nuestra infraestructura actual.'),
    ],
    closing:
      'Un cilindro de O Neill es la promesa de que el cielo podría dejar de ser frontera y convertirse en arquitectura.',
  },
};

const sentence = (value: string) => value.trim().replace(/[.?!]*$/, '.');

const listAsText = (items: string[]) => {
  if (items.length === 0) {
    return 'No hay elementos definidos para este concepto.';
  }

  if (items.length === 1) {
    return sentence(items[0]);
  }

  const [first, ...rest] = items;
  return sentence(`${first}; ${rest.join('; ')}`);
};

const evidenceItem = (
  label: string,
  body: string,
  evidence: DossierEvidence = 'conceptual',
): ConceptDossierItem => ({
  label,
  body,
  evidence,
});

const metricBody = (metric: keyof AstroConcept['metrics'], score: number) =>
  `Estimación editorial aproximada ${score}/5 para ${metricDescriptions[metric]}; compara conceptos dentro del atlas, no una magnitud física absoluta.`;

const buildDefaultNarrative = (concept: ConceptEditorialInput): ConceptNarrative => {
  const style = getReadingStyle(concept);
  const sections = buildDefaultReadingSections(concept);

  return {
    title: style.title(concept),
    lead: style.lead(concept),
    paragraphs: [
      sections[0].body.join(' '),
      sections[1].body.join(' '),
      sections[2].body.join(' '),
      sections[3].body.join(' '),
      `${sections[4].body.join(' ')} ${sections[5].body.join(' ')}`,
    ],
    sections,
    closing: style.closing(concept),
  };
};

const buildReferences = (sources?: SourceRef[]) => {
  if (!sources || sources.length === 0) {
    return [
      evidenceItem(
        'Marco del atlas',
        'No hay una fuente específica adjunta a este concepto; debe leerse con las referencias generales del capítulo y el documento base del atlas.',
      ),
    ];
  }

  return sources.map((source) =>
    evidenceItem(source.publisher, `${source.title}: ${source.url}`, 'fuente'),
  );
};

const buildDossier = (concept: ConceptEditorialInput): ConceptDossierSection[] => [
  {
    id: 'estado',
    title: 'Estado',
    items: [
      evidenceItem('Madurez', plausibilityDescriptions[concept.plausibility]),
      evidenceItem('Categoría', `${concept.category} dentro del bloque de ${scaleLabels[concept.scale]}.`),
    ],
  },
  {
    id: 'principio',
    title: 'Principio físico/ingenieril',
    items: [
      evidenceItem('Idea clave', sentence(concept.keyIdea)),
      evidenceItem('Mecanismo', sentence(concept.mechanism)),
    ],
  },
  {
    id: 'magnitudes',
    title: 'Magnitudes o escala',
    items: [
      evidenceItem('Lectura de escala', scaleDescriptions[concept.scale]),
      evidenceItem('Imagen de escala', sentence(concept.mentalImage)),
      evidenceItem('Energía', metricBody('energia', concept.metrics.energia), 'estimacion'),
      evidenceItem('Materiales', metricBody('materiales', concept.metrics.materiales), 'estimacion'),
      evidenceItem('Madurez', metricBody('madurez', concept.metrics.madurez), 'estimacion'),
      evidenceItem('Maravilla', metricBody('maravilla', concept.metrics.maravilla), 'estimacion'),
    ],
  },
  {
    id: 'requisitos',
    title: 'Requisitos',
    items: [
      evidenceItem(
        'Infraestructura previa',
        `Requiere operaciones sostenidas, automatización, mantenimiento y una cadena logística proporcional a su escala de ${scaleLabels[concept.scale]}.`,
      ),
      evidenceItem(
        'Capacidad dominante',
        concept.metrics.materiales >= concept.metrics.energia
          ? 'El cuello de botella editorial del atlas apunta más a materiales, fabricación y ensamblaje que a energía pura.'
          : 'El cuello de botella editorial del atlas apunta más a disponibilidad, captura o gestión de energía que a la forma estructural.',
        'estimacion',
      ),
    ],
  },
  {
    id: 'limites',
    title: 'Riesgos y límites',
    items: concept.difficulties.map((difficulty, index) =>
      evidenceItem(`Límite ${index + 1}`, sentence(difficulty)),
    ),
  },
  {
    id: 'interes',
    title: 'Qué lo vuelve interesante',
    items: [
      ...concept.advantages.map((advantage, index) =>
        evidenceItem(`Aporte ${index + 1}`, sentence(advantage)),
      ),
      evidenceItem('Lectura visual', sentence(concept.visualNotes)),
    ],
  },
  {
    id: 'fuentes',
    title: 'Fuentes / referencias',
    items: buildReferences(concept.sources),
  },
];

export const createConceptEditorial = (
  concept: ConceptEditorialInput,
): Pick<AstroConcept, 'narrative' | 'longRead' | 'dossier'> => ({
  narrative: narrativeOverrides[concept.id] ?? buildDefaultNarrative(concept),
  longRead: createConceptLongRead(concept),
  dossier: buildDossier(concept),
});
