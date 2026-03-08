export class TokenBucketLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly capacity: number,
    private readonly refillWindowMs: number,
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  allow(cost = 1): boolean {
    const now = Date.now();
    const elapsed = now - this.lastRefill;

    if (elapsed > 0) {
      const refillRate = this.capacity / this.refillWindowMs;
      this.tokens = Math.min(this.capacity, this.tokens + elapsed * refillRate);
      this.lastRefill = now;
    }

    if (this.tokens < cost) {
      return false;
    }

    this.tokens -= cost;
    return true;
  }
}
