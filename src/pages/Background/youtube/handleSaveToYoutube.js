import { base64ToUint8Array } from "../utils/base64ToUint8Array";
import { sendMessageTab } from "../tabManagement";
import signIn from "../modules/signIn";
import { diagEvent } from "../../utils/diagnosticLog";

const getAuthTokenFromStorage = async () => {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(["youtubeToken"], async (result) => {
      if (chrome.runtime.lastError) {
        console.error("[YouTube] storage error:", chrome.runtime.lastError);
        reject(new Error(chrome.runtime.lastError));
        return;
      }

      const token = result.youtubeToken;
      if (!token) {
        try {
          const newToken = await signIn();
          if (!newToken) {
            console.error("[YouTube] youtube_auth_failed: signIn returned null");
            diagEvent("youtube-auth-fail", { reason: "signIn returned null" });
            reject(new Error("Sign-in failed"));
          } else {
            await chrome.storage.local.set({ youtubeToken: newToken });
            resolve(newToken);
          }
        } catch (err) {
          console.error("[YouTube] youtube_auth_failed:", err.message);
          diagEvent("youtube-auth-fail", { reason: String(err.message).slice(0, 80) });
          reject(err);
        }
        return;
      }

      let isExpired = false;
      try {
        const parts = token.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          const exp = payload.exp * 1000;
          isExpired = Date.now() >= exp;
        }
      } catch {
        // Not parseable — use as-is
      }

      if (isExpired) {
        try {
          const newToken = await signIn();
          if (!newToken) {
            console.error("[YouTube] youtube_auth_failed: re-sign-in returned null");
            reject(new Error("Sign-in failed"));
          } else {
            await chrome.storage.local.set({ youtubeToken: newToken });
            resolve(newToken);
          }
        } catch (err) {
          console.error("[YouTube] youtube_auth_failed:", err.message);
          reject(err);
        }
      } else {
        resolve(token);
      }
    });
  });
};

const saveToYoutube = async (videoBlob, fileName) => {
  try {
    const token = await getAuthTokenFromStorage();
    if (!token) throw new Error("Sign-in failed");

    diagEvent("youtube-upload-start", {
      blobSize: videoBlob.size,
      blobType: videoBlob.type,
    });

    // Step 1: Initiate resumable upload to get the upload URI
    const initiateRes = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Upload-Content-Type": "video/mp4",
          "X-Upload-Content-Length": videoBlob.size.toString(),
        },
        body: JSON.stringify({
          snippet: {
            title: fileName,
            description: "Recorded with Screenity",
          },
          status: {
            privacyStatus: "unlisted",
            selfDeclaredMadeForKids: false,
          },
        }),
      }
    );

    if (!initiateRes.ok) {
      const errBody = await initiateRes.text().catch(() => "");
      console.error("[YouTube] youtube_upload_failed (initiate)", {
        status: initiateRes.status,
        body: errBody,
      });
      throw new Error(`Upload initiation failed: ${initiateRes.status} ${errBody}`);
    }

    const uploadUri = initiateRes.headers.get("Location");
    if (!uploadUri) {
      throw new Error("No upload URI returned from initiate request");
    }

    // Step 2: Upload the video blob to the upload URI
    const uploadRes = await fetch(uploadUri, {
      method: "PUT",
      headers: {
        "Content-Type": "video/mp4",
      },
      body: videoBlob,
    });

    if (!uploadRes.ok) {
      const errBody = await uploadRes.text().catch(() => "");
      console.error("[YouTube] youtube_upload_failed (upload)", {
        status: uploadRes.status,
        body: errBody,
      });
      throw new Error(`Upload failed: ${uploadRes.status} ${errBody}`);
    }

    const uploadData = await uploadRes.json();
    const videoId = uploadData.id;

    if (!videoId) {
      throw new Error("Video ID missing after upload");
    }

    diagEvent("youtube-upload-ok", { videoId });

    // Open YouTube Studio to the uploaded video
    chrome.tabs.create({
      url: `https://studio.youtube.com/video/${videoId}/edit`,
    });

    return { status: "ok", videoId };
  } catch (error) {
    console.error("[YouTube] youtube_upload_failed:", error.message);
    diagEvent("youtube-upload-fail", {
      error: String(error.message).slice(0, 120),
    });
    return { status: "error", videoId: null, error: error.message };
  }
};

const savedToYoutube = async () => {
  const { sandboxTab } = await chrome.storage.local.get(["sandboxTab"]);
  if (!sandboxTab) {
    console.warn("[YouTube] savedToYoutube: sandboxTab not set, cannot notify UI");
    return;
  }
  try {
    await sendMessageTab(sandboxTab, { type: "saved-to-youtube" });
  } catch (err) {
    console.warn("[YouTube] savedToYoutube: failed to notify sandbox tab:", err);
  }
};

export const handleSaveToYoutube = async (request) => {
  try {
    // YouTube requires MP4 — no fallback to WebM
    if (request.isWebm) {
      console.error("[YouTube] youtube_upload_failed: WebM not supported, MP4 required");
      diagEvent("youtube-upload-fail", { error: "WebM format not supported" });
      return {
        status: "error",
        videoId: null,
        error: "YouTube requires MP4 format. WebM is not supported.",
      };
    }

    const blob = base64ToUint8Array(request.base64);
    const fileName = (request.title || "Screenity Recording") + ".mp4";
    const response = await saveToYoutube(blob, fileName);

    if (response.status === "ok") {
      await savedToYoutube();
    }
    return response;
  } catch (err) {
    console.error("[YouTube] handleSaveToYoutube failed:", err);
    diagEvent("youtube-save-fail", { error: String(err.message).slice(0, 120) });
    return { status: "error", videoId: null, error: err.message };
  }
};
