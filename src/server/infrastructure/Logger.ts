import winston from "winston";
import { v4 as uuidv4 } from "uuid";

/**
 * High-Performance Structured Logging Service (SRE Ready)
 * Standardizing log output for ELK/Datadog/CloudWatch ingestion using Winston.
 */
const winstonLogger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: "omni-matrix-engine" },
  transports: [
    new winston.transports.Console()
  ],
});

export const logger = {
  info: (msg: string, meta?: any) => {
    winstonLogger.info(msg, { traceId: meta?.traceId || uuidv4(), ...meta });
  },
  error: (msg: string, error?: any, meta?: any) => {
    winstonLogger.error(msg, {
      error: error?.message || error,
      stack: error?.stack,
      traceId: meta?.traceId || uuidv4(),
      ...meta
    });
  },
  warn: (msg: string, meta?: any) => {
    winstonLogger.warn(msg, { traceId: meta?.traceId || uuidv4(), ...meta });
  },
  debug: (msg: string, meta?: any) => {
    winstonLogger.debug(msg, { traceId: meta?.traceId || uuidv4(), ...meta });
  }
};
