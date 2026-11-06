# LogForensics web console

React 19 + TypeScript + Vite frontend for the local LogForensics API.

## Development

```powershell
npm install
npm run dev
```

Vite runs on `http://127.0.0.1:5173` and proxies `/api` to the FastAPI process on
`http://127.0.0.1:8000`. Start the API from the repository root first:

```powershell
python app.py
```

## Production build

```powershell
npm run build
```

The output in `web/dist` is served by FastAPI at `http://127.0.0.1:8000`.

## Checks

```powershell
npm run lint                # oxlint
node scripts/ui-check.mjs   # headless Edge assertions (desktop + mobile)
node scripts/screenshots.mjs
```

Both browser scripts use `playwright-core` with the system Microsoft Edge. Start
the app first; override the target with `LOGFORENSICS_URL`.

## Structure

```text
src/
├── components/   # shell, drawers, command palette, shared UI
├── context/      # auth, cases, theme, toasts
├── lib/          # typed API client, formatting, constants, hooks
├── pages/        # landing, login, workspace pages, 404
├── App.tsx       # routes and protected-route wiring
└── styles.css    # design tokens and component styles
```
