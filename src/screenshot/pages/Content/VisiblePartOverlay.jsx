import React, { useState, useEffect, useCallback } from "react";

const BLUE = "#567BDA";

const overlayStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100vw",
  height: "100vh",
  zIndex: 2147483647,
  pointerEvents: "none",
  boxSizing: "border-box",
  border: `2px solid ${BLUE}`,
  // Large inset shadow creates the subtle gray "capture-mode frame" effect
  boxShadow: `inset 0 0 0 9999px rgba(120, 130, 160, 0.08)`,
};

const captureBtnStyle = {
  position: "fixed",
  right: "20px",
  top: "50%",
  transform: "translateY(-50%)",
  zIndex: 2147483647,
  pointerEvents: "auto",
  backgroundColor: BLUE,
  color: "#fff",
  border: "none",
  borderRadius: "10px",
  padding: "11px 22px",
  fontSize: "14px",
  fontWeight: "600",
  fontFamily: "'Satoshi-Medium', system-ui, -apple-system, sans-serif",
  letterSpacing: "0.01em",
  cursor: "pointer",
  boxShadow: `0 3px 12px rgba(86, 123, 218, 0.45)`,
  userSelect: "none",
  WebkitUserSelect: "none",
  transition: "opacity 0.1s",
};

const dismissBtnStyle = {
  position: "fixed",
  top: "12px",
  right: "12px",
  zIndex: 2147483647,
  pointerEvents: "auto",
  width: "28px",
  height: "28px",
  backgroundColor: "rgba(30, 30, 40, 0.55)",
  color: "#fff",
  border: "none",
  borderRadius: "50%",
  fontSize: "16px",
  lineHeight: "28px",
  textAlign: "center",
  cursor: "pointer",
  userSelect: "none",
  WebkitUserSelect: "none",
  fontFamily: "system-ui",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const badgeStyle = {
  position: "fixed",
  top: "12px",
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 2147483647,
  pointerEvents: "none",
  backgroundColor: "rgba(30, 30, 40, 0.62)",
  color: "#fff",
  borderRadius: "20px",
  padding: "5px 14px",
  fontSize: "12px",
  fontWeight: "500",
  fontFamily: "'Satoshi-Medium', system-ui, -apple-system, sans-serif",
  letterSpacing: "0.02em",
  whiteSpace: "nowrap",
  userSelect: "none",
  WebkitUserSelect: "none",
};

const VisiblePartOverlay = () => {
  const [active, setActive] = useState(false);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    chrome.storage.local.get("screenshot_mode", (result) => {
      setActive(result.screenshot_mode === "viewport_overlay");
    });

    const onChange = (changes, area) => {
      if (area !== "local" || !changes.screenshot_mode) return;
      const val = changes.screenshot_mode.newValue;
      setActive(val === "viewport_overlay");
    };

    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, []);

  const dismiss = useCallback(() => {
    setActive(false);
    chrome.storage.local.remove("screenshot_mode");
  }, []);

  useEffect(() => {
    if (!active) return;
    const onKey = (e) => {
      if (e.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [active, dismiss]);

  const handleCapture = useCallback(() => {
    // Hide overlay immediately so it's gone before captureVisibleTab fires
    setCapturing(true);
    setActive(false);
    chrome.storage.local.remove("screenshot_mode");

    setTimeout(() => {
      chrome.runtime.sendMessage({ type: "screenshot_capture_viewport" }, () => {
        setCapturing(false);
      });
    }, 150);
  }, []);

  if (!active || capturing) return null;

  return (
    <>
      <div style={overlayStyle} />
      <div style={badgeStyle}>Visible Part · Press Esc to cancel</div>
      <button style={captureBtnStyle} onClick={handleCapture}>
        Capture
      </button>
      <button style={dismissBtnStyle} onClick={dismiss} title="Cancel (Esc)">
        ✕
      </button>
    </>
  );
};

export default VisiblePartOverlay;
