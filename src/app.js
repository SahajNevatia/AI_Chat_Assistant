import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import chatRoutes from './routes/chatRoutes.js';
import { authMiddleware } from './middleware/auth.js';
import { apiRateLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

export function createApp() {
  const app = express();

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // Let frontend Vite handle scripts
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  // Cross-Origin Resource Sharing
  app.use(
    cors({
      origin: true, // Allow frontend dev server and production origins
      credentials: true,
      exposedHeaders: ['x-user-id'],
    })
  );

  // Body parsing with safe size limit (Requirement 9: input size limits)
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Basic health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // API router with rate limiter and auth-ready middleware
  app.use('/api', apiRateLimiter, authMiddleware);
  app.use('/api/chat', chatRoutes);

  // 404 handler for unknown routes
  app.use((req, res, next) => {
    res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
  });

  // Centralized error handler
  app.use(errorHandler);

  return app;
}
