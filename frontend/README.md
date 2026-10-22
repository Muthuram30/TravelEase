# TravelEase Frontend

React 19 SPA built with Vite. Talks to the PHP REST API in `../backend/api/`.

## Commands

```powershell
npm install     # install dependencies
npm run dev     # dev server at http://localhost:5173
npm run build   # production build to dist/
npm run preview # preview the production build
npm run lint    # oxlint
```

## Key Libraries

- **Three.js / React Three Fiber** — 3D destination viewer & globe
- **MapLibre GL + @maplibre/maplibre-gl-geocoder** — route planner with OpenFreeMap tiles
- **react-router-dom** — client-side routing
- **qrcode** — booking confirmation QR codes

## API Connectivity

The dev server expects the backend at your local Apache host (XAMPP), configured via the API base URL in `src/api/api.js`. Make sure Apache + MySQL are running and the backend is deployed before starting the dev server.
