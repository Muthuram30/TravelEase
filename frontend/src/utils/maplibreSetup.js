// ============================================================
// Shared maplibre-gl runtime setup.
//
// Why this exists: maplibre-gl v6 does not inline its worker. The bundle
// resolves the worker as `new URL('./maplibre-gl-worker.mjs', import.meta.url)`,
// but Vite's dev dep-optimizer flattens maplibre into a single file
// (~/.vite/deps/maplibre-gl.js), so that relative URL 404s and every map
// fails with "Worker failed to load. Check that the worker URL is correct."
// Importing the real worker file with `?url` and setting it explicitly
// fixes dev AND production builds.
//
// Usage: `import * as maplibregl from '<path>/utils/maplibreSetup';`
// (re-exports every maplibre-gl symbol so it is a drop-in replacement
// for `import * as maplibregl from 'maplibre-gl'`).
// ============================================================

import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { setWorkerUrl } from 'maplibre-gl';

setWorkerUrl(maplibreWorkerUrl);

export * from 'maplibre-gl';
