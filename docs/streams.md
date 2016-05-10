Streams provide a simple but powerful streaming abstraction. They consist of two concepts: Sinks and Sources.

# Sinks

Sinks are stream consumers. More concretely, they describe how to reduce a stream, by providing three actions:

- `onStart: () => Eff<Fx, State>`
- `onData: (s: State, i: Input) => Eff<Fx, State>`
- `onEnd: (s: State) => Eff<Fx, Result>`

Those three actions are called in order during the lifecycle of the stream.
When a stream starts, `onStart` is called, returning an effectful computation that results in an initial state. As data flows through the stream, `onData` is called multiple times with the current state
and a bit of input, providing the next state. The next `onData` won't be called unless the effectful
computation returned from the previous call terminates, providing a way to handle back-pressure.
At the point where the stream is exhausted, `onEnd` will be called once with the last state, finalizing
it into the end result.

# Sources

Sources are the objects that take a sink and run it. Two sources of the same type can be combined into a new source, which provides a simple way to build up sources from lots of different parts, concatenating
many effectful data fetches.
