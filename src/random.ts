'use strict';

import {Eff, Op} from './index';

export interface RANDOM {
  random: Op<void, number>;
}

export function random<F>() {
  return new Eff<F & {random: RANDOM}, number>(eff => eff.random.random(null));
}
