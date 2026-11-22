# Accounting System Monorepo

## Structure

- `frontend-desktop`: Electron desktop application (current production app)
- `frontend-android`: reserved for future Flutter mobile application
- `backend`: Node.js API server that will be deployed externally

## Quick Commands (from repo root)

- Install all dependencies:
  - `npm run setup`
- Sync backend contract from desktop preload (dev maintenance):
  - `npm run sync:contract`
- Start desktop app:
  - `npm start`
- Start backend (dev):
  - `npm run backend:dev`
- Validate backend compatibility with desktop contract:
  - `npm run backend:check`
- Rebuild backend native module (Node ABI):
  - `npm run backend:rebuild-native`
- Check desktop -> backend connectivity:
  - `npm run desktop:check-backend`

## Desktop Shortcut

- Create launcher icon on desktop:
  - `powershell -ExecutionPolicy Bypass -File scripts/create-desktop-shortcut.ps1`
- Direct launcher files:
  - `scripts/launch-desktop-full.cmd` (preferred for desktop shortcut)
  - `scripts/launch-desktop-dev.cmd` (development-only)
- Launcher behavior:
  - Starts backend automatically (if not running)
  - Starts desktop app (packaged if available, otherwise dev Electron)
  - Installs/rebuilds missing native dependencies when needed

## Integration Contract (Current)

- Desktop and backend are runtime-separated.
- Backend reads its own contract file:
  - `backend/src/contracts/public-channels.json`
- Backend exposes:
  - `GET /api/health`
  - `GET /api/channels`
  - `GET /api/compatibility`
  - `POST /api/rpc/:channel`
- Desktop preload supports two modes with no renderer code changes:
  - Local mode: direct Electron IPC
  - Remote mode: HTTP RPC to backend (`USE_REMOTE_BACKEND=true`)
