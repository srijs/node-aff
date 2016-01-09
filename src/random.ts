'use strict';

import {Eff, Op} from './index';

export interface RANDOM {
  random: Op<void, number>;
}

export function random<F>() {
  return new Eff<{random: RANDOM} & F, number>(eff => eff.random.random(null));
}
