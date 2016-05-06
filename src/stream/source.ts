import {Eff} from '../core/eff';

import {Sink, SinkInterface} from './sink';
import {fromInputStream} from './compat/input';

export class Source<Fx, Output> {
  constructor(private _pipe: <Fx2, State, Result>(sink: SinkInterface<Fx2, Output, State, Result>) => Eff<Fx & Fx2, Result>) {}

  pipe<Fx2, State, Result>(sink: SinkInterface<Fx2, Output, State, Result>): Eff<Fx & Fx2, Result> {
    return this._pipe(sink);
  }

  static empty<Fx, Output>(): Source<Fx, Output> {
    return new Source(<Fx2, State, Result>(sink: SinkInterface<Fx2, Output, State, Result>) => {
      return sink.onStart().andThen((state: State) => sink.onEnd(state));
    });
  }

  static singleton<Fx, Output>(output: Output): Source<Fx, Output> {
    return new Source(<Fx2, State, Result>(sink: SinkInterface<Fx2, Output, State, Result>) => {
      return sink.onStart()
        .andThen((init: State) => sink.onData(init, output))
        .andThen((state: State) => sink.onEnd(state));
    });
  }

  concat(next: Source<Fx, Output>): Source<Fx, Output> {
    return this.concatWithEffect(Eff.of(next));
  }

  concatWithEffect(f: Eff<Fx, Source<Fx, Output>>): Source<Fx, Output> {
    return new Source(<Fx2, State, Result>(sink: SinkInterface<Fx2, Output, State, Result>) => {
      return this.pipe({
        onStart: () => sink.onStart(),
        onData: (state: State, output: Output) => sink.onData(state, output),
        onEnd: (intermediateState: State) => {
          return f.andThen((next) => {
            return next.pipe({
              onStart: () => Eff.of<Fx2, State>(intermediateState),
              onData: (state: State, output: Output) => sink.onData(state, output),
              onEnd: (state: State) => sink.onEnd(state)
            });
          });
        }
      });
    });
  }

  map<NewOutput>(f: (output: Output) => NewOutput): Source<Fx, NewOutput> {
    return new Source(<Fx2, State, Result>(sink: SinkInterface<Fx2, NewOutput, State, Result>) => {
      return this.pipe({
        onStart: () => sink.onStart(),
        onData: (state, output) => sink.onData(state, f(output)),
        onEnd: (state) => sink.onEnd(state)
      });
    });
  }

  flatMap<Fx2, NewOutput>(f: (output: Output) => Source<Fx, NewOutput>): Source<Fx & Fx2, NewOutput> {
    return new Source(<Fx3, State, Result>(sink: SinkInterface<Fx3, NewOutput, State, Result>) => {
      return this.pipe<Fx3, State, Result>({
        onStart: () => sink.onStart(),
        onData: (state, output) => f(output).pipe({
          onStart: () => Eff.of<Fx & Fx2 & Fx3, State>(state),
          onData: (intermediateState, newOutput) => sink.onData(intermediateState, newOutput),
          onEnd: (intermediateState) => Eff.of<Fx & Fx2 & Fx3, State>(intermediateState)
        }),
        onEnd: (state) => sink.onEnd(state)
      });
    });
  }

  toArray(): Eff<Fx, Array<Output>> {
    return this.pipe(Sink.fold([], (arr, outp) => arr.concat([outp])));
  }

  static fromArray<Output>(arr: Array<Output>): Source<{}, Output> {
    return new Source(<Fx2, State, Result>(sink: SinkInterface<Fx2, Output, State, Result>) => {
      return sink.onStart().andThen((init: State) => {
        return Eff.fold(arr, (state: State, output: Output) => {
          return sink.onData(state, output);
        }, init);
      }).andThen((state: State) => {
        return sink.onEnd(state);
      });
    });
  }

  static fromInputStream<F>(input: () => NodeJS.ReadableStream): Source<F, Buffer> {
    return fromInputStream(input);
  }
}
