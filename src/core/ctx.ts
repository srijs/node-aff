export class Context {
  private _cancelled = false;
  private _cancellationReason: Error;
  private _cancellationListeners: Array<(reason: Error) => void> = [];
  private _children: Array<Context> = [];
  private _parent: Context;

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
    this._cancellationListeners.push(cancel);
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
    try {
      return action();
    } catch (err) {
      return Promise.reject<T>(err);
    }
  }

  withChild<T>(action: (ctx: Context) => Promise<T>): Promise<T> {
    return this.guard(() => {
      const child = new Context();
      child._parent = this;
      this._addChild(child);
      try {
        return action(child).then(value => {
          this._clearChild(child);
          return value;
        }, err => {
          this._clearChild(child);
          throw err;
        });
      } catch (err) {
        this._clearChild(child);
        return Promise.reject<T>(err);
      }
    });
  }
}
