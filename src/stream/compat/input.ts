import * as stream from 'stream';

import {Context} from '../../core/ctx';
import {Eff} from '../../core/eff';
import {Source} from '../source';
import {SinkInterface} from '../sink';

class FeedingStream<F, A> extends stream.Writable {
  public state: A;

  constructor(
    private _ctx: Context<F>,
    private _init: A,
    private _feed: (state: A, buf: Buffer) => Eff<F, A>,
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

function feed<F, A>(input: NodeJS.ReadableStream, init: A, step: (state: A, buf: Buffer) => Eff<F, A>): Eff<F, A> {
  return new Eff<F, A>((ctx: Context<F>) => {
    const s = new FeedingStream(ctx, init, step);
    const p = new Promise((resolve, reject) => {
      input.on('error', reject);
      s.on('finish', () => resolve(s.state));
      s.on('error', reject);
    });
    input.pipe(s);
    return p;
  });
}

export function fromInputStream<F>(input: NodeJS.ReadableStream): Source<F, Buffer> {
  return new Source(<Fx2, State, Result>(sink: SinkInterface<Fx2, Buffer, State, Result>) => {
    return sink.onStart().chain((init: State) => {
      return feed(input, init, (state, buf) => sink.onData(state, buf));
    }).chain((state: State) => {
      return sink.onEnd(state);
    });
  });
}
