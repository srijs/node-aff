import {Task} from '../core/task';

export interface Closable {
  close(): void;
}

export class Resource<T extends Closable> {
  constructor(private _acquire: Task<T>) {}

  use<U>(action: (t: T) => Task<U>): Task<U> {
    return this._acquire.andThen(t => {
      return new Task(ctx => {
        let closed = false;
        ctx.onCancel(() => {
          if (!closed) {
            closed = true;
            t.close();
          }
        });
        return ctx.withChild(cctx => action(t).run(cctx))
          .then(result => {
            if (!closed) {
              closed = true;
              t.close();
            }
            return result;
          }, err => {
            if (!closed) {
              closed = true;
              t.close();
            }
            throw err;
          });
      });
    });
  }
}
