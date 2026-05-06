You are working in a live production Electron accounting system (Arabic RTL).
The app has dual codebases that must stay in sync:
  - Frontend: frontend-desktop/src/main/ (db.js, ipcHandlers.js)
  - Backend:  backend/src/desktop-compat/ (db.js, ipcHandlers.js)
Any DB schema or IPC handler change MUST be applied to BOTH paths.

ARCHITECTURE RULES:
- SQLite via better-sqlite3. Schema migrations use ALTER TABLE with try/catch.
- IPC handlers follow the pattern: ipcMain.handle('channel-name', handler).
- Renderer pages live under frontend-desktop/src/renderer/views/{page}/.
- Shared assets: assets/js/ (autocomplete.js, i18n.js, theme.js, toast.js, globalSearch.js).
- i18n: ar.json dictionary, accessed via t('section.key', 'fallback') and fmt() for placeholders.
- All UI text must be Arabic. English only in code identifiers.

STRICT RULES:
- Do not modify, delete, reformat, or refactor any existing code.
- Do not change logic, behavior, structure, naming, or styling.
- Do not touch package.json, config files, or project structure.
- Only change what is explicitly requested. Nothing else.
- When editing ipcHandlers.js or db.js, always apply to BOTH frontend-desktop AND backend copies.

REQUIRES PRIOR APPROVAL:
- New libraries, dependencies, imports, or files.
- Any UI/styling changes beyond what was requested.
- package.json or lock file changes.
- New i18n keys (propose Arabic + English fallback first).

CODE STYLE:
- Match existing files exactly (spacing, naming, structure, patterns).
- Reuse existing components and CSS classes only.
- If a similar feature exists elsewhere, follow its pattern exactly.
- DB columns use snake_case. JS variables use camelCase.
- Use try/catch for ALTER TABLE migrations (column may already exist).

TRANSLATIONS:
- Never edit ar.json without proposing translations first.
- Format: Arabic translation + English fallback.
- Use fmt() with {placeholder} syntax for dynamic values.
- Wait for user approval before applying.

PAGE MAP REFERENCE:
- Before any modification, read .github/page-map.md to identify exact file paths, IPC channels, DB tables, CSS classes, and dark mode selectors for the target page.
- This eliminates guesswork and reduces search time significantly.
- After any change (new page, new IPC channel, DB schema change, new CSS classes), update page-map.md immediately in the same step.

EXECUTION FLOW (MANDATORY):
1. Read the task fully.
2. Check .github/page-map.md for relevant file paths and dependencies.
3. Respond in Arabic only, concisely.
4. Confirm understanding and planned action.
4. List ALL questions needed to execute correctly.
5. If translations involved: propose Arabic + English, wait for approval.
6. Wait for confirmation before applying.
7. Apply only the approved change.
8. Do not alter surrounding code.
