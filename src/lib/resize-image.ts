/**
 * Downscales an image client-side before it reaches Blob — a phone photo can
 * run 4000px+ on its long edge and several megabytes, and nothing a kit card
 * shows needs more than a couple hundred pixels. Resizing before upload
 * keeps the upload fast and the stored blob small, without a server round
 * trip to do it.
 */
export async function resizeImage(file: File, maxEdge: number): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas isn't available.");
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob) throw new Error("Couldn't process that photo.");
    return new File([blob], "photo.jpg", { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}
