import * as mocha from 'mocha';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

import {Context} from './ctx';

chai.use(chaiAsPromised);

describe('Context', () => {

  describe('inj', () => {

    it('retrieves the value passed to the constructor', () => {
      const ctx = new Context(42);
      chai.expect(ctx.inj).to.be.equal(42);
    });

  });

  describe('guard', () => {

    it('short-circuits if the context has been cancelled', () => {
      const ctx = new Context({});
      const reason = new Error('yep this is an error');
      ctx.cancel(reason);
      const promise = ctx.guard(() => Promise.resolve(42));
      return chai.expect(promise).to.eventually.be.rejectedWith(reason);
    });

    it('executes the action if the context has not been cancelled', () => {
      const ctx = new Context({});
      const promise = ctx.guard(() => Promise.resolve(42));
      return chai.expect(promise).to.eventually.equal(42);
    });

  });

  describe('withChild', () => {

    it('short-circuits if the context has been cancelled', () => {
      const ctx = new Context({});
      const reason = new Error('yep this is an error');
      ctx.cancel(reason);
      const promise = ctx.withChild(cctx => Promise.resolve(42));
      return chai.expect(promise).to.eventually.be.rejectedWith(reason);
    });

    it('executes the action if the context has not been cancelled', () => {
      const ctx = new Context({});
      const promise = ctx.withChild(cctx => Promise.resolve(42));
      return chai.expect(promise).to.eventually.equal(42);
    });

  });

});
