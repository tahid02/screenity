import React, { useState, useEffect, useCallback, useRef } from "react";
import { Rnd } from "react-rnd";

const BLUE = "#567BDA";

const overlayBaseStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 2147483646,
  userSelect: "none",
  WebkitUserSelect: "none",
  backgroundColor: "rgba(0, 0, 0, 0.15)",
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

const dimBadgeStyle = {
  position: "absolute",
  top: "-28px",
  left: "0",
  backgroundColor: "rgba(30, 30, 40, 0.78)",
  color: "#fff",
  fontSize: "11px",
  padding: "2px 8px",
  borderRadius: "3px",
  whiteSpace: "nowrap",
  pointerEvents: "none",
  fontFamily: "'Satoshi-Medium', system-ui, -apple-system, sans-serif",
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
  boxShadow: "0 3px 12px rgba(86, 123, 218, 0.45)",
  userSelect: "none",
  WebkitUserSelect: "none",
  transition: "opacity 0.1s",
};

const resetBtnStyle = {
  position: "fixed",
  right: "20px",
  top: "calc(50% + 50px)",
  transform: "translateY(-50%)",
  zIndex: 2147483647,
  pointerEvents: "auto",
  backgroundColor: "rgba(255,255,255,0.12)",
  color: "#fff",
  border: "none",
  borderRadius: "10px",
  padding: "9px 18px",
  fontSize: "13px",
  fontWeight: "500",
  fontFamily: "'Satoshi-Medium', system-ui, -apple-system, sans-serif",
  cursor: "pointer",
  userSelect: "none",
  WebkitUserSelect: "none",
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

const SelectedAreaOverlay = () => {
  const [active, setActive] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isFixed, setIsFixed] = useState(false);
  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
  const [selectionRect, setSelectionRect] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const overlayRef = useRef(null);

  useEffect(() => {
    const loadInitial = () => {
      chrome.storage.local.get("screenshot_mode", (result) => {
        if (result.screenshot_mode === "select_area") {
          setActive(true);
          chrome.storage.local.get("screenshot_last_selected_area", (res) => {
            if (res.screenshot_last_selected_area) {
              setSelectionRect(res.screenshot_last_selected_area);
              setIsFixed(true);
            }
          });
        }
      });
    };

    loadInitial();

    const onChange = (changes, area) => {
      if (area !== "local" || !changes.screenshot_mode) return;
      const val = changes.screenshot_mode.newValue;
      if (val === "select_area") {
        setActive(true);
        chrome.storage.local.get("screenshot_last_selected_area", (res) => {
          if (res.screenshot_last_selected_area) {
            setSelectionRect(res.screenshot_last_selected_area);
            setIsFixed(true);
          }
        });
      } else {
        setActive(false);
        setIsFixed(false);
        setIsDrawing(false);
      }
    };

    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, []);

  const dismiss = useCallback(() => {
    setActive(false);
    setIsFixed(false);
    setIsDrawing(false);
    setSelectionRect({ x: 0, y: 0, width: 0, height: 0 });
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

  const handleMouseDown = useCallback(
    (e) => {
      if (isFixed || capturing) return;
      if (e.button !== 0) return;
      const x = e.clientX;
      const y = e.clientY;
      setStartPoint({ x, y });
      setIsDrawing(true);
      setSelectionRect({ x, y, width: 0, height: 0 });
    },
    [isFixed, capturing]
  );

  const handleMouseMove = useCallback(
    (e) => {
      if (!isDrawing) return;
      const width = e.clientX - startPoint.x;
      const height = e.clientY - startPoint.y;
      setSelectionRect({
        x: width < 0 ? e.clientX : startPoint.x,
        y: height < 0 ? e.clientY : startPoint.y,
        width: Math.abs(width),
        height: Math.abs(height),
      });
    },
    [isDrawing, startPoint]
  );

  const handleMouseUp = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (selectionRect.width > 5 && selectionRect.height > 5) {
      setIsFixed(true);
    } else {
      setSelectionRect({ x: 0, y: 0, width: 0, height: 0 });
    }
  }, [isDrawing, selectionRect]);

  const handleRectDrag = useCallback((e, d) => {
    setSelectionRect((prev) => ({
      ...prev,
      x: d.x,
      y: d.y,
    }));
  }, []);

  const handleRectResize = useCallback((e, direction, ref, delta, position) => {
    setSelectionRect({
      x: position.x,
      y: position.y,
      width: ref.offsetWidth,
      height: ref.offsetHeight,
    });
  }, []);

  const handleResetSelection = useCallback(() => {
    setIsFixed(false);
    setIsDrawing(false);
    setSelectionRect({ x: 0, y: 0, width: 0, height: 0 });
    chrome.storage.local.remove("screenshot_last_selected_area");
  }, []);

  const handleCapture = useCallback(() => {
    if (selectionRect.width < 1 || selectionRect.height < 1) return;
    setCapturing(true);
    setActive(false);

    chrome.storage.local.set({
      screenshot_last_selected_area: {
        x: selectionRect.x,
        y: selectionRect.y,
        width: selectionRect.width,
        height: selectionRect.height,
      },
      screenshot_selection_rect: {
        x: selectionRect.x,
        y: selectionRect.y,
        width: selectionRect.width,
        height: selectionRect.height,
        devicePixelRatio: window.devicePixelRatio,
      },
    });

    chrome.storage.local.remove("screenshot_mode");

    setTimeout(() => {
      chrome.runtime.sendMessage(
        { type: "screenshot_capture_area" },
        () => {
          setCapturing(false);
        }
      );
    }, 150);
  }, [selectionRect]);

  if (!active || capturing) return null;

  const hasSelection = isFixed || isDrawing;
  const showFixedUI = isFixed && !isDrawing;

  return (
    <>
      <div
        ref={overlayRef}
        className="screenity-screenshot-area-overlay"
        style={{
          ...overlayBaseStyle,
          cursor: isFixed ? "default" : "crosshair",
          pointerEvents: isFixed ? "none" : "auto",
          backgroundColor: hasSelection ? "transparent" : "rgba(0, 0, 0, 0.15)",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      />

      {hasSelection && (
        <>
          {isDrawing && !isFixed && (
            <div
              className="screenity-screenshot-area-rect"
              style={{
                position: "fixed",
                left: selectionRect.x,
                top: selectionRect.y,
                width: selectionRect.width,
                height: selectionRect.height,
                boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.35)",
                border: `2px solid ${BLUE}`,
                borderRadius: "2px",
                zIndex: 2147483646,
                pointerEvents: "none",
              }}
            >
              {selectionRect.width > 30 && selectionRect.height > 20 && (
                <div style={dimBadgeStyle}>
                  {Math.round(selectionRect.width)} × {Math.round(selectionRect.height)}
                </div>
              )}
            </div>
          )}

          {showFixedUI && (
            <Rnd
              position={{ x: selectionRect.x, y: selectionRect.y }}
              size={{ width: selectionRect.width, height: selectionRect.height }}
              minWidth={10}
              minHeight={10}
              onDrag={handleRectDrag}
              onResize={handleRectResize}
              style={{
                zIndex: 2147483646,
              }}
            >
              <div
                className="screenity-screenshot-area-rect"
                style={{
                  width: "100%",
                  height: "100%",
                  boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.35)",
                  border: `2px solid ${BLUE}`,
                  borderRadius: "2px",
                  pointerEvents: "auto",
                  position: "relative",
                }}
              >
                <div style={dimBadgeStyle}>
                  {Math.round(selectionRect.width)} ×{" "}
                  {Math.round(selectionRect.height)}
                </div>
              </div>
            </Rnd>
          )}
        </>
      )}

      <div style={badgeStyle}>
        Selected Area · Press Esc to cancel
      </div>

      {showFixedUI && (
        <>
          <button
            className="screenity-screenshot-area-capture"
            style={captureBtnStyle}
            onClick={handleCapture}
          >
            Capture
          </button>
          <button
            className="screenity-screenshot-area-reset"
            style={resetBtnStyle}
            onClick={handleResetSelection}
          >
            Reset
          </button>
        </>
      )}

      <button style={dismissBtnStyle} onClick={dismiss} title="Cancel (Esc)">
        ✕
      </button>
    </>
  );
};

export default SelectedAreaOverlay;