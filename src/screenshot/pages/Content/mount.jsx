import React from "react";
import { createRoot } from "react-dom/client";
import VisiblePartOverlay from "./VisiblePartOverlay";
import SelectedAreaOverlay from "./SelectedAreaOverlay";
import FullPageOverlay from "./FullPageOverlay";

export function mountScreenshotOverlay() {
  if (document.getElementById("screenity-screenshot-overlay-root")) return;

  const container = document.createElement("div");
  container.id = "screenity-screenshot-overlay-root";
  // Container itself is zero-size; overlay children use fixed positioning
  container.style.cssText =
    "position:fixed;top:0;left:0;width:0;height:0;overflow:visible;z-index:2147483647;pointer-events:none;";
  document.body.appendChild(container);

  const root = createRoot(container);
  root.render(
    <>
      <VisiblePartOverlay />
      <SelectedAreaOverlay />
      <FullPageOverlay />
    </>
  );
}
