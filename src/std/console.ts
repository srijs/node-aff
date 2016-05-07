'use strict';

import {Eff} from '../index';

export interface CONSOLE {
  log(data: string): Promise<void>;
  info(data: string): Promise<void>;
  warn(data: string): Promise<void>;
  error(data: string): Promise<void>;
}

export class RealWorldConsole implements CONSOLE {
  log = (data: string) => Promise.resolve(console.log(data));
  info = (data: string) => Promise.resolve(console.info(data));
  warn = (data: string) => Promise.resolve(console.warn(data));
  error = (data: string) => Promise.resolve(console.error(data));
}

export function log<F>(data: string) {
  return new Eff<{console: CONSOLE} & F, void>(eff => eff.inj.console.log(data));
}

export function info<F>(data: string) {
  return new Eff<{console: CONSOLE} & F, void>(eff => eff.inj.console.info(data));
}

export function warn<F>(data: string) {
  return new Eff<{console: CONSOLE} & F, void>(eff => eff.inj.console.warn(data));
}

export function error<F>(data: string) {
  return new Eff<{console: CONSOLE} & F, void>(eff => eff.inj.console.error(data));
}
