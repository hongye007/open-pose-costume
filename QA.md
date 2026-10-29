# Verification

Last checked: 2026-10-30.

## Automated checks

```sh
npm test
npm run build
npm audit
```

All 13 tests and the production build pass; the dependency audit reports no known vulnerabilities. Tests cover catalog completeness, bilingual search, sorting, source hashes, safe JSON extraction, storage failures, image API requests, key storage, cancellation and provider errors.

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

## Reference generation checks

- Chinese and English settings work on desktop and a 390px mobile viewport without horizontal overflow.
- Saving a configuration enables generation; clearing it removes the action. Keys default to session storage and can optionally be remembered locally.
- A local mock API received both original images as multipart files with the expected model and authorization header. No paid provider was called.
- Loading, HTTP failure, manual retry and successful image display were verified. Switching pose/costume thumbnails updates the comparison reference.
- Missing references open the pairing board with a selection prompt and send no generation request.
- Tests disable Vite WebSocket listeners to avoid port conflicts.
