# Screenshot Feature: Isolation Rules & Guidelines

**⚠️ MANDATORY: All team members MUST follow these rules when working on the screenshot feature.**

---

## Core Principle

> **ALL screenshot code lives in `src/screenshot/` directory. This folder is completely separate from core recording code. When implementing screenshot features, you have complete ownership of this folder and accept responsibility for all code changes within it.**

---

## Directory Structure

```
src/
├── pages/                    # CORE RECORDING (READ-ONLY except for minimal mandatory changes)
│   ├── Background/
│   ├── Content/
│   ├── Recorder/
│   ├── EditorWebCodecs/
│   └── ... other recording pages
│
└── screenshot/               # 🆕 SCREENSHOT FEATURE (YOUR RESPONSIBILITY)
    ├── pages/
    │   ├── Background/       # Screenshot background logic
    │   ├── Content/          # Screenshot content script logic
    │   ├── ScreenshotCapture/
    │   └── ScreenshotEditor/
    ├── utils/
    ├── hooks/
    ├── constants.js
    └── types.js
```

---

## Rule 1: Code Duplication is Preferred Over Shared Imports

### ❌ DON'T: Modify core files ( outside of src/screenshot folder ) to share code

```javascript
// ❌ BAD: Modifying src/pages/EditorWebCodecs/utils/drawing.js
// to support both recording and screenshot
export function drawLine(canvas, from, to, color, recording = false, screenshot = false) {
  // Messy conditional logic for two different features
  if (recording) { /* recording-specific code */ }
  if (screenshot) { /* screenshot-specific code */ }
}
```

### ✅ DO: Copy the file to screenshot folder and modify your copy

```javascript
// ✅ GOOD: Copy to src/screenshot/utils/drawing.js
// Your independent copy, no modifications to core files
export function drawLine(canvas, from, to, color, options = {}) {
  // Your implementation optimized for screenshots
  // Completely independent from recording code
}
```

### ✅ ALLOWED: Import if code is EXACTLY identical, zero changes needed

```javascript
// ✅ GOOD: Reuse truly identical utilities
src/pages/utils/aspectRatio.js
  ↓ (100% identical, no changes needed)
src/screenshot/pages/ScreenshotEditor/components/CropTool.jsx

import { calculateAspectRatio } from "../../../pages/utils/aspectRatio.js";
```

---

## Rule 2: One-Way Dependency Flow (Only Direction Allowed)

### ✅ ALLOWED Direction
```
src/pages/Background/index.js
       ↓ (imports from screenshot)
src/screenshot/pages/Background/handlers.js
```

```
src/pages/Content/index.jsx
       ↓ (imports from screenshot)
src/screenshot/pages/Content/overlays.jsx
```

### ❌ FORBIDDEN Direction
```
src/screenshot/pages/Background/handlers.js
       ↓ (NEVER imports from core)
src/pages/Background/recording/*  ❌ FORBIDDEN
```

```
src/screenshot/pages/Content/overlays.jsx
       ↓ (NEVER imports from core recording code)
src/pages/Content/recording-ui.jsx  ❌ FORBIDDEN
```

### Rule of Thumb
- **Core files can import from screenshot (minimal, necessary)** ✅
- **Screenshot files CANNOT import from core recording code** ✅
- **Screenshot files CAN import from core utilities (if truly identical)** ✅

---

## Rule 3: Storage Keys Must Be Namespaced

### ❌ DON'T: Use core recording storage keys

```javascript
// ❌ BAD: Storing screenshot data in recording keys
chrome.storage.local.set({ recordingState: "capturing" });  // Conflict!
chrome.storage.local.set({ recordingSettings: { ... } });   // Conflict!
```

### ✅ DO: Use screenshot-specific storage namespace

```javascript
// ✅ GOOD: All screenshot data under screenshot_* prefix
chrome.storage.local.set({ screenshot_captured: { ... } });
chrome.storage.local.set({ screenshot_history: [...] });
chrome.storage.local.set({ screenshot_settings: { ... } });
chrome.storage.local.set({ screenshot_editorState: { ... } });
```

### Storage Namespace Convention
```javascript
// Recording (UNTOUCHED)
recordingState
recordingSettings
recordingHistory
drawingMode

// Screenshot (YOUR PREFIX)
screenshot_captured
screenshot_history
screenshot_settings
screenshot_editorState
screenshot_annotations
```

---

## Rule 4: Message Actions Must Be Namespaced

### ❌ DON'T: Use generic action names

```javascript
// ❌ BAD: Generic names that conflict with recording
{
  action: "capture",           // Too generic
  action: "edit",              // Too generic
  action: "save",              // Too generic
}
```

### ✅ DO: Use screenshot_* prefix for all screenshot messages

```javascript
// ✅ GOOD: Clear namespace for screenshot messages
{
  action: "screenshot_capture",
  action: "screenshot_edit",
  action: "screenshot_save",
  action: "screenshot_annotate",
  action: "screenshot_export"
}
```

### Message Routing
```javascript
// In src/pages/Background/index.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Recording messages (existing)
  if (message.action === "startRecording") { ... }
  if (message.action === "stopRecording") { ... }

  // Screenshot messages (NEW - namespaced)
  if (message.action?.startsWith("screenshot_")) {
    return handleScreenshotMessages(message, sender, sendResponse);
  }
});
```

---

## Rule 5: CSS Classes Must Be Namespaced

### ❌ DON'T: Use generic class names

```css
/* ❌ BAD: Could conflict with recorder styles */
.capture-ui { }
.editor-toolbar { }
.annotation-tool { }
```

### ✅ DO: Use screenity-screenshot-* prefix

```css
/* ✅ GOOD: Unique namespace for screenshot styles */
.screenity-screenshot-capture-ui { }
.screenity-screenshot-editor-toolbar { }
.screenity-screenshot-annotation-tool { }
.screenity-screenshot-drawing-canvas { }
```

### DOM ID Naming
```javascript
// ✅ GOOD: Screenshot-specific IDs
document.getElementById("screenity-screenshot-capture-mode-selector");
document.getElementById("screenity-screenshot-editor-canvas");
document.getElementById("screenity-screenshot-annotation-toolbar");
```

---

## Rule 6: Minimal Changes to Core Files

### Only Change Core Files When Necessary for Feature Function

You may modify `src/pages/` ONLY for these reasons:

| File | Allowed Changes | Reason |
|------|-----------------|--------|
| `src/pages/Background/index.js` | Add screenshot message routing import | Only one service worker allowed (MV3) |
| `src/pages/Content/index.jsx` | Add screenshot UI injection call | Only one content script allowed (MV3) |
| `webpack.config.js` | Add screenshot entry points | Required for build system |
| `src/manifest.json` | Add screenshot HTML resources | Required for web_accessible_resources |

### ❌ NEVER Change Core Files For
- ❌ Sharing utility functions (copy instead)
- ❌ Sharing state management (namespace in storage instead)
- ❌ Sharing CSS (namespace and duplicate)
- ❌ Sharing components (copy and modify)

---

## Checklist: Before Committing Screenshot Code

- [ ] **All code is in `src/screenshot/` directory**
  - Exception: Only necessary imports in `src/pages/Background/index.js` and `src/pages/Content/index.jsx`

- [ ] **No imports from `src/pages/recording/` or `src/pages/Recorder/`**
  - Only allowed imports: `src/pages/utils/` (if truly identical)

- [ ] **All storage keys start with `screenshot_`**
  - `screenshot_captured`, `screenshot_history`, `screenshot_settings`, etc.

- [ ] **All message actions start with `screenshot_`**
  - `screenshot_capture`, `screenshot_annotate`, `screenshot_export`, etc.

- [ ] **All CSS classes start with `screenity-screenshot-`**
  - `.screenity-screenshot-toolbar`, `.screenity-screenshot-canvas`, etc.

- [ ] **Core files only modified for mandatory reasons**
  - Only: message routing, UI injection, build config, manifest resources

- [ ] **Can delete `src/screenshot/` and recording still works**
  - Only 3-5 lines need to be removed from core files
  - No broken imports or build errors

---

## Common Scenarios

### Scenario 1: You Need Drawing Logic From EditorWebCodecs

```javascript
// ❌ DON'T
import { DrawingCanvas } from "../../pages/EditorWebCodecs/components/DrawingCanvas.jsx";

// ✅ DO: Copy the file
// src/screenshot/pages/ScreenshotEditor/components/DrawingCanvas.jsx
// (Your independent copy, can be modified separately)
```

### Scenario 2: You Need Aspect Ratio Calculation

```javascript
// ✅ OK: Import if IDENTICAL (no changes needed)
import { calculateAspectRatio } from "../../../pages/utils/aspectRatio.js";

// This is fine because:
// 1. Function is pure math, no side effects
// 2. No changes needed for screenshot use case
// 3. Truly reusable across features
```

### Scenario 3: You Need Canvas Manipulation Utilities

```javascript
// ❌ DON'T: Modify src/pages/EditorWebCodecs/utils/canvas.js
// to add screenshot-specific logic

// ✅ DO: Copy to your folder
// src/screenshot/utils/canvas.js
// Modify your copy for screenshot needs
```

### Scenario 4: You Need to Store Screenshot Data

```javascript
// ❌ DON'T
chrome.storage.local.set({ editorState: { ... } });  // Recording key!

// ✅ DO
chrome.storage.local.set({ screenshot_editorState: { ... } });
```

### Scenario 5: You Need to Send Message to Background

```javascript
// ❌ DON'T
chrome.runtime.sendMessage({ action: "annotate", payload: {...} });

// ✅ DO
chrome.runtime.sendMessage({ action: "screenshot_annotate", payload: {...} });
```

---

## Troubleshooting: "But I Need to Modify a Core File"

**Ask yourself:**

1. **Is it truly necessary for the feature to work?**
   - If YES → Proceed with minimal change
   - If NO → Copy the file instead

2. **Am I modifying the file for isolation or for convenience?**
   - Isolation = minimal, necessary change (allowed)
   - Convenience = modifying to avoid duplication (copy instead)

3. **Can I accomplish this by importing from screenshot code instead?**
   - If YES → Do that
   - If NO → Check question #1

**Examples:**

```javascript
// ✅ ALLOWED: Necessary for feature to function
// src/pages/Background/index.js
import { handleScreenshotMessages } from "../../screenshot/pages/Background/handlers.js";
// This is OK because MV3 only allows one service worker

// ❌ NOT ALLOWED: For convenience / code sharing
// src/pages/utils/drawing.js
export function draw(canvas, options, isScreenshot) {
  if (isScreenshot) { /* screenshot-specific code */ }
  else { /* recording-specific code */ }
}
// Don't do this. Copy drawing.js to src/screenshot/ instead.
```

---

## Impact When Rules Are Followed

### Safe Deletion Test ✅
```bash
# If you decide to delete the screenshot feature entirely:
rm -rf src/screenshot/

# Clean up 3-5 lines from:
#   - src/pages/Background/index.js (remove import)
#   - src/pages/Content/index.jsx (remove import)
#   - webpack.config.js (remove entries)
#   - src/manifest.json (remove resources)

npm run build
# ✅ No errors
# ✅ No broken imports
# ✅ Recording works exactly as before
```

### Independent Development ✅
- New features can be added to screenshot without touching recording code
- Recording bugs don't affect screenshot feature
- Screenshot bugs don't crash recording
- Team members can work on both features simultaneously

### Clear Code Ownership ✅
- Everything in `src/screenshot/` is screenshot team's responsibility
- Everything in `src/pages/` is recording team's responsibility
- No ambiguity about who owns what code

---

## Breaking These Rules: Consequences

| Rule Broken | Consequence | Severity |
|-------------|-------------|----------|
| Code in wrong directory | Hard to delete feature later | 🟠 MEDIUM |
| Importing from recording code | Breaking changes ripple to screenshot | 🔴 HIGH |
| Shared storage keys | Data corruption / state conflicts | 🔴 HIGH |
| Shared message actions | Message routing confusion | 🔴 HIGH |
| Shared CSS classes | UI style conflicts / overlap | 🟠 MEDIUM |
| Core file modifications for convenience | Maintenance burden increases | 🟠 MEDIUM |

---

## Questions? Ask Your Tech Lead

If you're unsure whether something should be:
- ✅ Imported (truly identical?)
- ✅ Copied (small modification needed?)
- ✅ Refactored in core (absolutely necessary?)

**Ask before implementing.** It takes 5 minutes to clarify, saves 5 hours of refactoring later.

---

## Summary

| Do | Don't |
|----|-------|
| ✅ Put all screenshot code in `src/screenshot/` | ❌ Mix screenshot code with core recording code |
| ✅ Copy files if modification is needed | ❌ Modify core files for code reuse |
| ✅ Use `screenshot_` prefix for state/messages/CSS | ❌ Use generic names that could conflict |
| ✅ Import from screenshot in core (when necessary) | ❌ Import from core recording in screenshot |
| ✅ Make minimal, necessary changes to core files | ❌ Modify core files for convenience |
| ✅ Delete feature by removing one folder | ❌ Have feature scattered across codebase |

---

**Document Version:** 1.0  
**Last Updated:** 2026-05-02  
**Status:** MANDATORY FOR ALL SCREENSHOT WORK
