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

  chain<G, S>(f: (r: R) => Stream<G, I, O, S>): Stream<F & G, I, O, S> {
    return chain(this, f);
  }

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
}

export class Lift<F, I, O, R> extends Stream<F, I, O, R> {
  constructor(public eff: Eff<F, Stream<F, I, O, R>>) {
    super();
  }
}

export class Await<F, I, O, R> extends Stream<F, I, O, R> {
  constructor(public k: (i: I) => Eff<F, Stream<F, I, O, R>>) {
    super();
  }
}

export class Yield<F, I, O, R> extends Stream<F, I, O, R> {
  constructor(public value: O, public k: (r: void) => Eff<F, Stream<F, I, O, R>>) {
    super();
  }
}

export class Leftover<F, I, O, R> extends Stream<F, I, O, R> {
  constructor(public value: I, public k: (r: void) => Eff<F, Stream<F, I, O, R>>) {
    super();
  }
}

function chain<F, G, I, O, R, S>(s: Stream<F, I, O, R>, f: (r: R) => Stream<G, I, O, S>): Stream<F & G, I, O, S> {
  if (s instanceof Pure) {
    return f(s.value);
  }
  if (s instanceof Lift) {
    return new Lift(s.eff.map(r => r.chain(f)));
  }
  if (s instanceof Await) {
    return new Await(i => s.k(i).map(r => r.chain(f)));
  }
  if (s instanceof Yield) {
    return new Yield(s.value, x => s.k(x).map(r => r.chain(f)));
  }
  if (s instanceof Leftover) {
    return new Leftover(s.value, x => s.k(x).map(r => r.chain(f)));
  }
}

export function fuse<F, G, I, O, P, R>(left: Stream<F, I, O, void>, right: Stream<G, O, P, R>): Stream<F & F, I, P, R> {
  if (right instanceof Pure) {
    return new Pure(right.value);
  }
  if (right instanceof Yield) {
    return new Yield(right.value, x => right.k(x).map(s => fuse(left, s)));
  }
  if (right instanceof Leftover) {
    return new Lift(right.k(null).map(s => fuse(new Yield(right.value, x => Eff.of(left)), s)));
  }
  if (right instanceof Await) {
    if (left instanceof Pure) {
      return new Lift(right.k(null).map(s => fuse(left, s)));
    }
    if (left instanceof Yield) {
      return new Lift(right.k(left.value).chain(s => left.k(null).map(t => fuse(t, s))));
    }
    if (left instanceof Leftover) {
      return new Leftover(left.value, r => left.k(r).map(s => fuse(s, right)));
    }
    if (left instanceof Await) {
      return new Await(r => left.k(r).map(s => fuse(s, right)));
    }
  }
}
