# Frontend Desktop (Electron)

## Run

- Install dependencies for desktop only:
  - `npm --prefix frontend-desktop install`
- `npm --prefix frontend-desktop run start`

## Backend Connectivity

- Health check command:
  - `npm run desktop:check-backend`
- Environment variable:
  - `BACKEND_URL` (default: `http://localhost:4000`)
- Optional remote mode:
  - `USE_REMOTE_BACKEND=true`
- Optional RPC token:
  - `BACKEND_RPC_TOKEN=<token>`

Renderer access (future use):

- `window.electronAPI.checkBackendHealth()`
