# Webpack 5 Build Baseline

Recorded on: 2026-03-12 at 13:27 UTC-3

## Build Command

```bash
npm run build
```

Command runs: `npm run lingui:extract && npm run lingui:compile && cross-env NODE_ENV=production webpack --config webpack.prod.ts`

Build completed successfully in **36008 ms** (36 seconds).

## Asset Summary

### JavaScript Assets

| Asset Name | Raw Size | Gzip Size | Brotli Size |
|---|---|---|---|
| main_f0b8a7e9.js | 1,824,339 bytes (1.74 MiB) | 408,400 bytes (399 KiB) | 323,142 bytes (316 KiB) |

**Total JS Bundle:**
- Raw: 1.74 MiB
- Gzip: 399 KiB (78.6% compression)
- Brotli: 316 KiB (82.3% compression)

### CSS Assets

| Asset Name | Raw Size | Gzip Size | Brotli Size |
|---|---|---|---|
| main_f0b8a7e9.css | 780,752 bytes (762 KiB) | 551,641 bytes (539 KiB) | 545,139 bytes (532 KiB) |

**Total CSS Bundle:**
- Raw: 762 KiB
- Gzip: 539 KiB (29.3% compression)
- Brotli: 532 KiB (30.2% compression)

### Additional Assets

| Asset Name | Raw Size |
|---|---|
| main_f0b8a7e9.js.LICENSE.txt | 2,733 bytes |
| index.html | 849 bytes |
| logo/ (directory) | 85.7 KiB (7 SVG/PNG files) |
| image/ (directory) | 248 KiB (goodreads_import.png) |

## Entrypoint

- **Name:** main
- **Combined Raw Size:** 2.48 MiB
- **Combined Gzip Size:** 948.4 KiB
- **Combined Brotli Size:** 848 KiB (JS + CSS)

## Webpack Warnings

Three performance warnings were generated:
1. Asset size limit exceeded: main_f0b8a7e9.css (762 KiB)
2. Asset size limit exceeded: main_f0b8a7e9.js (1.74 MiB)
3. Asset size limit exceeded: goodreads_import.png (248 KiB)
4. Entrypoint size limit exceeded: main (2.48 MiB)

## Build Artifacts Location

All build artifacts are output to: `server/public/`

Static assets (logos, images) are copied from `client/public/` to:
- `server/public/logo/` (7 files, 85.7 KiB)
- `server/public/image/` (1 file, 248 KiB)

## Test Results

**Command:** `npm test`

**Summary:**
- **Test Suites:** 69 passed, 69 total
- **Tests:** 1109 passed, 1109 total
- **Snapshots:** 2 passed, 2 total
- **Duration:** 17.085 seconds
- **Status:** ✅ All tests pass

Test configuration: Jest 28.1.3 with jest-environment-jsdom

## Type Checking

**Command:** `npm run check-types` (tsc --noEmit)

**Result:** ✅ No TypeScript errors

TypeScript version: 4.7.3

## Build Environment Details

- **Node.js:** v23.4.0
- **npm:** 10.8.0 (approximately, based on package.json)
- **Environment:** NODE_ENV=production
- **Webpack:** 5.80.0
- **Babel:** 7.26.0
- **React:** 17.0.2
- **Lingui:** 3.13.3

## Baseline Metrics

### Performance Metrics for Post-Migration Comparison

These metrics establish the baseline for measuring bundle size changes during the UI Stack Migration to Vite 6 + React 19 + Tailwind v4 + shadcn/ui v4.

**Bundle Size Baseline:**
- JS: 1.74 MiB (raw) / 399 KiB (gzip) / 316 KiB (brotli)
- CSS: 762 KiB (raw) / 539 KiB (gzip) / 532 KiB (brotli)
- **Total (JS + CSS):** 2.48 MiB (raw) / 938 KiB (gzip) / 848 KiB (brotli)

**Acceptable Post-Migration Bundle Size (within 20% increase):**
- JS: ≤ 2.09 MiB raw (20% above 1.74 MiB)
- CSS: ≤ 914 KiB raw (20% above 762 KiB)
- **Total:** ≤ 2.98 MiB raw (20% above 2.48 MiB)

**Test Pass Rate Baseline:** 100% (1109/1109 tests passing)

## Notes

- Compression plugins are configured in webpack.prod.ts: both gzip (.gz) and brotli (.br) variants are generated for all JS and CSS assets
- The @lingui/loader is used for extracting and compiling message catalogs across 28 locales
- React Spring animations are included in the JS bundle (post-migration: replaced with CSS transitions in US-016, US-011)
- Styled-components are included in the CSS (post-migration: replaced with Tailwind utilities)
- PostCSS processes Tailwind v3 configuration
- The main entry point is `client/src/index.tsx`
- All static assets are copied from `client/public/` to the output directory

---

**Status:** ✅ Baseline established successfully

This baseline can be used to compare bundle sizes and test pass rates after applying the UI Stack Migration (Webpack 5 → Vite 6, React 17 → 19, Tailwind v3 → v4, styled-components → Tailwind utilities, React Spring → CSS transitions).
