# Guía editorial de AstroIngeniería

La organización visible del museo se define en [Recorrido editorial](./reading-journey.md). Las tandas y archivos históricos conservan sus identificadores; el capítulo visible de una lectura puede diferir de su archivo de almacenamiento.

Esta guía gobierna la reescritura por tandas de las 106 lecturas. El objetivo es que una persona curiosa, sin formación técnica previa, pueda representar cada idea, explicar su mecanismo y comprender por qué resulta extraordinaria sin confundir una escena hipotética con un hecho demostrado.

## Referencias de estilo

- **Cilindro de O’Neill:** construir geometría, orientación y experiencia de habitar.
- **Gravedad artificial:** convertir física en experiencias cotidianas.
- **ISS:** seguir objetos y procesos para revelar sistemas invisibles.
- **Naves generacionales:** conectar tecnología, tiempo, instituciones y vida.
- **Ascensor espacial:** organizar la explicación como un recorrido.
- **Enjambre Dyson:** pasar de una máquina concreta a una escala inmensa.

Estas lecturas aportan recursos, no una plantilla. Cada artículo necesita una pregunta, una organización y un cierre propios.

## Flujo obligatorio

1. Trabajar una sola tanda y completar un artículo antes de abrir el siguiente.
2. Leer el texto actual y una referencia de estilo pertinente.
3. Definir la pregunta que sostiene el artículo, la representación mental buscada y los hechos que requieren fuentes.
4. Investigar en fuentes primarias o trabajos técnicos directamente pertinentes.
5. Redactar con profundidad progresiva: experiencia, mecanismo, consecuencias, posibilidades e incertidumbre.
6. Auditar cada artículo con las siete preguntas editoriales.
7. Comparar todos los artículos de la tanda para eliminar aperturas, apartados y cierres repetidos.
8. Ejecutar validación de contenido, lint, build y revisión visual en escritorio y móvil.
9. Actualizar el registro. No comenzar otra tanda ni publicar.

## Extensión

La categoría y tanda de cada identificador viven en `scripts/editorialPlan.mjs`. El objetivo concreto de cada artículo está en [editorial-batches.md](./editorial-batches.md).

| Categoría | Mínimo de lectura principal | Objetivo |
|---|---:|---:|
| A | 900 palabras | 1.000–1.400 |
| B | 650 palabras | 750–1.000 |
| R | Sin ampliación automática | Auditoría |

La lectura principal contiene únicamente bloques de párrafo. No cuenta título, entradilla, subtítulos, notas, pies de imagen ni fuentes. Alcanzar el mínimo no acredita calidad y nunca justifica relleno.

## Criterios

- La escena o comparación inicial debe enseñar algo que el artículo explique después.
- Cada término técnico debe adquirir una función dentro de una cadena causal.
- Las posibilidades deben derivarse del mecanismo explicado.
- La emoción debe aparecer en una consecuencia concreta para una persona, comunidad o paisaje.
- Tecnología operativa, estudio conceptual, extrapolación e hipótesis deben distinguirse.
- Las notas amplían una explicación comprensible por sí sola; no esconden el mecanismo central.
- Los subtítulos expresan ideas propias del tema.
- El cierre añade una comprensión y evita resumir mecánicamente el cuerpo.

Obliga a revisar: listas abstractas después de una apertura visual; párrafos intercambiables entre temas; fórmulas sin unidades o supuestos; incertidumbres genéricas repetidas; preguntas abandonadas; conclusiones más profundas que el desarrollo; secciones creadas solo para sumar palabras.

## Auditoría de siete preguntas

Para declarar un artículo `revisado-validado`, el registro debe poder responder con evidencia concreta:

1. ¿Qué representación mental construye?
2. ¿Qué mecanismo o razonamiento permite explicar?
3. ¿Qué posibilidad desarrolla con profundidad?
4. ¿Qué detalle sostiene la emoción?
5. ¿Qué distinción evita una confusión?
6. ¿Qué incertidumbre explica y respalda?
7. ¿Qué aporta frente a sus temas vecinos?

## Estados

- `pendiente`
- `en-redaccion`
- `redactado-pendiente-revision`
- `revisado-validado`

La validación solo exige el mínimo editorial a los artículos en el último estado. Nunca se rebaja una categoría para hacer pasar una tanda. El estado operativo está en `scripts/editorialPlan.mjs` y el informe humano en `docs/editorial-rewrite.md`.

## Inicio de una tanda

> Ejecuta únicamente la tanda N. Lee esta guía, el registro y una referencia pertinente. Completa cada artículo con su categoría y profundidad; conserva identificadores e imágenes y verifica las fuentes. Audita todos los textos, ejecuta las comprobaciones y actualiza el informe. Si falta algo, déjalo pendiente. No comiences otra tanda ni publiques.
