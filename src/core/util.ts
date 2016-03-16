'use strict';

import {Eff} from './eff';
import {Run} from './run';

export class EffUtil {
  static scheduledOnce<F, T>(block:() => T, delay:number):Eff<F, T> {
    return new Eff<F, T>(() => EffUtil.scheduledRun(block, delay));
  }

  static delay<F, T>(block:() => T):Eff<F, T> {
    return new Eff(() => Run.of(block()));
  }

  static unit<F>():Eff<F, void> {
    return new Eff(() => new Run<void>(Promise.resolve(), () => null));
  }

  static fromFunction<T>(f:(abortCallback:(abort:(reason:Error) => void) => void) => Promise<T>):Run<T> {
    let onCancel:(e:Error) => void;
    return new Run(f(abort => onCancel = abort), e => onCancel(e));
  }

  private static scheduledRun<F, T>(block:() => T, delay:number):Run<T> {
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
      return Eff.of(null);
    }
    return f(arr[i]).chain(() => {
      return loop(i + 1);
    });
  };
  return loop(0);
}
