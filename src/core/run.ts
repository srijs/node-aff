'use strict';

import {EffUtil} from './effutil';

export class Run<T> {
  constructor(private promise: Promise<T>, private canceler: (reason: Error) => void) {}

  static of<T>(x: T): Run<T> {
    return new Run(Promise.resolve(x), () => null);
  }

  static fail<T>(err: Error): Run<T> {
    return new Run(Promise.reject<T>(err), () => null);
  }

  toPromise(): Promise<T> {
    return this.promise;
  }

  cancel(reason: Error): void {
    this.canceler(reason);
  }

  chain<U>(next: (x: T) => Run<U>): Run<U> {
    return this.bind(next, this.promise.then.bind(this.promise));
  }

  catch<U>(handler: (err: Error) => Run<U>): Run<U> {
    return this.bind(handler, this.promise.catch.bind(this.promise));
  }

  and<U>(other: Run<U>): Run<[T, U]> {
    return new Run(Promise.all([this.promise, other.promise]), reason => {
      this.cancel(reason);
      other.cancel(reason);
    });
  }

  private bind<X, U>(f: (x: X) => Run<U>, binder: (block: (x: X) => PromiseLike<U>) => Promise<U>): Run<U> {
    return EffUtil.fromFunction(abortCallback => {
      let complete: (x: X) => void;
      const cancellablePromise = new Promise<X>((resolve, reject) => {
        abortCallback(reject);
        complete = resolve;
      });
      cancellablePromise.catch(this.canceler);
      return binder(x => {
        complete(x);
        return cancellablePromise.then(x2 => {
          const nextRun = f(x);
          abortCallback(nextRun.cancel.bind(nextRun));
          return nextRun.promise;
        });
      });
    });
  }

}
