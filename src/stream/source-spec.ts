import * as mocha from 'mocha';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

import * as stream from 'stream';

import {Context} from '../core/ctx';
import {Eff} from '../core/eff';
import {Source} from './source';

chai.use(chaiAsPromised);

describe('Stream', () => {

  describe('Source', () => {

    describe('fromArray/toArray', () => {

      it('works for empty arrays', () => {
        const src = Source.fromArray([]);
        return chai.expect(src.toArray().exec({})).to.eventually.deep.equal([]);
      });

      it('works for non-empty arrays', () => {
        const src = Source.fromArray([1,2,3]);
        return chai.expect(src.toArray().exec({})).to.eventually.deep.equal([1,2,3]);
      });

    });

    describe('empty', () => {

      it('results in empty array', () => {
        const src = Source.empty();
        return chai.expect(src.toArray().exec({})).to.eventually.deep.equal([]);
      });

    });

    describe('singleton', () => {

      it('results in singleton array', () => {
        const src = Source.singleton(42);
        return chai.expect(src.toArray().exec({})).to.eventually.deep.equal([42]);
      });

    });

    describe('concat', () => {

      it('concatenates two empty sources', () => {
        const src1 = Source.empty();
        const src2 = Source.empty();
        return chai.expect(src1.concat(src2).toArray().exec({})).to.eventually.deep.equal([]);
      });

      it('concatenates a non-empty source on the left with an empty source on the right', () => {
        const src1 = Source.fromArray([1,2,3]);
        const src2 = Source.empty();
        return chai.expect(src1.concat(src2).toArray().exec({})).to.eventually.deep.equal([1,2,3]);
      });

      it('concatenates an empty source on the left with a non-empty source on the right', () => {
        const src1 = Source.empty();
        const src2 = Source.fromArray([1,2,3]);
        return chai.expect(src1.concat(src2).toArray().exec({})).to.eventually.deep.equal([1,2,3]);
      });

    });

    describe('map', () => {

      it('produces an empty source from an empty source', () => {
        const src = Source.empty();
        return chai.expect(src.map((x: number) => x + 1).toArray().exec({})).to.eventually.deep.equal([]);
      });

      it('replaces each output with the result of the function', () => {
        const src = Source.fromArray([1,2,3]);
        return chai.expect(src.map((x: number) => x + 1).toArray().exec({})).to.eventually.deep.equal([2,3,4]);
      });

    });

    describe('effectfulMap', () => {

      it('produces an empty source from an empty source', () => {
        const src = Source.empty();
        return chai.expect(src.effectfulMap((x: number) => Eff.of(x + 1)).toArray().exec({})).to.eventually.deep.equal([]);
      });

      it('replaces each output with the result of the function', () => {
        const src = Source.fromArray([1,2,3]);
        return chai.expect(src.effectfulMap((x: number) => Eff.of(x + 1)).toArray().exec({})).to.eventually.deep.equal([2,3,4]);
      });

    });

    describe('flatMap', () => {

      it('produces an empty source from an empty source', () => {
        const src = Source.empty();
        return chai.expect(src.flatMap(() => Source.fromArray([1,2,3])).toArray().exec({})).to.eventually.deep.equal([]);
      });

      it('flattens all results of the function', () => {
        const src = Source.fromArray([1,2,3]);
        return chai.expect(src.flatMap(x => Source.fromArray([x,x*2,x*3])).toArray().exec({})).to.eventually.deep.equal([1,2,3,2,4,6,3,6,9]);
      });

    });

    describe('filter', () => {

      it('produces an empty source from an empty source', () => {
        const src = Source.empty();
        return chai.expect(src.filter(() => true).toArray().exec({})).to.eventually.deep.equal([]);
      });

      it('only produces elements for which the predicate returns true', () => {
        const src = Source.fromArray([1,2,3,4,5,6]);
        return chai.expect(src.filter(x => x % 2 === 0).toArray().exec({})).to.eventually.deep.equal([2,4,6]);
      });

    });

    describe('fromInputStream', () => {

      it('produces an empty source from an empty stream', () => {
        const str = new stream.PassThrough({highWaterMark: 1024});
        const src = Source.fromInputStream(() => str);
        str.end();
        return chai.expect(src.toArray().exec({})).to.eventually.deep.equal([]);
      });

      it('produces multiple chunks from a fed stream', () => {
        const str = new stream.PassThrough({highWaterMark: 1024});
        const src = Source.fromInputStream(() => str);
        const data1 = new Buffer(1024);
        const data2 = new Buffer(1024);
        str.write(data1);
        str.write(data2);
        str.end();
        return chai.expect(src.toArray().exec({})).to.eventually.deep.equal([data1, data2]);
      });

      it('fails when the sink onStart fails', () => {
        const str = new stream.PassThrough({highWaterMark: 1024});
        const src = Source.fromInputStream(() => str);
        const err = new Error('yep this is an error');
        str.end(new Buffer(1024));
        const promise = src.pipe({
          onStart: () => Eff.throwError(err),
          onData: () => Eff.of(null),
          onEnd: () => Eff.of(null)
        }).exec({});
        return chai.expect(promise).to.eventually.be.rejectedWith(err);
      });

      it('fails when the sink onData fails', () => {
        const str = new stream.PassThrough({highWaterMark: 1024});
        const src = Source.fromInputStream(() => str);
        const err = new Error('yep this is an error');
        str.end(new Buffer(1024));
        const promise = src.pipe({
          onStart: () => Eff.of(null),
          onData: () => Eff.throwError(err),
          onEnd: () => Eff.of(null)
        }).exec({});
        return chai.expect(promise).to.eventually.be.rejectedWith(err);
      });

      it('fails when the sink onEnd fails', () => {
        const str = new stream.PassThrough({highWaterMark: 1024});
        const src = Source.fromInputStream(() => str);
        const err = new Error('yep this is an error');
        str.end(new Buffer(1024));
        const promise = src.pipe({
          onStart: () => Eff.of(null),
          onData: () => Eff.of(null),
          onEnd: () => Eff.throwError(err)
        }).exec({});
        return chai.expect(promise).to.eventually.be.rejectedWith(err);
      });

      it('fails when input stream fails', () => {
        const str = new stream.PassThrough({highWaterMark: 1024});
        const err = new Error('yep this is an error');
        const src = Source.fromInputStream(() => {
          setImmediate(() => {
            str.emit('error', err);
            str.end();
          });
          return str;
        });
        const promise = src.pipe({
          onStart: () => Eff.of(null),
          onData: () => Eff.of(null),
          onEnd: () => Eff.of(null)
        }).exec({});
        return chai.expect(promise).to.eventually.be.rejectedWith(err);
      });

    });

  });

});
