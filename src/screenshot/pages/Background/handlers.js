import { registerMessage } from "../../../messaging/messageRouter";
import { cropImage } from "./cropImage";

export function registerScreenshotHandlers() {
  registerMessage("screenshot_capture_viewport", async (message, sender) => {
    try {
      const windowId = sender.tab?.windowId;
      if (windowId == null) throw new Error("No windowId in sender");

      const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
        format: "png",
      });

      await chrome.storage.local.set({
        screenshot_captured: {
          dataUrl,
          timestamp: Date.now(),
          source: "viewport",
        },
      });

      await chrome.storage.local.remove("screenshot_mode");

      await chrome.tabs.create({
        url: chrome.runtime.getURL("screenshotviewer.html"),
      });

      return { success: true };
    } catch (err) {
      console.error("[Screenshot] capture_viewport failed:", err);
      return { success: false, error: err.message };
    }
  });

  registerMessage(
    "screenshot_capture_area",
    async (message, sender) => {
      try {
        const windowId = sender.tab?.windowId;
        if (windowId == null) throw new Error("No windowId in sender");

        const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
          format: "png",
        });

        const { screenshot_selection_rect } =
          await chrome.storage.local.get("screenshot_selection_rect");
        if (!screenshot_selection_rect) {
          throw new Error("No selection rect stored");
        }

        const { x, y, width, height, devicePixelRatio } =
          screenshot_selection_rect;
        const dpr = devicePixelRatio || 1;

        const croppedDataUrl = await cropImage(
          dataUrl,
          x * dpr,
          y * dpr,
          width * dpr,
          height * dpr
        );

        await chrome.storage.local.set({
          screenshot_captured: {
            dataUrl: croppedDataUrl,
            timestamp: Date.now(),
            source: "selected_area",
          },
        });

        await chrome.storage.local.remove([
          "screenshot_mode",
          "screenshot_selection_rect",
        ]);

        await chrome.tabs.create({
          url: chrome.runtime.getURL("screenshotviewer.html"),
        });

        return { success: true };
      } catch (err) {
        console.error("[Screenshot] capture_area failed:", err);
        return { success: false, error: err.message };
      }
    }
  );

  registerMessage("screenshot_dismiss_overlay", async () => {
    await chrome.storage.local.remove("screenshot_mode");
    return { success: true };
  });
}
