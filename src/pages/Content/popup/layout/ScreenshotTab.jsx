import React, { useState, useContext, useEffect } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import * as Collapsible from "@radix-ui/react-collapsible";
import { DropdownIcon } from "../../images/popup/images";
import { contentStateContext } from "../../context/ContentState";

const ScreenshotTab = () => {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [contentState, setContentState] = useContext(contentStateContext);

  // Hide toolbar when screenshot tab is active
  useEffect(() => {
    setContentState((prevState) => ({
      ...prevState,
      hideToolbar: true,
    }));

    return () => {
      // Show toolbar again when leaving screenshot tab
      setContentState((prevState) => ({
        ...prevState,
        hideToolbar: false,
      }));
    };
  }, [setContentState]);

  const primaryCaptureModes = [
    {
      id: "visible-part",
      icon: "👁️",
      label: "Visible Part",
    },
    {
      id: "selected-area",
      icon: "▭",
      label: "Selected Area",
    },
    {
      id: "full-page",
      icon: "📄",
      label: "Full Page",
    },
  ];

  const additionalOptions = [
    {
      id: "visible-with-delay",
      icon: "⏱️",
      label: "Visible Part + Delay",
      description: "Capture with configurable delay",
    },
    {
      id: "annotate-image",
      icon: "✏️",
      label: "Annotate Image",
      description: "Annotate local or clipboard images",
    },
    {
      id: "extract-text",
      icon: "📝",
      label: "Extract Text",
      description: "Capture and extract text from screenshot",
    },
    {
      id: "screen-window",
      icon: "🖥️",
      label: "Full Screen",
      description: "Capture entire screen or window with delay",
    },
  ];

  return (
    <div className="screenshot-ui">
      {/* Horizontal Tabs */}
      <Tabs.Root className="screenshot-tabs-root" defaultValue="visible-part">
        <Tabs.List className="screenshot-tabs-list">
          {primaryCaptureModes.map((mode) => (
            <Tabs.Trigger
              key={mode.id}
              className="screenshot-tab-trigger"
              value={mode.id}
            >
              <div className="screenshot-tab-icon">{mode.icon}</div>
              <span>{mode.label}</span>
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        {/* Tab Contents */}
        {primaryCaptureModes.map((mode) => (
          <Tabs.Content
            key={mode.id}
            className="screenshot-tab-content"
            value={mode.id}
          >
            <div className="screenshot-content-area">
              {/* Show More Options Collapsible */}
              <Collapsible.Root
                className="screenshot-collapsible-root"
                open={optionsOpen}
                onOpenChange={setOptionsOpen}
              >
                <Collapsible.Trigger className="screenshot-collapsible-trigger">
                  <div className="screenshot-collapsible-label">
                    ✨ Show more options
                    <img src={DropdownIcon} alt="dropdown" />
                  </div>
                </Collapsible.Trigger>

                <Collapsible.Content className="screenshot-collapsible-content">
                  <div className="screenshot-options-list">
                    {additionalOptions.map((option) => (
                      <div
                        key={option.id}
                        className="screenshot-option-item"
                        role="button"
                        tabIndex="0"
                      >
                        <div className="screenshot-option-icon">
                          {option.icon}
                        </div>
                        <div className="screenshot-option-text">
                          <div className="screenshot-option-label">
                            {option.label}
                          </div>
                          <div className="screenshot-option-desc">
                            {option.description}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Collapsible.Content>
              </Collapsible.Root>
            </div>
          </Tabs.Content>
        ))}
      </Tabs.Root>
    </div>
  );
};

export default ScreenshotTab;
