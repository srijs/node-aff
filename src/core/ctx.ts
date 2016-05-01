import {Run} from './run';

export class Context {
  private _cancelled = false;
  private _cancellationReason: Error;
  private _cancellationListeners: Array<(reason: Error) => void> = [];

  cancel(reason: Error) {
    this._cancelled = true;
    this._cancellationReason = reason;
    this._cancellationListeners.forEach(cancel => {
      cancel(reason);
    });
  }

  private _addListener(cancel: (reason: Error) => void) {
    this._cancellationListeners.push(cancel);
  }

  private _clearListener(cancel: (reason: Error) => void) {
    const idx = this._cancellationListeners.indexOf(cancel);
    if (idx >= 0) {
      this._cancellationListeners.splice(idx, 1);
    }
  }

  withCancel<T>(action: () => Run<T>): Promise<T> {
    if (this._cancelled) {
      return Promise.reject<T>(this._cancellationReason);
    }
    const run = action();
    const cancel = (reason: Error) => run.cancel(reason);
    this._addListener(cancel);
    return run.toPromise().then(value => {
      this._clearListener(cancel);
      return value;
    }, err => {
      this._clearListener(cancel);
      throw err;
    });
  }
}
