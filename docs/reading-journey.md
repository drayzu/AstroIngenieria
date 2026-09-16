# Recorrido editorial abierto

El museo ofrece una introducción y ocho capítulos con los 106 temas siempre disponibles, organizados en grupos con subtítulos discretos. Todas las lecturas tienen el mismo rango editorial. Los artículos conservan sus identificadores, textos, títulos literarios, fuentes e imágenes.

## Fuente de verdad

- `src/data/editorialJourney.ts` define el orden de capítulos y grupos, las preguntas, introducciones y fundamentos. Cada concepto aparece una sola vez. El mapa de nombres de catálogo traduce y aclara las denominaciones sin modificar los artículos.
- `src/data/readingJourney.ts` deriva la secuencia completa de 106 lecturas y calcula anterior, siguiente y hasta tres temas relacionados. Las relaciones proceden exclusivamente de los enlaces temáticos existentes.
- `AstroConcept.chapterId` indica la ubicación editorial. `sourceChapterId` indica el archivo de artículos original. Las referencias visuales se construyen antes de aplicar la organización editorial y los nombres del catálogo.

No mover artículos ni recursos al cambiar su capítulo editorial. El lector carga `sourceChapterId`; los enlaces públicos siguen siendo `#obra-<id>`. Los archivos históricos, incluido `complements.ts`, son ubicaciones de almacenamiento.

## Orden de capítulos

0. Introducción.
1. Hábitats espaciales.
2. Industria espacial.
3. Ingeniería planetaria.
4. Energía estelar.
5. Viaje interestelar.
6. Ingeniería estelar.
7. Civilizaciones cósmicas.
8. Inteligencia extraterrestre.

Los grupos siguen una progresión desde fundamentos y mecanismos hasta arquitecturas, aplicaciones y límites. Todos están abiertos; la carga diferida de imágenes se conserva para no descargar el catálogo entero al entrar.

## Navegación

Las tarjetas y sus números siguen el orden de los grupos. La cabecera y el teclado del lector comparten anterior/siguiente, también entre capítulos. Los cruces incluyen el nombre del capítulo de destino. El primer artículo no tiene anterior y el último no tiene siguiente.

Cuando la lectura pertenece a la vitrina, se conserva su navegación contextual: cabecera y teclado siguen el orden de las obras guardadas y respetan los extremos de esa selección. Fuera de la vitrina se usa el recorrido completo.

El índice de capítulos permite saltos libres y en móvil se mantiene compacto y desplazable horizontalmente.

## Verificación

- `npm run check:articles`: cobertura de los archivos originales, fuentes, imágenes y contenido de los 106 artículos.
- `npm run check:journey`: orden editorial acordado, 106 tarjetas abiertas y numeradas, recorrido completo, cabecera y teclado, ausencia de botones al final, cambios de capítulo, vitrina, enlaces y presentación en 1440 y 390 píxeles. Inicia y cierra su propio servidor en el puerto 5186.
- `npm run check:reader`: enlaces directos de todos los artículos, notas, imágenes, vitrina y recuperación tras errores de descarga; requiere el servidor de desarrollo en el puerto 5173.
- `npm run lint` y `npm run build`.

Esta organización conserva los 106 artículos. Radiación y blindaje, autonomía industrial y comunicaciones siguen siendo candidatos para una futura auditoría de cobertura.
