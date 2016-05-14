# Motivation

Side-effects are inevitable. What's more, without them, the software we write would be worthless. Many of the useful things that software does begin with a side effect, and end in one. Often leaving no trace of its execution but those side-effects. Be it on the command line, where we read input from the user and print some output as our program ends. Or as a web server, where we start by reading a request, and finish by writing out a response.

It is good practice to keep the central parts of a program free of side-effects, which leads to code that is easier to test and refactor. But we can't avoid side-effects, and at one point in our program we need to deal with them. So there is not only great merit in avoiding side-effects, but also in being in control at the inevitable point where we have to face them. As craftspeople, we need make sure that we have the best tools available for that job.

# What about Promises?

Promises represent the future result of an asynchronous computation. And they are good at that. The advantage they give us over callbacks is that we can pass them around as values. Consumers of such a value gain control over it, and are no longer at the whim of the computation deciding to call them back.

So what is the problem? In practice, Promises will often represent not just the result of an asynchronous computation. Instead, the computation will also perform side-effects to arrive at its result. While Promises can provide us with control over the result, we don't get to control the effects.


# Manageable Effects

The `aff` effect system allows you to easily compose functions that have side-effects, while being completely in control over which effects those are and how they are executed. It mainly concerns itself with handling "native" effects, i.e. effects which are provided by the runtime system, and which cannot be emulated by pure functions.

Some examples of native, asynchronous effects are:

- Reading and writing files
- Executing and handling network requests
- Spawning and terminating processes
- Performing expensive computations in the background
