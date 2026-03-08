/**
 * Simple circuit breaker for inter-service calls.
 *
 * States:
 *  CLOSED  → requests pass through normally
 *  OPEN    → requests fail immediately (fast-fail)
 *  HALF_OPEN → one probe request allowed; success → CLOSED, failure → OPEN
 *
 * @example
 *   const cb = new CircuitBreaker('python-service', { failThreshold: 5, resetTimeoutMs: 30_000 });
 *   const result = await cb.call(() => fetch('http://ai-python:8000/v1/ai/moderate', ...));
 */
export class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failCount = 0;
  private lastFailTime = 0;
  private readonly failThreshold: number;
  private readonly resetTimeoutMs: number;

  constructor(
    private readonly name: string,
    opts?: { failThreshold?: number; resetTimeoutMs?: number },
  ) {
    this.failThreshold = opts?.failThreshold ?? 5;
    this.resetTimeoutMs = opts?.resetTimeoutMs ?? 30_000;
  }

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailTime > this.resetTimeoutMs) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error(`Circuit breaker [${this.name}] is OPEN — fast-failing`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    this.failCount = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failCount++;
    this.lastFailTime = Date.now();
    if (this.failCount >= this.failThreshold) {
      this.state = 'OPEN';
    }
  }

  getState(): string {
    return this.state;
  }

  getFailCount(): number {
    return this.failCount;
  }
}
