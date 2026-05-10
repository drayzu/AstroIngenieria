# AstroIngeniería

Un atlas interactivo en español para explorar ideas de astroingeniería: hábitats espaciales, infraestructura orbital, energía estelar, propulsión avanzada, ingeniería planetaria, ingeniería estelar y civilizaciones cósmicas.

La app combina narrativa, visualización, comparación y fuentes técnicas para convertir conceptos enormes en un recorrido navegable.

## Demo

[Abrir AstroIngeniería en GitHub Pages](https://drayo00.github.io/AstroIngenieria/)

## Qué Incluye

- 9 misiones temáticas, desde una introducción mínima hasta civilizaciones cósmicas.
- 106 conceptos estructurados con escala, plausibilidad, mecanismo, riesgos, notas visuales y fuentes.
- Páginas de misión con filtros por escala, madurez y búsqueda.
- Páginas de concepto con lectura guiada, visuales, capas y puntos de interés.
- Comparador para contrastar tecnologías e ideas por dificultad, madurez, escala y utilidad.
- Lista de fuentes enlazadas desde NASA, SETI y otros materiales técnicos.
- Galería de ilustraciones WebP generadas para acompañar el atlas.

## Stack

- React 19
- TypeScript
- Vite
- Framer Motion
- Three.js / React Three Fiber
- Lucide React
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

## Ilustraciones

La galería usa assets WebP en `public/illustrations/`. Se pueden regenerar con:

```bash
npm run generate:illustrations
```

Los datos de cada concepto, incluyendo prompts, alt text, capas y hotspots, viven en `src/data/astroData.ts`.

## Publicación

```bash
npm run deploy
```

El deploy publica `dist/` en GitHub Pages mediante `gh-pages`.

## Estructura De Contenido

La base documental original está en `docs/AstroIngenieria.txt`. La aplicación usa datos estructurados derivados y enriquecidos en `src/data/astroData.ts`, manteniendo rutas internas para misiones y conceptos individuales.

