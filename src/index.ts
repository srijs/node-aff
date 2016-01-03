'use strict';

import Promise = require('bluebird');

export type Op<X, T> = (x: X) => Promise<T>;

export class Eff<F, T> {
  public constructor(private op: Op<F, T>) {}

  public run(inj: F): Promise<T> {
    return this.op(inj);
  }

  public static of<T>(x: T): Eff<{}, T> {
    return new Eff(_ => Promise.resolve(x));
  }

  public static throwError<T>(err: Error): Eff<{}, T> {
    return new Eff(_ => Promise.reject(err));
  }

  public catchError(f: (err: Error) => T): Eff<F, T> {
    return new Eff((inj: F) => this.run(inj).catch(f));
  }

  public attempt(): Eff<F, T | Error> {
    return new Eff((inj: F) => this.run(inj).catch(err => err));
  }

  public map<U>(f: (x: T) => U): Eff<F, U> {
    return new Eff((inj: F) => this.run(inj).then(f));
  }

  public chain<G, U>(f: (x: T) => Eff<G, U>): Eff<F & G, U> {
    return new Eff((inj: F & G) => this.run(inj).then(x => f(x).run(inj)));
  }

  public translate<G>(t: (inj: G) => F): Eff<G, T> {
    return new Eff((inj: G) => this.run(t(inj)));
  }
}
