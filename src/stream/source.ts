import {Eff} from '../core/eff';
import {fold} from '../core/util';

import {SinkInterface} from './sink';

export class Source<Fx, Output> {
  constructor(private _pipe: <Fx2, State, Result>(sink: SinkInterface<Fx2, Output, State, Result>) => Eff<Fx & Fx2, Result>) {}

  pipe<Fx2, State, Result>(sink: SinkInterface<Fx2, Output, State, Result>): Eff<Fx & Fx2, Result> {
    return this._pipe(sink);
  }

  static empty<Fx, Output>(): Source<Fx, Output> {
    return new Source(<Fx2, State, Result>(sink: SinkInterface<Fx2, Output, State, Result>) => {
      return sink.onStart().chain((state: State) => sink.onEnd(state));
    });
  }

  concat(next: Source<Fx, Output>): Source<Fx, Output> {
    return new Source(<Fx2, State, Result>(sink: SinkInterface<Fx2, Output, State, Result>) => {
      return this.pipe({
        onStart: () => sink.onStart(),
        onData: (state: State, output: Output) => sink.onData(state, output),
        onEnd: (intermediateState: State) => {
          return next.pipe({
            onStart: () => Eff.of<Fx2, State>(intermediateState),
            onData: (state: State, output: Output) => sink.onData(state, output),
            onEnd: (state: State) => sink.onEnd(state)
          });
        }
      });
    });
  }

  static fromArray<Output>(arr: Array<Output>): Source<{}, Output> {
    return new Source(<Fx2, State, Result>(sink: SinkInterface<Fx2, Output, State, Result>) => {
      return sink.onStart().chain((init: State) => {
        return fold(arr, (state: State, output: Output) => {
          return sink.onData(state, output);
        }, init);
      }).chain((state: State) => {
        return sink.onEnd(state);
      });
    });
  }
}
