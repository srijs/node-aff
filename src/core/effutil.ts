import {Eff} from './eff';
import {Run} from './run';

class Deferred<T> {
    promise: Promise<T> = new Promise<T>((resolve, reject) => {
        this.resolve = resolve;
        this.reject = reject;
    });
    resolve: (t: T) => void;
    reject: (e: Error) => void;
}

export class EffUtil {
    static scheduledOnce<F, T>(block: () => T, delay: number): Eff<F, T> {
        return new Eff<F, T>(_ => {
            const deferred = new Deferred<T>();
            const timeoutObject = setTimeout(() => {
                try {
                    deferred.resolve(block());
                } catch(e) {
                    deferred.reject(e);
                }
            }, delay);
            const cancel = (e: Error) => {
                clearTimeout(timeoutObject);
                deferred.reject(e);
            };
            return new Run(deferred.promise, cancel);
        });
    }
    static delay<F, T>(block: () => T): Eff<F, T> {
        return new Eff(_ => Run.of(block()));
    }
    static unit<F>(): Eff<F, void> {
        return new Eff(_ => new Run<void>(Promise.resolve(), () => null));
    }
}