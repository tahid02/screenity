import React from "react";

const ScreenshotTab = () => {
  return (
    <div className="screenshot-tab-demo">
      <div className="demo-content">
        <h2>Screenshot Feature</h2>
        <p>Screenshot annotation and editing coming soon!</p>
        <div className="feature-list">
          <div className="feature-item">
            <span className="feature-icon">📸</span>
            <span className="feature-name">Capture Screenshots</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">✏️</span>
            <span className="feature-name">Annotate & Edit</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">📤</span>
            <span className="feature-name">Quick Share</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScreenshotTab;
