import { logger } from "./Logger";

/**
 * Universal Graceful Shutdown Orchestrator
 * Intercepts SIGTERM/SIGINT and closes database connections, drains event loops,
 * and handles outstanding I/O requests securely before container termination.
 */
export class GracefulShutdown {
  private static isShuttingDown = false;
  private static teardownCallbacks: Array<() => Promise<void>> = [];

  /**
   * Register an asynchronous teardown operation (e.g. Server close, DB disconnect)
   * @param callback Promise-returning function carrying internal unmount logic
   */
  public static registerTeardown(callback: () => Promise<void>) {
    this.teardownCallbacks.push(callback);
  }

  public static initializeNodeListeners() {
    process.on("SIGTERM", () => this.executeSequence("SIGTERM"));
    process.on("SIGINT", () => this.executeSequence("SIGINT"));
    process.on("uncaughtException", (error: Error) => {
      logger.error("Uncaught Exception intercepted. Triggering emergency teardown.", error);
      this.executeSequence("UNCAUGHT_EXCEPTION", 1);
    });
    process.on("unhandledRejection", (reason: unknown) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      logger.error("Unhandled Promise Rejection. Triggering emergency teardown.", error);
      this.executeSequence("UNHANDLED_REJECTION", 1);
    });
  }

  private static async executeSequence(signal: string, exitCode = 0) {
    if (this.isShuttingDown) {
      logger.warn(`Shutdown sequence already initiated. Ignoring redundant ${signal}.`);
      return;
    }

    this.isShuttingDown = true;
    logger.info(`Shutdown sequence initiated gracefully via ${signal}. Draining pool...`);

    // Enforce an absolute maximum timeout to prevent zombie containers hanging in execution
    const hardExitTimer = setTimeout(() => {
      logger.error("Graceful shutdown timeout exceeded (10s). Forcing process termination.");
      process.exit(1);
    }, 10000);

    try {
      for (const callback of this.teardownCallbacks) {
        await callback();
      }
      logger.info("All registered unmount callbacks executed successfully. Infrastructure secure.");
    } catch (error: unknown) {
      logger.error("Critical error encountered during active teardown phase.", error);
      exitCode = 1;
    } finally {
      clearTimeout(hardExitTimer);
      logger.info(`Process exiting gracefully with code [${exitCode}]. Goodbye.`);
      process.exit(exitCode);
    }
  }
}
