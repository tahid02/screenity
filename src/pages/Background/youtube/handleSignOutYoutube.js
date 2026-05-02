export const handleSignOutYoutube = async () => {
  const { youtubeToken } = await chrome.storage.local.get(["youtubeToken"]);
  var url = "https://accounts.google.com/o/oauth2/revoke?token=" + youtubeToken;
  fetch(url);

  chrome.identity.removeCachedAuthToken({ token: youtubeToken });
  chrome.storage.local.set({ youtubeToken: false });
};
