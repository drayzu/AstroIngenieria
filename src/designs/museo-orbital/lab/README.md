# Colección del laboratorio

Solo se abre en desarrollo: mantener **Q + E** durante dos segundos. El menú comienza en Nuevos (24); Todos muestra los 32 fenómenos. Los gestos de supernova, cometa y constelación siguen disponibles en Explorar.

Las tarjetas permiten seleccionar, probar en una escena vacía y guardar favoritos. Después de colocar, los círculos luminosos son los tiradores. Esc cancela una herramienta o restaura un gesto en curso; otra pulsación sale. Repetir último vuelve a preparar la herramienta. Los favoritos usan `museo-orbital:lab-favorites:v1` en localStorage.

## Extender la colección

- `registry.ts`: catálogo, instrucciones, familia, color, icono y modalidad de creación.
- `shared.ts`: contrato de familia y entorno, geometría, dibujo y cuerpos reutilizables. Los cuerpos físicos usan velocidades en píxeles por frame de 60 Hz, como los cometas del museo.
- `light.ts`, `matter.ts`, `stars.ts`, `structures.ts`: creación, actualización, dibujo y manipulación. No conocen React ni el DOM del museo.
- `collection.ts`: selección de tiradores, cancelación, límites, proyección de lentes, presión luminosa, envejecimiento y limpieza. CosmicLab mantiene gravedad, portales, nebulosas y los ocho experimentos anteriores.

Los asteroides y meteoros pasan por `moveBody`; los cuerpos reutilizados deben pasar por `recycleBody` para borrar captura, bloqueo de portal y estela anteriores. El plasma puede iluminar auroras. Las ondas de proa y motores estelares transfieren movimiento al gas. Los haces del prisma, espejos, púlsares, cuásares y colectores iluminan polvo y empujan velas. Los impactos recorren segmentos, no solo posiciones puntuales.

## Límites y dibujo

Máximo 12 fenómenos nuevos activos y 1600 cuerpos decorativos/físicos asignados en la colección. Los experimentos anteriores conservan sus topes (incluidos 500 gases y 460 estrellas galácticas); el emisor compartido limita los proyectiles del museo a 100. Las rosetas tienen una estela acotada a 900 muestras; las demás estelas son más cortas. Los fragmentos reutilizan espacio reservado.

Máximo 40 haces de entrada, seis salidas por prisma y cuatro rebotes por haz. Los fenómenos duran 90 segundos y atenúan su salida durante los últimos cinco. El detalle decorativo se reduce al 50 % si los frames reales superan 38 ms de forma sostenida y se recupera después. Cambiar la velocidad de simulación no activa esa reducción.

El canvas frontal usa composición CSS normal únicamente mientras el laboratorio está abierto. Las superficies opacas se dibujan con `source-over` y la luz con `screen` dentro del canvas. Esto permite que los cuerpos oscuros oculten el fondo. Los filamentos tienen un contorno oscuro tenue para seguir visibles sobre salas claras.

## Verificación

`npm run check:cosmic-lab` ejecuta el motor real y las pruebas de navegador. Incluye los 24 gestos, portales rápidos, luz/velas, impactos, cancelación, favoritos persistentes, búsqueda, filtros, aislamiento y repetición, límites durante diez minutos simulados y paneles de 390/768/1440 px.

El navegador guarda capturas de cada fenómeno dentro del museo, atlas de las cuatro familias sobre fondos claros y oscuros y escenas de seis efectos en `%TEMP%/astro-cosmic-lab`. La medición de actualización/dibujo mide CPU del motor; no equivale al FPS final de todo el museo.
