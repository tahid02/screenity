export async function cropImage(dataUrl, sx, sy, sw, sh) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);

  const imgW = bitmap.width;
  const imgH = bitmap.height;

  const cx = Math.max(0, Math.min(Math.round(sx), imgW));
  const cy = Math.max(0, Math.min(Math.round(sy), imgH));
  const cw = Math.max(1, Math.min(Math.round(sw), imgW - cx));
  const ch = Math.max(1, Math.min(Math.round(sh), imgH - cy));

  const canvas = new OffscreenCanvas(cw, ch);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, cx, cy, cw, ch, 0, 0, cw, ch);

  const croppedBlob = await canvas.convertToBlob({ type: "image/png" });
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(croppedBlob);
  });
}