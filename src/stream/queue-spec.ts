import {Context} from '../core/ctx';
import {Task} from '../core/task';
import {Queue} from './queue';
import {Source} from './source';
import {Sink} from './sink';

import * as chai from 'chai';

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

});
