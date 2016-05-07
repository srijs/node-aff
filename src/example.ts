'use strict';

import {Eff} from './index';
import {RANDOM, random, RealWorldRandom} from './std/random';
import {CONSOLE, log, RealWorldConsole} from './std/console';

export function printRandom<F>(): Eff<{random: RANDOM, console: CONSOLE} & F, void> {
  return random().andThen(n => log(n.toString()));
}

printRandom().exec({
  random: new RealWorldRandom(),
  console: new RealWorldConsole()
});
