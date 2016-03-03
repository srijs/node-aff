'use strict';

export class Run<T> {
  constructor(private promise: Promise<T>, private canceler: (reason: Error) => void) {}

  static of<T>(x: T): Run<T> {
    return new Run(Promise.resolve(x), () => null);
  }

  static fail<T>(err: Error): Run<T> {
    return new Run(Promise.reject(err) as Promise<any>, () => null);
  }

  toPromise(): Promise<T> {
    return this.promise;
  }

  cancel(reason: Error): void {
    this.canceler(reason);
  }

  chain<U>(next: (x: T) => Run<U>): Run<U> {
    let cancelReason: Error;
    let onCancel = (reason: Error) => {
      cancelReason = reason;
      this.cancel(reason);
    };
    return new Run(this.promise.then((x: T) => {
      if (cancelReason) {
        return Promise.reject(cancelReason) as Promise<any>;
      }
      const nextRun = next(x);
      onCancel = nextRun.cancel;
      return nextRun.promise;
    }), reason => onCancel(reason));
  }

  catch<U>(handler: (err: Error) => Run<U>): Run<T | U> {
    let cancelReason: Error;
    let onCancel = (reason: Error) => {
      cancelReason = reason;
      this.cancel(reason);
    };
    return new Run(this.promise.catch((err: Error) => {
      if (cancelReason) {
        return Promise.reject(cancelReason);
      }
      const handlerRun = handler(err);
      onCancel = handlerRun.cancel;
      return handlerRun.promise;
    }), reason => onCancel(reason));
  }

  and<U>(other: Run<U>): Run<[T, U]> {
    return new Run(Promise.all([this.promise, other.promise]), reason => {
      this.cancel(reason);
      other.cancel(reason);
    });
  }
}
