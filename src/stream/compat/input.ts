import * as stream from 'stream';

import {Context} from '../../core/ctx';
import {Task} from '../../core/task';
import {Source} from '../source';
import {SinkInterface} from '../sink';

class FeedingStream<A> extends stream.Writable {
  public state: A;

  constructor(
    private _ctx: Context,
    private _init: A,
    private _feed: (state: A, buf: Buffer) => Task<A>,
    options?: Object
  ) {
    super(options);
    this.state = _init;
  }

  _write(buf: Buffer, enc: String, cb: (err?: Error) => void) {
    this._feed(this.state, buf).run(this._ctx).then((state: A) => {
      this.state = state;
      return cb();
    }, (err) => cb(err));
  }
}

export type InputStreamSupplier = (ctx: Context, resolve: (stream: NodeJS.ReadableStream) => void, reject: (err: Error) => void) => void;

function feed<A>(supplier: InputStreamSupplier, init: A, step: (state: A, buf: Buffer) => Task<A>): Task<A> {
  return new Task<A>((ctx: Context) => {
    const s = new FeedingStream(ctx, init, step);
    return new Promise((resolve, reject) => {
      supplier(ctx, (stream) => {
        stream.on('error', reject);
        s.on('finish', () => resolve(s.state));
        s.on('error', reject);
        stream.pipe(s);
      }, reject);
    });
  });
}

export function fromInputStream(input: () => NodeJS.ReadableStream): Source<Buffer> {
  const supplier: InputStreamSupplier = (ctx, resolve, reject) => resolve(input());
  return fromInputStreamSupplier(supplier);
}

export function fromInputStreamSupplier(supplier: InputStreamSupplier): Source<Buffer> {
  return new Source(<State, Result>(sink: SinkInterface<Buffer, State, Result>) => {
    return sink.onStart().andThen((init: State) => {
      return feed(supplier, init, (state, buf) => sink.onData(state, buf));
    }).andThen((state: State) => {
      return sink.onEnd(state);
    });
  });
}
