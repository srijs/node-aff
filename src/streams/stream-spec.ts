'use strict';

import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

chai.use(chaiAsPromised);

import * as stream from './stream';

describe('Stream', () => {

  describe('fuse', () => {

    it('immediately terminates if the right stream ends', () => {
      const left = stream.Stream.yield(42);
      const right = stream.Stream.of(24);
      const fused = stream.fuse(left, right);
      chai.assert.instanceOf(fused, stream.Pure);
      if (fused instanceof stream.Pure) {
        chai.assert.equal(fused.value, 24);
      }
    });

    it('yields from left to right', async () => {
      const left = stream.Stream.yield(42);
      const right = stream.Stream.await();
      const fused = stream.fuse(left, right);
      chai.assert.instanceOf(fused, stream.Lift);
      if (fused instanceof stream.Lift) {
        const result = await fused.eff.run({}).toPromise();
        chai.assert.instanceOf(result, stream.Pure);
        if (result instanceof stream.Pure) {
          chai.assert.equal(result.value, 42);
        }
      }
    });

    it('feeds right leftover back into stream', async () => {
      const left = stream.Stream.yield(42);
      const right = stream.Stream.leftover(24).chain(x => stream.Stream.await());
      const fused = stream.fuse(left, right);
      chai.assert.instanceOf(fused, stream.Lift);
      if (fused instanceof stream.Lift) {
        const result = await fused.eff.run({}).toPromise();
        chai.assert.instanceOf(result, stream.Lift);
        if (result instanceof stream.Lift) {
          const result2 = await result.eff.run({}).toPromise();
          chai.assert.instanceOf(result2, stream.Pure);
          if (result2 instanceof stream.Pure) {
            chai.assert.equal(result2.value, 24);
          }
        }
      }
    });

    it('feeds left leftover back into stream', async () => {
      const left = stream.Stream.leftover(24)
        .chain(x => stream.Stream.await())
        .chain(x => stream.Stream.yield(x));
      const right = stream.Stream.await();
      const fused = stream.fuse(left, right);
      chai.assert.instanceOf(fused, stream.Leftover);
      if (fused instanceof stream.Leftover) {
        const result = await fused.k(null).run({}).toPromise();
        chai.assert.instanceOf(result, stream.Await);
        if (result instanceof stream.Await) {
          const result2 = await result.k(fused.value).run({}).toPromise();
          chai.assert.instanceOf(result2, stream.Lift);
          if (result2 instanceof stream.Lift) {
            const result3 = await result2.eff.run({}).toPromise();
            chai.assert.instanceOf(result3, stream.Pure);
            if (result3 instanceof stream.Pure) {
              chai.assert.equal(result3.value, 24);
            }
          }
        }
      }
    });

    it('feeds null into right if left has terminated', async () => {
      const left = stream.Stream.of(42).map(x => null);
      const right = stream.Stream.await();
      const fused = stream.fuse(left, right);
      chai.assert.instanceOf(fused, stream.Lift);
      if (fused instanceof stream.Lift) {
        const result = await fused.eff.run({}).toPromise();
        chai.assert.instanceOf(result, stream.Pure);
        if (result instanceof stream.Pure) {
          chai.assert.equal(result.value, null);
        }
      }
    });

  });

});
