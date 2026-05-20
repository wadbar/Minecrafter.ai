/**
 * Telemetry and Structured Logging Service (Frontend)
 */
export const FrontLogger = {
  info: (event: string, meta?: Record<string, any>) => {
    if (import.meta.env.DEV) {
      console.log(`[INFO] ${event}`, meta || "");
    }
    // Remote payload formulation for telemetry pipeline ingestion
    const payload = { level: 'INFO', event, meta, timestamp: new Date().toISOString() };
    if (!import.meta.env.DEV && import.meta.env.VITE_TELEMETRY_ENDPOINT) {
        fetch(import.meta.env.VITE_TELEMETRY_ENDPOINT, {
            method: 'POST',
            keepalive: true,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).catch(() => {});
    }
  },
  warn: (event: string, meta?: Record<string, any>) => {
    console.warn(`[WARN] ${event}`, meta || "");
    const payload = { level: 'WARN', event, meta, timestamp: new Date().toISOString() };
    if (!import.meta.env.DEV && import.meta.env.VITE_TELEMETRY_ENDPOINT) {
        fetch(import.meta.env.VITE_TELEMETRY_ENDPOINT, {
            method: 'POST',
            keepalive: true,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).catch(() => {});
    }
  },
  error: (event: string, meta?: Record<string, any>) => {
    console.error(`[ERROR] ${event}`, meta || "");
    const payload = { level: 'ERROR', event, meta, timestamp: new Date().toISOString() };
    if (!import.meta.env.DEV && import.meta.env.VITE_TELEMETRY_ENDPOINT) {
        fetch(import.meta.env.VITE_TELEMETRY_ENDPOINT, {
            method: 'POST',
            keepalive: true,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).catch(() => {});
    }
  },
  trackMetric: (metricName: string, value: number, tags?: Record<string, string>) => {
    if (import.meta.env.DEV) {
      console.log(`[METRIC] ${metricName}=${value}`, tags || "");
    }
    const payload = { type: 'METRIC', metricName, value, tags, timestamp: new Date().toISOString() };
    if (!import.meta.env.DEV && import.meta.env.VITE_TELEMETRY_ENDPOINT) {
        fetch(import.meta.env.VITE_TELEMETRY_ENDPOINT, {
            method: 'POST',
            keepalive: true,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).catch(() => {});
    }
  }
};
