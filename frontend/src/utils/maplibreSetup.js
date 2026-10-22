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
// Import this module once before creating any maplibregl.Map.
// ============================================================

import * as maplibregl from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

maplibregl.setWorkerUrl(maplibreWorkerUrl);

export default maplibregl;
