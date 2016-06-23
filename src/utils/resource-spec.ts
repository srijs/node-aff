import {Task} from '../core/task';
import {Context} from '../core/ctx';
import {Resource} from './resource';

import * as sinon from 'sinon';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

chai.use(chaiAsPromised);

describe('Resource', () => {

  describe('use', () => {

    it('closes the resource when the action is cancelled', async () => {
      const closable = {close: sinon.spy()};
      const resource = new Resource(Task.of(closable));
      const ctx = new Context();
      const err = new Error('cancelled');
      const promise = resource.use(() => Task.never()).run(ctx);
      setImmediate(() => ctx.cancel(err));
      await chai.expect(promise).to.eventually.be.rejectedWith(err);
      chai.expect(closable.close.calledOnce).to.be.true;
    });

    it('closes the resource when the action fails', async () => {
      const closable = {close: sinon.spy()};
      const resource = new Resource(Task.of(closable));
      const ctx = new Context();
      const err = new Error('cancelled');
      const promise = resource.use(() => Task.throwError(err)).run(ctx);
      await chai.expect(promise).to.eventually.be.rejectedWith(err);
      chai.expect(closable.close.calledOnce).to.be.true;
    });

    it('closes the resource when the action succeeds', async () => {
      const closable = {close: sinon.spy()};
      const resource = new Resource(Task.of(closable));
      const ctx = new Context();
      const promise = resource.use(() => Task.of(42)).run(ctx);
      await chai.expect(promise).to.eventually.be.equal(42);
      chai.expect(closable.close.calledOnce).to.be.true;
    });

  });

});
