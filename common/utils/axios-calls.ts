import axios from 'axios';

export const gasPriceCall = async (url: string) => {
  const { data } = await axios.get(url);
  return data;
};
