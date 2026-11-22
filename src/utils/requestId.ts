import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

/**
 * Attaches a unique X-Request-Id to every incoming request and outgoing response.
 * Allows developers and system monitors to correlate logs, errors, and traces.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const incomingId = req.headers['x-request-id'] as string;
  const requestId = incomingId && incomingId.length <= 64 ? incomingId : `req_${crypto.randomUUID().replace(/-/g, '')}`;
  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}
