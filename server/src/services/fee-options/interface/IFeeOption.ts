import { FeeOptionResponseType } from '../types';

export interface IFeeOption {
  get: () => Promise<FeeOptionResponseType>
}
