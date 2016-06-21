export interface Backoff {
  /**
   * Given an iteration number, produces a backoff time in milliseconds.
   */
  nth(n: number): number;
}

/**
 * Implements a jittered backoff strategy, which is described
 * in detail (called "Full Jitter") in this great article:
 * https://www.awsarchitectureblog.com/2015/03/backoff.html
 */
export class FullJitter implements Backoff {
  constructor(private _base: number, private _cap: number) {}

  private _exp(n: number): number {
    return Math.min(this._cap, Math.pow(2, n) * this._base);
  }

  nth(n: number): number {
    const v = this._exp(n);
    return Math.random() * v;
  }
}
