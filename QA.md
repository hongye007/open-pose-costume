# Verification

Checked on 2026-10-30 (Asia/Shanghai).

## Automated

`npm test` checks source preservation and IDs, bilingual coverage, original image origins, crawl hashes, safe JSON extraction, Chinese/English search, sorting and unavailable browser storage. Seven tests passed.

`npm run build` passes TypeScript checking and produces a static Vite build. `npm install` reported no known dependency vulnerabilities at implementation time.

## Browser verification

Tested in the Codex in-app browser at a desktop breakpoint, a 390 × 844 mobile viewport, and the app's normal tablet-width viewport.

- Both image origins render directly, without an image proxy or downloaded source files.
- Chinese joined-term search `蓝色大衣`, English `blue coat`, source ID search, empty-result feedback and category filtering work.
- Language switching preserves active search/filter state.
- Favorites survive a page reload and appear in the saved collection.
- A pose and outfit can be added to the pairing board; both survive reload.
- Copying the combined description produces the expected clipboard text.
- Selecting a pose's Side view updates both the visible image and original-image link to the source's `_side.png` address.
- Direct links restore the selected reference and angle. The currently missing low-angle view for `full_sexy_P018` falls back to Front and shows a localized explanation.
- The extended-category switch changes the complete collection from 1,112 standard references to all 1,695 references.
- Mobile cards use two columns; the board remains accessible in the top bar. At 390px, document width and scroll width are both 390px.
- No browser runtime errors were observed during verification.

Screenshots, when present, are local review artifacts under `artifacts/`, excluded from Git. They are not a source-image dataset.

## Limits

Remote-image availability depends on the source sites. No image de-emphasis, automatic clothing generation, offline image mirror, account service, cloud sync or public deployment was performed. The source permits contain their own usage restrictions; see SOURCES.md.
