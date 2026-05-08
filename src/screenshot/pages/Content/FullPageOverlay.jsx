import React, { useState, useEffect, useCallback } from "react";
import { captureFullPage } from "./fullPageCapture";

const BLUE = "#567BDA";

// ─── Styles ──────────────────────────────────────────────────────────────────

const frameStyle = {
  position: "fixed",
  inset: 0,
  boxShadow: `inset 0 0 0 3px ${BLUE}`,
  pointerEvents: "none",
  zIndex: 2147483647,
};

const badgeStyle = {
  position: "fixed",
  top: 12,
  left: "50%",
  transform: "translateX(-50%)",
  background: "rgba(0,0,0,0.72)",
  color: "#fff",
  fontSize: 13,
  fontFamily: "'Satoshi-Medium', system-ui, sans-serif",
  fontWeight: 600,
  padding: "6px 14px",
  borderRadius: 20,
  pointerEvents: "none",
  zIndex: 2147483647,
  letterSpacing: "0.01em",
  whiteSpace: "nowrap",
};

const captureButtonStyle = {
  position: "fixed",
  bottom: 24,
  left: "50%",
  transform: "translateX(-50%)",
  background: BLUE,
  color: "#fff",
  border: "none",
  borderRadius: 10,
  padding: "10px 28px",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  zIndex: 2147483647,
  boxShadow: "0 4px 18px rgba(86,123,218,0.45)",
  fontFamily: "'Satoshi-Medium', system-ui, sans-serif",
  pointerEvents: "all",
};

const backdropStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.55)",
  zIndex: 2147483646,
  pointerEvents: "none",
};

const modalStyle = {
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  background: "#1a1a24",
  borderRadius: 14,
  padding: "28px 32px",
  width: 340,
  zIndex: 2147483647,
  boxShadow: "0 12px 48px rgba(0,0,0,0.7)",
  fontFamily: "'Satoshi-Medium', system-ui, sans-serif",
  color: "#fff",
  pointerEvents: "all",
};

const modalTitleStyle = {
  fontSize: 16,
  fontWeight: 700,
  marginBottom: 6,
};

const modalSubStyle = {
  fontSize: 13,
  color: "rgba(255,255,255,0.55)",
  marginBottom: 18,
};

const progressTrackStyle = {
  background: "rgba(255,255,255,0.1)",
  borderRadius: 6,
  height: 6,
  overflow: "hidden",
  marginBottom: 12,
};

const progressBarBaseStyle = {
  height: "100%",
  borderRadius: 6,
  background: BLUE,
  transition: "width 0.2s ease",
};

const noteStyle = {
  fontSize: 12,
  color: "rgba(255,255,255,0.38)",
  textAlign: "center",
};

const errorModalStyle = {
  ...modalStyle,
  borderTop: "3px solid #e05252",
};

const errorTitleStyle = {
  ...modalTitleStyle,
  color: "#e05252",
};

const errorTextStyle = {
  fontSize: 13,
  color: "rgba(255,255,255,0.65)",
  marginBottom: 20,
  wordBreak: "break-word",
};

const btnRowStyle = {
  display: "flex",
  gap: 10,
  justifyContent: "flex-end",
};

const cancelBtnStyle = {
  background: "rgba(255,255,255,0.1)",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "8px 18px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "'Satoshi-Medium', system-ui, sans-serif",
};

const retryBtnStyle = {
  background: BLUE,
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "8px 18px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "'Satoshi-Medium', system-ui, sans-serif",
};

// Indeterminate shimmer for stitching phase
const shimmerKeyframes = `
@keyframes screenity-screenshot-shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(400%); }
}`;

// ─── Component ───────────────────────────────────────────────────────────────

export default function FullPageOverlay() {
  const [active, setActive] = useState(false);
  const [phase, setPhase] = useState("idle"); // idle | capturing | stitching | error
  const [progress, setProgress] = useState({ step: 0, total: 0 });
  const [errorMsg, setErrorMsg] = useState("");

  // Watch storage for screenshot_mode = "full_page"
  useEffect(() => {
    const check = () => {
      chrome.storage.local.get("screenshot_mode", ({ screenshot_mode }) => {
        setActive(screenshot_mode === "full_page");
      });
    };
    check();

    const listener = (changes) => {
      if (changes.screenshot_mode) {
        setActive(changes.screenshot_mode.newValue === "full_page");
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  // Reset to idle when overlay becomes inactive
  useEffect(() => {
    if (!active) {
      setPhase("idle");
      setProgress({ step: 0, total: 0 });
      setErrorMsg("");
    }
  }, [active]);

  // Esc to dismiss in idle phase
  useEffect(() => {
    if (!active || phase !== "idle") return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        chrome.runtime.sendMessage({ type: "screenshot_dismiss_overlay" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, phase]);

  const handleCapture = useCallback(async () => {
    setPhase("capturing");
    setProgress({ step: 0, total: 0 });

    // Wait two animation frames so React commits the re-render (removes the
    // idle-state blue frame and button) before the first captureVisibleTab call.
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    );

    try {
      const finalDataUrl = await captureFullPage(({ step, total, phase: p }) => {
        if (p === "capturing") {
          setProgress({ step, total });
        } else if (p === "stitching") {
          setPhase("stitching");
        }
      });

      // Send stitched image to background to store and open viewer
      const result = await chrome.runtime.sendMessage({
        type: "screenshot_fullpage_complete",
        dataUrl: finalDataUrl,
      });

      if (!result?.success) throw new Error(result?.error || "Failed to save screenshot");
    } catch (err) {
      console.error("[Screenshot] Full page capture error:", err);
      setErrorMsg(err.message?.slice(0, 120) || "An unknown error occurred.");
      setPhase("error");
    }
  }, []);

  const handleDismiss = useCallback(() => {
    chrome.runtime.sendMessage({ type: "screenshot_dismiss_overlay" });
  }, []);

  const handleRetry = useCallback(() => {
    setPhase("idle");
    setErrorMsg("");
  }, []);

  if (!active) return null;

  // ── Idle state: frame + badge + capture button ──
  if (phase === "idle") {
    return (
      <div className="screenity-screenshot-fullpage-root">
        <div className="screenity-screenshot-fullpage-frame" style={frameStyle} />
        <div className="screenity-screenshot-fullpage-badge" style={badgeStyle}>
          Full Page &nbsp;·&nbsp; Press Esc to cancel
        </div>
        <button
          className="screenity-screenshot-fullpage-capture-btn"
          style={captureButtonStyle}
          onClick={handleCapture}
        >
          Capture Full Page
        </button>
      </div>
    );
  }

  // ── Error state ──
  if (phase === "error") {
    return (
      <div className="screenity-screenshot-fullpage-root">
        <div className="screenity-screenshot-fullpage-backdrop" style={backdropStyle} />
        <div className="screenity-screenshot-fullpage-error-modal" style={errorModalStyle}>
          <div style={errorTitleStyle}>Capture Failed</div>
          <div style={errorTextStyle}>{errorMsg}</div>
          <div style={btnRowStyle}>
            <button style={cancelBtnStyle} onClick={handleDismiss}>
              Cancel
            </button>
            <button style={retryBtnStyle} onClick={handleRetry}>
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Capturing state: render nothing so the overlay never appears in screenshots ──
  if (phase === "capturing") return null;

  // ── Stitching state ──
  const isStitching = phase === "stitching";
  const pct =
    isStitching || progress.total === 0
      ? null
      : Math.round((progress.step / progress.total) * 100);

  return (
    <div className="screenity-screenshot-fullpage-root">
      <style>{shimmerKeyframes}</style>
      <div className="screenity-screenshot-fullpage-backdrop" style={backdropStyle} />
      <div className="screenity-screenshot-fullpage-modal" style={modalStyle}>
        <div style={modalTitleStyle}>
          {isStitching ? "Stitching Image" : "Capturing Full Page"}
        </div>
        <div style={modalSubStyle}>
          {isStitching
            ? `Combining ${progress.total} segment${progress.total !== 1 ? "s" : ""}…`
            : `Capturing segment ${progress.step} of ${progress.total}…`}
        </div>

        <div
          className="screenity-screenshot-fullpage-progress-track"
          style={progressTrackStyle}
        >
          {isStitching ? (
            // Indeterminate shimmer
            <div
              style={{
                ...progressBarBaseStyle,
                width: "30%",
                animation: "screenity-screenshot-shimmer 1.4s ease infinite",
              }}
            />
          ) : (
            <div
              className="screenity-screenshot-fullpage-progress-bar"
              style={{ ...progressBarBaseStyle, width: `${pct ?? 0}%` }}
            />
          )}
        </div>

        <div style={noteStyle}>Please don&apos;t scroll or interact with the page</div>
      </div>
    </div>
  );
}
