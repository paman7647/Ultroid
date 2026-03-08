import { describe, expect, it } from 'vitest';
import { TokenBucketLimiter } from './rate-limiter';

describe('TokenBucketLimiter', () => {
  it('blocks when over capacity', () => {
    const limiter = new TokenBucketLimiter(2, 60_000);
    expect(limiter.allow()).toBe(true);
    expect(limiter.allow()).toBe(true);
    expect(limiter.allow()).toBe(false);
  });
});
