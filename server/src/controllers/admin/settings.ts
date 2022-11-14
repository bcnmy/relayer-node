import { Request, Response } from 'express';

export const settings = async (req: Request, res: Response) => {
  res.render('settings');
};
