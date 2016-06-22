# Combining Tasks

## In Sequence

To combine two tasks in sequence, the `andThen` function can be used, which works roughly the same as `then` in Promise land. It takes a task and chains a function after it, so that it will get called with the result of the computation. The function in turn returns a new task. To understand things in detail, we need to take a look at the type signature:

```
class Task<T> {
    public andThen<U>(f: (x: T) => Task<U>): Task<U>;
}
```

This might seem complicated at first, but let's break it down a bit. `Task<T>` describes a task that results in a value of type `T`. We can combine it with a function that takes that resulting `T`, and returns a new task `Task<U>`. The result of that combination is another task `Task<U>`, which performs effects from both input tasks and results in a value of type `U`.

## In Parallel

To combine two tasks in parallel, the `parallel` function can be used:

```
class Task<T> {
    public parallel<U>(task: Task<U>): Task<[T, U]>;
}
```
