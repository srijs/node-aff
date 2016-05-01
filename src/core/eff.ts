'use strict';

import {Run} from './run';
import {Context} from './ctx';

export type Op<X, T> = (x: X) => Run<T>;

/**
 * Represents an asynchronous, effectful computation.
 *
 * @param F The type of the performed effects.
 * @param T The type of the result of the computation.
 */
export class Eff<F, T> {
  public constructor(private op: Op<F, T>) {}

  /**
   * Runs the effectful computation by supplying the necessary
   * effect handlers and an optional context, resulting in a promise.
   *
   * @param inj The map of required effect handlers.
   */
  public exec(inj: F, ctx?: Context): Promise<T> {
    ctx = ctx || new Context();
    return ctx.withCancel(() => this.run(inj));
  }

  /**
   * Runs the effectful computation by supplying the necessary
   * effect handlers, resulting in a Run.
   *
   * @param inj The map of required effect handlers.
   */
  public run(inj: F): Run<T> {
    // trampoline left-associatively by calling the op inside a Run#chain
    return Run.of(null).chain(() => this.op(inj));
  }

  /**
   * Lifts a value into a pure effect which immediately returns.
   *
   * @type T The type of the value.
   * @param x The value to lift.
   */
  public static of<F, T>(x: T): Eff<F, T> {
    return new Eff(_ => Run.of(x));
  }

  /**
   * Lifts a nullary function into a pure effect which is scheduled
   * via setImmediate.
   *
   * @type T The type of the value.
   * @param f The function to lift.
   */
  public static immediate<F, T>(f: () => T): Eff<F, T> {
    return new Eff(_ => Run.immediate(f));
  }

  /**
   * Returns a pure effect that never returns.
   *
   * @type T The type of the value.
   */
  public static never<F, T>(): Eff<F, T> {
    return new Eff(_ => Run.never());
  }

  /**
   * Lifts an error into a pure effect, causing it to fail.
   *
   * @param err The error to lift.
   */
  public static throwError<T>(err: Error): Eff<{}, T> {
    return new Eff(_ => Run.fail<T>(err));
  }

  /**
   * Catches an error using a pure handler function.
   *
   * @param f The pure handler function.
   */
  public catchError(f: (err: Error) => T): Eff<F, T> {
    return new Eff((inj: F) => this.run(inj).catch(err => Run.of(f(err))));
  }

  /**
   * Catches an error using an effectful handler function.
   *
   * @param f The effectful handler function.
   */
  public recover<G>(f: (err: Error) => Eff<G, T>): Eff<F & G, T> {
    return new Eff((inj: F & G) => this.run(inj).catch(err => f(err).run(inj)));
  }

  /**
   * Promotes any error to the value level.
   */
  public attempt(): Eff<F, T | Error> {
    return new Eff((inj: F) => this.run(inj).catch(err => Run.of(err)));
  }

  /**
   * Maps the value using a pure function.
   *
   * @param f The pure mapping function.
   */
  public map<U>(f: (x: T) => U): Eff<F, U> {
    return new Eff((inj: F) => this.run(inj).chain(x => Run.of(f(x))));
  }

  /**
   * Maps the value using an effectful mapping function.
   *
   * @param f The effectful mapping function.
   */
  public chain<G, U>(f: (x: T) => Eff<G, U>): Eff<F & G, U> {
    return new Eff((inj: F & G) => this.run(inj).chain(x => f(x).run(inj)));
  }

  /**
   * Combines the computation with another in parallel.
   *
   * @param eff The second effectful computation.
   */
  public parallel<G, U>(eff: Eff<G, U>): Eff<F & G, [T, U]> {
    return new Eff((inj: F & G) => this.run(inj).and(eff.run(inj)));
  }

  /**
   * Translates one effect to another using a contravariant mapping.
   *
   * @param t The contravariant function.
   */
  public translate<G>(t: (inj: G) => F): Eff<G, T> {
    return new Eff((inj: G) => this.run(t(inj)));
  }
}
