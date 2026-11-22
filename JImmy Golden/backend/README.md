# Backend API

## Run

1. Install backend dependencies:
   - `npm --prefix backend install`
2. Rebuild native sqlite module for Node runtime:
   - `npm run backend:rebuild-native`
3. Start development server:
   - `npm run backend:dev`
4. Run compatibility check:
   - `npm run backend:check`

## Release Preflight (Mandatory)

Before any build/release or merge, always run from repository root:

1. Sync public RPC contract from frontend preload:
   - `npm run sync:contract`
2. Run strict backend compatibility + smoke checks:
   - `npm run backend:check`

If `public-channels.json` changes after sync, commit it with the related frontend/backend change.

Default server URL: `http://localhost:4000`

## Current Endpoints

- `GET /` simple service info
- `GET /api/health` health + compatibility report
- `GET /api/channels` public channels exposed by desktop preload contract
- `GET /api/channels-local` local Electron-only channels (non-RPC)
- `GET /api/compatibility` exact compatibility summary
- `POST /api/rpc/:channel` invoke any public desktop channel remotely

## Separation Notes

- Backend compatibility runtime loads handlers through `backend/src/desktop-compat/handlers/_loadFrontendHandler.js`.
- Runtime execution uses generated local copies under `backend/src/desktop-compat/generated/handlers`.
- Refresh generated handlers and channel contracts with:
   - `npm run sync:contract`
- Backend owns its compatibility layer under:
  - `backend/src/desktop-compat`
- Backend owns channel contracts under:
  - `backend/src/contracts/public-channels.json`
   - `backend/src/contracts/local-electron-only-channels.json`

## Config

Environment variables:

- `PORT` default `4000`
- `API_PREFIX` default `/api`
- `CORS_ORIGIN` default `*`
- `BACKEND_DATA_DIR` default `./data`
- `BACKEND_RPC_TOKEN` optional shared token for RPC protection
