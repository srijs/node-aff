'use strict';

import {Eff, Op, Run} from '../index';

export interface RANDOM {
  random: Op<void, number>;
}

export class RealWorldRandom implements RANDOM {
  random = () => Run.of(Math.random());
}

export function random<F>() {
  return new Eff<{random: RANDOM} & F, number>(eff => eff.random.random(null));
}
