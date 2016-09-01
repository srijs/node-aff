import * as mocha from 'mocha';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

import {Context} from './ctx';

chai.use(chaiAsPromised);

describe('Context', () => {

  describe('guard', () => {

    it('short-circuits if the context has been cancelled', () => {
      const ctx = new Context();
      const reason = new Error('yep this is an error');
      ctx.cancel(reason);
      const promise = ctx.guard(() => Promise.resolve(42));
      return chai.expect(promise).to.eventually.be.rejectedWith(reason);
    });

    it('executes the action if the context has not been cancelled', () => {
      const ctx = new Context();
      const promise = ctx.guard(() => Promise.resolve(42));
      return chai.expect(promise).to.eventually.equal(42);
    });

    it('catches thrown errors', () => {
      const ctx = new Context();
      const reason = new Error('yep this is an error');
      const promise = ctx.guard(<any>(() => {
        throw reason;
      }));
      return chai.expect(promise).to.eventually.be.rejectedWith(reason);
    });

  });

  describe('withChild', () => {

    it('short-circuits if the context has been cancelled', () => {
      const ctx = new Context();
      const reason = new Error('yep this is an error');
      ctx.cancel(reason);
      const promise = ctx.withChild(cctx => Promise.resolve(42));
      return chai.expect(promise).to.eventually.be.rejectedWith(reason);
    });

    it('executes the action if the context has not been cancelled', () => {
      const ctx = new Context();
      const promise = ctx.withChild(cctx => Promise.resolve(42));
      return chai.expect(promise).to.eventually.equal(42);
    });

    it('catches thrown errors', () => {
      const ctx = new Context();
      const reason = new Error('yep this is an error');
      const promise = ctx.withChild(<any>((cctx: Context) => {
        throw reason;
      }));
      return chai.expect(promise).to.eventually.be.rejectedWith(reason);
    });

  });

});
