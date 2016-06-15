import {Task} from '../core/task';

import {IntoOutputStreamState, intoOutputStream} from './compat/output';

export interface SinkInterface<Input, State, Result> {
  onStart: () => Task<State>;
  onData: (s: State, i: Input) => Task<State>;
  onEnd: (s: State) => Task<Result>;
}

export class Sink<Input, State, Result> implements SinkInterface<Input, State, Result> {
  constructor(private _interface: SinkInterface<Input, State, Result>) {}

  onStart(): Task<State> {
    return this._interface.onStart();
  }

  onData(s: State, i: Input): Task<State> {
    return this._interface.onData(s, i);
  }

  onEnd(s: State): Task<Result> {
    return this._interface.onEnd(s);
  }

  static unit<Input>(): Sink<Input, void, void> {
    return Sink.const(null);
  }

  static const<Input, Result>(res: Result): Sink<Input, Result, Result> {
    return new Sink<Input, Result, Result>({
      onStart: () => Task.of(res),
      onData: (s) => Task.of(s),
      onEnd: (s) => Task.of(s)
    });
  }

  static fold<Input, State>(
    init: State,
    accum: (state: State, input: Input) => State
  ): Sink<Input, State, State> {
    return new Sink({
      onStart: () => Task.of(init),
      onData: (state: State, input: Input) => Task.of(accum(state, input)),
      onEnd: (state: State) => Task.of(state)
    });
  }

  static foldTask<F, Input, State>(
    init: State,
    accum: (state: State, input: Input) => Task<State>
  ): Sink<Input, State, State> {
    return new Sink({
      onStart: () => Task.of(init),
      onData: (state: State, input: Input) => accum(state, input),
      onEnd: (state: State) => Task.of(state)
    });
  }

  map<NewResult>(f: (res: Result) => NewResult): Sink<Input, State, NewResult> {
    return new Sink<Input, State, NewResult>({
      onStart: () => this.onStart(),
      onData: (s, i) => this.onData(s, i),
      onEnd: (s) => this.onEnd(s).map(f)
    });
  }

  mapWithTask<NewResult>(f: (res: Result) => Task<NewResult>): Sink<Input, State, NewResult> {
    return new Sink<Input, State, NewResult>({
      onStart: () => this.onStart(),
      onData: (s, i) => this.onData(s, i),
      onEnd: (s) => this.onEnd(s).andThen(f)
    });
  }

  parallel<OtherState, OtherResult>(
    other: Sink<Input, OtherState, OtherResult>
  ): Sink<Input, [State, OtherState], [Result, OtherResult]> {
    return new Sink<Input, [State, OtherState], [Result, OtherResult]>({
      onStart: () => this.onStart().parallel(other.onStart()),
      onData: (s, i) => this.onData(s[0], i).parallel(other.onData(s[1], i)),
      onEnd: (s) => this.onEnd(s[0]).parallel(other.onEnd(s[1]))
    });
  }

  static intoOutputStream(output: () => NodeJS.WritableStream): Sink<Buffer, IntoOutputStreamState, void> {
    return intoOutputStream(output);
  }
}
