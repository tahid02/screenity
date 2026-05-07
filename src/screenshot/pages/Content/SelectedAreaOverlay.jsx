import React, { useState, useEffect, useCallback, useRef } from "react";

const BLUE = "#567BDA";
const HANDLE_SIZE = 12;
const EDGE_HIT = 8;
const MIN_SIZE = 10;

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

const cornerHandleStyle = {
  position: "fixed",
  width: HANDLE_SIZE,
  height: HANDLE_SIZE,
  backgroundColor: BLUE,
  borderRadius: "3px",
  pointerEvents: "auto",
  zIndex: 2147483647,
  boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
};

const edgeHandleStyle = {
  position: "fixed",
  backgroundColor: "transparent",
  pointerEvents: "auto",
  zIndex: 2147483647,
};

const clampToViewport = (rect) => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let { x, y, width, height } = rect;

  if (x + width > vw) {
    x = Math.max(0, vw - width);
  }
  if (y + height > vh) {
    y = Math.max(0, vh - height);
  }
  width = Math.min(width, vw - x);
  height = Math.min(height, vh - y);

  return { x, y, width: Math.max(width, MIN_SIZE), height: Math.max(height, MIN_SIZE) };
};

const RESIZE_DIRS = {
  topLeft: { cursor: "nwse-resize", edgeX: "start", edgeY: "start" },
  top: { cursor: "ns-resize", edgeX: null, edgeY: "start" },
  topRight: { cursor: "nesw-resize", edgeX: "end", edgeY: "start" },
  right: { cursor: "ew-resize", edgeX: "end", edgeY: null },
  bottomRight: { cursor: "nwse-resize", edgeX: "end", edgeY: "end" },
  bottom: { cursor: "ns-resize", edgeX: null, edgeY: "end" },
  bottomLeft: { cursor: "nesw-resize", edgeX: "start", edgeY: "end" },
  left: { cursor: "ew-resize", edgeX: "start", edgeY: null },
};

function getHandlePositions(rect) {
  const { x, y, width, height } = rect;
  const h = HANDLE_SIZE;
  const e = EDGE_HIT;
  const half = h / 2;
  const edgeHalf = e / 2;
  return {
    topLeft: { left: x - half, top: y - half, style: "corner" },
    top: {
      left: x + h,
      top: y - edgeHalf,
      width: Math.max(width - h * 2, h),
      height: e,
      style: "edgeH",
    },
    topRight: { left: x + width - half, top: y - half, style: "corner" },
    right: {
      left: x + width - edgeHalf,
      top: y + h,
      width: e,
      height: Math.max(height - h * 2, h),
      style: "edgeV",
    },
    bottomRight: { left: x + width - half, top: y + height - half, style: "corner" },
    bottom: {
      left: x + h,
      top: y + height - edgeHalf,
      width: Math.max(width - h * 2, h),
      height: e,
      style: "edgeH",
    },
    bottomLeft: { left: x - half, top: y + height - half, style: "corner" },
    left: {
      left: x - edgeHalf,
      top: y + h,
      width: e,
      height: Math.max(height - h * 2, h),
      style: "edgeV",
    },
  };
}

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
  const [resizingDir, setResizingDir] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const resizeStartRef = useRef(null);
  const dragStartRef = useRef(null);
  const overlayRef = useRef(null);

  useEffect(() => {
    const loadInitial = () => {
      chrome.storage.local.get("screenshot_mode", (result) => {
        if (result.screenshot_mode === "select_area") {
          setActive(true);
          chrome.storage.local.get("screenshot_last_selected_area", (res) => {
            if (res.screenshot_last_selected_area) {
              setSelectionRect(clampToViewport(res.screenshot_last_selected_area));
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
            setSelectionRect(clampToViewport(res.screenshot_last_selected_area));
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

  const handleResizeStart = useCallback((e, dir) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingDir(dir);
    resizeStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startRect: { ...selectionRect },
    };
  }, [selectionRect]);

  const handleDragStart = useCallback((e) => {
    if (resizingDir) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startRect: { ...selectionRect },
    };
  }, [resizingDir, selectionRect]);

  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e) => {
      const dx = e.clientX - dragStartRef.current.startX;
      const dy = e.clientY - dragStartRef.current.startY;
      const sr = dragStartRef.current.startRect;

      let x = sr.x + dx;
      let y = sr.y + dy;

      const vw = window.innerWidth;
      const vh = window.innerHeight;

      x = Math.max(0, Math.min(x, vw - sr.width));
      y = Math.max(0, Math.min(y, vh - sr.height));

      setSelectionRect({ ...sr, x, y });
    };

    const onMouseUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDragging]);

  useEffect(() => {
    if (!resizingDir) return;
    const dirInfo = RESIZE_DIRS[resizingDir];
    const start = resizeStartRef.current;

    const onMouseMove = (e) => {
      const dx = e.clientX - start.startX;
      const dy = e.clientY - start.startY;
      const sr = start.startRect;
      let { x, y, width, height } = sr;

      if (dirInfo.edgeX === "start") {
        x = sr.x + dx;
        width = sr.width - dx;
      } else if (dirInfo.edgeX === "end") {
        width = sr.width + dx;
      }
      if (dirInfo.edgeY === "start") {
        y = sr.y + dy;
        height = sr.height - dy;
      } else if (dirInfo.edgeY === "end") {
        height = sr.height + dy;
      }

      if (width < MIN_SIZE) {
        if (dirInfo.edgeX === "start") x = sr.x + sr.width - MIN_SIZE;
        width = MIN_SIZE;
      }
      if (height < MIN_SIZE) {
        if (dirInfo.edgeY === "start") y = sr.y + sr.height - MIN_SIZE;
        height = MIN_SIZE;
      }

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      x = Math.max(0, x);
      y = Math.max(0, y);
      if (x + width > vw) width = vw - x;
      if (y + height > vh) height = vh - y;

      setSelectionRect({ x, y, width: Math.max(width, MIN_SIZE), height: Math.max(height, MIN_SIZE) });
    };

    const onMouseUp = () => {
      setResizingDir(null);
      resizeStartRef.current = null;
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [resizingDir]);

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
  const handlePositions = showFixedUI ? getHandlePositions(selectionRect) : null;

  return (
    <>
      <div
        ref={overlayRef}
        className="screenity-screenshot-area-overlay"
        style={{
          ...overlayBaseStyle,
          cursor: isFixed ? "default" : "crosshair",
          pointerEvents: "auto",
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
            <>
              <div
                className="screenity-screenshot-area-rect"
                style={{
                  position: "fixed",
                  left: selectionRect.x,
                  top: selectionRect.y,
                  width: selectionRect.width,
                  height: selectionRect.height,
                  zIndex: 2147483646,
                  boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.35)",
                  border: `2px solid ${BLUE}`,
                  borderRadius: "2px",
                  pointerEvents: "auto",
                  cursor: isDragging ? "grabbing" : "grab",
                  userSelect: "none",
                  WebkitUserSelect: "none",
                }}
                onMouseDown={handleDragStart}
              >
                <div style={dimBadgeStyle}>
                  {Math.round(selectionRect.width)} ×{" "}
                  {Math.round(selectionRect.height)}
                </div>
              </div>

              {handlePositions && Object.entries(RESIZE_DIRS).map(([dir, info]) => {
                const pos = handlePositions[dir];
                if (pos.style === "corner") {
                  return (
                    <div
                      key={dir}
                      className="screenity-screenshot-resize-handle"
                      style={{
                        ...cornerHandleStyle,
                        left: pos.left,
                        top: pos.top,
                        cursor: info.cursor,
                      }}
                      onMouseDown={(e) => handleResizeStart(e, dir)}
                    />
                  );
                }
                return (
                  <div
                    key={dir}
                    className="screenity-screenshot-resize-handle"
                    style={{
                      ...edgeHandleStyle,
                      ...pos,
                      cursor: info.cursor,
                    }}
                    onMouseDown={(e) => handleResizeStart(e, dir)}
                  >
                    <div
                      style={{
                        position: "absolute",
                        backgroundColor: BLUE,
                        borderRadius: "3px",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                        ...(pos.style === "edgeH"
                          ? { width: HANDLE_SIZE, height: HANDLE_SIZE, left: "50%", top: "50%", transform: "translate(-50%, -50%)" }
                          : { width: HANDLE_SIZE, height: HANDLE_SIZE, left: "50%", top: "50%", transform: "translate(-50%, -50%)" }),
                      }}
                    />
                  </div>
                );
              })}
            </>
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