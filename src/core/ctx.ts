import {Run} from './run';

export class Context {
  private _cancelled = false;
  private _cancellationReason: Error;
  private _cancellationListeners: Array<(reason: Error) => void> = [];
  private _children: Array<Context> = [];

  constructor(private _parent?: Context) {
    if (_parent && _parent._cancelled) {
      this._cancelled = true;
      this._cancellationReason = _parent._cancellationReason;
    }
  }

  cancel(reason: Error) {
    if (this._cancelled) {
      // return early to avoid cancellation cycles
      return;
    }
    this._cancelled = true;
    this._cancellationReason = reason;
    setImmediate(() => {
      this._cancellationListeners.forEach(cancel => {
        cancel(reason);
      });
      this._children.forEach(child => {
        child.cancel(reason);
      });
      if (this._parent) {
        this._parent.cancel(reason);
      }
    });
  }

  onCancel(cancel: (reason: Error) => void) {
    this._addListener(cancel);
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

  private _addChild(child: Context) {
    this._children.push(child);
  }

  private _clearChild(child: Context) {
    const idx = this._children.indexOf(child);
    if (idx >= 0) {
      this._children.splice(idx, 1);
    }
  }

  guard<T>(action: () => Promise<T>): Promise<T> {
    if (this._cancelled) {
      return Promise.reject<T>(this._cancellationReason);
    }
    return action();
  }

  withChild<T>(action: (ctx: Context) => Promise<T>): Promise<T> {
    return this.guard(() => {
      const child = new Context(this);
      this._addChild(child);
      return action(child).then(value => {
        this._clearChild(child);
        return value;
      }, err => {
        this._clearChild(child);
        throw err;
      });
    });
  }
}
