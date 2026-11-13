import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  CLIENT_URL: z.string().min(1),
  MONGODB_URI: z.string().min(10, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(24, 'JWT_SECRET must be at least 24 chars'),
  JWT_REFRESH_SECRET: z.string().min(24, 'JWT_REFRESH_SECRET must be at least 24 chars'),
  SMS_PROVIDER: z.enum(['console', 'msg91', 'fast2sms']).default('console'),
  SMS_API_KEY: z.string().optional().default(''),
  MSG91_TEMPLATE_ID: z.string().optional().default(''),
  CLOUDINARY_URL: z.string().optional().default(''),
  CLOUDINARY_CLOUD_NAME: z.string().optional().default(''),
  CLOUDINARY_API_KEY: z.string().optional().default(''),
  CLOUDINARY_API_SECRET: z.string().optional().default(''),
  RAZORPAY_KEY_ID: z.string().optional().default(''),
  RAZORPAY_KEY_SECRET: z.string().optional().default(''),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional().default(''),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:');
  for (const i of parsed.error.issues) console.error(` - ${i.path.join('.')}: ${i.message}`);
  process.exit(1);
}
export const env = parsed.data;

// Cloudinary: either the single CLOUDINARY_URL (cloudinary://KEY:SECRET@CLOUD_NAME) or the three separate values.
const cl = { name: env.CLOUDINARY_CLOUD_NAME, key: env.CLOUDINARY_API_KEY, secret: env.CLOUDINARY_API_SECRET };
const m = env.CLOUDINARY_URL.trim().match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
if (m) { cl.key = m[1]; cl.secret = m[2]; cl.name = m[3]; }
export const cloudinaryCfg = { name: cl.name.trim().toLowerCase(), key: cl.key.trim(), secret: cl.secret.trim() }; // cloud names are lowercase
if (!cloudinaryCfg.name || !cloudinaryCfg.key || !cloudinaryCfg.secret) {
  console.error('Cloudinary is not configured: set CLOUDINARY_URL, or CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET.');
  process.exit(1);
}
if (env.NODE_ENV === 'production') {
  if (env.SMS_PROVIDER === 'console') {
    console.error('SMS_PROVIDER=console is not allowed in production. Configure msg91 or fast2sms.');
    process.exit(1);
  }
  if (!env.SMS_API_KEY) {
    console.error('SMS_API_KEY is required in production.');
    process.exit(1);
  }
}
export const isProd = env.NODE_ENV === 'production';
export const clientOrigins = env.CLIENT_URL.split(',').map((s) => s.trim()).filter(Boolean);
