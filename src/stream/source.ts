import {Task} from '../core/task';

import {Sink, SinkInterface} from './sink';
import {fromInputStream} from './compat/input';

export class Source<Output> {
  constructor(private _pipe: <State, Result>(sink: SinkInterface<Output, State, Result>) => Task<Result>) {}

  pipe<State, Result>(sink: SinkInterface<Output, State, Result>): Task<Result> {
    return this._pipe(sink);
  }

  static empty<Output>(): Source<Output> {
    return new Source(<State, Result>(sink: SinkInterface<Output, State, Result>) => {
      return sink.onStart().andThen((state: State) => sink.onEnd(state));
    });
  }

  static singleton<Output>(output: Output): Source<Output> {
    return new Source(<State, Result>(sink: SinkInterface<Output, State, Result>) => {
      return sink.onStart()
        .andThen((init: State) => sink.onData(init, output))
        .andThen((state: State) => sink.onEnd(state));
    });
  }

  concat(next: Source<Output>): Source<Output> {
    return this.concatWithTask(Task.of(next));
  }

  concatWithTask(f: Task<Source<Output>>): Source<Output> {
    return new Source(<State, Result>(sink: SinkInterface<Output, State, Result>) => {
      return this.pipe({
        onStart: () => sink.onStart(),
        onData: (state: State, output: Output) => sink.onData(state, output),
        onEnd: (intermediateState: State) => {
          return f.andThen((next) => {
            return next.pipe({
              onStart: () => Task.of(intermediateState),
              onData: (state: State, output: Output) => sink.onData(state, output),
              onEnd: (state: State) => sink.onEnd(state)
            });
          });
        }
      });
    });
  }

  map<NewOutput>(f: (output: Output) => NewOutput): Source<NewOutput> {
    return this.mapWithState(null, (state, output) => [state, f(output)]);
  }

  mapWithState<S, NewOutput>(init: S, f: (state: S, output: Output) => [S, NewOutput]): Source<NewOutput> {
    return new Source(<State, Result>(sink: SinkInterface<NewOutput, State, Result>) => {
      return this.pipe<[S, State], Result>({
        onStart: () => sink.onStart().map(state => [init, state]),
        onData: (states, output) => {
          const res = f(states[0], output);
          return sink.onData(states[1], res[1]).map(state => [res[0], state]);
        },
        onEnd: (states) => sink.onEnd(states[1])
      });
    });
  }

  mapWithTask<NewOutput>(f: (output: Output) => Task<NewOutput>): Source<NewOutput> {
    return new Source(<State, Result>(sink: SinkInterface<NewOutput, State, Result>) => {
      return this.pipe<State, Result>({
        onStart: () => sink.onStart(),
        onData: (state, output) => f(output).andThen(newOutput => sink.onData(state, newOutput)),
        onEnd: (state) => sink.onEnd(state)
      });
    });
  }

  flatMap<NewOutput>(f: (output: Output) => Source<NewOutput>): Source<NewOutput> {
    return new Source(<State, Result>(sink: SinkInterface<NewOutput, State, Result>) => {
      return this.pipe<State, Result>({
        onStart: () => sink.onStart(),
        onData: (state, output) => f(output).pipe({
          onStart: () => Task.of(state),
          onData: (intermediateState, newOutput) => sink.onData(intermediateState, newOutput),
          onEnd: (intermediateState) => Task.of(intermediateState)
        }),
        onEnd: (state) => sink.onEnd(state)
      });
    });
  }

  filter(pred: (output: Output) => boolean): Source<Output> {
    return this.filterWithState(null, (state, output) => [state, pred(output)]);
  }

  filterWithState<S>(init: S, pred: (state: S, output: Output) => [S, boolean]): Source<Output> {
    return new Source(<State, Result>(sink: SinkInterface<Output, State, Result>) => {
      return this.pipe<[S, State], Result>({
        onStart: () => sink.onStart().map(state => [init, state]),
        onData: (state, output) => {
          const res = pred(state[0], output);
          if (!res[1]) {
            return Task.of([res[0], state[1]]);
          }
          return sink.onData(state[1], output).map(newState => [res[0], newState]);
        },
        onEnd: (state) => sink.onEnd(state[1])
      });
    });
  }

  fold<State>(
    init: State,
    accum: (state: State, input: Output) => State
  ): Task<State> {
    return this.pipe(Sink.fold(init, accum));
  }

  forEach(action: (input: Output) => Task<void>): Task<void> {
    return this.pipe(Sink.forEach(action));
  }

  toArray(): Task<Array<Output>> {
    return this.fold([], (arr, outp) => arr.concat([outp]));
  }

  static fromArray<Output>(arr: Array<Output>): Source<Output> {
    return new Source(<State, Result>(sink: SinkInterface<Output, State, Result>) => {
      return sink.onStart().andThen((init: State) => {
        return Task.fold(arr, (state: State, output: Output) => {
          return sink.onData(state, output);
        }, init);
      }).andThen((state: State) => {
        return sink.onEnd(state);
      });
    });
  }

  static fromInputStream(input: () => NodeJS.ReadableStream): Source<Buffer> {
    return fromInputStream(input);
  }
}
