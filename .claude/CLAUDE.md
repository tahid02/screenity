# CLAUDE.md

Screenity — privacy-friendly Chrome MV3 extension. React 18, Webpack 5, Chrome Extension APIs. Loads from `build/`. **No test runner exists.**

## Dev Commands

- `npm start` — dev server on port **3001** (set in `.envrc`)
- `npm run build` — dev build to `build/`
- `npm run build:prod` — production build (minified)
- `npm run build:release` — prod build with `SCREENITY_SKIP_ENV=true` (open-source release)
- `npm run watch` — webpack watch, no dev server
- `npm run hot-reload` — alternative hot-reload (`webpack serve --hot`)
- `npm run build:content-css` — compile SCSS for content script
- `npm run package` — prod build + zip (includes env)
- `npm run package:release` — prod build + zip (`SCREENITY_SKIP_ENV=true`, no env)
- `npm run clean` — delete and recreate `build/`
- `npm run lint` — ESLint on `src/**/*.js` only (not .jsx/.ts), with `--fix`
- `npm run prettier` — format all JS/JSON/CSS/MD

## Postinstall

`npm install` runs `patch-package` + `node scripts/patch-radix.js`. Patches: `fabric` (two versions), `plyr`, and `@radix-ui/react-use-callback-ref` (optional-chaining crash fix).

## Architecture

Chrome MV3, page-per-feature. Each page = separate webpack entry → own `.html` + `.bundle.js`.

- **Background** (`src/pages/Background/index.js`) — Service worker: recording state, message routing, tab management, auth, offscreen documents.
- **Content Script** (`src/pages/Content/index.jsx`) — Two scripts: recording (`contentScript`) and screenshot (`screenshotContentScript`).
- **Pages** — Independent React apps: `Recorder`, `EditorWebCodecs`, `EditorViewer`, `Region`, `Setup`, `Permissions`, `Download`, `Camera`, etc.
- **OffscreenRecorder / AudioOffscreen** — Offscreen documents for background media capture (MV3 requirement).

State: `chrome.storage.local` only — no Redux, no localStorage, no IndexedDB.  
Messaging: `src/messaging/messageRouter.js` + `src/pages/Background/messaging/handlers.js`.  
Media: WebCodecs (`EditorWebCodecs/`) is the modern path; MediaRecorder (`OffscreenRecorder/`) is fallback; FFmpeg (`Editor/`) is legacy.

## Adding a Page

1. Create `src/pages/YourPage/index.jsx` + `src/pages/YourPage/index.html`
2. Add entry in `webpack.config.js` `entryPoints` object
3. Add `HtmlWebpackPlugin` config if it needs special mapping (see `folderNameMap`)
4. Add to `manifest.json` → `web_accessible_resources` if web-accessible
5. Add message handler in `src/pages/Background/messaging/handlers.js` if it talks to the service worker
6. Open via `chrome.windows.create()` or `chrome.tabs.create()` from background

## Key Gotchas

- **HMR exclusions:** Background, contentScript, and sandbox are excluded from HMR (`custom.config.js` → `notHMR`). Background changes require manual extension reload at `chrome://extensions/`.
- **Chrome API style:** Use callbacks, not `await`, in background scripts where callback patterns already exist.
- **TypeScript:** Configured but `allowJs: false`, `checkJs: false`. Only `src/media/fastRecorderGate.ts` uses it. Everything else is `.js`/`.jsx`.
- **Babel:** Targets Chrome 110. JSX runtime is `"automatic"`.
- **Webpack cache:** `node_modules/.cache/webpack/`
- **COEP/COOP headers** in manifest for media isolation — can break some third-party resources.
- **Env files:** `.env.local` (dev), `.env.production` (prod). Release skips via `SCREENITY_SKIP_ENV=true`. Injected vars: `SCREENITY_APP_BASE`, `SCREENITY_WEBSITE_BASE`, `SCREENITY_API_BASE_URL`, `SCREENITY_ENABLE_CLOUD_FEATURES`, `MAX_RECORDING_DURATION` (default 3600), `RECORDING_WARNING_THRESHOLD` (default 60), `SCREENITY_DEV_MODE`.
- **Stale locks:** If recording state is stuck, check `sendingChunks` — `clearStaleLocks()` in `Background/index.js` clears them on restart.

## Loading in Chrome

1. `npm start` or `npm run build`
2. `chrome://extensions/` → enable Developer mode
3. Load unpacked → select `build/`
4. Background changes require manual reload on the extension card

## Debugging

- Background DevTools: `chrome://extensions/` → Details → Inspect views → `service_worker`
- Content script DevHUD: press `?` or set `devHUD` in localStorage
- Storage state: `chrome.storage.local.get(null)` in background console
- Diagnostic logging: `diagEvent()` in `src/pages/utils/diagnosticLog.js`
- Message routing: add logs in `src/messaging/messageRouter.js`
- WebCodecs gate: `src/media/fastRecorderGate.ts`

---

## ⚠️ Screenshot Feature Isolation (MANDATORY)

Screenshot code lives in `src/screenshot/` — completely separate from `src/pages/`. Hard architectural constraint.

### Rules

- All screenshot code goes in `src/screenshot/` only
- Copy files rather than importing from `src/pages/` when modification is needed (duplication over shared imports)
- Only import screenshot code **into** core files ( core files means the files outside the /screenshot directory ) — never the reverse
- Only 4 core files may be modified: `Background/index.js`, `Content/index.jsx`, `webpack.config.js`, `manifest.json`. if any other core files must needed to modify then ask/confirm from the user first providing with proper justification.
- Screenshot feature must be deletable by removing `src/screenshot/` + few lines from core files

### Naming (strictly enforced)

- Storage keys: `screenshot_*` prefix
- Message actions: `screenshot_*` prefix
- CSS classes: `screenity-screenshot-*` prefix

### Directory Structure

```
src/screenshot/
├── pages/
│   ├── Background/
│   │   ├── handlers.js        # Screenshot message handlers
│   │   ├── captureManager.js  # Orchestrate capture
│   │   └── storage.js         # Screenshot state management
│   ├── Content/
│   │   ├── overlays.jsx       # Screenshot capture UI
│   │   └── listeners.js       # Screenshot-specific event handlers
│   ├── ScreenshotCapture/
│   │   ├── index.jsx
│   │   └── index.html
│   └── ScreenshotEditor/
│       ├── index.jsx
│       └── index.html
├── utils/
├── hooks/
└── constants.js
```

### Code Patterns

```js
// ✅ Storage keys
chrome.storage.local.set({ screenshot_captured: { ... } });
chrome.storage.local.get("screenshot_history");

// ✅ Message actions
chrome.runtime.sendMessage({ action: "screenshot_capture", payload: { ... } });

// ✅ CSS classes
<div className="screenity-screenshot-editor-toolbar">

// ❌ Don't touch recording state
chrome.storage.local.get("recordingState");

// ❌ Don't cross-import from pages/
import DrawingCanvas from "src/pages/EditorWebCodecs/components/DrawingCanvas.jsx";
// ✅ Copy instead to src/screenshot/pages/ScreenshotEditor/components/DrawingCanvas.jsx
```

### Pre-commit Checklist

- [ ] All new code in `src/screenshot/` (except minimal core imports)
- [ ] All storage keys use `screenshot_*` prefix
- [ ] All message actions use `screenshot_*` prefix
- [ ] All CSS classes use `screenity-screenshot-*` prefix
- [ ] No imports from `src/pages/recording/*` or `src/pages/Recorder/`
- [ ] Feature deletable by removing `src/screenshot/` + few lines from core files

Full rules: `.claude/SCREENSHOT_ISOLATION_RULES.md`
