'use strict';

import {Eff} from './eff';

export class EffUtil {
  static scheduledOnce<F, T>(block: () => T, delay: number): Eff<F, T> {
    return EffUtil.scheduledRun(block, delay);
  }

  private static scheduledRun<F, T>(block: () => T, delay: number): Eff<F, T> {
    return new Eff(ctx => new Promise((resolve, reject) => {
      const timeoutObject = setTimeout(() => {
        try {
          resolve(block());
        } catch (e) {
          reject(e);
        }
      }, delay);
      ctx.onCancel(reason => {
        clearTimeout(timeoutObject);
        reject(reason);
      });
    }));
  }
}
