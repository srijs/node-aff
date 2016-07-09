import {Context} from '../core/ctx';
import {Task} from '../core/task';
import {Queue} from './queue';
import {Source} from './source';

import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

chai.use(chaiAsPromised);

describe('Queue', () => {

  it('works under the last-in-first-out model', async () => {
    const q = new Queue({
      highWaterMark: 5,
      overflowStrategy: Queue.OverflowStrategy.Block
    });
    await Task.sequence([
      q.enqueue(1),
      q.enqueue(2)
    ]).exec();

    const res = await Task.sequence([
      q.dequeue(),
      q.dequeue()
    ]).exec();

    chai.expect(res).to.deep.equal([1, 2]);
  });

  it('blocks and eventually serves waiting consumers', async () => {
    const q = new Queue({
      highWaterMark: 5,
      overflowStrategy: Queue.OverflowStrategy.Block
    });

    const deqPromise = Task.sequence([
      q.dequeue(),
      q.dequeue()
    ]).exec();

    const enqPromise = Task.sequence([
      q.enqueue(1),
      q.enqueue(2)
    ]).exec();

    const res = await Promise.all([deqPromise, enqPromise]);

    chai.expect(res[0]).to.deep.equal([1, 2]);
  });

  it('blocks waiting producers on overflow', async () => {
    const q = new Queue({
      highWaterMark: 0,
      overflowStrategy: Queue.OverflowStrategy.Block
    });

    const enqPromise = q.enqueue(1).exec();
    const deqPromise = q.dequeue().exec();

    const res = await Promise.all([deqPromise, enqPromise]);

    chai.expect(res[0]).to.deep.equal(1);
  });

  it('removes waiting consumers on cancel', async () => {
    const q = new Queue({
      highWaterMark: 5,
      overflowStrategy: Queue.OverflowStrategy.Block
    });

    const ctx = new Context();
    setTimeout(() => ctx.cancel(new Error('cancelled')), 10);

    try {
      await q.dequeue().run(ctx);
    } catch (e) {}

    const enqPromise = Task.sequence([q.enqueue(1), q.enqueue(2)]).exec();
    const deqPromise = Task.sequence([q.dequeue(), q.dequeue()]).exec();

    const res = await Promise.all([deqPromise, enqPromise]);

    chai.expect(res[0]).to.deep.equal([1, 2]);
  });

  it('removes waiting producers on cancel', async () => {
    const q = new Queue({
      highWaterMark: 0,
      overflowStrategy: Queue.OverflowStrategy.Block
    });

    const ctx = new Context();
    setTimeout(() => ctx.cancel(new Error('cancelled')), 10);

    try {
      await q.enqueue(1).run(ctx);
    } catch (e) {}

    const deqPromise = Task.sequence([q.dequeue(), q.dequeue()]).exec();
    const enqPromise = Task.sequence([q.enqueue(2), q.enqueue(3)]).exec();

    const res = await Promise.all([deqPromise, enqPromise]);

    chai.expect(res[0]).to.deep.equal([2, 3]);
  });

  it('discards old items on overflow', async () => {
    const q = new Queue({
      highWaterMark: 1,
      overflowStrategy: Queue.OverflowStrategy.DiscardOldest
    });

    await Task.sequence([
      q.enqueue(1),
      q.enqueue(2),
      q.enqueue(3)
    ]).exec();

    const res = await q.dequeue().exec();

    chai.expect(res).to.deep.equal(3);
  });

  it('discards new items on overflow', async () => {
    const q = new Queue({
      highWaterMark: 1,
      overflowStrategy: Queue.OverflowStrategy.DiscardNewest
    });

    await Task.sequence([
      q.enqueue(1),
      q.enqueue(2),
      q.enqueue(3)
    ]).exec();

    const res = await q.dequeue().exec();

    chai.expect(res).to.deep.equal(1);
  });

  it('produces what it consumes', async () => {
    const q = new Queue({
      highWaterMark: 0,
      overflowStrategy: Queue.OverflowStrategy.Block
    });

    const source = q.consumer;
    const sink = q.closingProducer;

    const proPromise = Source.fromArray([1,2,3]).pipe(sink).exec();
    const conPromise = source.toArray().exec();

    const res = await Promise.all([proPromise, conPromise]);

    chai.expect(res[1]).to.deep.equal([1,2,3]);
  });

  it('fails when writing to a closed queue', () => {
    const q = new Queue({
      highWaterMark: 0,
      overflowStrategy: Queue.OverflowStrategy.Block
    });

    const promise = Task.try(() => q.close()).andThen(() => q.enqueue(1)).exec();
    return chai.expect(promise).to.eventually.be.rejectedWith(Queue.ClosedError);
  });

  it('fails when reading from a closed queue', () => {
    const q = new Queue({
      highWaterMark: 0,
      overflowStrategy: Queue.OverflowStrategy.Block
    });

    const promise = Task.try(() => q.close()).andThen(() => q.dequeue()).exec();
    return chai.expect(promise).to.eventually.be.rejectedWith(Queue.ClosedError);
  });

  describe('demand', () => {

    it('is the sum of the capacity and the number of waiting consumers if empty', (done) => {
      const q = new Queue({
        highWaterMark: 100,
        overflowStrategy: Queue.OverflowStrategy.Block
      });

      q.dequeue().exec();
      q.dequeue().exec();

      setImmediate(() => {
        try {
          chai.expect(q.demand).to.be.equal(102);
          done();
        } catch (err) {
          done(err);
        }
      });
    });

    it('is the difference between the capacity and the number of items in the queue if not empty', async () => {
      const q = new Queue({
        highWaterMark: 100,
        overflowStrategy: Queue.OverflowStrategy.Block
      });

      await q.enqueue(1).exec();
      chai.expect(q.demand).to.be.equal(99);
    });

    it('is the negative of the number of waiting producers if full', (done) => {
      const q = new Queue({
        highWaterMark: 2,
        overflowStrategy: Queue.OverflowStrategy.Block
      });

      q.enqueue(1).exec();
      q.enqueue(2).exec();
      q.enqueue(3).exec();
      q.enqueue(4).exec();

      setImmediate(() => {
        try {
          chai.expect(q.demand).to.be.equal(-2);
          done();
        } catch (err) {
          done(err);
        }
      });
    });

  });

  describe('supply', () => {

    it('is the negative of the number of waiting consumers if empty', (done) => {
      const q = new Queue({
        highWaterMark: 100,
        overflowStrategy: Queue.OverflowStrategy.Block
      });

      q.dequeue().exec();
      q.dequeue().exec();

      setImmediate(() => {
        try {
          chai.expect(q.supply).to.be.equal(-2);
          done();
        } catch (err) {
          done(err);
        }
      });
    });

    it('is the number of items in the queue if not empty', async () => {
      const q = new Queue({
        highWaterMark: 100,
        overflowStrategy: Queue.OverflowStrategy.Block
      });

      await q.enqueue(1).exec();
      chai.expect(q.supply).to.be.equal(1);
    });

    it('is the sum of the capacity and the number of waiting producers if full', (done) => {
      const q = new Queue({
        highWaterMark: 2,
        overflowStrategy: Queue.OverflowStrategy.Block
      });

      q.enqueue(1).exec();
      q.enqueue(2).exec();
      q.enqueue(3).exec();
      q.enqueue(4).exec();

      setImmediate(() => {
        try {
          chai.expect(q.supply).to.be.equal(4);
          done();
        } catch (err) {
          done(err);
        }
      });
    });

  });

  describe('waitForDemand', () => {

    it('returns immediately when the queue is not full', async () => {
      const q = new Queue({
        highWaterMark: 2,
        overflowStrategy: Queue.OverflowStrategy.Block
      });

      await q.waitForDemand().exec();
      chai.expect(q.demand).to.be.equal(2);
    });

    it('blocks when the queue is full', async () => {
      const q = new Queue({
        highWaterMark: 2,
        overflowStrategy: Queue.OverflowStrategy.Block
      });

      await q.enqueue(1).exec();
      await q.enqueue(2).exec();

      chai.expect(q.demand).to.be.equal(0);

      await Task.parallel([
        q.waitForDemand().map(() => {
          chai.expect(q.demand).to.be.equal(1);
        }),
        q.dequeue().map(() => null)
      ]).exec();
    });

    it('blocks when the queue has zero capacity', async () => {
      const q = new Queue({
        highWaterMark: 0,
        overflowStrategy: Queue.OverflowStrategy.Block
      });

      chai.expect(q.demand).to.be.equal(0);

      const waitPromise = q.waitForDemand().map(() => {
        chai.expect(q.demand).to.be.equal(1);
      }).exec();

      q.dequeue().delay(30).exec();

      return chai.expect(waitPromise).to.be.fulfilled;
    });

    it('can be cancelled', async () => {
      const q = new Queue({
        highWaterMark: 2,
        overflowStrategy: Queue.OverflowStrategy.Block
      });

      await q.enqueue(1).exec();
      await q.enqueue(2).exec();

      chai.expect(q.demand).to.be.equal(0);

      const err = new Error('some error');
      const ctx = new Context();
      const promise = q.waitForDemand().run(ctx);

      await Task.try(() => ctx.cancel(err)).delay(30).exec();

      return chai.expect(promise).to.eventually.be.rejectedWith(err);
    });

    it('fails when called after queue is closed', async () => {
      const q = new Queue({
        highWaterMark: 2,
        overflowStrategy: Queue.OverflowStrategy.Block
      });

      await q.enqueue(1).exec();
      await q.enqueue(2).exec();

      chai.expect(q.demand).to.be.equal(0);

      q.close();

      const promise = q.waitForDemand().exec();

      return chai.expect(promise).to.eventually.be.rejectedWith(Queue.ClosedError);
    });

    it('fails when queue is closed after it was called', async () => {
      const q = new Queue({
        highWaterMark: 2,
        overflowStrategy: Queue.OverflowStrategy.Block
      });

      await q.enqueue(1).exec();
      await q.enqueue(2).exec();

      chai.expect(q.demand).to.be.equal(0);

      const promise = q.waitForDemand().exec();

      await Task.try(() => q.close()).delay(30).exec();

      return chai.expect(promise).to.eventually.be.rejectedWith(Queue.ClosedError);
    });

  });

});
