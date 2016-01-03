'use strict';

import {Eff} from './index';
import {RANDOM, random} from './random';
import {CONSOLE, console} from './console';

function printRandom<F extends {random: RANDOM, console: CONSOLE}>(): Eff<F, void> {
  return random.random().chain(n => console.log(n));
}
