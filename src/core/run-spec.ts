'use strict';

import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

import {Run} from './run';

chai.use(chaiAsPromised);

describe('Run', () => {

  describe('of', () => {

    it('returns a Run that resolves to the given value', () => {
      return chai.expect(Run.of(42).toPromise()).to.eventually.equal(42);
    });

  });

  describe('fail', () => {

    it('returns a Run that rejects with the given reason', () => {
      const reason = new Error('just because');
      return chai.expect(Run.fail(reason).toPromise()).to.be.rejectedWith(reason);
    });

  });

});
