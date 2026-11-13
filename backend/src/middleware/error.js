import { ZodError } from 'zod';
import multer from 'multer';
import { isProd } from '../config/env.js';

export const notFoundHandler = (_req, res) => res.status(404).json({ success: false, message: 'Route not found' });

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let status = err.status || 500;
  let message = err.message || 'Something went wrong';
  let details;
  if (err instanceof ZodError) {
    status = 400;
    message = err.issues[0]?.message || 'Invalid input';
    details = err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
  } else if (err instanceof multer.MulterError) {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (max 8 MB)' : err.message;
  } else if (err.code === 11000) {
    status = 409;
    message = 'This record already exists';
  } else if (err.name === 'CastError') {
    status = 400;
    message = 'Invalid id';
  }
  if (status >= 500) console.error(`[${req.method} ${req.originalUrl}]`, err);
  res.status(status).json({
    success: false,
    message: status >= 500 && isProd ? 'Internal server error' : message,
    code: err.code && typeof err.code === 'string' ? err.code : undefined,
    details,
  });
}
