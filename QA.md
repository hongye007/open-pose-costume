# Verification

Last checked: 2026-10-30.

## Automated checks

```sh
npm test
npm run build
npm audit
```

All 7 tests and the production build pass; the dependency audit reports no known vulnerabilities. Tests cover catalog completeness, bilingual search, sorting, source hashes, safe JSON extraction and storage failures.

## Browser checks

Checked desktop, tablet and 390 × 844 mobile layouts:

- Search, categories, sorting and language switching work together.
- Favorites and pairings persist across reloads; combined descriptions copy correctly.
- Angle thumbnails switch the image and original link; unavailable angles fall back to an existing view.
- Share links restore filters and selected references.
- Extended categories expose the full catalog: 1,695 references versus 1,112 by default.
- Mobile uses two columns without horizontal page overflow.
- The logo, favicon and bilingual usage guide render correctly.

## Local archive checks

All 5,692 images passed format, size and SHA-256 verification: 1,439 pose covers and originals each, plus 1,407 costume covers and originals each. Total size: 2,097,624,172 bytes. A repeat run reused every file with no downloads or failures.

Archive directories, download records and review artifacts are excluded from Git. Website image availability depends on the upstream sites. Image and data rights are documented in [SOURCES.md](SOURCES.md).
