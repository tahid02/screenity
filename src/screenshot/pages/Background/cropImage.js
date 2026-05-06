export async function cropImage(dataUrl, sx, sy, sw, sh) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);

  const safeW = Math.max(1, Math.round(sw));
  const safeH = Math.max(1, Math.round(sh));

  const canvas = new OffscreenCanvas(safeW, safeH);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, sx, sy, safeW, safeH, 0, 0, safeW, safeH);

  const croppedBlob = await canvas.convertToBlob({ type: "image/png" });
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(croppedBlob);
  });
}