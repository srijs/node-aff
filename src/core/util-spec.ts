'use strict';

import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

import {Eff} from './eff';
import {Context} from './ctx';
import * as util from './util';

chai.use(chaiAsPromised);

describe('Util', () => {

  describe('forEach', () => {

    it('returns an empty effect for an empty list', async () => {
      let called = 0;
      await chai.expect(util.forEach([], (x: number) => new Eff(() => {
        called++;
        return Promise.resolve(null);
      })).exec({})).to.eventually.be.eq(null);
      chai.expect(called).to.equal(0);
    });

    it('calls the function in order for every item in the list', async () => {
      const list: Array<number> = [];
      await chai.expect(util.forEach([1, 2, 3], (x: number) => new Eff(() => {
        list.push(x);
        return Promise.resolve(null);
      })).exec({})).to.eventually.be.eq(null);
      chai.expect(list).to.eql([1, 2, 3]);
    });

  });

});
