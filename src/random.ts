'use strict';

import {Eff, Op} from './index';

export interface RANDOM {
  random: Op<void, number>;
}

export module random {

  export function random<F extends {random: RANDOM}>() {
    return new Eff<F, number>(eff => eff.random.random(null));
  }

}
