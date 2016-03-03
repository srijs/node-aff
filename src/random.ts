'use strict';

import {Eff, Op} from './index';

export interface RANDOM {
  random: Op<void, number>;
}

export class RealWorldRandom implements RANDOM {
  random = () => Promise.resolve(Math.random());
}

export function random<F>() {
  return new Eff<{random: RANDOM} & F, number>(eff => eff.random.random(null));
}
