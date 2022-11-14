export interface ITokenPrice {
  getTokenPrice(symbol: string): Promise<number>;
  getTokenPriceByTokenAddress(chainId: number, tokenAddress: string): Promise<number>;
}
