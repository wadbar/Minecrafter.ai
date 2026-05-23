import { toast } from "sonner";

class MonitoringService {
  private static instance: MonitoringService;
  private cpuOverThresholdSince: number | null = null;
  private ramOverThresholdSince: number | null = null;
  private readonly THRESHOLD = 85; 
  private readonly ALERT_DURATION_MS = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  public static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  public recordMetrics(cpuUsage: number, ramUsage: number) {
    const now = Date.now();

    // CPU Monitoring
    if (cpuUsage > this.THRESHOLD) {
      if (!this.cpuOverThresholdSince) {
        this.cpuOverThresholdSince = now;
      } else if (now - this.cpuOverThresholdSince >= this.ALERT_DURATION_MS) {
        toast.error("Critical CPU Usage Detected", {
          description: `CPU usage has exceeded ${this.THRESHOLD}% for over 5 minutes.`,
          duration: 10000,
        });
        // Reset to prevent spamming
        this.cpuOverThresholdSince = null;
      }
    } else {
      this.cpuOverThresholdSince = null;
    }

    // RAM Monitoring
    if (ramUsage > this.THRESHOLD) {
      if (!this.ramOverThresholdSince) {
        this.ramOverThresholdSince = now;
      } else if (now - this.ramOverThresholdSince >= this.ALERT_DURATION_MS) {
        toast.error("Critical Memory Usage Detected", {
          description: `RAM usage has exceeded ${this.THRESHOLD}% for over 5 minutes.`,
          duration: 10000,
        });
        // Reset to prevent spamming
        this.ramOverThresholdSince = null;
      }
    } else {
      this.ramOverThresholdSince = null;
    }
  }
}

export const monitoringService = MonitoringService.getInstance();
