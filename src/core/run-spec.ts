'use strict';

import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

import {Run} from './run';
import {EffUtil} from './util';

chai.use(chaiAsPromised);

describe('Run', () => {

  describe('of', () => {

    it('returns a Run that resolves to the given value', () => {
      return chai.expect(Run.of(42).toPromise()).to.eventually.equal(42);
    });

    it('returns a Run that can be chained', () => {
      return chai.expect(Run.of(42).chain(n => Run.of(n * 2)).toPromise()).to.eventually.equal(42 * 2);
    });

    it('returns a Run that cannot be cancelled', () => {
      const run = Run.of(42);
      const reason = new Error('just because');
      run.cancel(reason);
      return chai.expect(run.toPromise()).to.eventually.equal(42);
    });

  });

  describe('fail', () => {

    it('returns a Run that rejects with the given reason', () => {
      const reason = new Error('just because');
      return chai.expect(Run.fail(reason).toPromise()).to.be.rejectedWith(reason);
    });

    it('returns a Run that can be chained', () => {
      const reason = new Error('just because');
      return chai.expect(Run.fail<number>(reason).chain(n => Run.of(n * 2)).toPromise()).to.be.rejectedWith(reason);
    });

    it('returns a Run that can be recovered', () => {
      const reason = new Error('just because');
      return chai.expect(Run.fail<number>(reason).catch(_ => Run.of(42)).toPromise()).to.eventually.equal(42);
    });

    it('returns a Run that cannot be cancelled', () => {
      const failureReason = new Error('it failed');
      const run = Run.fail(failureReason);
      const cancelReason = new Error('just because');
      run.cancel(cancelReason);
      return chai.expect(run.toPromise()).to.be.rejectedWith(failureReason);
    });

  });

  describe('cancel', () => {

    it('cancels a Run', () => {
      const cancelReason = new Error('cancelled');
      const abortReason = new Error('aborted');
      const run = EffUtil.fromFunction(abortCallback => {
        return new Promise((resolve, reject) => {
          abortCallback(() => {
            reject(abortReason);
          });
        });
      });
      setImmediate(() => {
        run.cancel(cancelReason);
      });
      return chai.expect(run.toPromise()).to.be.rejectedWith(abortReason);
    });

    it('cancels first part of a chained Run', () => {
      const cancelReason = new Error('cancelled');
      const abortReason = new Error('aborted');
      const run = EffUtil.fromFunction(abortCallback => {
        return new Promise((resolve, reject) => {
          abortCallback(() => {
            reject(abortReason);
          });
        });
      }).chain(() => Run.of(42));
      setImmediate(() => {
        run.cancel(cancelReason);
      });
      return chai.expect(run.toPromise()).to.be.rejectedWith(abortReason);
    });

    it('cancels second part of a chained Run', () => {
      const cancelReason = new Error('cancelled');
      const abortReason = new Error('aborted');
      const run = Run.of(42).chain(() => EffUtil.fromFunction(abortCallback => {
        return new Promise((resolve, reject) => {
          abortCallback(() => {
            reject(abortReason);
          });
        });
      }));
      setImmediate(() => {
        run.cancel(cancelReason);
      });
      return chai.expect(run.toPromise()).to.be.rejectedWith(abortReason);
    });

    it('cancels a Run with the given reason', () => {
      const cancelReason = new Error('cancelled');
      const run = EffUtil.fromFunction(abortCallback => {
        return new Promise((resolve, reject) => {
          abortCallback(reject);
        });
      });
      setImmediate(() => {
        run.cancel(cancelReason);
      });
      return chai.expect(run.toPromise()).to.be.rejectedWith(cancelReason);
    });

  });

});
