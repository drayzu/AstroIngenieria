# AstroIngeniería — Museo Orbital

<p align="center">
  <a href="https://drayzu.github.io/AstroIngenieria/">
    <img alt="✦ ENTRAR AL MUSEO — Museo Orbital en línea" src="public/readme/entrar-al-museo-v2.svg">
  </a>
</p>

Durante casi toda la historia del cosmos, las estrellas nacieron y murieron sin que nada pudiera preguntarse si podían ser distintas. De ese mismo universo surgió una inteligencia capaz de comprender sus leyes y, ahora, de crear nuevas inteligencias.

**AstroIngeniería nace de lo que viene después:** de la posibilidad de que comprender el universo sea solo el comienzo.

Este proyecto es un museo digital dedicado a la ingeniería a escala cósmica: un recorrido desde las primeras estructuras orbitales hasta civilizaciones capaces de transformar planetas, capturar la energía de estrellas o modificar sistemas enteros. Hábitats giratorios, enjambres de Dyson, propulsión interestelar, terraformación, ingeniería estelar y otras ideas se presentan no como una predicción del futuro, sino como una exploración de lo que las leyes conocidas de la naturaleza podrían permitirnos construir.

La intención es habitar esa frontera extraña entre **ciencia, ingeniería y futuro**: conservar el rigor suficiente para distinguir lo plausible de lo especulativo, sin perder de vista la pregunta que hace interesantes a todas estas ideas:

> **¿Qué ocurre cuando una inteligencia que aprendió a comprender el universo empieza también a preguntarse qué puede hacer con él?**

---

## El museo

El recorrido está dividido en **9 salas temáticas** y reúne **106 conceptos**, avanzando progresivamente desde tecnologías orbitales relativamente cercanas hasta ingeniería planetaria, estelar y civilizaciones de escala cósmica.

Cada concepto incluye, según corresponda:

* mecanismo físico o principio de funcionamiento;
* escala y nivel de plausibilidad;
* métricas y órdenes de magnitud;
* riesgos y limitaciones;
* contexto narrativo y visual;
* fuentes y material técnico para profundizar.

Las salas de estudio combinan una lectura visual con dossiers técnicos y referencias externas de NASA, SETI y otras fuentes científicas o de ingeniería.

El museo no busca borrar la diferencia entre lo posible y lo fantástico. Parte de ella.

---

## Un cielo vivo

La exposición ocurre bajo un cielo interactivo que acompaña todo el recorrido.

Las estrellas reaccionan al cursor, aparecen constelaciones ambientales y puedes trazar las tuyas propias con **Mayús + clic**. Meteoros atraviesan ocasionalmente el cielo y una pequeña resortera permite lanzarlos manualmente: mantén pulsado, tensa y suelta.

La interfaz está pensada como parte de la experiencia, no únicamente como una forma de navegar entre fichas.

---

## Qué incluye

* 9 salas temáticas en un recorrido continuo.
* 106 conceptos de astroingeniería estructurados.
* Fichas con escala, plausibilidad, mecanismos, riesgos, métricas y fuentes.
* Lecturas extensas y dossiers técnicos.
* Navegación directa a salas y conceptos individuales.
* Vitrina para contrastar conceptos.
* Archivo de fuentes.
* Cielo estelar interactivo mediante Canvas.
* Constelaciones ambientales y dibujables.
* Sistema de meteoros e interacciones físicas.
* Galería de ilustraciones WebP para los distintos conceptos.

---

## Stack

* React 19
* TypeScript
* Vite
* Framer Motion
* Canvas 2D
* Sharp
* GitHub Pages

---

## Desarrollo local

```bash
npm install
npm run dev
```

Vite sirve la aplicación utilizando la base `/AstroIngenieria/`, consistente con su publicación en GitHub Pages.

### Verificación

```bash
npm run lint
npm run build
```

El proceso de build ejecuta TypeScript, genera el bundle de Vite y crea `dist/404.html` como fallback para las rutas internas utilizadas en GitHub Pages.

### Publicación

```bash
npm run deploy
```

El deploy publica `dist/` en GitHub Pages mediante `gh-pages`.

---

![Portada del museo — AstroIngeniería](public/readme/1.png)

![Cilindro de O'Neill interior](public/illustrations/ai/concepts/habitats/interiors/oneill-cylinder.webp)

![Sala 0 — Introducción](public/readme/3.png)

![Cilindro de O'Neill conceptual](public/illustrations/ai/concepts/habitats/conceptual/oneill-cylinder.webp)

![Dossier técnico de un concepto](public/readme/5.png)

![Dyson Shell](public/illustrations/ai/concepts/energy/immersive/dyson-shell.webp)

![Archivo de fuentes y cierre del recorrido](public/readme/7.png)

![Cilindro de McKendree](public/illustrations/ai/concepts/habitats/immersive/mckendree-cylinder.webp)

![Misión completada — cierre de la exposición](public/readme/final.png)