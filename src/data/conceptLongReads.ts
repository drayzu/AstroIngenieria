import type { AstroConcept, ConceptLongRead, ConceptLongReadSection, Plausibility } from '../types';

type ConceptLongReadInput = Pick<
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
>;

type LongReadProfile = Partial<{
  title: string;
  subtitle: string;
  scene: string;
  world: string;
  life: string;
  machinery: string;
  purpose: string;
  path: string;
  risk: string;
  lesson: string;
  closing: string;
  takeaways: string[];
}>;

type FamilyLongReadStyle = {
  title: (concept: ConceptLongReadInput) => string;
  subtitle: (concept: ConceptLongReadInput) => string;
  sceneFrame: string;
  worldFrame: string;
  lifeFrame: string;
  machineryFrame: string;
  purposeFrame: string;
  pathFrame: string;
  riskFrame: string;
  lessonFrame: string;
  closingFrame: (concept: ConceptLongReadInput) => string;
};

const scaleLabels: Record<AstroConcept['scale'], string> = {
  nave: 'una nave o sistema de vuelo',
  habitat: 'un hábitat',
  orbital: 'infraestructura orbital',
  planetaria: 'ingeniería planetaria',
  estelar: 'escala estelar',
  galactica: 'escala galáctica',
};

const plausibilityLabels: Record<Plausibility, string> = {
  actual: 'actual',
  plausible: 'plausible',
  frontera: 'de frontera',
  especulativo: 'especulativo',
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

const section = (
  id: string,
  title: string,
  body: string[],
  callout?: ConceptLongReadSection['callout'],
): ConceptLongReadSection => ({
  id,
  title,
  body,
  ...(callout ? { callout } : {}),
});

const capabilityPressure = (concept: ConceptLongReadInput) => {
  const needs = [
    concept.metrics.energia >= 4 ? 'energía abundante y controlada' : null,
    concept.metrics.materiales >= 4 ? 'materiales, masa y fabricación a gran escala' : null,
    concept.metrics.madurez <= 2 ? 'ensayos progresivos antes de confiar vidas o civilizaciones al sistema' : null,
    concept.metrics.maravilla >= 5 ? 'continuidad cultural para sostener una obra que no se completa en una sola campaña' : null,
  ].filter((item): item is string => Boolean(item));

  return needs.length > 0
    ? listAsText(needs)
    : 'operación sostenida, mantenimiento, redundancia y una cadena de decisiones que no dependa de una misión excepcional.';
};

const familyStyles: Record<string, FamilyLongReadStyle> = {
  intro: {
    title: (concept) => `${concept.title}: leer la escala antes de construir`,
    subtitle: (concept) =>
      `${sentence(concept.summary)} Esta lectura lo trata como una herramienta para ordenar imaginación, física y futuro.`,
    sceneFrame:
      'La escena funciona como un umbral: no estamos mirando una sola máquina, sino una forma de convertir el cosmos en un problema legible. El lector no necesita memorizar una definición; necesita entender qué cambia cuando la escala deja de ser humana y empieza a ser planetaria, estelar o galáctica.',
    worldFrame:
      'Su forma sería la de un mapa mental. Ordena conceptos que a primera vista parecen incompatibles: estaciones orbitales, motores, terraformación, tecnofirmas y civilizaciones que podrían vivir durante tiempos inmensos.',
    lifeFrame:
      'La experiencia humana aquí es intelectual, pero no fría. Una persona que entiende este marco empieza a ver que cada hábitat, motor o señal del atlas habla de una decisión: qué sostener, qué transformar, qué preservar y qué riesgos aceptar.',
    machineryFrame:
      'La maquinaria invisible es el propio criterio de comparación. Energía, materiales, madurez tecnológica, escala, riesgo y plausibilidad permiten separar una idea útil de una imagen espectacular que todavía no explica cómo funcionaría.',
    purposeFrame:
      'Alguien lo usaría para no perderse. La astroingeniería reúne ideas enormes, y sin una brújula terminan mezclándose proyectos actuales, ciencia de frontera y metáforas de ciencia ficción como si pesaran lo mismo.',
    pathFrame:
      'El camino consiste en aprender a leer por capas: primero la física mínima, luego la infraestructura necesaria, después la economía y finalmente las consecuencias sociales. Esa disciplina evita que el asombro se convierta en confusión.',
    riskFrame:
      'El riesgo es creer que nombrar una escala equivale a dominarla. Un marco conceptual no construye nada por sí mismo; solo ayuda a preguntar mejor qué habría que construir y qué todavía falta demostrar.',
    lessonFrame:
      'Lo que enseña es humildad de escala. Antes de imaginar una civilización galáctica hay que entender qué significa cerrar un ciclo de aire, mover una tonelada, disipar calor o sostener una institución durante generaciones.',
    closingFrame: (concept) =>
      `${concept.title} importa porque prepara la mirada: convierte el atlas en una conversación ordenada sobre lo que podría significar construir fuera de la Tierra.`,
  },
  habitats: {
    title: (concept) => `${concept.title}: vivir dentro de una máquina que finge ser mundo`,
    subtitle: (concept) =>
      `${sentence(concept.summary)} La lectura completa mira su arquitectura, su vida diaria, su soporte vital y la fragilidad de construir hogar en el vacío.`,
    sceneFrame:
      'La primera sensación no sería la de llegar a una ciudad, sino a un acuerdo delicado entre materia y vida. Afuera habría vacío, radiación y silencio; adentro, aire mantenido por bombas, luz administrada por espejos o lámparas, agua contada y una arquitectura diseñada para que el cuerpo olvide por momentos que no está sobre un planeta.',
    worldFrame:
      'El lugar tendría una geografía artificial. Sus pasillos, valles interiores, cavidades o módulos no serían decoración: cada forma respondería a presión, rotación, blindaje, mantenimiento, circulación y evacuación.',
    lifeFrame:
      'Vivir allí significaría crecer con una idea distinta de normalidad. Podrían existir colonias que no conocieran otro suelo, niños que aprendieran a leer el clima como una decisión de ingeniería y comunidades para las que una ventana hacia la Tierra fuese más mito que paisaje cotidiano.',
    machineryFrame:
      'La maquinaria invisible estaría en todas partes. Soporte vital, radiadores, filtros, sensores, compuertas, cultivos, reciclaje de agua, control de dióxido de carbono y redundancias formarían el metabolismo técnico del lugar.',
    purposeFrame:
      'Alguien lo construiría para convertir presencia en permanencia. Un hábitat no es solo refugio: es la posibilidad de vivir, trabajar, criar, reparar, recordar y proyectar futuro sin depender de volver pronto a la Tierra.',
    pathFrame:
      'El camino pasaría por estaciones pequeñas, ensamblaje orbital, minería o logística externa, agricultura controlada, materiales confiables y una cultura de mantenimiento continuo.',
    riskFrame:
      'Lo que puede salir mal es precisamente lo que lo vuelve fascinante. Una fuga, un fallo térmico, una plaga en cultivos, una rotación mal controlada o una cadena logística rota afectarían no a una máquina aislada, sino a un mundo entero.',
    lessonFrame:
      'La lección es que habitar el espacio no empieza con paisajes hermosos. Empieza con cerrar ciclos, cuidar piezas pequeñas y aceptar que todo hogar artificial es también una responsabilidad compartida.',
    closingFrame: (concept) =>
      `${concept.title} deja una imagen persistente: el espacio puede parecer vacío, pero con suficiente cuidado podría contener hogares.`,
  },
  infrastructure: {
    title: (concept) => `${concept.title}: la red que convierte misiones en rutina`,
    subtitle: (concept) =>
      `${sentence(concept.summary)} Esta lectura lo mira como parte de la logística que permitiría trabajar en el espacio sin empezar desde cero cada vez.`,
    sceneFrame:
      'La escena no tiene que ser heroica para ser transformadora. Puede ser un puerto, una plataforma, una ruta de carga, un depósito o una máquina que repite una operación miles de veces hasta que el espacio deja de sentirse como excepción.',
    worldFrame:
      'Su forma sería la de un nodo dentro de una red. No importa solo el objeto, sino sus conexiones: qué recibe, qué entrega, qué repara, qué almacena y qué otras misiones vuelven posibles sus servicios.',
    lifeFrame:
      'La vida alrededor de esta infraestructura sería menos cinematográfica que la exploración, pero más decisiva. Técnicos, robots, operadores, planificadores y tripulaciones dependerían de que las maniobras sean aburridas, previsibles y repetibles.',
    machineryFrame:
      'La maquinaria invisible vive en interfaces, protocolos, navegación, control de tráfico, transferencia de masa, acoplamientos, electricidad, inventarios y mantenimiento. Lo que parece administración es, en realidad, el esqueleto de una civilización espacial.',
    purposeFrame:
      'Alguien lo construiría porque ningún sistema espacial madura si cada misión debe cargar todo desde la Tierra. La infraestructura reduce improvisación y crea continuidad.',
    pathFrame:
      'El camino requiere cadencia de lanzamiento, estándares compartidos, sensores, automatización, acuerdos operativos y suficiente actividad para justificar que la red siga viva.',
    riskFrame:
      'Lo que puede salir mal no siempre es explosivo. A veces basta con que no haya tráfico, que el mantenimiento sea demasiado caro o que una pieza crítica no tenga repuesto para que la red pierda sentido.',
    lessonFrame:
      'La enseñanza es pragmática: el espacio se vuelve habitable no cuando llegamos una vez, sino cuando podemos volver, reparar, repostar y seguir.',
    closingFrame: (concept) =>
      `${concept.title} importa porque cambia la pregunta de "¿podemos llegar?" a "¿podemos operar allí todos los días?".`,
  },
  energy: {
    title: (concept) => `${concept.title}: aprender a leer luz y calor`,
    subtitle: (concept) =>
      `${sentence(concept.summary)} La lectura completa lo trata como una historia de energía disponible, energía útil y calor que siempre debe escapar.`,
    sceneFrame:
      'La primera imagen es luminosa, pero no simple. Donde vemos brillo, una civilización avanzada vería flujo; donde vemos vacío, vería espacio para colectores, transmisores, computación y radiadores.',
    worldFrame:
      'Su forma estaría definida por superficies, orientación, órbitas y temperatura. Los elementos visibles no existirían para verse imponentes, sino para capturar, dirigir, convertir o disipar energía.',
    lifeFrame:
      'La vida alrededor de este sistema dependería de una abundancia que no se sentiría como fuego, sino como capacidad. Más energía significa más industria, más cómputo, más transporte, más hábitats y también más responsabilidad.',
    machineryFrame:
      'La maquinaria invisible es termodinámica. Cada watt capturado debe tener un camino: entrada, conversión, uso, pérdida y emisión final como calor residual. Ninguna civilización escapa a esa contabilidad.',
    purposeFrame:
      'Alguien lo construiría porque casi todos los sueños grandes del atlas necesitan potencia sostenida. Sin energía, los hábitats son frágiles, los motores son lentos y la computación cósmica es solo una metáfora.',
    pathFrame:
      'El camino exige colectores, materiales resistentes, control orbital, transmisión segura, radiadores, robots de mantenimiento y una economía que pueda crecer por etapas sin exigir una obra perfecta desde el principio.',
    riskFrame:
      'Lo que puede salir mal incluye colisiones, degradación, pérdidas, calor acumulado, haces mal controlados, dependencia sistémica y la concentración política de una fuente de poder enorme.',
    lessonFrame:
      'La lección es que energía y calor son dos caras de la misma historia. Una civilización que aprende a capturar más luz también debe aprender a vivir con la sombra térmica de sus decisiones.',
    closingFrame: (concept) =>
      `${concept.title} hace visible una regla profunda: el futuro no solo se construye con energía, también se construye disipándola.`,
  },
  propulsion: {
    title: (concept) => `${concept.title}: el precio físico de cambiar de mundo`,
    subtitle: (concept) =>
      `${sentence(concept.summary)} Esta lectura lo explica como arquitectura de misión: empuje, energía, masa, calor, tiempo y destino.`,
    sceneFrame:
      'La escena empieza con una nave frente a una distancia que no negocia. El espacio parece vacío, pero cada cambio de velocidad cuesta algo: combustible, energía, infraestructura externa, masa estructural, tiempo o riesgo.',
    worldFrame:
      'Su forma sería dictada por el modo de empuje. Tanques, campos, velas, reactores, radiadores, blindajes o haces externos no serían accesorios, sino el cuerpo mismo de la misión.',
    lifeFrame:
      'Para una tripulación o una carga, la propulsión define el mundo posible. Cambia cuánto dura el viaje, cuánta protección se necesita, qué se puede llevar y si el destino es una expedición cercana o una apuesta interplanetaria o interestelar.',
    machineryFrame:
      'La maquinaria invisible es la contabilidad de momento y energía. Acelerar significa intercambiar algo con el entorno o expulsar masa; frenar exige otro pago, a menudo tan difícil como partir.',
    purposeFrame:
      'Alguien lo construiría porque no basta con saber que hay recursos, mundos o estrellas allá fuera. Una civilización espacial necesita mover masa de manera confiable, no solo mirar destinos en un mapa.',
    pathFrame:
      'El camino exige motores probados, fuentes de potencia compatibles, materiales que toleren calor y radiación, navegación precisa, infraestructura de apoyo y una arquitectura honesta sobre tiempos de viaje.',
    riskFrame:
      'Lo que puede salir mal aparece como masa extra, calor no disipado, combustible insuficiente, empuje demasiado bajo, radiación, fallos de control o expectativas que confunden posibilidad física con utilidad práctica.',
    lessonFrame:
      'La lección es sobria: viajar por el sistema solar o más allá no es una cuestión de valentía, sino de cerrar balances físicos sin engañarse.',
    closingFrame: (concept) =>
      `${concept.title} convierte el deseo de ir lejos en una pregunta precisa: qué estamos dispuestos a pagar para movernos.`,
  },
  planetary: {
    title: (concept) => `${concept.title}: intervenir un mundo sin olvidar que responde`,
    subtitle: (concept) =>
      `${sentence(concept.summary)} La lectura completa lo aborda como una relación entre clima, geología, atmósfera, vida posible e infraestructura.`,
    sceneFrame:
      'La escena no es solo una máquina sobre un paisaje. Es un paisaje que empieza a cambiar por máquinas, decisiones y tiempos largos: aire que se mide, suelo que se protege, hielo que se busca, luz que se redirige o ciudades que se cierran contra un exterior hostil.',
    worldFrame:
      'Su forma dependería del mundo objetivo. Puede aparecer como domos, espejos, fábricas atmosféricas, sensores, laboratorios biológicos, blindajes, importación de volátiles o reglas estrictas para no contaminar lo que aún no entendemos.',
    lifeFrame:
      'La vida alrededor del concepto sería una negociación constante entre refugio y ambiente. Las personas podrían vivir en bordes: ni completamente dentro de una nave ni completamente libres en un planeta, sino en una zona donde cada salida recuerda que la habitabilidad se construye lentamente.',
    machineryFrame:
      'La maquinaria invisible combina presión, temperatura, química, radiación, ciclos de agua, estabilidad atmosférica, energía y biología. Una intervención planetaria no es un interruptor; es una cadena de retroalimentaciones.',
    purposeFrame:
      'Alguien lo construiría para ampliar el espacio habitable, reducir dependencia de la Tierra, estudiar vida o preparar asentamientos que no estén condenados a ser puestos temporales.',
    pathFrame:
      'El camino exige reconocimiento científico, infraestructura de superficie, energía sostenida, protección planetaria, modelos climáticos, monitoreo y decisiones éticas antes de tocar sistemas irreversibles.',
    riskFrame:
      'Lo que puede salir mal incluye contaminación, falsas expectativas, inestabilidad climática, consumo enorme de recursos, daño a posibles biosferas y proyectos que duren más que las instituciones que los iniciaron.',
    lessonFrame:
      'La lección es que un planeta no es una hoja en blanco. Incluso un mundo hostil tiene historia, dinámica y valor científico antes de convertirse en destino humano.',
    closingFrame: (concept) =>
      `${concept.title} enseña que hacer habitable un mundo también exige aprender cuándo no tocarlo demasiado pronto.`,
  },
  stellar: {
    title: (concept) => `${concept.title}: ingeniería al borde de una estrella`,
    subtitle: (concept) =>
      `${sentence(concept.summary)} Esta lectura lo mira como una operación extrema entre plasma, gravedad, radiación, masa y tiempo profundo.`,
    sceneFrame:
      'La escena está dominada por una estrella que no parece objeto sino ambiente total. La luz no ilumina simplemente: empuja, calienta, erosiona, ioniza y obliga a cualquier estructura a justificar su existencia.',
    worldFrame:
      'Su forma sería abierta, desplegada y resistente. Espejos, colectores, campos magnéticos, plataformas, radiadores o sistemas de extracción tendrían que mantenerse a distancia suficiente para sobrevivir y cerca suficiente para actuar.',
    lifeFrame:
      'La vida alrededor de este concepto sería indirecta. Pocas personas estarían cerca; lo normal serían robots, observatorios, control remoto y comunidades que viven lejos pero dependen de decisiones tomadas frente a una fuente de energía inmensa.',
    machineryFrame:
      'La maquinaria invisible pertenece a la física estelar: plasma, viento solar, magnetismo, radiación, transferencia de momento, extracción de masa, disipación térmica y estabilidad orbital.',
    purposeFrame:
      'Alguien lo construiría cuando usar energía estelar ya no bastara. El siguiente paso sería administrar, mover, extraer o interpretar una estrella como sistema físico manipulable.',
    pathFrame:
      'El camino exige modelos estelares confiables, materiales resistentes, energía abundante, automatización, radiadores inmensos, tolerancia a fallos y una escala institucional que piense en generaciones.',
    riskFrame:
      'Lo que puede salir mal incluye calor, radiación, inestabilidad, degradación, errores de modelado y una diferencia brutal entre controlar una máquina y afectar un astro.',
    lessonFrame:
      'La lección es que una estrella no se domina con fuerza bruta. Se trabaja con ella aceptando que la física impone el ritmo y que cada intervención deja huella.',
    closingFrame: (concept) =>
      `${concept.title} convierte el Sol y otras estrellas en algo más que escenario: sistemas físicos ante los que una civilización tendría que actuar con precisión y humildad.`,
  },
  civilizations: {
    title: (concept) => `${concept.title}: pensar civilizaciones cuando el tiempo se vuelve profundo`,
    subtitle: (concept) =>
      `${sentence(concept.summary)} La lectura completa lo explora como una pregunta sobre señales, expansión, silencio, duración y decisiones colectivas.`,
    sceneFrame:
      'La escena puede no tener una máquina visible. Puede ser una galaxia silenciosa, una señal improbable, una frontera de expansión, una civilización que decide ocultarse o una ausencia que pesa más que una respuesta.',
    worldFrame:
      'Su forma sería distribuida. No se entiende en un lugar único, sino en patrones: energía usada, calor emitido, mensajes enviados, mundos transformados, sondas desplegadas o decisiones de no intervenir.',
    lifeFrame:
      'La vida alrededor del concepto se imagina en escalas difíciles. Una cultura podría vivir con retrasos de siglos, ramas separadas por estrellas, memorias institucionales enormes o mentes que ya no dependan de cuerpos biológicos.',
    machineryFrame:
      'La maquinaria invisible son modelos y sesgos. Detectabilidad, duración, velocidad de expansión, tecnología, riesgo, ética y límites de la luz deciden qué podríamos ver y qué quizá nunca sabríamos interpretar.',
    purposeFrame:
      'Alguien lo estudiaría porque hablar de astroingeniería sin civilizaciones deja fuera la pregunta central: quién construye, por qué construye, cuánto dura y qué señales deja.',
    pathFrame:
      'El camino exige observación, teoría, prudencia estadística, búsqueda de tecnofirmas, comparación con límites físicos y cuidado para no convertir deseos o temores en conclusiones.',
    riskFrame:
      'Lo que puede salir mal es epistemológico y existencial. Podemos confundir silencio con ausencia, señal con intención, expansión con éxito o poder tecnológico con sabiduría.',
    lessonFrame:
      'La lección es que el cosmos no solo pregunta qué tecnología es posible. Pregunta qué tipo de civilización sobrevive lo suficiente para usarla sin destruirse o desaparecer de la vista.',
    closingFrame: (concept) =>
      `${concept.title} deja el atlas mirando hacia fuera y hacia dentro: hacia las estrellas, y hacia la clase de futuro que una civilización decide merecer.`,
  },
  complements: {
    title: (concept) => `${concept.title}: el contexto que evita construir a ciegas`,
    subtitle: (concept) =>
      `${sentence(concept.summary)} Esta lectura lo trata como soporte científico, ético, legal o imaginativo para entender mejor el resto del atlas.`,
    sceneFrame:
      'La escena amplía el foco. Ya no vemos solo una estructura o un motor, sino el conjunto de preguntas que rodean cualquier obra cósmica: vida, mundos, evidencia, derecho, cultura, tiempo y responsabilidad.',
    worldFrame:
      'Su forma no siempre es física. Puede ser un campo de estudio, una norma, una tradición imaginativa, un catálogo de mundos o una ética que decide qué proyectos deberían esperar.',
    lifeFrame:
      'La vida alrededor de este concepto aparece en laboratorios, observatorios, debates, tratados, misiones de reconocimiento y relatos que ayudan a sentir escalas que de otro modo serían abstractas.',
    machineryFrame:
      'La maquinaria invisible está hecha de criterios. Qué cuenta como evidencia, qué mundo merece protección, qué riesgo aceptamos, qué lenguaje usamos y qué futuros consideramos legítimos.',
    purposeFrame:
      'Alguien lo estudiaría porque la astroingeniería no puede ser solo capacidad técnica. Poder construir algo no responde si conviene construirlo, dónde, para quién y con qué consecuencias.',
    pathFrame:
      'El camino exige investigación interdisciplinaria, fuentes claras, debate público, modelos comparables y una frontera honesta entre ciencia, especulación y valores.',
    riskFrame:
      'Lo que puede salir mal es confundir contexto con adorno. Sin estos marcos, una megaestructura puede parecer impresionante y aun así estar mal planteada científica, ética o políticamente.',
    lessonFrame:
      'La lección es que las grandes obras necesitan grandes criterios. El cosmos no reduce la responsabilidad humana; la agranda.',
    closingFrame: (concept) =>
      `${concept.title} sostiene una parte silenciosa del atlas: entender antes de intervenir.`,
  },
};

const longReadProfiles: Record<string, LongReadProfile> = {
  'bernal-sphere': {
    title: 'Bernal Sphere: una ciudad dentro de una esfera',
    scene:
      'Imagina entrar por un eje tranquilo, casi sin peso, y descender hacia una franja donde el cuerpo empieza a recuperar gravedad. La esfera no se revela de golpe: primero aparecen paredes técnicas, después luz, después vegetación, y finalmente la intuición extraña de que el suelo no termina, sino que se curva hacia arriba.',
    world:
      'Su intimidad es parte de su fuerza. Una Bernal Sphere no intenta ser un planeta entero; intenta ser el primer mundo artificial suficientemente grande para tener barrios, cultivos, memoria local y una relación visible entre arquitectura y supervivencia.',
    life:
      'Una colonia nacida allí podría conocer la Tierra como historia, no como experiencia. Su cielo sería una arquitectura curvada; su clima, una decisión de ingeniería; sus estaciones, quizá ciclos de luz programados para sostener cuerpos y cultivos.',
    closing:
      'La Bernal Sphere convence porque no necesita prometer infinito: basta con imaginar una comunidad aprendiendo a llamar mundo a una esfera cuidadosamente mantenida.',
  },
  'oneill-cylinder': {
    title: 'Cilindro de O Neill: un paisaje que gira para sostener ciudades',
    scene:
      'La escena interior sería casi imposible de olvidar: campos y barrios subiendo por las paredes del cielo, nubes que parecen obedecer a una geometría distinta y una luz solar dirigida por espejos como si el día fuese una pieza mecánica.',
    world:
      'A diferencia de un hábitat compacto, el cilindro permite pensar en geografía. No solo habitaciones: valles, transporte, agricultura, vecindarios, parques y distancias internas capaces de dar a una comunidad la sensación de territorio.',
    life:
      'Una persona nacida allí quizá sentiría vértigo al ver un planeta abierto. Su normalidad sería un mundo donde el horizonte se curva, donde el clima depende de mantenimiento y donde la noche puede llegar porque alguien diseñó cómo cerrar la luz.',
    closing:
      'El cilindro de O Neill es una de las imágenes más fuertes del atlas porque convierte el espacio en paisaje y la ingeniería en hogar visible.',
  },
  worldship: {
    title: 'Worldship: una civilización viajando dentro de su propia memoria',
    scene:
      'La escena no es una nave cruzando estrellas; es una sociedad entera avanzando con lentitud por una noche que dura generaciones. Hay jardines, escuelas, talleres, archivos, rituales y ventanas donde el exterior no cambia casi nunca.',
    world:
      'Una worldship tendría que ser vehículo, ciudad, ecosistema, archivo cultural y pacto político al mismo tiempo. Su forma exterior importaría menos que su capacidad de conservar continuidad interior mientras todo alrededor permanece inalcanzable.',
    life:
      'Algunas personas podrían nacer, amar, discutir, trabajar y morir sin ver el destino. Para ellas, la misión no sería viaje sino mundo heredado: una promesa recibida de antepasados y entregada a descendientes.',
    risk:
      'Su riesgo más profundo no es solo técnico. También es cultural: cómo mantener legitimidad, propósito, diversidad y libertad dentro de una sociedad cerrada que no puede bajarse del viaje.',
    closing:
      'Una worldship obliga a preguntar si viajar a otra estrella puede ser menos una expedición y más una forma completa de civilización.',
  },
  'dyson-swarm': {
    title: 'Dyson Swarm: cuando una estrella se vuelve territorio industrial',
    scene:
      'Desde lejos, la estrella seguiría brillando, pero ya no estaría sola. A su alrededor habría una multitud de objetos: colectores, estaciones, fábricas, radiadores y rutas orbitales, cada uno capturando una parte de la luz que antes se perdía en el espacio.',
    world:
      'Lo importante es que no sería una cáscara sólida. Sería una ecología orbital de máquinas, creciendo por capas, con órbitas distintas y funciones distintas, más parecida a una ciudad distribuida que a un monumento único.',
    machinery:
      'Su verdad técnica está en el calor residual. Capturar energía estelar es solo la mitad del relato; la otra mitad es emitir calor de manera controlada, porque una civilización de alta potencia también es una civilización térmicamente visible.',
    closing:
      'El Dyson Swarm impresiona porque cambia la escala de la palabra infraestructura: ya no rodea una ciudad, rodea una estrella.',
  },
  fermi: {
    title: 'Paradoja de Fermi: el silencio como problema científico',
    scene:
      'La escena es una galaxia inmensa y antigua que no responde. No hace falta imaginar invasiones ni mensajes dramáticos: basta con mirar el cielo y preguntarse por qué no vemos rastros claros de civilizaciones que tuvieron muchísimo tiempo para aparecer.',
    world:
      'Fermi no describe una máquina, sino una tensión entre expectativas. Si la vida, la inteligencia y la expansión tecnológica son comunes, el universo cercano debería parecer menos silencioso. Si no lo parece, algo en esa cadena falla o se esconde.',
    life:
      'La paradoja nos incluye. Cada hipótesis sobre el silencio cambia la forma en que entendemos nuestra propia vulnerabilidad: tal vez somos raros, tal vez somos tempranos, tal vez las civilizaciones duran poco, tal vez no sabemos mirar.',
    closing:
      'Fermi convierte la ausencia de respuesta en una herramienta: no resuelve el misterio, pero obliga a preguntar con más precisión.',
  },
  'mars-terraforming': {
    title: 'Terraformación de Marte: cambiar un planeta sin olvidar su historia',
    scene:
      'Marte no se abriría como un jardín esperando humanos. Sería frío, seco, radiado y lleno de memoria geológica. Cualquier intento de transformarlo tendría que empezar con humildad ante un mundo que ya tiene una historia propia.',
    world:
      'El cambio no sería instantáneo. Primero vendrían bases, domos, extracción local, pruebas atmosféricas, fábricas, blindajes y quizá intervenciones parciales mucho antes de imaginar un cielo respirable.',
    risk:
      'El riesgo más delicado es confundir deseo con derecho. Si Marte guarda rastros de vida pasada o presente, transformarlo demasiado pronto podría destruir precisamente la evidencia que nos hizo viajar hasta allí.',
    closing:
      'Terraformar Marte no es solo imaginar un planeta rojo volviéndose azul; es decidir qué significa heredar otro mundo.',
  },
  shkadov: {
    title: 'Shkadov Thruster: empujar una estrella con su propia luz',
    scene:
      'La imagen parece absurda hasta que se vuelve física: un espejo colosal colocado cerca de una estrella, reflejando parte de su luz para producir un empuje diminuto pero persistente.',
    machinery:
      'No habría explosión ni motor tradicional. La fuerza sería pequeña, acumulativa y paciente. En escalas humanas parecería casi nada; en escalas estelares, una dirección sostenida durante tiempos inmensos puede convertirse en trayectoria.',
    purpose:
      'Alguien lo consideraría si una civilización pensara en mover no una nave, sino un sistema entero: esquivar amenazas, reubicar recursos o convertir la estrella en parte activa de una estrategia de supervivencia.',
    closing:
      'El Shkadov Thruster enseña que a escala estelar incluso una fuerza suave puede volverse monumental si una civilización aprende a esperar.',
  },
  'tipo-ii': {
    title: 'Civilización Tipo II: vivir a la escala de una estrella',
    scene:
      'Una civilización Tipo II no se define por una capital brillante, sino por una relación nueva con su estrella. La luz deja de caer sobre mundos como un regalo y empieza a organizarse como infraestructura.',
    world:
      'Su territorio real sería el sistema estelar completo: enjambres de energía, hábitats, minería de asteroides, estaciones térmicas, fábricas orbitales y rutas entre mundos artificiales.',
    life:
      'Para sus habitantes, la abundancia energética podría ser normal. Pero también lo serían los problemas de coordinación, calor residual, gobernanza y dependencia de sistemas tan grandes que nadie individual podría comprenderlos completos.',
    closing:
      'Una civilización Tipo II no es solo una civilización poderosa: es una sociedad que aprende a vivir con las consecuencias de usar una estrella.',
  },
};

const getFamilyStyle = (concept: ConceptLongReadInput) =>
  familyStyles[concept.chapterId] ?? familyStyles.intro;

const getProfile = (concept: ConceptLongReadInput) => longReadProfiles[concept.id] ?? {};

const buildTakeaways = (concept: ConceptLongReadInput, profile: LongReadProfile): string[] =>
  profile.takeaways ?? [
    `${concept.title} se entiende mejor como ${concept.category.toLocaleLowerCase('es')} de escala ${scaleLabels[concept.scale]}.`,
    sentence(concept.keyIdea),
    `Su plausibilidad es ${plausibilityLabels[concept.plausibility]} y sus mayores tensiones son: ${listAsText(concept.difficulties)}`,
  ];

export const createConceptLongRead = (concept: ConceptLongReadInput): ConceptLongRead => {
  const style = getFamilyStyle(concept);
  const profile = getProfile(concept);
  const capability = capabilityPressure(concept);

  return {
    title: profile.title ?? style.title(concept),
    subtitle: profile.subtitle ?? style.subtitle(concept),
    sections: [
      section('escena', 'Entrar en la escena', [
        profile.scene ?? `${concept.mentalImage} ${style.sceneFrame}`,
        `En esa primera imagen, ${concept.title} no aparece como una ficha técnica. Aparece como una situación: algo que alguien tendría que construir, mantener, habitar, usar o interpretar bajo restricciones reales.`,
      ]),
      section('mundo', 'Cómo sería ese mundo o sistema', [
        profile.world ?? style.worldFrame,
        `${concept.title} pertenece a la categoría ${concept.category.toLocaleLowerCase('es')} y opera como ${scaleLabels[concept.scale]}. Eso cambia la forma de leerlo: su escala no es decorativa, define qué materiales, tiempos, distancias y formas de coordinación entran en juego.`,
        `La imagen visual que conviene conservar es esta: ${sentence(concept.visualNotes)}`,
      ]),
      section('vida', 'La vida alrededor del concepto', [
        profile.life ?? style.lifeFrame,
        `Para una persona, tripulación, colonia o civilización, el concepto se volvería cotidiano solo si deja de exigir atención constante. Esa normalidad sería su mayor logro: que lo extraordinario se transforme en rutina sin desaparecer como riesgo.`,
      ]),
      section('maquinaria', 'La maquinaria invisible', [
        profile.machinery ?? style.machineryFrame,
        `${sentence(concept.mechanism)} Dicho de otra forma: la parte visible solo funciona si debajo hay control, energía, materiales, sensores, mantenimiento y márgenes de seguridad.`,
      ], {
        label: 'Idea clave',
        body: sentence(concept.keyIdea),
      }),
      section('proposito', 'Por qué alguien lo construiría', [
        profile.purpose ?? style.purposeFrame,
        `Sus ventajas explican la tentación: ${listAsText(concept.advantages)} No son adornos narrativos; son las razones por las que una sociedad aceptaría invertir recursos y asumir riesgos.`,
      ]),
      section('camino', 'El camino para llegar ahí', [
        profile.path ?? style.pathFrame,
        `Harían falta ${capability} Esta frase debe leerse como una estimación editorial aproximada: compara dificultad dentro del atlas, no entrega un presupuesto ni una fecha.`,
        'Casi ningún concepto de astroingeniería aparece de golpe. Primero llegan prototipos, operaciones parciales, infraestructura auxiliar y versiones imperfectas que enseñan dónde falla la teoría.',
      ]),
      section('riesgo', 'Lo que puede salir mal', [
        profile.risk ?? style.riskFrame,
        `En este caso, los límites principales son: ${listAsText(concept.difficulties)} La lectura completa no intenta borrar esos límites; los usa para mantener la imaginación unida a la ingeniería.`,
      ], {
        label: 'Punto crítico',
        body: `La maravilla de ${concept.title} depende de no esconder sus fallos posibles.`,
      }),
      section('ensenanza', 'Qué nos enseña', [
        profile.lesson ?? style.lessonFrame,
        `${concept.title} deja una pregunta que va más allá de su mecanismo: qué clase de cultura, instituciones y paciencia serían necesarias para convertir una idea así en parte estable de la realidad.`,
      ]),
    ],
    closing: profile.closing ?? style.closingFrame(concept),
    takeaways: buildTakeaways(concept, profile),
  };
};
