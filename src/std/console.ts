'use strict';

import {Eff} from '../index';

export interface CONSOLE {
  log(data: any): Promise<void>;
  info(data: any): Promise<void>;
  warn(data: any): Promise<void>;
  error(data: any): Promise<void>;
}

export class RealWorldConsole implements CONSOLE {
  log = (data: any) => Promise.resolve(console.log(data));
  info = (data: any) => Promise.resolve(console.log(data));
  warn = (data: any) => Promise.resolve(console.log(data));
  error = (data: any) => Promise.resolve(console.log(data));
}

export function log<F>(data: any) {
  return new Eff<{console: CONSOLE} & F, void>(eff => eff.inj.console.log(data));
}

export function info<F>(data: any) {
  return new Eff<{console: CONSOLE} & F, void>(eff => eff.inj.console.info(data));
}

export function warn<F>(data: any) {
  return new Eff<{console: CONSOLE} & F, void>(eff => eff.inj.console.warn(data));
}

export function error<F>(data: any) {
  return new Eff<{console: CONSOLE} & F, void>(eff => eff.inj.console.error(data));
}
