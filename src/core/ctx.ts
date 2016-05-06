export class Context<F> {
  private _cancelled = false;
  private _cancellationReason: Error;
  private _cancellationListeners: Array<(reason: Error) => void> = [];
  private _children: Array<Context<F>> = [];
  private _parent: Context<F>;

  constructor(private _inj: F) {}

  private _setParent(parent: Context<F>) {
    this._parent = parent;
    if (parent._cancelled) {
      this._cancelled = true;
      this._cancellationReason = parent._cancellationReason;
    }
  }

  get inj(): F {
    return this._inj;
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
    this._cancellationListeners.push(cancel);
  }

  private _addChild(child: Context<F>) {
    this._children.push(child);
  }

  private _clearChild(child: Context<F>) {
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

  withChild<T>(action: (ctx: Context<F>) => Promise<T>): Promise<T> {
    return this.guard(() => {
      const child = new Context(this._inj);
      child._setParent(this);
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
