/**
 * Token-bucket rate limiter + retry with exponential backoff.
 * Shared across all outbound HTTP (SEC bulk, IAPD PDFs, firm websites).
 */

export class RateLimiter {
  private tokens: number
  private lastRefill: number
  private readonly maxTokens: number
  private readonly refillRate: number // tokens per ms

  constructor(requestsPerSecond: number, burstSize?: number) {
    this.maxTokens = burstSize ?? requestsPerSecond
    this.tokens = this.maxTokens
    this.refillRate = requestsPerSecond / 1000
    this.lastRefill = Date.now()
  }

  private refill(): void {
    const now = Date.now()
    const elapsed = now - this.lastRefill
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate)
    this.lastRefill = now
  }

  async acquire(): Promise<void> {
    this.refill()
    if (this.tokens >= 1) {
      this.tokens -= 1
      return
    }
    const waitMs = Math.ceil((1 - this.tokens) / this.refillRate)
    await new Promise(r => setTimeout(r, waitMs))
    this.refill()
    this.tokens -= 1
  }

  async withRateLimit<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire()
    return fn()
  }
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { maxRetries?: number; baseDelayMs?: number; label?: string } = {},
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 1000, label = 'request' } = opts
  let lastError: Error | undefined

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err as Error
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt)
        console.warn(`  ⚠ ${label} attempt ${attempt + 1} failed: ${lastError.message} — retrying in ${delay}ms`)
        await new Promise(r => setTimeout(r, delay))
      }
    }
  }
  throw lastError
}
