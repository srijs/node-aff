'use strict';

import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

import {Task} from './task';
import {Context} from './ctx';
import {Backoff} from '../utils/backoff';
import {Resource, Closable} from '../utils/resource';

chai.use(chaiAsPromised);

describe('Regular Operation', () => {

  it('should work fine', () => {
    const ctx = new Context();
    const op1 = Task.try(() => 3);
    return chai.expect(op1.run(ctx)).to.eventually.equal(3);
  });

  it('can be cancelled', () => {
    const ctx = new Context();
    const op1 = Task.try(() => 3).delay(50);
    const promise = op1.run(ctx);
    const cause = new Error('Operation cancelled');
    ctx.cancel(cause);
    return chai.expect(promise).to.be.rejectedWith(cause);
  });
});

describe('Bind Operation', function () {
  this.timeout(4000);

  it('should work fine', () => {
    const op1 = Task.try(() => 3);
    const op2 = op1.andThen((multiplier) => Task.try(() => 2 * multiplier));
    return chai.expect(op2.exec()).to.eventually.equal(6);
  });

  it('can be cancelled', () => {
    const ctx = new Context();
    const op1 = Task.try(() => 3);
    const op2 = op1.andThen((multiplier) => Task.try(() => 2 * multiplier));
    const promise = op2.run(ctx);
    const cause = new Error('Operation cancelled');
    ctx.cancel(cause);
    return chai.expect(promise).to.be.rejectedWith(cause);
  });

  it('can handle exceptions', () => {
    const op1 = Task.try(() => 3);
    const op2 = op1.andThen((multiplier) => Task.try(() => {
      throw new Error('No need for a ' + multiplier);
    }));
    return chai.expect(op2.exec()).to.be.rejectedWith('No need for a 3');
  });

  it('trampolines', () => {
    let operation = Task.try(() => 0);
    const numberOfLoops = 20000;
    for (let l = 0; l < numberOfLoops; l++) {
      operation = operation.andThen((i:number) => Task.of(i + 1));
    }
    return chai.expect(operation.exec()).to.eventually.equal(numberOfLoops);
  });

  it('trampolines with delay', () => {
    let operation = Task.try(() => 0);
    const numberOfLoops = 20000;
    for (let l = 0; l < numberOfLoops; l++) {
      operation = operation.andThen((i:number) => Task.try(() => i + 1));
    }
    return chai.expect(operation.exec()).to.eventually.equal(numberOfLoops);
  });

  it('trampolines with cancellation', () => {
    let operation = Task.try(() => 0);
    const numberOfLoops = 20000;
    const cause = new Error('Operation cancelled');
    const finished = new Error('Operation should not have finished');
    let count = 0;
    for (let l = 0; l < numberOfLoops; l++) {
      operation = operation.andThen((i:number) => Task.try(() => {
        count = i;
        return i + 1;
      }));
    }
    const ctx = new Context();
    const promise = operation.run(ctx).then((success:number) => Promise.reject(finished), (reject:Error) => Promise.resolve(count));
    setTimeout(() => {
      ctx.cancel(cause);
    }, 100);
    return chai.expect(promise).to.eventually.lessThan(numberOfLoops);
  });

});

describe('Task', () => {

  describe('map', () => {

    it('retains the error in case of failure', () => {
      const reason = new Error('some kind of error');
      const promise = Task.fail(reason).map(() => 42).exec();
      return chai.expect(promise).to.be.rejectedWith(reason);
    });

  });

  describe('unit', () => {

    it('retains the error in case of failure', () => {
      const reason = new Error('some kind of error');
      const promise = Task.fail(reason).void().exec();
      return chai.expect(promise).to.be.rejectedWith(reason);
    });

  });

  describe('throwError', () => {

    it('returns a task that fails', () => {
      const reason = new Error('Operation cancelled');
      const promise = Task.throwError(reason).exec();
      return chai.expect(promise).to.be.rejectedWith(reason);
    });

  });

  describe('catchError', () => {

    it('does nothing in the absence of errors', () => {
      const promise = Task.of(42).catchError(err => 300).exec();
      return chai.expect(promise).to.eventually.equal(42);
    });

    it('catches the error and replaces the result', () => {
      const reason = new Error('Operation cancelled');
      const promise = Task.throwError(reason).catchError(err => 300).exec();
      return chai.expect(promise).to.eventually.equal(300);
    });

  });

  describe('recover', () => {

    it('does nothing in the absence of errors', () => {
      const promise = Task.of(42).recover(err => Task.of(300)).exec();
      return chai.expect(promise).to.eventually.equal(42);
    });

    it('catches the error and replaces the result', () => {
      const reason = new Error('Operation cancelled');
      const promise = Task.throwError(reason).recover(err => Task.of(300)).exec();
      return chai.expect(promise).to.eventually.equal(300);
    });

  });

  describe('cancel', () => {

    it('results in an error', () => {
      const reason = new Error('Operation cancelled');
      const promise = Task.cancel(reason).exec();
      return chai.expect(promise).to.be.rejectedWith(reason);
    });

    it('cancels parallel tasks to the left', (done) => {
      const reason = new Error('Operation cancelled');
      new Task(ctx => {
        ctx.onCancel(() => { done(); });
        return new Promise(() => {});
      }).parallel(Task.cancel(reason)).exec();
    });

    it('cancels parallel tasks to the right', (done) => {
      const reason = new Error('Operation cancelled');
      Task.cancel(reason).parallel(new Task(ctx => {
        ctx.onCancel(() => { done(); });
        return new Promise(() => {});
      })).exec();
    });

  });

  describe('try', () => {

    it('returns a task that succeeds if it returns', () => {
      const eff = Task.try(() => {
        return 42;
      });
      return chai.expect(eff.exec()).to.eventually.equal(42);
    });

    it('returns a task that fails if it throws', () => {
      const err = new Error('yep this is an error');
      const eff = Task.try(() => {
        throw err;
      });
      return chai.expect(eff.exec()).to.eventually.be.rejectedWith(err);
    });

  });

  describe('func', () => {

    it('returns a task that succeeds if it returns', () => {
      const f = Task.func((x: number) => x + 1);
      return chai.expect(f(42).exec()).to.eventually.equal(43);
    });

    it('returns a task that fails if it throws', () => {
      const err = new Error('yep this is an error');
      const f = Task.func((_) => {
        throw err;
      });
      return chai.expect(f(null).exec()).to.eventually.be.rejectedWith(err);
    });

  });

  describe('delay', () => {

    it('succeeds when the task succeeds', () => {
      const promise = Task.of(42).delay(20).exec();
      return chai.expect(promise).to.eventually.be.equal(42);
    });

    it('fails when the task fails', () => {
      const err = new Error('yep this is an error');
      const promise = Task.throwError(err).delay(20).exec();
      return chai.expect(promise).to.eventually.be.rejectedWith(err);
    });

    it('can be cancelled before the timeout', () => {
      const err = new Error('yep this is an error');
      const ctx = new Context();
      const promise = Task.of(42).delay(20).run(ctx);
      setTimeout(() => {
        ctx.cancel(err);
      }, 10);
      return chai.expect(promise).to.eventually.be.rejectedWith(err);
    });

  });

  describe('never', () => {

    it('can be cancelled', () => {
      const err = new Error('yep this is an error');
      const ctx = new Context();
      const promise = Task.never().run(ctx);
      setImmediate(() => ctx.cancel(err));
      return chai.expect(promise).to.eventually.be.rejectedWith(err);
    });

  });

  describe('repeat', () => {

    it('returns an array of tasks', async () => {
      let counter = 0;
      await Task.sequence(Task.try(() => counter++).repeat(5)).exec();
      chai.expect(counter).to.eql(5);
    });

  });

  describe('forEach', () => {

    it('returns an empty task for an empty list', async () => {
      let called = 0;
      await chai.expect(Task.forEach([], (x: number) => new Task(() => {
        called++;
        return Promise.resolve(null);
      })).exec()).to.eventually.be.eq(null);
      chai.expect(called).to.equal(0);
    });

    it('calls the function in order for every item in the list', async () => {
      const list: Array<number> = [];
      await chai.expect(Task.forEach([1, 2, 3], (x: number) => new Task(() => {
        list.push(x);
        return Promise.resolve(null);
      })).exec()).to.eventually.be.eq(null);
      chai.expect(list).to.eql([1, 2, 3]);
    });

  });

  describe('sequence', () => {

    it('returns an empty array from an empty array', async () => {
      await chai.expect(Task.sequence([]).exec()).to.eventually.be.deep.equal([]);
    });

    it('executes all the tasks in the array in sequence', async () => {
      const tasks = [Task.of(1), Task.of(2), Task.of(3)];
      await chai.expect(Task.sequence(tasks).exec()).to.eventually.be.deep.equal([1,2,3]);
    });

  });

  describe('parallel', () => {

    it('returns an empty array from an empty array', async () => {
      await chai.expect(Task.parallel([]).exec()).to.eventually.be.deep.equal([]);
    });

    it('executes all the tasks in the array in sequence', async () => {
      const tasks = [Task.of(1), Task.of(2), Task.of(3)];
      await chai.expect(Task.parallel(tasks).exec()).to.eventually.be.deep.equal([1,2,3]);
    });

  });

  describe('tryTask', () => {

    it('calls the function', async () => {
      await chai.expect(Task.tryTask(() => Task.of(1)).exec()).to.eventually.equals(1);
    });

    it('can be cancelled', () => {
      const ctx = new Context();
      const op1 = Task.tryTask(() => Task.of(1)).delay(50);
      const promise = op1.run(ctx);
      const cause = new Error('Operation cancelled');
      ctx.cancel(cause);
      return chai.expect(promise).to.be.rejectedWith(cause);
    });

    it('propagates errors', async () => {
      const reason = new Error('some kind of error');
      await chai.expect(Task.tryTask(() => Task.fail(reason)).exec()).to.be.rejectedWith(reason);
    });

    it('catches errors', async () => {
      const reason = new Error('some kind of error');
      await chai.expect(Task.tryTask(<any>(() => {
        throw reason;
      })).exec()).to.be.rejectedWith(reason);
    });

  });

  describe('map2', () => {

    it('should work fine', () => {
      const promise = Task.try(() => 3).map2(Task.try(() => 5), (a, b) => a * b).exec();
      return chai.expect(promise).to.eventually.equal(15);
    });

    it('retains the error in case of failure of the first task', () => {
      const reason = new Error('some kind of error');
      const promise = Task.fail(reason).map2(Task.try(() => 5), (a, b) => a * b).exec();
      return chai.expect(promise).to.be.rejectedWith(reason);
    });

    it('retains the error in case of failure of the second task', () => {
      const reason = new Error('some kind of error');
      const promise = Task.try(() => 5).map2(Task.fail(reason), (a, b) => a * b).exec();
      return chai.expect(promise).to.be.rejectedWith(reason);
    });

  });

  describe('return', () => {

    it('should work fine', () => {
      const promise = Task.try(() => 3).return(17).exec();
      return chai.expect(promise).to.eventually.equal(17);
    });

  });

  describe('using', () => {

    it('closes the resource on task success', async () => {
      let isClosed = false;
      const closable: Closable = {
        close: () => {
          isClosed = true;
        }
      };
      const resource = new Resource(Task.of(closable));
      const value = await Task.using(resource, _ => Task.of(3)).exec();
      chai.expect(value).to.equals(3);
      chai.expect(isClosed).to.be.true;
    });

    it('closes the resource on task failure', async () => {
      let isClosed = false;
      const closable: Closable = {
        close: () => {
          isClosed = true;
        }
      };
      const reason = new Error('some kind of error');
      const resource = new Resource(Task.of(closable));
      let failed = true;
      try {
        await Task.using(resource, _ => Task.fail(reason)).exec();
        failed = false;
      } catch (err) {
        chai.expect(err).to.equals(reason);
      }
      chai.expect(failed).to.be.true;
      chai.expect(isClosed).to.be.true;
    });

    it('propagates acquisition failure', async () => {
      const reason = new Error('some kind of error');
      const wrongReason = new Error('should not throw this error');
      const resource = new Resource(Task.fail(reason));
      let failed = true;
      try {
        await Task.using(resource, _ => Task.fail(wrongReason)).exec();
        failed = false;
      } catch (err) {
        chai.expect(err).to.equals(reason);
      }
      chai.expect(failed).to.be.true;
    });

  });

  describe('retry', () => {

    it('respects the maximum number of retries allowed', async () => {
      let timesCalled = 0;
      let timesBackoffCalled = 0;
      const reason = new Error('some kind of error');
      const backoff: Backoff = {
        nth: (n: number) => {
          timesBackoffCalled++;
          return 0;
        }
      };
      let failed = true;
      try {
        await Task.try(() => {
          timesCalled++;
          throw reason;
        }).retry(backoff, 7).exec();
        failed = false;
      } catch (err) {
        chai.expect(err).to.equals(reason);
      }
      chai.expect(timesBackoffCalled).to.equals(7);
      chai.expect(timesCalled).to.equals(8); // first time + number of retries
    });

    it('does not call backoff if the maximum number of retries is zero', async () => {
      let timesCalled = 0;
      let timesBackoffCalled = 0;
      const reason = new Error('some kind of error');
      const backoff: Backoff = {
        nth: (n: number) => {
          console.log(n);
          timesBackoffCalled++;
          return 0;
        }
      };
      let failed = true;
      try {
        await Task.try(() => {
          timesCalled++;
          throw reason;
        }).retry(backoff, 0).exec();
        failed = false;
      } catch (err) {
        chai.expect(err).to.equals(reason);
      }
      chai.expect(timesBackoffCalled).to.equals(0);
      chai.expect(timesCalled).to.equals(1); // only first time
    });

    it('does not retry after success', async () => {
      let timesCalled = 0;
      const reason = new Error('some kind of error');
      const backoff: Backoff = {
        nth: (n: number) => 0
      };
      const result = await Task.try(() => {
        timesCalled++;
        if (timesCalled < 17) {
          throw reason;
        }
        return 8;
      }).retry(backoff, 100).exec();
      chai.expect(result).to.equals(8);
      chai.expect(timesCalled).to.equals(17);
    });

  });
});
