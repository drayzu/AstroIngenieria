# Herramientas de imágenes

Para abrirlas, ejecuta `npm run imagenes` desde la raíz del repo. El navegador se abre en http://localhost:5460/.

- **Elegir para la página** (`/elegir/`) sirve para decidir, sala por sala, la imagen principal y las secundarias. Lo elegido se guarda en `output/study-room-curation/_revision/elegir/elecciones.json`.
- **Referencias para ChatGPT** (`/referencias/`) sirve para juntar en colecciones las imágenes que más gustan. «Preparar para ChatGPT» crea `output/referencias-chatgpt/<colección>/`, que contiene:
  - las imágenes numeradas;
  - `hoja.jpg`, que junta todas las imágenes con su número;
  - `referencias.txt`, el texto para pegar en ChatGPT.

  Las colecciones se guardan en `output/referencias-chatgpt/colecciones.json`.

Comandos:

| Comando | Para qué |
|---|---|
| `npm run imagenes` | Abre las herramientas |
| `npm run imagenes:actualizar` | Rehace `data.json` y las miniaturas cuando llegan imágenes nuevas a `elegida/` |
| `npm run imagenes:aplicar` | Muestra qué cambiaría en la página según `elecciones.json` |
| `npm run imagenes:aplicar -- --write` | Aplica esos cambios: escribe los WebP en `public/illustrations/selected/` y actualiza `src/data/selectedStudyImages.ts` |

El código está aquí. Los datos y las imágenes viven en `output/`, que git no versiona.
