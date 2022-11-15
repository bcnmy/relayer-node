import { Router } from 'express';
import { settings, status } from '../../controllers';

export const adminApiRouter = Router();

adminApiRouter.get('/', settings);
adminApiRouter.get('/status', status);
