# Actualizar la versión en español desde el upstream sin perder el español

Guía para la rama `es` del fork `gilberth/open-pose-costume`, cuyo upstream es `hongye007/open-pose-costume`.

## 1. Regla de ramas: nunca hacer sync directo sobre la rama es

No se hace sync directo sobre la rama `es` ni sobre `main` con la traducción mezclada.

- `main` se mantiene como espejo del upstream.
- `es` es la rama que fusiona `main` y sobre la que vive la capa española.

De este modo, una actualización del upstream entra primero en `main` y luego se fusiona en `es`, sin que la traducción quede mezclada con el espejo.

## 2. Flujo exacto de actualización

```sh
git fetch upstream
git checkout es
git merge upstream/main
```

Si el merge genera conflictos, se resuelven solo en los archivos de integración:

- `src/types.ts`
- `src/App.tsx`
- `src/library.ts`
- `src/i18n.ts`
- `src/generation-copy.ts`
- `src/studio-copy.ts`
- `scripts/build-data.mjs`
- `scripts/portrait-data.mjs`

En esos archivos se conserva la estructura nueva del upstream y se vuelve a conectar la capa española, sin reescribir la lógica nueva ni borrar la integración existente.

## 3. Lo que NUNCA hay que tocar a mano en un merge

No se tocan a mano los archivos propios de la capa española, porque el upstream no los conoce y, por tanto, no puede sobrescribirlos:

- `src/*-es.ts`
- `data/vocabulary-es.json`
- `data/pose-titles.es.json`
- `data/portrait-styles-es.json`
- `README.es.md`
- `docs/ES-UPDATES.md`
- `scripts/check-es.mjs`

Si alguno de estos archivos aparece en un conflicto, es señal de que algo se mezcló mal entre ramas: se detiene el merge, se revisa qué rama trajo el cambio y no se resuelve borrando la versión española.

## 4. Después del merge: reconstruir y comprobar

```sh
npm run data:build
npm run check-es
```

- `npm run data:build` regenera el catálogo con la capa española, con fallback a inglés para cualquier token nuevo.
- `npm run check-es` es el script que reporta las claves faltantes en español.

No se da por terminada la actualización sin haber corrido ambos comandos.

## 5. Traducir solo lo faltante

Se traduce solo lo que `check-es` reporte como faltante. Nunca se re-traduce todo el catálogo ni todos los diccionarios en cada actualización: eso es lo que introduce regresiones y trabajo innecesario.

## 6. Regla de fallback

Si algo nuevo del upstream no tiene todavía traducción al español, la app muestra inglés. No rompe ni queda en blanco.

Ese contenido queda pendiente para la siguiente pasada de traducción, cuando `check-es` lo reporte como faltante.
