import {Task} from '../core/task';
import {Queue} from './queue';

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

});
