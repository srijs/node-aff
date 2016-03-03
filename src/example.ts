'use strict';

import {Eff} from './index';
import {RANDOM, random, RealWorldRandom} from './random';
import {CONSOLE, log, RealWorldConsole} from './console';

export function printRandom<F>(): Eff<{random: RANDOM, console: CONSOLE} & F, void> {
  return random().chain(n => log(n));
}

printRandom().run({
  random: new RealWorldRandom(),
  console: new RealWorldConsole()
});
