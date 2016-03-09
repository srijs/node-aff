'use strict';

import {Eff} from '../core/eff';

export abstract class Stream<F, I, O, R> {
  static of<F, I, O, R>(value: R): Stream<F, I, O, R> {
    return new Pure(value);
  }

  static lift<F, I, O, R>(eff: Eff<F, R>): Stream<F, I, O, R> {
    return new Lift(eff.map(Stream.of));
  }

  static await<F, I, O, R>(): Stream<F, I, O, R> {
    return new Await(x => Eff.of(Stream.of(x)));
  }

  static yield<F, I, O>(value: O): Stream<F, I, O, void> {
    return new Yield(value, x => Eff.of(Stream.of(x)));
  }

  static leftover<F, I, O>(value: I): Stream<F, I, O, void> {
    return new Leftover(value, x => Eff.of(Stream.of(x)));
  }

  abstract chain<G, S>(f: (r: R) => Stream<G, I, O, S>): Stream<F & G, I, O, S>

  map<S>(f: (r: R) => S): Stream<F, I, O, S> {
    return this.chain(r => Stream.of(f(r)));
  }

  zip<G, S>(other: Stream<G, I, O, S>): Stream<F & G, I, O, [R, S]> {
    return this.chain(r => other.map(s => [r, s]));
  }
}

export class Pure<F, I, O, R> extends Stream<F, I, O, R> {
  constructor(public value: R) {
    super();
  }

  chain<G, S>(f: (r: R) => Stream<G, I, O, S>): Stream<F & G, I, O, S> {
    return f(this.value);
  }
}

export class Lift<F, I, O, R> extends Stream<F, I, O, R> {
  constructor(public eff: Eff<F, Stream<F, I, O, R>>) {
    super();
  }

  chain<G, S>(f: (r: R) => Stream<G, I, O, S>): Stream<F & G, I, O, S> {
    return new Lift(this.eff.map(r => r.chain(f)));
  }
}

export class Await<F, I, O, R> extends Stream<F, I, O, R> {
  constructor(public k: (r: any) => Eff<F, Stream<F, I, O, R>>) {
    super();
  }

  chain<G, S>(f: (r: R) => Stream<G, I, O, S>): Stream<F & G, I, O, S> {
    return new Await(x => this.k(x).map(r => r.chain(f)));
  }
}

export class Yield<F, I, O, R> extends Stream<F, I, O, R> {
  constructor(public value: O, public k: (r: void) => Eff<F, Stream<F, I, O, R>>) {
    super();
  }

  chain<G, S>(f: (r: R) => Stream<G, I, O, S>): Stream<F & G, I, O, S> {
    return new Yield(this.value, x => this.k(x).map(r => r.chain(f)));
  }
}

export class Leftover<F, I, O, R> extends Stream<F, I, O, R> {
  constructor(public value: I, public k: (r: void) => Eff<F, Stream<F, I, O, R>>) {
    super();
  }

  chain<G, S>(f: (r: R) => Stream<G, I, O, S>): Stream<F & G, I, O, S> {
    return new Leftover(this.value, x => this.k(x).map(r => r.chain(f)));
  }
}
