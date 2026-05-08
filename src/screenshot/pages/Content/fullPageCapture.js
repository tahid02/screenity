const MAX_PAGE_HEIGHT = 15000; // CSS pixels — keeps canvas within GPU memory limits
const MAX_SEGMENTS = 50;
const CONTAINER_SCORE_THRESHOLD = 50;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Two rAF cycles ensure the scroll position is committed to the compositor before
// captureVisibleTab fires. Falls back to a 200ms timeout if rAF is throttled
// (e.g., backgrounded tab).
function waitForPaint() {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        resolve();
      }
    };
    requestAnimationFrame(() => requestAnimationFrame(finish));
    setTimeout(finish, 200);
  });
}

function getNodeDepth(el) {
  let depth = 0;
  let node = el.parentElement;
  while (node && node !== document.body) {
    depth++;
    node = node.parentElement;
  }
  return depth;
}

// Returns the primary scrollable container when the document itself doesn't scroll,
// or null to use the window-scroll path.
function detectScrollContainer() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // If the document itself is scrollable, use the existing window-scroll path.
  const docScroller = document.scrollingElement || document.documentElement;
  if (docScroller.scrollHeight > vh + 100) return null;

  // Collect candidate scrollable elements: must have overflow-y auto/scroll/overlay
  // AND actually overflow their visible area.
  const candidates = [];
  for (const el of document.querySelectorAll("*")) {
    if (el.offsetWidth === 0 || el.offsetHeight === 0) continue;
    const overflowY = window.getComputedStyle(el).overflowY;
    if (overflowY !== "auto" && overflowY !== "scroll" && overflowY !== "overlay") continue;
    if (el.scrollHeight <= el.clientHeight + 100) continue;
    candidates.push(el);
  }

  if (candidates.length === 0) return null;

  const viewportArea = vw * vh;
  const maxTextLen = candidates.reduce((m, el) => Math.max(m, el.textContent.length), 1);

  let bestEl = null;
  let bestScore = -Infinity;

  for (const el of candidates) {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    const role = el.getAttribute("role");
    let score = 0;

    // Viewport coverage: primary containers fill most of the screen
    const area = rect.width * rect.height;
    if (area > viewportArea * 0.5) score += 40;
    else if (area > viewportArea * 0.25) score += 20;

    // Position: top-left near viewport origin (below a nav bar at most)
    if (rect.top <= 120 && rect.left <= 80) score += 10;

    // Content density: main area has the most text
    const textRatio = el.textContent.length / maxTextLen;
    if (textRatio > 0.8) score += 20;
    else if (textRatio > 0.5) score += 10;

    // DOM depth: prefer shallower containers (widgets tend to nest deeper)
    const depth = getNodeDepth(el);
    if (depth < 8) score += 15;
    else if (depth < 15) score += 5;

    // Semantic landmarks
    if (el.tagName === "MAIN" || role === "main") score += 10;

    // Disqualifiers
    if (rect.width < vw * 0.4) score -= 30; // narrow — sidebar or panel
    if (style.position === "fixed") score -= 20;
    if (el.getAttribute("aria-modal") === "true") score -= 20;
    if (role === "dialog") score -= 20;
    if (role === "navigation" || el.tagName === "NAV") score -= 20;
    if (rect.left > vw * 0.6) score -= 20; // far right — chat panel / sidebar
    if (el.scrollHeight < el.clientHeight * 1.5) score -= 15; // barely scrollable

    if (score > bestScore) {
      bestScore = score;
      bestEl = el;
    }
  }

  return bestScore >= CONTAINER_SCORE_THRESHOLD ? bestEl : null;
}

// Scroll a specific container element, crop each captured frame to its bounds,
// and stitch the crops into a single canvas.
async function captureContainer(container, onProgress) {
  const dpr = window.devicePixelRatio || 1;

  // Snapshot the bounding rect before any scroll mutations — it stays stable
  // for the duration of the capture on fixed-layout apps like Gmail / Notion.
  const rect = container.getBoundingClientRect();
  const clientH = container.clientHeight;
  const totalH = Math.min(container.scrollHeight, MAX_PAGE_HEIGHT);
  const originalScrollTop = container.scrollTop;
  const originalScrollLeft = container.scrollLeft;

  // Hide fixed/sticky elements (window-level and within the container) so they
  // don't ghost across every captured strip.
  const hiddenEls = [];
  for (const el of document.querySelectorAll("*")) {
    const pos = window.getComputedStyle(el).position;
    if (pos === "fixed" || pos === "sticky") {
      hiddenEls.push({ el, original: el.style.visibility });
      el.style.visibility = "hidden";
    }
  }

  // Build scroll positions the same way as the window path.
  const maxScrollTop = Math.max(0, totalH - clientH);
  const positions = [];
  for (let y = 0; y < totalH; y += clientH) positions.push(y);

  const last = positions[positions.length - 1];
  if (last > maxScrollTop) {
    positions[positions.length - 1] = maxScrollTop;
  } else if (last < maxScrollTop) {
    positions.push(maxScrollTop);
  }

  if (positions.length > MAX_SEGMENTS) {
    positions.length = MAX_SEGMENTS;
    positions[MAX_SEGMENTS - 1] = maxScrollTop;
  }

  const segments = [];
  let lastCaptureTime = 0;

  try {
    for (let i = 0; i < positions.length; i++) {
      container.scrollTop = positions[i];
      // Read back the actual clamped value — the browser silently rounds/clamps
      // fractional pixel values, so we use this as the draw offset rather than
      // the intended position to avoid hairline seams at high DPR.
      const actualScrollTop = container.scrollTop;

      await waitForPaint();
      await delay(80); // extra buffer for React re-renders after paint

      const gap = Date.now() - lastCaptureTime;
      if (lastCaptureTime > 0 && gap < 600) await delay(600 - gap);

      const response = await chrome.runtime.sendMessage({
        type: "screenshot_capture_segment",
      });
      lastCaptureTime = Date.now();

      if (!response?.success) {
        throw new Error(response?.error || "Segment capture failed");
      }

      segments.push({ scrollY: actualScrollTop, dataUrl: response.dataUrl });
      onProgress({ step: i + 1, total: positions.length, phase: "capturing" });
    }
  } finally {
    hiddenEls.forEach(({ el, original }) => {
      el.style.visibility = original;
    });
    container.scrollTop = originalScrollTop;
    container.scrollLeft = originalScrollLeft;
  }

  onProgress({ step: 0, total: segments.length, phase: "stitching" });

  const bitmaps = await Promise.all(
    segments.map(({ dataUrl }) =>
      fetch(dataUrl).then((r) => r.blob()).then(createImageBitmap)
    )
  );

  // Crop each full-viewport bitmap to the container's bounds (device pixels).
  const cropX = Math.round(rect.left * dpr);
  const cropY = Math.round(rect.top * dpr);
  const cropW = Math.round(rect.width * dpr);
  // Use clientH for crop height to exclude scrollbar track on the edge of the bitmap.
  const cropH = Math.min(
    Math.round(clientH * dpr),
    bitmaps[0].height - cropY
  );

  const canvas = new OffscreenCanvas(cropW, Math.ceil(totalH * dpr));
  const ctx = canvas.getContext("2d");

  for (let i = 0; i < segments.length; i++) {
    ctx.drawImage(
      bitmaps[i],
      cropX, cropY, cropW, cropH,                              // source: cropped container region
      0, Math.round(segments[i].scrollY * dpr), cropW, cropH   // dest: at correct content row
    );
    bitmaps[i].close();
  }

  const finalBlob = await canvas.convertToBlob({ type: "image/png" });
  return blobToDataUrl(finalBlob);
}

export async function captureFullPage(onProgress) {
  if (!document.body) throw new Error("No document body — cannot capture this page.");

  // Try container-scroll path first for apps where the document doesn't scroll
  // (Gmail, Notion, Linear, Slack, etc.).
  const container = detectScrollContainer();
  if (container) return captureContainer(container, onProgress);

  // ── Window-scroll path ────────────────────────────────────────────────────

  const dpr = window.devicePixelRatio || 1;
  const viewportH = window.innerHeight;
  const totalH = Math.min(
    Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
    MAX_PAGE_HEIGHT
  );
  const originalScrollY = window.scrollY;
  const originalScrollX = window.scrollX;

  const fixedEls = [];
  for (const el of document.querySelectorAll("*")) {
    const pos = window.getComputedStyle(el).position;
    if (pos === "fixed" || pos === "sticky") {
      fixedEls.push({ el, original: el.style.visibility });
      el.style.visibility = "hidden";
    }
  }

  const maxScrollY = Math.max(0, totalH - viewportH);
  const positions = [];
  for (let y = 0; y < totalH; y += viewportH) positions.push(y);

  const last = positions[positions.length - 1];
  if (last > maxScrollY) {
    positions[positions.length - 1] = maxScrollY;
  } else if (last < maxScrollY) {
    positions.push(maxScrollY);
  }

  if (positions.length > MAX_SEGMENTS) {
    positions.length = MAX_SEGMENTS;
    positions[positions.length - 1] = maxScrollY;
  }

  const segments = [];
  let lastCaptureTime = 0;

  try {
    for (let i = 0; i < positions.length; i++) {
      window.scrollTo({ top: positions[i], left: 0, behavior: "instant" });
      await delay(150);

      const gap = Date.now() - lastCaptureTime;
      if (lastCaptureTime > 0 && gap < 600) await delay(600 - gap);

      const response = await chrome.runtime.sendMessage({
        type: "screenshot_capture_segment",
      });
      lastCaptureTime = Date.now();

      if (!response?.success) {
        throw new Error(response?.error || "Segment capture failed");
      }

      segments.push({ scrollY: positions[i], dataUrl: response.dataUrl });
      onProgress({ step: i + 1, total: positions.length, phase: "capturing" });
    }
  } finally {
    fixedEls.forEach(({ el, original }) => {
      el.style.visibility = original;
    });
    window.scrollTo({ top: originalScrollY, left: originalScrollX, behavior: "instant" });
  }

  onProgress({ step: 0, total: segments.length, phase: "stitching" });

  const bitmaps = await Promise.all(
    segments.map(({ dataUrl }) =>
      fetch(dataUrl).then((r) => r.blob()).then(createImageBitmap)
    )
  );

  const imgW = bitmaps[0].width;
  const imgH = bitmaps[0].height;

  const canvas = new OffscreenCanvas(imgW, Math.ceil(totalH * dpr));
  const ctx = canvas.getContext("2d");

  for (let i = 0; i < segments.length; i++) {
    ctx.drawImage(
      bitmaps[i],
      0, 0, imgW, imgH,
      0, Math.round(segments[i].scrollY * dpr), imgW, imgH
    );
    bitmaps[i].close();
  }

  const finalBlob = await canvas.convertToBlob({ type: "image/png" });
  return blobToDataUrl(finalBlob);
}
