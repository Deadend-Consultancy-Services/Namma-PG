import multer from 'multer';
import { HttpError } from '../utils/helpers.js';
import cloudinary from '../config/cloudinary.js';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 5 },
  fileFilter: (_req, f, cb) => (ALLOWED.has(f.mimetype) ? cb(null, true) : cb(new HttpError(400, 'Only JPG, PNG, WEBP or PDF files are allowed'))),
});

/** Upload a multer file buffer to Cloudinary. `type: 'authenticated'` keeps files private (KYC). */
export function uploadToCloudinary(file, { folder, priv = false }) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `pg-platform/${folder}`, resource_type: 'auto', type: priv ? 'authenticated' : 'upload' },
      (err, r) => {
        if (err) { console.error('Cloudinary upload failed:', err.message); return reject(new HttpError(502, 'File upload failed. Please try again in a moment.')); }
        resolve({ url: priv ? undefined : r.secure_url, publicId: r.public_id, resourceType: r.resource_type, format: r.format });
      },
    );
    stream.end(file.buffer);
  });
}

export async function deleteFromCloudinary(f, priv = false) {
  if (!f?.publicId) return;
  try {
    await cloudinary.uploader.destroy(f.publicId, { resource_type: f.resourceType || 'image', type: priv ? 'authenticated' : 'upload', invalidate: true });
  } catch (e) { console.warn('Cloudinary delete failed:', e.message); }
}

/** Short-lived signed download link for a private file. */
export function privateFileUrl(f) {
  if (!f?.publicId) return null;
  return cloudinary.utils.private_download_url(f.publicId, f.format || '', {
    resource_type: f.resourceType || 'image',
    type: 'authenticated',
    expires_at: Math.floor(Date.now() / 1000) + 300,
  });
}
