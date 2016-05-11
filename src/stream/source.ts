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
    return this.statefulMap(null, (state, output) => [state, f(output)]);
  }

  statefulMap<S, NewOutput>(init: S, f: (state: S, output: Output) => [S, NewOutput]): Source<Fx, NewOutput> {
    return new Source(<Fx2, State, Result>(sink: SinkInterface<Fx2, NewOutput, State, Result>) => {
      return this.pipe<Fx2, [S, State], Result>({
        onStart: () => sink.onStart().map(state => [init, state]),
        onData: (states, output) => {
          const res = f(states[0], output);
          return sink.onData(states[1], res[1]).map(state => [res[0], state]);
        },
        onEnd: (states) => sink.onEnd(states[1])
      });
    });
  }

  effectfulMap<Fx2, NewOutput>(f: (output: Output) => Eff<Fx2, NewOutput>): Source<Fx & Fx2, NewOutput> {
    return new Source(<Fx3, State, Result>(sink: SinkInterface<Fx3, NewOutput, State, Result>) => {
      return this.pipe<Fx3, State, Result>({
        onStart: () => sink.onStart(),
        onData: (state, output) => f(output).andThen(newOutput => sink.onData(state, newOutput)),
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

  filter(pred: (output: Output) => boolean): Source<Fx, Output> {
    return this.statefulFilter(null, (state, output) => [state, pred(output)]);
  }

  statefulFilter<S>(init: S, pred: (state: S, output: Output) => [S, boolean]): Source<Fx, Output> {
    return new Source(<Fx3, State, Result>(sink: SinkInterface<Fx3, Output, State, Result>) => {
      return this.pipe<Fx3, [S, State], Result>({
        onStart: () => sink.onStart().map(state => [init, state]),
        onData: (state, output) => {
          const res = pred(state[0], output);
          if (!res[1]) {
            return Eff.of([res[0], state[1]]);
          }
          return sink.onData(state[1], output).map(newState => [res[0], newState]);
        },
        onEnd: (state) => sink.onEnd(state[1])
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
