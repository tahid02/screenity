import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";

const BLUE = "#567BDA";

const pageStyle = {
  margin: 0,
  padding: 0,
  minHeight: "100vh",
  backgroundColor: "#1a1a24",
  fontFamily: "'Satoshi-Medium', system-ui, -apple-system, sans-serif",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
};

const toolbarStyle = {
  width: "100%",
  backgroundColor: "#111118",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  padding: "12px 24px",
  display: "flex",
  alignItems: "center",
  gap: "12px",
  boxSizing: "border-box",
  position: "sticky",
  top: 0,
  zIndex: 10,
};

const titleStyle = {
  color: "#fff",
  fontSize: "15px",
  fontWeight: "600",
  flex: 1,
};

const btnBase = {
  borderRadius: "8px",
  padding: "8px 18px",
  fontSize: "13px",
  fontWeight: "600",
  cursor: "pointer",
  border: "none",
  letterSpacing: "0.01em",
};

const downloadBtnStyle = {
  ...btnBase,
  backgroundColor: BLUE,
  color: "#fff",
  boxShadow: "0 2px 8px rgba(86,123,218,0.35)",
};

const copyBtnStyle = {
  ...btnBase,
  backgroundColor: "rgba(255,255,255,0.1)",
  color: "#fff",
};

const imageWrapStyle = {
  padding: "32px 24px",
  display: "flex",
  justifyContent: "center",
  alignItems: "flex-start",
  flex: 1,
  width: "100%",
  boxSizing: "border-box",
};

const imageStyle = {
  maxWidth: "100%",
  borderRadius: "6px",
  boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
  display: "block",
};

const emptyStyle = {
  color: "rgba(255,255,255,0.45)",
  fontSize: "15px",
  marginTop: "80px",
};

const ScreenshotViewer = () => {
  const [dataUrl, setDataUrl] = useState(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState("viewport");

  useEffect(() => {
    chrome.storage.local.get("screenshot_captured", (result) => {
      const captured = result.screenshot_captured;
      if (captured?.dataUrl) {
        setDataUrl(captured.dataUrl);
        if (captured.source) {
          setSource(captured.source);
        }
        // Remove from storage immediately after reading
        chrome.storage.local.remove("screenshot_captured");
      }
      setLoading(false);
    });
  }, []);

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `screenshot-${Date.now()}.png`;
    a.click();
  };

  const handleCopy = async () => {
    if (!dataUrl) return;
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: copy the data URL as text
      await navigator.clipboard.writeText(dataUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div style={pageStyle}>
      <div style={toolbarStyle}>
        <span style={titleStyle}>Screenshot · {source === "selected_area" ? "Selected Area" : "Visible Part"}</span>
        {dataUrl && (
          <>
            <button style={copyBtnStyle} onClick={handleCopy}>
              {copied ? "Copied!" : "Copy Image"}
            </button>
            <button style={downloadBtnStyle} onClick={handleDownload}>
              Download PNG
            </button>
          </>
        )}
      </div>

      <div style={imageWrapStyle}>
        {loading && <p style={emptyStyle}>Loading…</p>}
        {!loading && !dataUrl && (
          <p style={emptyStyle}>No screenshot found.</p>
        )}
        {dataUrl && (
          <img src={dataUrl} alt="Screenshot" style={imageStyle} />
        )}
      </div>
    </div>
  );
};

const container = document.getElementById("app-container");
createRoot(container).render(<ScreenshotViewer />);
