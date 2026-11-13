import { v2 as cloudinary } from 'cloudinary';
import { cloudinaryCfg } from './env.js';

cloudinary.config({ cloud_name: cloudinaryCfg.name, api_key: cloudinaryCfg.key, api_secret: cloudinaryCfg.secret, secure: true });

/** Called once at boot so a wrong cloud name / key is obvious immediately instead of failing on the first upload. */
export async function checkCloudinary() {
  try {
    await cloudinary.api.ping();
    console.log(`Cloudinary connected (${cloudinaryCfg.name})`);
    return true;
  } catch (e) {
    console.error(`\nCLOUDINARY CHECK FAILED: ${e?.error?.message || e.message}\n` +
      '  -> Open https://console.cloudinary.com, copy "Cloud name", "API Key" and "API Secret" EXACTLY as shown\n' +
      '     (the cloud name is usually lowercase and is NOT the same as the product-environment display name),\n' +
      '     or paste the single CLOUDINARY_URL value into backend/.env. Photo/file uploads will fail until this is fixed.\n');
    return false;
  }
}
export default cloudinary;
