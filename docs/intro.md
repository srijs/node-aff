# Beyond Promises

Promises represent the future result of an asynchronous computation. And they are good at that. The advantage they give us over callbacks is that we can pass them around as values. Consumers of such a value gain control over it, and are no longer at the mercy of the computation to call them back.

Yet in practice, representing just the future result is not enough. That's because the computation will also perform certain side-effects to arrive at the result. While Promises can provide us with control over the result, we don't get to control the effects.

# About Side-Effects

Side-effects are inevitable. What's more, without them, the software we write would be useless. Many of the useful things that programs do begin with a side effect, and end in one. Often leaving no trace of its execution but those side-effects.

Be it on the command line, where we read input from the user and print some output as our program ends. Or as a web server, where we start by reading a request, and finish by writing out a response.

It is good practice to keep the central parts of a program free of side-effects. This leads to code that is easier to test and refactor. But we can't write useful software without side-effects; at one point we need to deal with them.

So there is not only great merit in avoiding side-effects for the most part. Being able to control them at the inevitable point where we have to face them has immense value for writing robust programs.

# Manageable Effects

The `aff` effect system allows you to easily compose functions that have side-effects, while being completely in control over how they are executed. It mainly concerns itself with handling "native" effects, i.e. effects which are provided by the runtime system, and which cannot be emulated by pure functions.

Some examples of native, asynchronous effects are:

- Reading and writing files
- Executing and handling network requests
- Spawning and terminating processes
- Performing expensive computations in the background
