'use strict';

import {Context} from './ctx';

/**
 * Represents an asynchronous, effectful computation.
 *
 * @param F The type of the performed effects.
 * @param T The type of the result of the computation.
 */
export class Eff<F, T> {
  public constructor(private op: (ctx: Context<F>) => Promise<T>) {}

  /**
   * Runs the effectful computation by supplying the necessary
   * effect handlers in a context, resulting in a promise.
   *
   * @param ctx The context with a map of required effect handlers.
   */
  public run(ctx: Context<F>): Promise<T> {
    // trampoline left-associatively by calling the op inside a Promise#then`
    return Promise.resolve(null).then(() => this.op(ctx));
  }

  /**
   * Runs the effectful computation by supplying the necessary
   * effect handlers, resulting in a promise.
   *
   * @param inj The map of required effect handlers.
   */
  public exec(inj: F): Promise<T> {
    const ctx = new Context(inj);
    return this.run(ctx);
  }

  /**
   * Lifts a value into a pure effect which immediately returns.
   *
   * @type T The type of the value.
   * @param x The value to lift.
   */
  public static of<F, T>(x: T): Eff<F, T> {
    return new Eff(_ => Promise.resolve(x));
  }

  /**
   * Lifts a nullary function into a pure effect which is scheduled
   * via setImmediate.
   *
   * @type T The type of the value.
   * @param f The function to lift.
   */
  public static immediate<F, T>(f: () => T): Eff<F, T> {
    return new Eff(_ => new Promise((resolve, reject) => {
      setImmediate(() => {
        try { resolve(f()); }
        catch (err) { reject(err); }
      });
    }));
  }

  /**
   * Returns a pure effect that immediately results in void.
   */
  public static unit<F>(): Eff<F, void> {
    return Eff.of(null);
  }

  /**
   * Returns a pure effect that never returns.
   *
   * @type T The type of the value.
   */
  public static never<F, T>(): Eff<F, T> {
    return new Eff(_ => new Promise(() => {}));
  }

  /**
   * Returns an effect that when run, cancels the computation.
   *
   * @type T The type of the value.
   */
  public static cancel<F, T>(reason: Error): Eff<F, T> {
    return new Eff(ctx => {
      ctx.cancel(reason);
      return Promise.reject<T>(reason);
    });
  }

  /**
   * Lifts an error into a pure effect, causing it to fail.
   *
   * @param err The error to lift.
   */
  public static throwError<T>(err: Error): Eff<{}, T> {
    return new Eff(_ => Promise.reject<T>(err));
  }

  /**
   * Catches an error using a pure handler function.
   *
   * @param f The pure handler function.
   */
  public catchError(f: (err: Error) => T): Eff<F, T> {
    return new Eff((ctx: Context<F>) => this.run(ctx).catch(err => f(err)));
  }

  /**
   * Catches an error using an effectful handler function.
   *
   * @param f The effectful handler function.
   */
  public recover<G>(f: (err: Error) => Eff<G, T>): Eff<F & G, T> {
    return new Eff((ctx: Context<F & G>) => {
      return ctx.withChild(cctx => this.run(cctx)).catch(err => {
        return ctx.withChild(cctx => f(err).run(cctx));
      });
    });
  }

  /**
   * Maps the value using a pure function.
   *
   * @param f The pure mapping function.
   */
  public map<U>(f: (x: T) => U): Eff<F, U> {
    return new Eff((ctx: Context<F>) => this.run(ctx).then(x => f(x)));
  }

  /**
   * Maps the value using an effectful mapping function.
   *
   * @param f The effectful mapping function.
   */
  public andThen<G, U>(f: (x: T) => Eff<G, U>): Eff<F & G, U> {
    return new Eff((ctx: Context<F & G>) => {
      return ctx.withChild(cctx => this.run(cctx)).then(err => {
        return ctx.withChild(cctx => f(err).run(cctx));
      });
    });
  }

  /**
   * Combines the computation with another in parallel.
   *
   * @param eff The second effectful computation.
   */
  public parallel<G, U>(eff: Eff<G, U>): Eff<F & G, [T, U]> {
    return new Eff((ctx: Context<F & G>) => {
      return Promise.all([
        ctx.withChild(cctx => this.run(cctx)),
        ctx.withChild(cctx => eff.run(cctx))
      ]);
    });
  }
}
