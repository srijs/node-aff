'use strict';

import {Context} from './ctx';

export class Run<T> {
  constructor(private action: (ctx: Context) => Promise<T>) {}

  static of<T>(x: T): Run<T> {
    return new Run(_ => Promise.resolve(x));
  }

  static immediate<T>(f: () => T): Run<T> {
    return Run.fromPromise(new Promise((resolve, reject) => {
      setImmediate(() => {
        try { resolve(f()); }
        catch (err) { reject(err); }
      });
    }));
  }

  static never<T>(): Run<T> {
    return Run.fromPromise(new Promise(() => {}));
  }

  static fail<T>(err: Error): Run<T> {
    return new Run(_ => Promise.reject<T>(err));
  }

  static fromPromise<T>(promise: Promise<T>): Run<T> {
    return new Run(_ => promise);
  }

  toPromise(ctx: Context): Promise<T> {
    return this.action(ctx);
  }

  map<U>(f: (x: T) => U): Run<U> {
    return new Run(ctx => this.action(ctx).then(x => f(x)));
  }

  chain<U>(next: (x: T) => Run<U>): Run<U> {
    return new Run(ctx => {
      return ctx.withChild(cctx => this.action(cctx)).then(x => {
        return ctx.withChild(cctx => next(x).action(cctx));
      });
    });
  }

  catch(handler: (err: Error) => Run<T>): Run<T> {
    return new Run(ctx => {
      return ctx.withChild(cctx => this.action(cctx)).catch(err => {
        return ctx.withChild(cctx => handler(err).action(cctx));
      });
    });
  }

  and<U>(other: Run<U>): Run<[T, U]> {
    return new Run(ctx => {
      return Promise.all([
        ctx.withChild(cctx => this.action(cctx)),
        ctx.withChild(cctx => other.action(cctx))
      ]);
    });
  }
}
