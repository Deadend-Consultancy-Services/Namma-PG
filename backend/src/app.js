import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import compression from 'compression';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { clientOrigins, isProd } from './config/env.js';
import authRoutes from './routes/auth.routes.js';
import commonRoutes from './routes/common.routes.js';
import ownerStructure from './routes/owner.structure.routes.js';
import ownerOps from './routes/owner.ops.routes.js';
import tenantRoutes from './routes/tenant.routes.js';
import webhookRoutes from './routes/webhook.routes.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({
  origin: (origin, cb) => cb(null, !origin || clientOrigins.includes(origin) || clientOrigins.includes('*')), // no Origin = native mobile app / curl
  credentials: true,
}));
app.use(compression());
if (!isProd) app.use(morgan('dev'));

// Razorpay webhook needs the raw body, so it is mounted BEFORE express.json()
app.use('/api/webhooks', webhookRoutes);

app.use(express.json({ limit: '200kb' }));
app.use(mongoSanitize());

app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/ready', (_req, res) => (mongoose.connection.readyState === 1 ? res.json({ ready: true }) : res.status(503).json({ ready: false })));

app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many attempts. Try again later.' } }), authRoutes);
app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));
app.use('/api/owner', ownerStructure);
app.use('/api/owner', ownerOps);
app.use('/api/tenant', tenantRoutes);
app.use('/api', commonRoutes);

app.use(notFoundHandler);
app.use(errorHandler);
export default app;
