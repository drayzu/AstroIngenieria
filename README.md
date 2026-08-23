# AstroIngeniería — Museo Orbital

> ✦ **[ENTRAR AL MUSEO](https://drayzu.github.io/AstroIngenieria/)** — exposición permanente interactiva, en vivo

Un museo nocturno dedicado a la ingeniería a escala cósmica. Nueve salas que ascienden desde una estación orbital hasta civilizaciones capaces de mover estrellas: hábitats giratorios, enjambres de Dyson, velas de fusión, terraformación de mundos, ingeniería solar y más. Cada obra se presenta con el rigor de un catálogo técnico y la inquietud de quien dibuja planos del futuro.

Y sobre las salas, el cielo está vivo: constelaciones que se forman al paso del cursor —o que puedes trazar tú con Mayús+clic—, meteoros que cruzan la noche y una resortera celestial lista para disparar.

## Qué Incluye

- 9 salas temáticas en un recorrido continuo, de la introducción mínima a las civilizaciones cósmicas.
- 106 conceptos estructurados con escala, plausibilidad, mecanismo, riesgos, métricas y fuentes.
- Sala de estudio por obra: narrativa visual, lectura larga guiada, dossier técnico y fuentes enlazadas desde NASA, SETI y otros materiales técnicos.
- Un cielo interactivo sobre todo el recorrido: estrellas con gravedad de cursor, constelaciones ambientales, constelaciones dibujables y una resortera de meteoros — mantén clic, tensa y suelta; a plena potencia, el proyectil chisporrotea contra los bordes del cielo.
- Rutas directas a salas y conceptos para compartir cualquier pieza de la exposición.
- Galería de ilustraciones WebP generadas para acompañar cada concepto.

## Stack

- React 19
- TypeScript
- Vite
- Framer Motion
- Canvas 2D para el cielo estelar interactivo
- Sharp para generación de assets

## Desarrollo

```bash
npm install
npm run dev
```

Vite sirve la app en desarrollo y usa la base `/AstroIngenieria/`, igual que la publicación en GitHub Pages.

## Verificación

```bash
npm run lint
npm run build
```

El build ejecuta TypeScript, genera el bundle de Vite y crea `dist/404.html` como fallback para rutas internas en GitHub Pages.

## Publicación

```bash
npm run deploy
```

El deploy publica `dist/` en GitHub Pages mediante `gh-pages`.

## Estructura De Contenido

La base documental original está en `docs/AstroIngenieria.txt`. La aplicación usa datos estructurados derivados y enriquecidos en `src/data/astroData.ts`, manteniendo rutas internas para salas y conceptos individuales.

## Ilustraciones

La galería usa assets WebP en `public/illustrations/`. Se pueden regenerar con:

```bash
npm run generate:illustrations
```

Los datos de cada concepto, incluyendo prompts, alt text, capas y hotspots, viven en `src/data/astroData.ts`.

![Cilindro de O'Neill interior](public/illustrations/ai/concepts/habitats/interiors/oneill-cylinder.webp)

![Cilindro de O'Neill conceptual](public/illustrations/ai/concepts/habitats/conceptual/oneill-cylinder.webp)

![Dyson Shell](public/illustrations/ai/concepts/energy/immersive/dyson-shell.webp)

![Cilindro de McKendree](public/illustrations/ai/concepts/habitats/immersive/mckendree-cylinder.webp)
