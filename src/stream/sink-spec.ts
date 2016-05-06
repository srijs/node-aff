import * as mocha from 'mocha';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

import {Source} from './source';
import {Sink} from './sink';

chai.use(chaiAsPromised);

describe('Stream', () => {

  describe('Sink', () => {

    describe('const', () => {

      it('returns the result with an empty input', () => {
        const sink = Sink.const(42);
        const source = Source.empty();
        const promise = source.pipe(sink).exec({});
        return chai.expect(promise).to.eventually.equal(42);
      });

      it('returns the result with a non-empty input', () => {
        const sink = Sink.const(42);
        const source = Source.fromArray([1, 2, 3]);
        const promise = source.pipe(sink).exec({});
        return chai.expect(promise).to.eventually.equal(42);
      });

    });

  });

});
