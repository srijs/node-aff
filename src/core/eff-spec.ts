'use strict';

import * as mocha from 'mocha';
import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

import {Op, Eff} from './eff';
import {Run} from './run';
import {EffUtil} from './effutil';

chai.should();
chai.use(chaiAsPromised);

describe('Regular Operation', () => {
    it('should work fine', () => {
        const op1 = EffUtil.scheduledOnce(() => 3, 500);
        return op1.run({}).toPromise().should.eventually.equal(3);
    });

    it('can be cancelled', () => {
        const op1 = EffUtil.scheduledOnce(() => 3, 500);
        const run = op1.run({});
        const promise = run.toPromise();
        const cause = new Error('Operation cancelled');
        run.cancel(cause);
        return promise.should.be.rejectedWith(cause);
    });
});

describe('Bind Operation', function() {
    this.timeout(4000);

    it('should work fine', () => {
        const op1 = EffUtil.scheduledOnce(() => 3, 500);
        const op2 = op1.chain((multiplier) => EffUtil.scheduledOnce(() => 2 * multiplier, 500));
        return op2.run({}).toPromise().should.eventually.equal(6);
    });

    it('can be cancelled', () => {
        const op1 = EffUtil.scheduledOnce(() => 3, 500);
        const op2 = op1.chain((multiplier) => EffUtil.scheduledOnce(() => 2 * multiplier, 500));
        const run = op2.run({});
        const cause = new Error('Operation cancelled');
        run.cancel(cause);
        return run.toPromise().should.be.rejectedWith(cause);
    });

    it('can handle exceptions', () => {
        const op1 = EffUtil.scheduledOnce(() => 3, 500);
        const op2 = op1.chain((multiplier) => EffUtil.scheduledOnce(() => {
            throw new Error('No need for a ' + multiplier);
        }, 500));
        return op2.run({}).toPromise().should.be.rejectedWith('No need for a 3');
    });

    it('trampoline', () => {
        let operation = EffUtil.scheduledOnce(() => 0, 100);
        const numberOfLoops = 20000;
        for (let l = 0; l < numberOfLoops; l++)
        {
            operation = operation.chain((i: number) => Eff.of(i + 1));
        }
        return operation.run({}).toPromise().should.eventually.equal(numberOfLoops);
    });

    it('trampoline with delay', () => {
        let operation = EffUtil.scheduledOnce(() => 0, 100);
        const numberOfLoops = 20000;
        for (let l = 0; l < numberOfLoops; l++)
        {
            operation = operation.chain((i: number) => EffUtil.delay(() => i + 1));
        }
        return operation.run({}).toPromise().should.eventually.equal(numberOfLoops);
    });

    it('trampoline with cancellation', () => {
        let operation = EffUtil.scheduledOnce(() => 0, 100);
        const numberOfLoops = 20000;
        const cause = new Error('Operation cancelled');
        const finished = new Error('Operation should not have finished');
        let count = 0;
        for (let l = 0; l < numberOfLoops; l++)
        {
            operation = operation.chain((i: number) => EffUtil.delay(() => {
                count = i;
                return i + 1;
            }));
        }
        const run = operation.run({});
        const promise = run.toPromise().then((success: number) => Promise.reject(finished), (reject: Error) => Promise.resolve(count));
        run.cancel(cause);
        return promise.should.eventually.lessThan(numberOfLoops);
    });

});
