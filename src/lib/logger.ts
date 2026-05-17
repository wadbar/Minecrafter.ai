/**
 * Telemetry and Structured Logging Service (Frontend)
 */
export const FrontLogger = {
  info: (event: string, meta?: Record<string, any>) => {
    if (import.meta.env.DEV) {
      console.log(`[INFO] ${event}`, meta || "");
    }
    // TODO: Send to a real ingest pipeline (Datadog/NewRelic) in Production
  },
  warn: (event: string, meta?: Record<string, any>) => {
    console.warn(`[WARN] ${event}`, meta || "");
  },
  error: (event: string, meta?: Record<string, any>) => {
    console.error(`[ERROR] ${event}`, meta || "");
  },
  trackMetric: (metricName: string, value: number, tags?: Record<string, string>) => {
    if (import.meta.env.DEV) {
      console.log(`[METRIC] ${metricName}=${value}`, tags || "");
    }
  }
};
