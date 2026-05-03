# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Screenity is a privacy-friendly Chrome extension for screen recording, annotation, and video editing. It's built as a Manifest V3 extension using React, Webpack, and modern web APIs (MediaRecorder, WebCodecs, Canvas APIs, etc.).

The extension supports:
- Screen, tab, window, and camera recording
- Microphone and internal audio capture
- Real-time annotation (drawing, text, shapes)
- Video editing with a custom editor
- Export to MP4/GIF/WebM or Google Drive/YouTube
- Local-only operation (no data collection)

Key repo: https://github.com/alyssaxuu/screenity

## ⚠️ Screenshot Feature Development (MANDATORY RULES)

This project is implementing a screenshot feature with annotation capabilities as a completely isolated subsystem. 

**🚨 ALL TEAM MEMBERS: You MUST follow the isolation rules in [SCREENSHOT_ISOLATION_RULES.md](SCREENSHOT_ISOLATION_RULES.md) when working on screenshot features.**

**Key Rules (TL;DR):**
- ✅ All screenshot code lives in `src/screenshot/` directory (parallel structure to `src/pages/`)
- ✅ Code duplication is preferred over shared imports (copy files if they need modification)
- ✅ Use `screenshot_` prefix for all storage keys, message actions, and CSS classes
- ✅ Only import screenshot code INTO core files (`src/pages/`) — never the reverse
- ✅ Make minimal changes to core recording files (only for mandatory MV3 requirements)
- ✅ Feature can be safely deleted by removing `src/screenshot/` + 3-5 lines from core files

**For detailed rules, exceptions, and examples:** See [SCREENSHOT_ISOLATION_RULES.md](SCREENSHOT_ISOLATION_RULES.md)

---

## Architecture

### Extension Structure (Manifest V3)

The extension uses a modular page-based architecture:

- **Background Service Worker** (`src/pages/Background/`) — Long-lived service worker that:
  - Manages recording state and lifecycle
  - Handles Chrome extension APIs (permissions, tabs, alarms, storage)
  - Routes messages between content scripts and UI pages
  - Coordinates external integrations (Google Drive, YouTube)
  - Manages offscreen documents for recording contexts

- **Content Script** (`src/pages/Content/`) — Injects into every webpage to:
  - Listen for extension commands
  - Inject the recording overlay UI (DOM wrapper)
  - Capture screen/region selection via user interaction

- **Recording Pages** — Isolated React pages for specific recording modes:
  - `Recorder/` — Default recording UI
  - `CloudRecorder/` — Cloud-based recording (legacy/alternative mode)
  - `OffscreenRecorder/` — Offscreen context for background recording
  - `AudioOffscreen/` — Dedicated worker for audio processing
  - `Camera/` — Camera preview/configuration

- **Editor Pages** — Video editing interfaces:
  - `EditorWebCodecs/` — Modern editor using WebCodecs API
  - `EditorViewer/` — Read-only playback viewer
  - `Editor/` — Legacy editor (FFmpeg-based)

- **Utility Pages** — Single-purpose dialogs:
  - `Setup/` — Initial configuration and permissions
  - `Permissions/` — Permission requests
  - `Region/` — Region/area selection UI
  - `Download/` — Download options
  - `Waveform/` — Audio waveform display
  - `Sandbox/` — Isolated editing sandbox
  - `Playground/` — Development/testing page
  - `Backup/` — Backup/restore UI

### Key Modules

**Recording & Media** (`src/media/` + `src/pages/Background/recording/`)
- WebCodecs and MediaRecorder wrapper abstractions
- Video codec/frame rate negotiation
- Frame processing and optimization
- Format detection and transcoding

**Messaging System** (`src/messaging/` + `src/pages/Background/messaging/`)
- `messageRouter.js` — Central message dispatcher (content script ↔ background ↔ pages)
- `handlers.js` — Background message handlers
- Asynchronous request-response pattern via `sendMessage()` with timeout protection

**State Management** (`src/pages/Background/listeners/` + Chrome Storage API)
- No Redux/Context: uses Chrome Storage API for persistent state
- Event listeners in `listeners/` subscribe to storage changes
- Separate storage areas for recording settings, UI state, auth tokens

**Authentication** (`src/pages/Background/auth/` + `utils/drive/` + `utils/youtube/`)
- OAuth 2.0 flow via Chrome extension OAuth2 manifest
- Google Drive and YouTube upload integrations
- Token refresh and session management

**Tab Management** (`src/pages/Background/tabManagement/`)
- Tracks active recording tabs
- Manages multi-scene/multi-recording mode
- Handles tab close/redirect edge cases

### Build System

Uses **Webpack 5** with entry points per page (see `webpack.config.js`):

```
Entry points:
  background → background.bundle.js (service worker)
  contentScript → contentScript.bundle.js
  recorder, cloudrecorder, offscreenrecorder, camera, waveform → separate chunks
  editor, editorwebcodecs, editorviewer → separate chunks
  setup, permissions, region, etc. → separate chunks
```

HtmlWebpackPlugin generates `.html` files for non-service-worker pages from JSX entry points. Babel transpiles JSX/ES6. SCSS compiled to CSS via sass-loader.

## Development Setup

### Prerequisites
- Node.js >= 14
- npm

### Commands

**Development Workflow:**
- `npm start` — Start webpack dev server with hot reload on port 8080. Build and watch src changes.
- `npm run build` — Single development build to `build/` folder.
- `npm run build:prod` — Production build (minified, NODE_ENV=production).
- `npm run hot-reload` — Alternative hot-reload server (webpack serve with --hot).
- `npm run watch` — Watch mode without dev server (webpack --watch).

**Code Quality:**
- `npm run lint` — Run ESLint on src/**/*.js with --fix flag.
- `npm run prettier` — Format all JS/JSON/CSS/MD files with Prettier.
- `npm run build:content-css` — Compile SCSS to CSS for Content script styles.

**Packaging:**
- `npm run package` — Build for production and create `extension.zip` (dev version).
- `npm run package:release` — Build for release and create `extension.zip` (SCREENITY_SKIP_ENV=true, no .env files).

**Other:**
- `npm run clean` — Remove build folder and recreate it.

### Loading in Chrome

1. Run `npm start` (dev mode) or `npm run build` to build the extension.
2. Open `chrome://extensions/` in Chrome.
3. Enable **Developer mode** (toggle in top right).
4. Click **Load unpacked** and select the `build/` folder.
5. The extension icon appears in the toolbar.

### Environment Setup

- **Development** — Uses `.env.local` for dev-specific config (loaded by webpack).
- **Production** — Uses `.env.production` for prod-specific config.
- **Release Build** — SCREENITY_SKIP_ENV=true skips .env loading (for open-source releases).

For Google Drive OAuth in development:
- Create an OAuth 2.0 credential in [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
- Update `client_id` in `manifest.json` with your extension key.
- Follow Chrome extension [key generation](https://developer.chrome.com/docs/extensions/reference/manifest/key) to create a persistent extension ID.

## Key Patterns & Conventions

### Message Passing

The extension uses a request-response pattern for cross-context communication:

```js
// In content script or page:
chrome.runtime.sendMessage({ action: "startRecording", payload: {...} }, response => {
  console.log("Response:", response);
});

// In background service worker:
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "startRecording") {
    // Handle and respond
    sendResponse({ success: true });
  }
});
```

Messages route through `messageRouter.js` for centralized handling and logging.

### Storage API Usage

Chrome Storage API used for all persistent state (no IndexedDB or localStorage):

```js
// Save
await chrome.storage.local.set({ recordingState: "paused" });

// Read
const { recordingState } = await chrome.storage.local.get("recordingState");

// Listen
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.recordingState) {
    const newValue = changes.recordingState.newValue;
  }
});
```

Avoid Promises; use callbacks for Chrome APIs that don't support them.

### Offscreen Documents

Used for background recording and audio processing (avoid main thread blocking):

```js
// In background:
await chrome.offscreen.createDocument({
  url: "offscreenrecorder.html",
  reasons: ["USER_MEDIA", "DOM_MANIPULATION"],
  justification: "Recording audio/video in background"
});

// Listen from offscreen:
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "startAudioCapture") {
    startAudioStream();
  }
});
```

### React/JSX in Pages

Pages use React 18 with functional components and hooks. No Redux; use Chrome Storage API or component state:

```jsx
// In src/pages/Recorder/index.jsx
import { useState, useEffect } from "react";

export default function Recorder() {
  const [recordingTime, setRecordingTime] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setRecordingTime(t => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return <div>Recording: {recordingTime}s</div>;
}
```

### Media & Codec Handling

Recording logic split by codec/API:

- **WebCodecs** (`src/media/fastRecorderGate.ts`, `EditorWebCodecs/`) — Modern approach, preferred for new work. Handles VP8/VP9/AV1 video codecs.
- **MediaRecorder** (`src/pages/OffscreenRecorder/`) — Fallback for older browsers.
- **FFmpeg** (`Editor/`) — Legacy editor for post-processing.

The `recording/` directory contains codec negotiation, frame enqueuing, and format fixes (e.g., WebM duration fixes via `webm-duration-fix`).

### Temporary Flags & Locks

Stale lock detection in Background/index.js clears storage flags that could block operations if the service worker crashes mid-operation:

```js
const stale = {};
if (sendingChunks) {
  stale.sendingChunks = false; // Clear stale flag
  console.warn("[Screenity][BG] Stale lock found...");
}
```

### Diagnostic & Debug Logging

Use `src/pages/utils/diagnosticLog.js` for troubleshooting:

```js
import { diagEvent } from "../pages/utils/diagnosticLog";
diagEvent("recordingStarted", { codec: "vp8", audioTrack: true });
```

Logs are indexed by flow and searchable via DevHUD in content script.

### Screenshot Feature Patterns (REQUIRED READING)

**🚨 When working on screenshot features, you MUST follow [SCREENSHOT_ISOLATION_RULES.md](SCREENSHOT_ISOLATION_RULES.md)**

Key patterns for screenshot development:

```javascript
// 1. Screenshot message handling (separate from recording)
// src/screenshot/pages/Background/handlers.js
export function handleScreenshotCapture(message, sender) {
  // Only screenshot-specific logic
  // Storage keys use screenshot_* prefix
  chrome.storage.local.set({ screenshot_captured: { ... } });
}

// 2. Screenshot storage (namespaced)
chrome.storage.local.get("screenshot_history")    // ✅ OK
chrome.storage.local.get("screenshot_settings")   // ✅ OK
chrome.storage.local.get("recordingState")        // ❌ Don't touch recording state

// 3. Screenshot message actions (namespaced)
chrome.runtime.sendMessage({ 
  action: "screenshot_capture",     // ✅ OK
  payload: { ... } 
});

// 4. Screenshot CSS classes (namespaced)
<div className="screenity-screenshot-editor-toolbar">  {/* ✅ OK */}
<div className="screenity-recorder-ui">               {/* ❌ Don't use recorder classes */}

// 5. Code reuse strategy
// ❌ DON'T: import from src/pages/EditorWebCodecs/components/DrawingCanvas.jsx
// ✅ DO: Copy to src/screenshot/pages/ScreenshotEditor/components/DrawingCanvas.jsx
//        and modify your copy independently
```

**Directory Structure for Screenshots:**
```
src/screenshot/
├── pages/
│   ├── Background/
│   │   ├── handlers.js          # Screenshot message handlers
│   │   ├── captureManager.js    # Orchestrate capture
│   │   └── storage.js           # Screenshot state management
│   ├── Content/
│   │   ├── overlays.jsx         # Screenshot capture UI
│   │   └── listeners.js         # Screenshot-specific event handlers
│   ├── ScreenshotCapture/       # Mode selector page
│   │   ├── index.jsx
│   │   └── index.html
│   └── ScreenshotEditor/        # Annotation editor page
│       ├── index.jsx
│       └── index.html
├── utils/                        # Screenshot-only utilities
├── hooks/                        # Screenshot-only React hooks
└── constants.js
```

**Checklist Before Committing:**
- [ ] All code in `src/screenshot/` (except minimal core imports)
- [ ] All storage keys use `screenshot_*` prefix
- [ ] All message actions use `screenshot_*` prefix
- [ ] All CSS classes use `screenity-screenshot-*` prefix
- [ ] No imports from `src/pages/recording/*` or `src/pages/Recorder/`
- [ ] Feature can be deleted by removing `src/screenshot/` + 3-5 lines from core files

---

## Common Development Tasks

### Adding a New Recording Mode

1. Create `src/pages/YourMode/index.jsx` as React entry point.
2. Add webpack entry in `webpack.config.js`: `yourmode: path.join(..., "YourMode", "index.jsx")`.
3. Create `.html` template (HtmlWebpackPlugin auto-generates).
4. Add message handler in `src/pages/Background/messaging/handlers.js`.
5. Open page via `chrome.windows.create()` or `chrome.tabs.create()` from background.
6. Test by running `npm start` and loading unpacked extension.

### Debugging Recording Issues

1. Open the extension background service worker DevTools:
   - Go to `chrome://extensions/`.
   - Find Screenity, click **Details**.
   - Scroll to **Inspect views** → click **service_worker** background script.
2. Check console for stale lock warnings and `[Screenity][BG]` logs.
3. Enable DevHUD in Content script (press `?` or check localStorage for `devHUD`).
4. Check Storage API state: `chrome.storage.local.get(null)` in console.

### Testing UI Changes

1. Run `npm start` to start webpack dev server.
2. Make changes to React components.
3. Webpack hot-reload will refresh the page automatically.
4. For background changes, the service worker may need manual reload (click reload on extension card in chrome://extensions/).

### Building for Release

```bash
npm run package:release
# Creates extension.zip ready for Chrome Web Store submission
# Uses SCREENITY_SKIP_ENV=true to exclude .env files
```

## Git Workflow

- Main branch: **master**
- Feature branches follow the pattern: `feature/description` or `fix/description`
- Recent work tracked via `git log` (check recent commits for context on WIP areas)

## Important Notes

- **Privacy-first**: The extension runs entirely locally when self-hosted. No external API calls except Google Drive/YouTube (only if user opts in).
- **License**: GPLv3 for current MV3 version (v3.0.0+). See LICENSE and CODE_OF_CONDUCT.md.
- **Cross-origin Policy**: Uses COEP/COOP headers for media isolation. Defined in manifest.json.
- **No Data Collection**: Unlike the official Chrome Store version, self-hosted builds don't connect to external analytics or Screenity Pro features.

## Quick Debugging Tips

- Stale lock errors? Check Background/index.js `clearStaleLocks()` — these indicate crashed operations.
- Message routing broken? Log in `messageRouter.js` to trace sender/receiver.
- Recording won't start? Check tab permissions in `chrome://extensions/` → Details → Permissions.
- Audio not captured? Verify `AudioOffscreen/` worker is created and listening.
- Editor crashes? Check WebCodecs availability in `src/media/fastRecorderGate.ts` gate logic.
