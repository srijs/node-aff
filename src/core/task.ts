'use strict';

import {Context} from './ctx';
import {Backoff} from '../utils/backoff';
import {Closable, Resource} from '../utils/resource';

/**
 * Represents an asynchronous, effectful computation.
 *
 * @param T The type of the result of the computation.
 */
export class Task<T> {
  public constructor(private op: (ctx: Context) => Promise<T>) {}

  /**
   * Runs the effectful computation by supplying the necessary
   * effect handlers in a context, resulting in a promise.
   *
   * @param ctx The context with a map of required effect handlers.
   */
  public run(ctx: Context): Promise<T> {
    // trampoline left-associatively by calling the op inside a Promise#then`
    return Promise.resolve(null).then(() => this.op(ctx));
  }

  /**
   * Runs the effectful computation by supplying the necessary
   * effect handlers, resulting in a promise.
   */
  public exec(): Promise<T> {
    const ctx = new Context();
    return this.run(ctx);
  }

  /**
   * Lifts a value into a pure task which immediately returns.
   *
   * @type T The type of the value.
   * @param t The value to lift.
   */
  public static of<T>(t: T): Task<T> {
    return new Task(_ => Promise.resolve(t));
  }

  /**
   * Lifts a nullary function into a pure task.
   * The function will be executed in another tick after the task
   * has started to run. If it throws an exception, it is caught
   * and expressed as a failure of the task.
   *
   * @type T The type of the value.
   * @param f The function to lift.
   */
  public static try<T>(f: () => T): Task<T> {
    return new Task(_ => new Promise((resolve, reject) => {
      setImmediate(() => {
        try { resolve(f()); }
        catch (err) { reject(err); }
      });
    }));
  }

  /**
   * Lifts a unary function into a pure task.
   * The function will be executed in another tick after the task
   * has started to run. If it throws an exception, it is caught
   * and expressed as a failure of the task.
   *
   * @type T The argument type of the function.
   * @type U The return type of the function.
   * @param f The function to lift.
   */
  public static func<T, U>(f: (t: T) => U): (t: T) => Task<U> {
    return (t: T) => new Task(_ => new Promise((resolve, reject) => {
      setImmediate(() => {
        try { resolve(f(t)); }
        catch (err) { reject(err); }
      });
    }));
  }

  /**
   * Delays the execution of the task by the
   * given number of milliseconds.
   *
   * @param delay The delay in milliseconds
   */
  public delay(delay: number): Task<T> {
    return new Task<T>(ctx => new Promise((resolve, reject) => {
      const timeoutObject = setTimeout(() => {
        this.run(ctx).then(resolve, reject);
      }, delay);
      ctx.onCancel(reason => {
        clearTimeout(timeoutObject);
        reject(reason);
      });
    }));
  }

  /**
   * Retries the task on failure up to a number of times,
   * with the given backoff strategy.
   */
  retry(backoff: Backoff, maxRetries: number): Task<T> {
    return this._retry(backoff, maxRetries, 0);
  }

  private _retry(backoff: Backoff, maxRetries: number, n: number): Task<T> {
    return this.delay(backoff.nth(n)).recover(err => {
      if (n < maxRetries) {
        return this._retry(backoff, maxRetries, n + 1);
      }
      throw err;
    });
  }

  /**
   * Returns a pure task that immediately results in void.
   */
  public static unit(): Task<void> {
    return Task.of(null);
  }

  /**
   * Returns a pure task that never returns, except when cancelled.
   *
   * @type T The type of the value.
   */
  public static never<T>(): Task<T> {
    return new Task(ctx => new Promise((resolve, reject) => {
      ctx.onCancel(reject);
    }));
  }

  /**
   * Returns a task that when run, cancels the computation.
   *
   * @type T The type of the value.
   */
  public static cancel<T>(reason: Error): Task<T> {
    return new Task(ctx => {
      ctx.cancel(reason);
      return Promise.reject<T>(reason);
    });
  }

  /**
   * Lifts an error into a pure task, causing it to fail.
   *
   * @param err The error to lift.
   */
  public static throwError<T>(err: Error): Task<T> {
    return Task.fail(err);
  }

  /**
   * Lifts an error into a pure task, causing it to fail.
   *
   * @param err The error to lift.
   */
  public static fail(err: Error): Task<any> {
    return new Task(_ => Promise.reject(err));
  }

  /**
   * Branches based on the outcome of the Task.
   */
  public when<U>(
    branches: {ok: (t: T) => Task<U>, err: (err: Error) => Task<U>}
  ): Task<U> {
    return new Task((ctx: Context) => {
      return ctx.withChild(cctx => this.run(cctx)).then(
        res => ctx.withChild(cctx => branches.ok(res).run(cctx)),
        err => ctx.withChild(cctx => branches.err(err).run(cctx))
      );
    });
  }

  /**
   * Catches an error using a pure handler function.
   *
   * @param f The pure handler function.
   */
  public catchError(f: (err: Error) => T): Task<T> {
    return this.recover(err => Task.of(f(err)));
  }

  /**
   * Catches an error using an effectful handler function.
   *
   * @param f The effectful handler function.
   */
  public recover(f: (err: Error) => Task<T>): Task<T> {
    return this.when({
      ok: t => Task.of(t),
      err: err => f(err)
    });
  }

  /**
   * Maps the value using a pure function.
   *
   * @param f The pure mapping function.
   */
  public map<U>(f: (t: T) => U): Task<U> {
    return this.andThen(t => Task.of(f(t)));
  }

  /**
   * Maps the value using an effectful mapping function.
   *
   * @param f The effectful mapping function.
   */
  public andThen<U>(f: (t: T) => Task<U>): Task<U> {
    return this.when({
      ok: t => f(t),
      err: err => Task.fail(err)
    });
  }

  /**
   * Discards this value for a new pure one.
   *
   * @param u The new pure value.
   */
  public return<U>(u: U): Task<U> {
    return this.map(_ => u);
  }

  /**
   * Discards this value for a new Task.
   *
   * @param tu The new Task.
   */
  public andReturn<U>(tu: Task<U>): Task<U> {
    return this.andThen(_ => tu);
  }

  /**
   * Discards this value.
   */
  public void(): Task<void> {
    return this.andReturn(Task.unit());
  }

  /**
   * Maps the value and another using an effectful mapping function.
   *
   * @param f The effectful mapping function.
   * @param tu The Task containing the other value.
   */
  public map2<U, V>(f: (t: T, u: U) => V, tu: Task<U>): Task<V> {
    return this.andThen(t => tu.map(u => f(t, u)));
  }

  /**
   * Repeats the given task a number of times.
   *
   * Can be combined with Task#sequence or Task#parallel
   * to choose an evaluation strategy.
   */
  repeat(times: number): Array<Task<T>> {
    const tasks = new Array<Task<T>>();
    for (let i = 0; i < times; i++) {
      tasks.push(this);
    }
    return tasks;
  }

  /**
   * Combines the computation with another in parallel.
   *
   * @param task The second effectful computation.
   */
  public parallel<U>(task: Task<U>): Task<[T, U]> {
    return new Task((ctx: Context) => {
      return Promise.all([
        ctx.withChild(cctx => this.run(cctx)),
        ctx.withChild(cctx => task.run(cctx))
      ]);
    });
  }

  /**
   * Executes all the tasks in the array in sequence.
   *
   * @param tasks The tasks to execute.
   */
  static sequence<T>(tasks: Array<Task<T>>): Task<Array<T>> {
    return Task.traverse(tasks, task => task);
  }

  /**
   * Executes all the tasks in the array in parallel.
   *
   * @param tasks The tasks to execute.
   */
  static parallel<T>(tasks: Array<Task<T>>): Task<Array<T>> {
    return new Task(ctx => Promise.all<T>(tasks.map(task => task.run(ctx))));
  }

  /**
   * Executes the given action in sequence for every element in the array.
   *
   * @param arr The array to traverse.
   * @param f The action to execute.
   */
  static traverse<T, U>(arr: Array<T>, f: (t: T) => Task<U>): Task<Array<U>> {
    function loop(i: number, arr2: Array<U>): Task<Array<U>> {
      if (i >= arr.length) {
        return Task.of(arr2);
      }
      return f(arr[i]).andThen(u => {
        return loop(i + 1, arr2.concat([u]));
      });
    }
    return Task.tryTask(() => loop(0, []));
  }

  /**
   * Executes the given function once for every item in the array, in order.
   *
   * @param arr The array to iterate over
   * @param f The iterator function
   */
  public static forEach<T, U>(arr: Array<T>, f: (x: T) => Task<void>): Task<void> {
    function loop(i: number): Task<void> {
      if (i >= arr.length) {
        return Task.unit();
      }
      return f(arr[i]).andThen(() => {
        return loop(i + 1);
      });
    }
    return Task.tryTask(() => loop(0));
  }

  /**
   * Executes the given function once for every item in the array,
   * while carrying state around.
   *
   * @param arr The array to iterate over
   * @param f The iterator function
   * @param init The initial state
   */
  public static fold<S, T, U>(arr: Array<T>, f: (s: S, x: T) => Task<S>, init: S): Task<S> {
    function loop(state: S, i: number): Task<S> {
      if (i >= arr.length) {
        return Task.of(state);
      }
      return f(state, arr[i]).andThen((newState) => {
        return loop(newState, i + 1);
      });
    }
    return Task.tryTask(() => loop(init, 0));
  }

  public static using<T extends Closable, U>(res: Resource<T>, action: (t: T) => Task<U>): Task<U> {
    return res.use(action);
  }

  public static tryTask<T>(f: () => Task<T>): Task<T> {
    return Task.unit().andThen(f);
  }
}
