'use strict';

import {Eff} from './eff';

export class EffUtil {
  static scheduledOnce<F, T>(block: () => T, delay: number): Eff<F, T> {
    return EffUtil.scheduledRun(block, delay);
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
