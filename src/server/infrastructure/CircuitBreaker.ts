import { logger } from "./Logger";

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

/**
 * Resilient Circuit Breaker (Hystrix-inspired)
 * Protects cascading failures across distributed microservices and LLM endpoints.
 */
export class CircuitBreaker {
  private failureThreshold: number;
  private recoveryTimeout: number;
  private failures: number = 0;
  private state: CircuitState = "CLOSED";
  private nextAttempt: number = Date.now();
  private name: string;

  constructor(name: string, failureThreshold = 3, recoveryTimeout = 30000) {
    this.name = name;
    this.failureThreshold = failureThreshold;
    this.recoveryTimeout = recoveryTimeout;
  }

  public getState(): CircuitState {
    return this.state;
  }

  async execute<T>(action: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      if (Date.now() > this.nextAttempt) {
        this.state = "HALF_OPEN";
        logger.info(`[CIRCUIT-BREAKER] ${this.name} -> HALF_OPEN. Testing availability...`);
      } else {
        throw new Error(`Circuit Breaker [${this.name}] is OPEN. Service unavailable.`);
      }
    }

    try {
      const result = await action();
      
      if (this.state === "HALF_OPEN") {
        this.state = "CLOSED";
        this.failures = 0;
        logger.info(`[CIRCUIT-BREAKER] ${this.name} -> CLOSED. Full restoration achieved.`);
      }
      
      return result;
    } catch (error: unknown) {
      this.failures++;
      
      const err = error instanceof Error ? error : new Error(String(error));
      
      if (this.failures >= this.failureThreshold) {
        this.state = "OPEN";
        this.nextAttempt = Date.now() + this.recoveryTimeout;
        logger.error(`[CIRCUIT-BREAKER] ${this.name} -> OPEN. Failure threshold exceeded.`, err);
      }
      
      throw err;
    }
  }
}
