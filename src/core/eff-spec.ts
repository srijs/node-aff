'use strict';

import * as mocha from 'mocha';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

import {Eff} from './eff';
import {Context} from './ctx';

chai.use(chaiAsPromised);

describe('Regular Operation', () => {

  it('should work fine', () => {
    const ctx = new Context({});
    const op1 = Eff.try(() => 3);
    return chai.expect(op1.run(ctx)).to.eventually.equal(3);
  });

  it('can be cancelled', () => {
    const ctx = new Context({});
    const op1 = Eff.try(() => 3).delay(50);
    const promise = op1.run(ctx);
    const cause = new Error('Operation cancelled');
    ctx.cancel(cause);
    return chai.expect(promise).to.be.rejectedWith(cause);
  });
});

describe('Bind Operation', function () {
  this.timeout(4000);

  it('should work fine', () => {
    const op1 = Eff.try(() => 3);
    const op2 = op1.andThen((multiplier) => Eff.try(() => 2 * multiplier));
    return chai.expect(op2.exec({})).to.eventually.equal(6);
  });

  it('can be cancelled', () => {
    const ctx = new Context({});
    const op1 = Eff.try(() => 3);
    const op2 = op1.andThen((multiplier) => Eff.try(() => 2 * multiplier));
    const promise = op2.run(ctx);
    const cause = new Error('Operation cancelled');
    ctx.cancel(cause);
    return chai.expect(promise).to.be.rejectedWith(cause);
  });

  it('can handle exceptions', () => {
    const op1 = Eff.try(() => 3);
    const op2 = op1.andThen((multiplier) => Eff.try(() => {
      throw new Error('No need for a ' + multiplier);
    }));
    return chai.expect(op2.exec({})).to.be.rejectedWith('No need for a 3');
  });

  it('trampolines', () => {
    let operation = Eff.try(() => 0);
    const numberOfLoops = 20000;
    for (let l = 0; l < numberOfLoops; l++) {
      operation = operation.andThen((i:number) => Eff.of(i + 1));
    }
    return chai.expect(operation.exec({})).to.eventually.equal(numberOfLoops);
  });

  it('trampolines with delay', () => {
    let operation = Eff.try(() => 0);
    const numberOfLoops = 20000;
    for (let l = 0; l < numberOfLoops; l++) {
      operation = operation.andThen((i:number) => Eff.try(() => i + 1));
    }
    return chai.expect(operation.exec({})).to.eventually.equal(numberOfLoops);
  });

  it('trampolines with cancellation', () => {
    let operation = Eff.try(() => 0);
    const numberOfLoops = 20000;
    const cause = new Error('Operation cancelled');
    const finished = new Error('Operation should not have finished');
    let count = 0;
    for (let l = 0; l < numberOfLoops; l++) {
      operation = operation.andThen((i:number) => Eff.try(() => {
        count = i;
        return i + 1;
      }));
    }
    const ctx = new Context({});
    const promise = operation.run(ctx).then((success:number) => Promise.reject(finished), (reject:Error) => Promise.resolve(count));
    setTimeout(() => {
      ctx.cancel(cause);
    }, 100);
    return chai.expect(promise).to.eventually.lessThan(numberOfLoops);
  });

});

describe('Eff', () => {

  describe('throwError', () => {

    it('returns an effect that fails', () => {
      const reason = new Error('Operation cancelled');
      const promise = Eff.throwError(reason).exec({});
      return chai.expect(promise).to.be.rejectedWith(reason);
    });

  });

  describe('catchError', () => {

    it('does nothing in the absence of errors', () => {
      const promise = Eff.of(42).catchError(err => 300).exec({});
      return chai.expect(promise).to.eventually.equal(42);
    });

    it('catches the error and replaces the result', () => {
      const reason = new Error('Operation cancelled');
      const promise = Eff.throwError(reason).catchError(err => 300).exec({});
      return chai.expect(promise).to.eventually.equal(300);
    });

  });

  describe('cancel', () => {

    it('results in an error', () => {
      const reason = new Error('Operation cancelled');
      const promise = Eff.cancel(reason).exec({});
      return chai.expect(promise).to.be.rejectedWith(reason);
    });

    it('cancels parallel effects to the left', (done) => {
      const reason = new Error('Operation cancelled');
      new Eff(ctx => {
        ctx.onCancel(() => { done(); });
        return new Promise(() => {});
      }).parallel(Eff.cancel(reason)).exec({});
    });

    it('cancels parallel effects to the right', (done) => {
      const reason = new Error('Operation cancelled');
      Eff.cancel(reason).parallel(new Eff(ctx => {
        ctx.onCancel(() => { done(); });
        return new Promise(() => {});
      })).exec({});
    });

  });

  describe('try', () => {

    it('returns an effect that succeeds if it returns', () => {
      const eff = Eff.try(() => {
        return 42;
      });
      return chai.expect(eff.exec({})).to.eventually.equal(42);
    });

    it('returns an effect that fails if it throws', () => {
      const err = new Error('yep this is an error');
      const eff = Eff.try(() => {
        throw err;
      });
      return chai.expect(eff.exec({})).to.eventually.be.rejectedWith(err);
    });

  });

  describe('forEach', () => {

    it('returns an empty effect for an empty list', async () => {
      let called = 0;
      await chai.expect(Eff.forEach([], (x: number) => new Eff(() => {
        called++;
        return Promise.resolve(null);
      })).exec({})).to.eventually.be.eq(null);
      chai.expect(called).to.equal(0);
    });

    it('calls the function in order for every item in the list', async () => {
      const list: Array<number> = [];
      await chai.expect(Eff.forEach([1, 2, 3], (x: number) => new Eff(() => {
        list.push(x);
        return Promise.resolve(null);
      })).exec({})).to.eventually.be.eq(null);
      chai.expect(list).to.eql([1, 2, 3]);
    });

  });

});
