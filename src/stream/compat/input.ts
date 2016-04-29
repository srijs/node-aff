import * as stream from 'stream';

import {Run} from '../../core/run';
import {Eff} from '../../core/eff';
import {Source} from '../source';
import {SinkInterface} from '../sink';

class FeedingStream<F, A> extends stream.Writable {
  public state: A;

  constructor(
    private _init: A,
    private _feed: (state: A, buf: Buffer) => Eff<F, A>,
    private _inj: F,
    options?: Object
  ) {
    super(options);
    this.state = _init;
  }

  _write(buf: Buffer, enc: String, cb: (err?: Error) => void) {
    const run = this._feed(this.state, buf).run(this._inj);
    run.toPromise().then((state: A) => {
      this.state = state;
      return cb();
    }, (err) => cb(err));
  }
}

function feed<F, A>(input: NodeJS.ReadableStream, init: A, step: (state: A, buf: Buffer) => Eff<F, A>): Eff<F, A> {
  return new Eff<F, A>((inj: F) => {
    const s = new FeedingStream(init, step, inj);
    const run = Run.fromPromise(new Promise((resolve, reject) => {
      input.on('error', reject);
      s.on('finish', () => resolve(s.state));
      s.on('error', reject);
    }));
    input.pipe(s);
    return run;
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
