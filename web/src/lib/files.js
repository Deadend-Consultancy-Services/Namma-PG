const OK = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX = 8 * 1024 * 1024;

async function shrink(file, maxSide = 1800) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
  if (!blob || blob.size >= file.size) return file;
  return new File([blob], `${file.name.replace(/\.\w+$/, '')}.jpg`, { type: 'image/jpeg' });
}

/** Validate a file chosen by the user and shrink large phone photos so uploads are fast and under the 8 MB limit. */
export async function prepareFile(file, { imageOnly = false } = {}) {
  if (!OK.includes(file.type)) throw new Error(imageOnly ? 'Please choose a JPG, PNG or WEBP image' : 'Only JPG, PNG, WEBP or PDF files are allowed');
  if (imageOnly && file.type === 'application/pdf') throw new Error('Please choose an image, not a PDF');
  let out = file;
  if (file.type.startsWith('image/') && file.size > 1.5 * 1024 * 1024) { try { out = await shrink(file); } catch { /* keep original */ } }
  if (out.size > MAX) throw new Error('File is too large (max 8 MB)');
  return out;
}
