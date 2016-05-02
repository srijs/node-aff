'use strict';

import {Eff} from '../index';

export interface RANDOM {
  random: () => Promise<number>;
}

export class RealWorldRandom implements RANDOM {
  random = () => Promise.resolve(Math.random());
}

export function random<F>() {
  return new Eff<{random: RANDOM} & F, number>(eff => eff.inj.random.random());
}
