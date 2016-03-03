'use strict';

export type Op<X, T> = (x: X) => Promise<T>;

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
   * effect handlers, resulting in a promise.
   *
   * @param inj The map of required effect handlers.
   */
  public run(inj: F): Promise<T> {
    return this.op(inj);
  }

  /**
   * Runs the effectful computation asynchronously by supplying the necessary
   * effect handlers, resulting in a promise.
   *
   * This is useful in case a trampoline is needed when chaining
   * effects.
   *
   * @param inj The map of required effect handlers.
   */
  private runAsync(inj: F): Promise<T> {
    return Promise.resolve().then(() => this.run(inj));
  }

  /**
   * Lifts a value into a pure effect which immediately returns.
   *
   * @param T The type of the value.
   * @param x The value to lift.
   */
  public static of<T>(x: T): Eff<{}, T> {
    return new Eff(_ => Promise.resolve(x));
  }

  /**
   * Lifts an error into a pure effect, causing it to fail.
   *
   * @param err The error to lift.
   */
  public static throwError<T>(err: Error): Eff<{}, void> {
    return new Eff(_ => Promise.reject(err));
  }

  /**
   * Catches an error using a pure handler function.
   *
   * @param f The pure handler function.
   */
  public catchError(f: (err: Error) => T): Eff<F, T> {
    return new Eff((inj: F) => this.runAsync(inj).catch(f));
  }

  /**
   * Catches an error using an effectful handler function.
   *
   * @param f The effectful handler function.
   */
  public recover<G>(f: (err: Error) => Eff<G, T>): Eff<F & G, T> {
    return new Eff((inj: F & G) => this.runAsync(inj).catch(err => f(err).run(inj)));
  }

  /**
   * Promotes any error to the value level.
   */
  public attempt(): Eff<F, T | Error> {
    return new Eff((inj: F) => this.runAsync(inj).catch(err => err));
  }

  /**
   * Maps the value using a pure function.
   *
   * @param f The pure mapping function.
   */
  public map<U>(f: (x: T) => U): Eff<F, U> {
    return new Eff((inj: F) => this.runAsync(inj).then(f));
  }

  /**
   * Maps the value using an effectful mapping function.
   *
   * @param f The effectful mapping function.
   */
  public chain<G, U>(f: (x: T) => Eff<G, U>): Eff<F & G, U> {
    return new Eff((inj: F & G) => this.runAsync(inj).then(x => f(x).run(inj)));
  }

  /**
   * Combines the computation with another in parallel.
   *
   * @param eff The second effectful computation.
   */
  public parallel<G, U>(eff: Eff<G, U>): Eff<F & G, [T, U]> {
    return new Eff((inj: F & G) => Promise.all([this.runAsync(inj), eff.runAsync(inj)]));
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
