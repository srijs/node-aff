import {Eff} from '../../core/eff';

import {Sink} from '../sink';

export class IntoOutputStreamState {
  private _hasError = false;
  private _err: Error;

  constructor(private _stream: NodeJS.WritableStream) {
    this._stream.on('error', (err: Error) => {
      this._hasError = true;
      this._err = err;
    });
  }

  write(buf: Buffer): Promise<this> {
    return new Promise<this>((resolve, reject) => {
      if (this._hasError) {
        return reject(this._err);
      }
      this._stream.once('error', reject);
      if (this._stream.write(buf)) {
        this._stream.removeListener('error', reject);
        return resolve(this);
      }
      this._stream.once('drain', () => {
        this._stream.removeListener('error', reject);
        resolve(this);
      });
    });
  }

  end(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (this._hasError) {
        return reject(this._err);
      }
      this._stream.once('error', reject);
      this._stream.once('finish', () => {
        this._stream.removeListener('error', reject);
        resolve(null);
      });
      this._stream.end();
    });
  }
}

export function intoOutputStream<F>(output: () => NodeJS.WritableStream): Sink<F, Buffer, IntoOutputStreamState, void> {
  return new Sink<F, Buffer, IntoOutputStreamState, void>({
    onStart: () => new Eff(ctx => {
      return Promise.resolve(new IntoOutputStreamState(output()));
    }),
    onData: (state, buf) => new Eff(ctx => {
      return state.write(buf);
    }),
    onEnd: (state) => new Eff(ctx => {
      return state.end();
    })
  });
}
