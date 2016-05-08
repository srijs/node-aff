# Notes on Design

Aff borrows ideas both from effect systems seen in languages such as PureScript, and from the module system used by the ML family of languages.

The main inspiration is drawn from PureScript's [Eff](http://www.purescript.org/learn/eff/) and [Aff](https://github.com/slamdata/purescript-aff) monads, the latter being chosen as namesake for this project. In a nutshell, PureScript uses its structural type system to describe native effects. The `Aff` monad takes this a step further and provides asynchronous effects and failure semantics on top of it.

But while PureScript introduces a new type kind to label effects, this project labels effects using interfaces, which is where inspiration from the ML module system comes in. When you define a value with the type `Eff<{console: CONSOLE}>`, `CONSOLE` is actually an interface describing the actions that can be performed inside that effect:

```
export interface CONSOLE {
  log: (data: any) => Promise<void>;
  ...
}
```

Basically, `Eff` uses a [van Laarhoven representation](http://r6.ca/blog/20140210T181244Z.html) to describe its actions. But instead of being a completely free monad, it is specialised to `Promise`. As a result, it sits in a sweet spot where it is more powerful than a simple effect system, and less powerful than a full-fledged free monad.
