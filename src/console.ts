'use strict';

import {Eff, Op} from './index';

export interface CONSOLE {
  log: Op<{data: any}, void>;
  info: Op<{data: any}, void>;
  warn: Op<{data: any}, void>;
  error: Op<{data: any}, void>;
}

export class RealWorldConsole implements CONSOLE {
  log = (input: {data: any}) => Promise.resolve(console.log(input.data));
  info = (input: {data: any}) => Promise.resolve(console.log(input.data));
  warn = (input: {data: any}) => Promise.resolve(console.log(input.data));
  error = (input: {data: any}) => Promise.resolve(console.log(input.data));
}

export function log<F>(data: any) {
  return new Eff<{console: CONSOLE} & F, void>(eff => eff.console.log({data: data}));
}

export function info<F>(data: any) {
  return new Eff<{console: CONSOLE} & F, void>(eff => eff.console.info({data: data}));
}

export function warn<F>(data: any) {
  return new Eff<{console: CONSOLE} & F, void>(eff => eff.console.warn({data: data}));
}

export function error<F>(data: any) {
  return new Eff<{console: CONSOLE} & F, void>(eff => eff.console.error({data: data}));
}
