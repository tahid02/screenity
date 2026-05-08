const MAX_PAGE_HEIGHT = 15000; // CSS pixels — keeps canvas within GPU memory limits
const MAX_SEGMENTS = 50;

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

export async function captureFullPage(onProgress) {
  if (!document.body) throw new Error("No document body — cannot capture this page.");

  const dpr = window.devicePixelRatio || 1;
  const viewportH = window.innerHeight;
  const totalH = Math.min(
    Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
    MAX_PAGE_HEIGHT
  );
  const originalScrollY = window.scrollY;
  const originalScrollX = window.scrollX;

  // Hide all fixed/sticky elements to prevent them appearing at every scroll position.
  // Use visibility:hidden rather than display:none to avoid layout reflow.
  const fixedEls = [];
  for (const el of document.querySelectorAll("*")) {
    const pos = window.getComputedStyle(el).position;
    if (pos === "fixed" || pos === "sticky") {
      fixedEls.push({ el, original: el.style.visibility });
      el.style.visibility = "hidden";
    }
  }

  // Build scroll positions. The loop generates evenly-spaced positions. The
  // final entry is replaced (or appended) with exactly maxScrollY so the
  // bottom is always fully captured and positions stay in ascending order.
  const maxScrollY = Math.max(0, totalH - viewportH);
  const positions = [];
  for (let y = 0; y < totalH; y += viewportH) positions.push(y);

  const last = positions[positions.length - 1];
  if (last > maxScrollY) {
    // Last step overshot — clamp it
    positions[positions.length - 1] = maxScrollY;
  } else if (last < maxScrollY) {
    // Page height isn't a perfect multiple — append the true last position
    positions.push(maxScrollY);
  }
  // If last === maxScrollY it's already correct; no change needed.

  if (positions.length > MAX_SEGMENTS) {
    positions.length = MAX_SEGMENTS;
    positions[MAX_SEGMENTS - 1] = maxScrollY;
  }

  const segments = [];
  let lastCaptureTime = 0;

  try {
    for (let i = 0; i < positions.length; i++) {
      window.scrollTo({ top: positions[i], left: 0, behavior: "instant" });
      await delay(150); // let layout and paint settle

      // Chrome enforces max 2 captureVisibleTab/sec — enforce 600ms floor
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
    // Restore page state regardless of success or error
    fixedEls.forEach(({ el, original }) => {
      el.style.visibility = original;
    });
    window.scrollTo({ top: originalScrollY, left: originalScrollX, behavior: "instant" });
  }

  // Stitch segments into a single canvas
  onProgress({ step: 0, total: segments.length, phase: "stitching" });

  const bitmaps = await Promise.all(
    segments.map(({ dataUrl }) =>
      fetch(dataUrl).then((r) => r.blob()).then(createImageBitmap)
    )
  );

  const imgW = bitmaps[0].width;  // viewport width in device pixels
  const imgH = bitmaps[0].height; // viewport height in device pixels
  const canvasW = imgW;
  const canvasH = Math.ceil(totalH * dpr);

  const canvas = new OffscreenCanvas(canvasW, canvasH);
  const ctx = canvas.getContext("2d");

  for (let i = 0; i < segments.length; i++) {
    ctx.drawImage(
      bitmaps[i],
      0, 0, imgW, imgH,                                     // source: full bitmap
      0, Math.round(segments[i].scrollY * dpr), imgW, imgH  // dest: at correct pixel row
    );
    bitmaps[i].close(); // release GPU memory immediately
  }

  const finalBlob = await canvas.convertToBlob({ type: "image/png" });
  return blobToDataUrl(finalBlob);
}
