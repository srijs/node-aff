'use strict';

import {Context} from './ctx';
import {Backoff} from '../utils/backoff';

/**
 * Represents an asynchronous, effectful computation.
 *
 * @param T The type of the result of the computation.
 */
export class Task<T> {
  public constructor(private op: (ctx: Context) => Promise<T>) {}

  /**
   * Runs the effectful computation by supplying the necessary
   * effect handlers in a context, resulting in a promise.
   *
   * @param ctx The context with a map of required effect handlers.
   */
  public run(ctx: Context): Promise<T> {
    // trampoline left-associatively by calling the op inside a Promise#then`
    return Promise.resolve(null).then(() => this.op(ctx));
  }

  /**
   * Runs the effectful computation by supplying the necessary
   * effect handlers, resulting in a promise.
   *
   * @param inj The map of required effect handlers.
   */
  public exec(): Promise<T> {
    const ctx = new Context();
    return this.run(ctx);
  }

  /**
   * Lifts a value into a pure effect which immediately returns.
   *
   * @type T The type of the value.
   * @param x The value to lift.
   */
  public static of<T>(x: T): Task<T> {
    return new Task(_ => Promise.resolve(x));
  }

  /**
   * Lifts a nullary function into a pure effect.
   * The function will be executed in another tick after the effect
   * has started to run. If it throws an exception, it is caught
   * and expressed as a failure of the effect.
   *
   * @type T The type of the value.
   * @param f The function to lift.
   */
  public static try<T>(f: () => T): Task<T> {
    return new Task(_ => new Promise((resolve, reject) => {
      setImmediate(() => {
        try { resolve(f()); }
        catch (err) { reject(err); }
      });
    }));
  }

  /**
   * Delays the execution of the effect by the
   * given number of milliseconds.
   *
   * @param delay The delay in milliseconds
   */
  public delay(delay: number): Task<T> {
    return new Task<T>(ctx => new Promise((resolve, reject) => {
      const timeoutObject = setTimeout(() => {
        this.run(ctx).then(resolve, reject);
      }, delay);
      ctx.onCancel(reason => {
        clearTimeout(timeoutObject);
        reject(reason);
      });
    }));
  }

  /**
   * Retries the task on failure up to a number of times,
   * with the given backoff strategy.
   */
  retry(backoff: Backoff, maxRetries: number): Task<T> {
    return this._retry(backoff, maxRetries, 0);
  }

  private _retry(backoff: Backoff, maxRetries: number, n: number): Task<T> {
    return this.delay(backoff.nth(n)).recover(err => {
      if (n < maxRetries) {
        return this._retry(backoff, maxRetries, n + 1);
      }
      throw err;
    });
  }

  /**
   * Returns a pure effect that immediately results in void.
   */
  public static unit(): Task<void> {
    return Task.of(null);
  }

  /**
   * Returns a pure effect that never returns.
   *
   * @type T The type of the value.
   */
  public static never<T>(): Task<T> {
    return new Task(_ => new Promise(() => {}));
  }

  /**
   * Returns an effect that when run, cancels the computation.
   *
   * @type T The type of the value.
   */
  public static cancel<T>(reason: Error): Task<T> {
    return new Task(ctx => {
      ctx.cancel(reason);
      return Promise.reject<T>(reason);
    });
  }

  /**
   * Lifts an error into a pure effect, causing it to fail.
   *
   * @param err The error to lift.
   */
  public static throwError<T>(err: Error): Task<T> {
    return new Task(_ => Promise.reject<T>(err));
  }

  /**
   * Catches an error using a pure handler function.
   *
   * @param f The pure handler function.
   */
  public catchError(f: (err: Error) => T): Task<T> {
    return new Task((ctx: Context) => this.run(ctx).catch(err => f(err)));
  }

  /**
   * Catches an error using an effectful handler function.
   *
   * @param f The effectful handler function.
   */
  public recover(f: (err: Error) => Task<T>): Task<T> {
    return new Task((ctx: Context) => {
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
  public map<U>(f: (x: T) => U): Task<U> {
    return new Task((ctx: Context) => this.run(ctx).then(x => f(x)));
  }

  /**
   * Maps the value using an effectful mapping function.
   *
   * @param f The effectful mapping function.
   */
  public andThen<G, U>(f: (x: T) => Task<U>): Task<U> {
    return new Task((ctx: Context) => {
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
  public parallel<U>(task: Task<U>): Task<[T, U]> {
    return new Task((ctx: Context) => {
      return Promise.all([
        ctx.withChild(cctx => this.run(cctx)),
        ctx.withChild(cctx => task.run(cctx))
      ]);
    });
  }

  /**
   * Executes the given function once for every item in the array, in order.
   *
   * @param arr The array to iterate over
   * @param f The iterator function
   */
  static forEach<T, U>(arr: Array<T>, f: (x: T) => Task<void>): Task<void> {
    function loop(i: number): Task<void> {
      if (i >= arr.length) {
        return Task.unit();
      }
      return f(arr[i]).andThen(() => {
        return loop(i + 1);
      });
    };
    return loop(0);
  }

  /**
   * Executes the given function once for every item in the array,
   * while carrying state around.
   *
   * @param arr The array to iterate over
   * @param f The iterator function
   * @param init The initial state
   */
  static fold<S, T, U>(arr: Array<T>, f: (s: S, x: T) => Task<S>, init: S): Task<S> {
    function loop(state: S, i: number): Task<S> {
      if (i >= arr.length) {
        return Task.of(state);
      }
      return f(state, arr[i]).andThen((newState) => {
        return loop(newState, i + 1);
      });
    };
    return loop(init, 0);
  }

}
