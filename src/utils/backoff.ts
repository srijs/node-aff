export class Backoff implements Iterable<number> {
  constructor(private _base: number, private _cap: number) {}

  private _expo(n: number): number {
    return Math.min(this._cap, Math.pow(2, n) * this._base);
  }

  /**
   * Given an iteration number, produces a backoff number.
   *
   * Implements a jittered backoff strategy, which is described
   * in detail (called "Full Jitter") in this great article:
   * https://www.awsarchitectureblog.com/2015/03/backoff.html
   */
  nth(n: number): number {
    const v = this._expo(n);
    return Math.random() * v;
  }

  [Symbol.iterator](): IterableIterator<number> {
    function* gen() {
      let n = 0;
      while (true) {
        yield this.nth(n);
        n++;
      }
    }
    return gen();
  }
}
