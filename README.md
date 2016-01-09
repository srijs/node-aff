# node-aff

_Asynchronous effect system for TypeScript_

## Disclaimer

This project has been published to provide a basis for discussion and to gather
feedback from the community. It is not ready for use in an production environment.

## Installation

`aff` is available via `npm`:

    npm install aff

## Introduction

The `aff` effect system allows you to easily compose functions that have side-effects, while being completely in control over which effects those are and how they are executed. It mainly concerns itself with handling "native" effects, i.e. effects which are provided by the runtime system, and which cannot be emulated by pure functions.

Some examples of native, asynchronous effects are:

- Reading and writing files
- Executing and handling network requests
- Spawning and terminating processes
- Performing expensive computations in the background

### The `Eff` type

The `aff` package defines a type called `Eff`, which describes an effectful computation. That computation can perform effects of some kind, and yields a result or an error.

Let's start with an example:

```
'use strict';

import {random} from 'aff/random';
import {console} from 'aff/console';

function printRandom() {
  return random().chain(n => console.log(n));
}
```

What we defined here is a function that performs two side-effects: It gets a random number between 0 and 1 from a non-deterministic entropy source, and it prints that number out to the console.

That does't sounds so different from the things we can with vanilla Node.js, does it? So what does `aff` actually give us in addition? The answer is that `aff` allows us make explicit and to restrict the effects that the function has.

To take advantage of those capabilities, all we need to do is add a type signature to it:

```
'use strict';

import {RANDOM, random} from 'aff/random';
import {CONSOLE, console} from 'aff/console';

function printRandom<F>(): Eff<F & {random: RANDOM, console: CONSOLE}, void> {
  return random().chain(n => console.log(n));
}
```

We are going to discuss the signatures in more detail later, but for now you can focus on the fact that the signature explicitly mentions `RANDOM` and `CONSOLE`, indicating that `printRandom` performs effects that affect the random entropy source and the console output. 

What happens if we removed one of those from the type signature?

```
'use strict';

import {RANDOM, random} from 'aff/random';
import {CONSOLE, console} from 'aff/console';

function printRandom<F>(): Eff<F & {random: RANDOM}, void> {
  return random().chain(n => console.log(n));
}
```

```
>> src/example.ts(8,10): error TS2322: Type 'Eff<{} & { random: RANDOM; } & { console: CONSOLE; }, void>' is not assignable to type 'Eff<F & { random: RANDOM; }, void>'.
>>   Type '{} & { random: RANDOM; } & { console: CONSOLE; }' is not assignable to type 'F & { random: RANDOM; }'.
>>     Type '{} & { random: RANDOM; } & { console: CONSOLE; }' is not assignable to type 'F'.
>>       Type '{ console: CONSOLE; }' is not assignable to type 'F'.
```

Uh oh, that looks like the compiler is not happy: It is complaining that our signature does not specify the `CONSOLE` type. Indeed, when you use `aff` effects, you need to specify all the effects your function performs (or leave off the signature completely and let the compiler figure it out for you).

### Combining effectful computations

To combine two effectful computations, the `chain` function can be used, which works roughly the same as `then` in Promise land. It takes an effectful computation and chains a function after it, so that it will get called with the result of the computation. The function in turn returns a new effectful computation. Maybe a look at the type signature can make things more clear:

```
class Eff<F, T> {
    public chain<G, U>(f: (x: T) => Eff<G, U>): Eff<F & G, U>;
}
```

This might seem complicated at first, but let's break it down a bit. `Eff<F, T>` describes an effectful computation that results in a value of type `T`, while performing effects of type `F`. We can combine it with a function that takes that resulting `T`, and returns a new computation `Eff<G, U>`. The result of that combination is the computation `Eff<F & G, U>`, which tells us that it performs effects from both input effects `F` and `G`, and results in a value of type `U`.


## In Detail

It borrows ideas both from effect systems seen in languages such as PureScript, and from the module system used by the ML family of languages.

The main inspiration is drawn from PureScript's [Eff](http://www.purescript.org/learn/eff/) and [Aff](https://github.com/slamdata/purescript-aff) monads, the latter being chosen as namesake for this project. In a nutshell, PureScript uses its structural type system to describe native effects. The `Aff` monad takes this a step further and provides asynchronous effects and failure semantics on top of it.

But while PureScript introduces a new type kind to label effects, this project labels effects using interfaces, which is where inspiration from the ML module system comes in. When you define a value with the type `Eff<{console: CONSOLE}>`, `CONSOLE` is actually an interface describing the actions that can be performed inside that effect:

```
export interface CONSOLE {
  log: Op<{data: any}, void>; // an action with {data: any} as input and void as output
  ...
}
```

`Op` is just a type alias for a kleisli arrow of the `Promise` monad, so `Op<{data: any}, void>` is just short-hand for `(arg: {data: any}) => Promise<void>`.

Basically, `Eff` uses a [van Laarhoven representation](http://r6.ca/blog/20140210T181244Z.html) to describe its actions. But instead of being a completely free monad, it is specialised to `Promise`. As a result, it sits in a sweet spot where it is more powerful than a simple effect system, and less powerful than a full-fledged free monad.
