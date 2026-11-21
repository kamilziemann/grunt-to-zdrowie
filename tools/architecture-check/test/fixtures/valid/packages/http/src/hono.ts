import type { Context } from 'hono';

import { AppError } from './index';

export const createErrorHandler = (c: Context): AppError => new AppError(String(c));
