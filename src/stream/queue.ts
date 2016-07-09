import {Task} from '../core/task';
import {Source} from './source';
import {Sink, SinkInterface} from './sink';

export class Queue<T> {
  private _closed = false;
  private _queue = new Array<T>();
  private _waitingConsumers = new Array<{resolve: (t: T) => void, reject: (err: Error) => void}>();
  private _waitingProducers = new Array<() => T>();

  constructor(private _opts: Queue.Options) {}

  get closed(): boolean {
    return this._closed;
  }

  /**
   * The demand is the number of items that can
   * be written into the queue without blocking.
   *
   * On an empty queue, it is the sum of the capacity
   * and the number of waiting consumers.
   *
   * On a non-empty queue, it is the difference between the capacity
   * and the number of items in the queue.
   *
   * On a full queue, it is the negative of the number of
   * waiting producers.
   */
  get demand(): number {
    return (this._opts.highWaterMark - this._queue.length) +
      (this._waitingConsumers.length - this._waitingProducers.length);
  }

  /**
   * The supply is the number of items that can
   * be read from the queue without blocking.
   *
   * On an empty queue, it is the negative of the number of
   * waiting consumers.
   *
   * On a non-empty queue, it is the number of items in the queue.
   *
   * On a full queue, it is the sum of the capacity
   * and the number of waiting producers.
   */
  get supply(): number {
    return this._queue.length +
      (this._waitingProducers.length - this._waitingConsumers.length);
  }

  close(): void {
    this._closed = true;
    while (this._waitingConsumers.length > 0) {
      this._waitingConsumers.shift().reject(new Queue.ClosedError());
    }
  }

  enqueue(t: T): Task<void> {
    return new Task(ctx => new Promise<void>((resolve, reject) => {
      if (this.closed) {
        return reject(new Queue.ClosedError());
      }
      if (this._waitingConsumers.length > 0) {
        this._waitingConsumers.shift().resolve(t);
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
          this._waitingProducers.splice(idx, 1);
        }
        reject(reason);
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
      if (this.closed) {
        return reject(new Queue.ClosedError());
      }
      const consumer = {resolve, reject};
      this._waitingConsumers.push(consumer);
      ctx.onCancel(reason => {
        const idx = this._waitingConsumers.indexOf(consumer);
        if (idx >= 0) {
          this._waitingConsumers.splice(idx, 1);
        }
        reject(reason);
      });
    }));
  }

  get consumer(): Source<T> {
    return new Source(<State, Result>(sink: SinkInterface<T, State, Result>): Task<Result> => {
      const consume = (state: State): Task<Result> => {
        return this.dequeue().when({
          ok: data => sink.onData(state, data).andThen(consume),
          err: () => sink.onEnd(state)
        });
      };

      return sink.onStart().andThen(consume);
    });
  }

  get producer(): Sink<T, void, void> {
    return Sink.forEach<T>(data => this.enqueue(data));
  }

  get closingProducer(): Sink<T, void, void> {
    return this.producer.map(() => this.close());
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

  export class ClosedError extends Error {
    constructor() {
      super();
      this.name = 'Queue.ClosedError';
    }
  }
}
