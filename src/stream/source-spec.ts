import * as mocha from 'mocha';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

import * as stream from 'stream';

import {Context} from '../core/ctx';
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

    describe('fromInputStream', () => {

      it('produces an empty source from an empty stream', () => {
        const str = new stream.PassThrough({highWaterMark: 1024});
        const src = Source.fromInputStream(str);
        str.end();
        return chai.expect(src.toArray().exec({})).to.eventually.deep.equal([]);
      });

      it('produces multiple chunks from a fed stream', () => {
        const str = new stream.PassThrough({highWaterMark: 1024});
        const src = Source.fromInputStream(str);
        const data1 = new Buffer(1024);
        const data2 = new Buffer(1024);
        str.write(data1);
        str.write(data2);
        str.end();
        return chai.expect(src.toArray().exec({})).to.eventually.deep.equal([data1, data2]);
      });

    });

  });

});
