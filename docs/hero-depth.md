# Profundidad de la portada

> Estado: experimento desactivado. La portada de producción usa una sola imagen estática. El componente, las placas y la prueba permanecen guardados para una posible revisión futura.

La portada usa tres placas alineadas de 1855 × 848 px, producidas con la herramienta integrada `image_gen` y exportadas a WebP con Sharp (calidad 92, alfa 100). No se usó el CLI ni se añadieron dependencias. La generación conserva la composición general, con diferencias pequeñas de geometría y textura respecto de la ilustración original.

## Archivos

- Original conservado: `public/illustrations/ai/habitats-hero.webp`.
- Fondo opaco: `public/illustrations/ai/hero-depth/background.webp`.
- Estructuras intermedias con alfa: `public/illustrations/ai/hero-depth/middle.webp`.
- Primer plano con alfa: `public/illustrations/ai/hero-depth/foreground.webp`.
- Comportamiento: `src/designs/museo-orbital/HeroDepth.tsx`.

Las tres placas pesan aproximadamente 451 KiB en total. Comparten encuadre `cover`, posición `center 30%` y margen del 6 %. La animación de entrada pertenece al contenedor; cada placa tiene su propia traslación. Los desplazamientos horizontales máximos son ±3/8/16 px y los verticales el 60 %. Los resortes usan rigidez 85, amortiguación 24 y masa 1. Los cambios por fotograma pasan por MotionValues, no por estado React.

Solo se descargan las placas con puntero preciso, hover y movimiento permitido. Se muestra el original hasta decodificar las tres; cualquier error, diferencia de dimensiones o demora superior a 15 segundos mantiene el original. El modo táctil y movimiento reducido usan el original estático. La respuesta se suspende fuera de pantalla, con pestaña oculta y durante el Playground y sus transiciones.

## Validación y vista previa

```sh
node scripts/checkHeroDepth.mjs
npx eslint src/designs/museo-orbital/HeroDepth.tsx src/designs/museo-orbital/MuseoOrbital.tsx scripts/checkHeroDepth.mjs
npm run build
```

El script abre un servidor temporal en el puerto 5194 y valida movimiento acotado, retorno al centro, posición fija del título, ausencia de renders React provocados por el puntero, imagen ampliada, pausa fuera de pantalla, Playground, cambios de movimiento reducido, móvil, carga pendiente y fallo de carga. Guarda capturas y resultados en `output/hero-depth/`. Se puede indicar un servidor ya abierto mediante `HERO_DEPTH_PREVIEW_URL`.

La grabación de esta revisión se encuentra en `output/hero-depth/preview.mp4`; las capturas incluyen vistas de escritorio, extremos, móvil y modo imagen. El lint de los archivos modificados pasa. El lint global detectó 12 errores previos de `no-undef` en los scripts `output/study-room-cinema/build-tanda-02-previews.mjs` a `build-tanda-07-previews.mjs`.

## Corrección de rendimiento

La grabación anterior corresponde a la primera implementación. Tras detectar lentitud:

- Se eliminó el filtro de color sobre el conjunto animado y la opacidad permanente del grupo. El sombreado de lectura permanece en su capa existente.
- La imagen original se retira del DOM mientras se muestran las placas, evitando una cuarta imagen de pantalla completa. Se eliminó el fundido adicional entre ambas versiones.
- La luz del cursor usa ahora una textura de gradiente fija de 680 × 680 px que se desplaza, en vez de repintar un gradiente del tamaño de la portada. Sus variables se escriben solo en esa luz, sin invalidar estilos de todos los descendientes del hero.
- Los límites de la portada se miden al redimensionar/desplazar, no en cada evento del puntero. Las placas usan traslación 3D y los resortes se detienen con una tolerancia subpíxel de 0,064 px en el primer plano.
- Tras una gracia de 3,5 segundos, se mide la cadencia solo durante movimiento continuo del puntero. Una ventana de al menos 2,4 segundos y 25 muestras, con promedio superior a 30 ms y más del 65 % de intervalos superiores a 28 ms, desactiva las placas. El original queda estático durante el resto del montaje. No se guardan preferencias ni se alterna repetidamente entre versiones. Pausas, pestañas ocultas y salida del puntero reinician la muestra.

En Chromium automatizado a 1440 × 1000, con el mismo recorrido sintético del cursor, la mediana pasó de 83,3 ms a 50,1 ms antes de aplicar el respaldo automático. Estas cifras comparan cambios en el entorno de prueba; no predicen los FPS de un navegador con otra GPU. La prueba de carga sostenida comprueba que el respaldo realmente retira las capas, conserva una imagen cargada y no vuelve a activarse al mover el ratón.

## Prompts finales

Las tres ediciones usaron como referencia y objetivo `public/illustrations/ai/habitats-hero.webp`, previamente inspeccionado. Cada placa se generó en una llamada independiente.

### Fondo

> Edit target: attached space panorama. Produce ONLY the opaque BACKGROUND PLATE for a layered parallax scene. Keep exact original wide aspect ratio, framing, star position in upper right, distant solar megastructure around it, small planets, galaxies, Milky Way and lighting/colors. Remove the entire foreground balcony/building/person along left and bottom-left, the large solar panels entering from right edge, the two prominent ring stations in upper left, the central asteroid mining cluster and its trail and the tall solar panel near center. Inpaint these removed areas with continuous matching starfield/nebula. Leave distant tiny objects near sun. No new objects, no text. Preserve unchanged regions as faithfully as possible. Output single clean background plate, not a collage.

### Plano medio

> Use case: background-extraction. Edit target: original wide space panorama. Extract ONLY its middle-distance objects as one RGBA TRANSPARENT plate for exact compositing. Keep entire original canvas aspect ratio 1855:848, positions, sizes, perspectives, colors and lighting unchanged. Include BOTH ring stations at upper-left (large ring centered x35%, y17%; small ring x24%, y29%) and their attached machinery, the vertical solar panel centered x54%,y19%, and the central asteroid/mining station cluster with its asteroid trail around x57%,y44%. All other pixels must be genuinely transparent, including the holes of rings and gaps between machinery. EXCLUDE the foreground left building/balcony/person, right-edge large panels, star, planets, distant sun structures and all sky/stars/nebula. Do not reposition, enlarge or rearrange the objects. No visible backdrop, no checkerboard baked into pixels, no shadow matte, no sheet labels. Fine antialiased cutout edges. Single full-size aligned transparent plate.

### Primer plano

> Use case: background-extraction. Edit target: original wide space panorama. Extract ONLY the foreground structures into a genuinely transparent RGBA image, entire original 1855:848 wide canvas, NO recentering or cropping. Keep EXACT original object positions, shapes, dimensions, perspective, lighting/colors and tiny person. Include ONLY: (1) dark massive architectural wall at far left with diagonal brace, round balcony/platform in lower-left with standing human at original position and all its supporting building down to bottom edge; (2) large solar-panel assembly entering from RIGHT edge, keeping its original silhouette. All other areas should be fully transparent including sky in between building braces and panel gaps. Remove all ring stations, asteroids, center solar panel, stars, planets, sun and distant structures. No invented details or new objects, no backdrop or shadow matte or baked checkerboard, no labels. Maintain original framing with empty transparent space between foreground left building and right solar panels. Precise clean antialiased alpha edges.
