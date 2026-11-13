import http from 'http';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import app from './app.js';
import { initSocket } from './services/socket.js';
import { startJobs } from './jobs/cron.js';
import { checkCloudinary } from './config/cloudinary.js';
import './models/index.js';

await connectDB();
// Build indexes explicitly. A failure is logged but never crashes the server
// (e.g. an old collection in the same database that already contains conflicting data).
await Promise.all(Object.values(mongoose.models).map((m) =>
  m.createIndexes().catch((e) => console.error(`Index build failed for ${m.modelName}: ${e.message}`))));

await checkCloudinary();

const server = http.createServer(app);
initSocket(server);
startJobs();
server.listen(env.PORT, () => console.log(`API listening on :${env.PORT} (${env.NODE_ENV})`));

const shutdown = async (sig) => {
  console.log(`${sig} received, shutting down`);
  server.close(async () => { await mongoose.disconnect(); process.exit(0); });
  setTimeout(() => process.exit(1), 10000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (e) => console.error('unhandledRejection', e));
