# Museum languages

The production museum supports `es` and `en`. The first visit uses Spanish;
`mo-locale` stores a visitor's explicit choice. `LocaleProvider` updates the
document language and metadata, and notifies reading panels before switching.
The language selector appears on the cover, in the index and in the cosmic
laboratory. Reading rooms inherit the selected language without their own selector.

`messages.ts` contains typed interface dictionaries. Spanish copy is the key;
use `t('Capítulo {0}', number)` for interpolated messages. Catalog translations
are overlays keyed by the original chapter and concept IDs. Assets, hashes,
metrics, bibliography and storage IDs remain independent of the language.

English articles are static, complete translations loaded by source chapter
through `loadArticle(chapterId, conceptId, locale)`. The cache separates languages.
The English introduction says **Astroengineering**, while the minigame continues
to use the project name **ASTROINGENIERÍA** and its existing score records.

The long-form English draft was authored with an offline OPUS-MT model. Exhibit
names and mathematical passages have been reviewed separately. As with other
editorial changes, further prose edits should be reviewed against the Spanish
original, especially technical terminology and scientific uncertainty.

## Checks

Run `npm run check:i18n` for complete article coverage, references, numbers,
mathematical symbols, assets, browser persistence, switching, accessibility,
reading progress, selected images, laboratory state and mobile layout. Existing
Spanish article, reader, journey and laboratory checks remain applicable.

## Offline authoring

The deployed site needs no translator, API key, Python or network translation.
To regenerate drafts deliberately, first run `node scripts/generateEnglish.mjs
--extract`. Translate the extracted strings using `scripts/translateEnglish.py`
with CTranslate2, SentencePiece and an OPUS-MT Spanish-to-English model. The
script accepts `--model` and `--device` arguments. Authoring inputs and caches
live in the ignored `tmp/english-authoring` directory.

Then run `node scripts/generateEnglish.mjs` to assemble static files. Reviewed
names and paragraphs are kept in `scripts/englishTerminology.mjs` and
`scripts/englishReview.mjs`; update those when their original source changes.
Finish with the language, article, reader, journey and laboratory checks.
