'use strict';

import {Eff} from './index';
import {RANDOM, random} from './random';
import {CONSOLE, console} from './console';

export function printRandom<F>(): Eff<{random: RANDOM, console: CONSOLE} & F, void> {
  return random().chain(n => console.log(n));
}
