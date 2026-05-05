import { registerMessage } from "../../../messaging/messageRouter";

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

  registerMessage("screenshot_dismiss_overlay", async () => {
    await chrome.storage.local.remove("screenshot_mode");
    return { success: true };
  });
}
