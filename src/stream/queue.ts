import {Task} from '../core/task';
import {Source} from './source';
import {Sink, SinkInterface} from './sink';

export class Queue<T> {
  private _queue = new Array<T>();
  private _waitingConsumers = new Array<(t: T) => void>();
  private _waitingProducers = new Array<() => T>();

  constructor(private _opts: Queue.Options) {}

  enqueue(t: T): Task<void> {
    return new Task(ctx => new Promise<void>((resolve, reject) => {
      if (this._waitingConsumers.length > 0) {
        this._waitingConsumers.shift()(t);
        return resolve(null);
      }
      if (this._queue.length < this._opts.highWaterMark) {
        this._queue.push(t);
        return resolve(null);
      }
      if (this._opts.overflowStrategy === Queue.OverflowStrategy.DiscardOldest) {
        this._queue.shift();
        this._queue.push(t);
        return resolve(null);
      }
      if (this._opts.overflowStrategy === Queue.OverflowStrategy.DiscardNewest) {
        return resolve(null);
      }
      const waiter = () => { resolve(); return t; };
      this._waitingProducers.push(waiter);
      ctx.onCancel(reason => {
        const idx = this._waitingProducers.indexOf(waiter);
        if (idx >= 0) {
          this._waitingConsumers.splice(idx, 1);
        }
      });
    }));
  }

  dequeue(): Task<T> {
    return new Task(ctx => new Promise((resolve, reject) => {
      if (this._queue.length > 0) {
        return resolve(this._queue.shift());
      }
      if (this._waitingProducers.length > 0) {
        return resolve(this._waitingProducers.shift()());
      }
      this._waitingConsumers.push(resolve);
      ctx.onCancel(reason => {
        const idx = this._waitingConsumers.indexOf(resolve);
        if (idx >= 0) {
          this._waitingConsumers.splice(idx, 1);
        }
      });
    }));
  }

  get consumer(): Source<T> {
    return new Source(<State, Result>(sink: SinkInterface<T, State, Result>): Task<Result> => {
      const consume = (state: State): Task<Result> => {
        return this.dequeue().andThen(data => {
          return sink.onData(state, data).andThen(consume);
        });
      };

      return sink.onStart().andThen(consume);
    });
  }

  get producer(): Sink<T, void, void> {
    return Sink.forEach<T>(data => this.enqueue(data));
  }
}

export module Queue {
  export enum OverflowStrategy {
    Block,
    DiscardOldest,
    DiscardNewest
  }

  export interface Options {
    highWaterMark: number;
    overflowStrategy: OverflowStrategy;
  }
}
