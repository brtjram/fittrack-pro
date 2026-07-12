// Client-side image resize/compress before upload — keeps photo-analysis
// payloads small (faster upload, lower vision API token cost, stays under
// serverless body-size limits) without needing a server round trip first.
export async function resizeImageToBase64(
  file: Blob,
  maxDimension = 1024,
  quality = 0.82,
): Promise<{ base64: string; mediaType: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported.');
  ctx.drawImage(bitmap, 0, 0, width, height);

  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  const [, base64] = dataUrl.split(',');
  return { base64, mediaType: 'image/jpeg' };
}
