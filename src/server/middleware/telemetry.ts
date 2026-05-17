import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../infrastructure/Logger";

/**
 * Enterprise Telemetry Middleware
 * Injects Correlation IDs and tracks precision response times.
 */
export const telemetryMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const traceId = (req.headers["x-trace-id"] as string) || uuidv4();
  const startTime = process.hrtime();

  // Attach to request for downstream usage
  (req as any).traceId = traceId;
  res.setHeader("X-Trace-Id", traceId);

  res.on("finish", () => {
    // Noise Reduction: Skip logging for statics, source files (Vite), and health checks with success codes
    const url = req.originalUrl || req.url;
    const isDevAsset = url.match(/\.(tsx|ts|jsx|js|css|png|jpg|jpeg|svg|webp|ico|map|json)(\?.*)?$/i) || 
                       url.startsWith("/@vite") || 
                       url.startsWith("/src/") ||
                       url.startsWith("/node_modules/");
    
    const isHealthCheck = url === "/api/health";

    if ((isDevAsset || isHealthCheck) && (res.statusCode === 200 || res.statusCode === 304)) {
      return;
    }

    const diff = process.hrtime(startTime);
    const durationMs = diff[0] * 1e3 + diff[1] * 1e-6;

    logger.info(`HTTP ${req.method} ${req.originalUrl}`, {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: durationMs.toFixed(3),
      traceId,
      userAgent: req.headers["user-agent"],
      ip: req.ip
    });
  });

  next();
};
