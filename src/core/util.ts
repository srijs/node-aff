'use strict';

import {Eff} from './eff';

export class EffUtil {
  static scheduledOnce<F, T>(block: () => T, delay: number): Eff<F, T> {
    return EffUtil.scheduledRun(block, delay);
  }

  static delay<F, T>(block: () => T): Eff<F, T> {
    return new Eff(() => Promise.resolve(block()));
  }

  static unit<F>():Eff<F, void> {
    return Eff.of(null);
  }

  static fromFunction<F, T>(f: (abortCallback: (abort: (reason:Error) => void) => void) => Promise<T>): Eff<F, T> {
    return new Eff(ctx => f(abort => ctx.onCancel(abort)));
  }

  private static scheduledRun<F, T>(block: () => T, delay: number): Eff<F, T> {
    return EffUtil.fromFunction(abortCallback => new Promise((resolve, reject) => {
      const timeoutObject = setTimeout(() => {
        try {
          resolve(block());
        } catch (e) {
          reject(e);
        }
      }, delay);
      abortCallback(reason => {
        clearTimeout(timeoutObject);
        reject(reason);
      });
    }));
  }
}

export function forEach<F, T, U>(arr: Array<T>, f: (x: T) => Eff<F, void>): Eff<F, void> {
  function loop(i: number): Eff<F, void> {
    if (i >= arr.length) {
      return EffUtil.unit();
    }
    return f(arr[i]).chain(() => {
      return loop(i + 1);
    });
  };
  return loop(0);
}

export function fold<F, S, T, U>(arr: Array<T>, f: (s: S, x: T) => Eff<F, S>, init: S): Eff<F, S> {
  function loop(state: S, i: number): Eff<F, S> {
    if (i >= arr.length) {
      return Eff.of<F, S>(state);
    }
    return f(state, arr[i]).chain((newState) => {
      return loop(newState, i + 1);
    });
  };
  return loop(init, 0);
}
