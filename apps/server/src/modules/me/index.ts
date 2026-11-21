// Tozsamosc biezacego zadania, montowana pod /me: czy auth jest wlaczone i kto jest zalogowany (user = null).
import { OpenAPIHono } from '@hono/zod-openapi';
import { openApiValidationHook } from '@app/http/hono';

import type { AppEnv } from '../../services/container';
import { me } from './me.handlers';
import { getMe } from './me.routes';

export const meModule = new OpenAPIHono<AppEnv>({ defaultHook: openApiValidationHook }).openapi(getMe, me);
