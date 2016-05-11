import {Eff} from '../core/eff';

import {IntoOutputStreamState, intoOutputStream} from './compat/output';

export interface SinkInterface<Fx, Input, State, Result> {
  onStart: () => Eff<Fx, State>;
  onData: (s: State, i: Input) => Eff<Fx, State>;
  onEnd: (s: State) => Eff<Fx, Result>;
}

export class Sink<Fx, Input, State, Result> implements SinkInterface<Fx, Input, State, Result> {
  constructor(private _interface: SinkInterface<Fx, Input, State, Result>) {}

  onStart(): Eff<Fx, State> {
    return this._interface.onStart();
  }

  onData(s: State, i: Input): Eff<Fx, State> {
    return this._interface.onData(s, i);
  }

  onEnd(s: State): Eff<Fx, Result> {
    return this._interface.onEnd(s);
  }

  static unit<Fx, Input>(): Sink<Fx, Input, void, void> {
    return Sink.const(null);
  }

  static const<Fx, Input, Result>(res: Result): Sink<Fx, Input, Result, Result> {
    return new Sink<{}, Input, Result, Result>({
      onStart: () => Eff.of(res),
      onData: (s) => Eff.of(s),
      onEnd: (s) => Eff.of(s)
    });
  }

  static fold<Input, State>(
    init: State,
    accum: (state: State, input: Input) => State
  ): Sink<{}, Input, State, State> {
    return new Sink({
      onStart: () => Eff.of(init),
      onData: (state: State, input: Input) => Eff.of(accum(state, input)),
      onEnd: (state: State) => Eff.of(state)
    });
  }

  map<NewResult>(f: (res: Result) => NewResult): Sink<Fx, Input, State, NewResult> {
    return new Sink<Fx, Input, State, NewResult>({
      onStart: () => this.onStart(),
      onData: (s, i) => this.onData(s, i),
      onEnd: (s) => this.onEnd(s).map(f)
    });
  }

  effectfulMap<Fx2, NewResult>(f: (res: Result) => Eff<Fx2, NewResult>): Sink<Fx, Input, State, NewResult> {
    return new Sink<Fx, Input, State, NewResult>({
      onStart: () => this.onStart(),
      onData: (s, i) => this.onData(s, i),
      onEnd: (s) => this.onEnd(s).andThen(f)
    });
  }

  parallel<Fx2, OtherState, OtherResult>(
    other: Sink<Fx2, Input, OtherState, OtherResult>
  ): Sink<Fx & Fx2, Input, [State, OtherState], [Result, OtherResult]> {
    return new Sink<Fx & Fx2, Input, [State, OtherState], [Result, OtherResult]>({
      onStart: () => this.onStart().parallel(other.onStart()),
      onData: (s, i) => this.onData(s[0], i).parallel(other.onData(s[1], i)),
      onEnd: (s) => this.onEnd(s[0]).parallel(other.onEnd(s[1]))
    });
  }

  static intoOutputStream<F>(output: () => NodeJS.WritableStream): Sink<F, Buffer, IntoOutputStreamState, void> {
    return intoOutputStream(output);
  }
}
