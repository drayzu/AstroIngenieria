# AstroIngeniería

Atlas narrativo interactivo en español para estudiar, contemplar y comparar conceptos de astroingeniería: hábitats espaciales, infraestructura orbital, energía estelar, propulsión, ingeniería planetaria, ingeniería estelar y civilizaciones cósmicas.

## Desarrollo

```bash
npm install
npm run dev
```

## Verificación

```bash
npm run lint
npm run build
```

## Ilustraciones

La galería usa 106 assets WebP más un hero en `public/illustrations/`. Se pueden regenerar con:

```bash
npm run generate:illustrations
```

Cada concepto incluye prompt, alt text, capas y hotspots en `src/data/astroData.ts`, de modo que los WebP iniciales pueden reemplazarse por imágenes IA curadas manteniendo la misma interfaz.

## Publicación

El proyecto está configurado para GitHub Pages con base `/AstroIngenieria/`.

```bash
npm run deploy
```

## Contenido

La base documental original está en `docs/AstroIngenieria.txt`. La app usa datos estructurados en `src/data/astroData.ts`, derivados de ese documento y enriquecidos con fuentes técnicas enlazadas desde la propia interfaz.
