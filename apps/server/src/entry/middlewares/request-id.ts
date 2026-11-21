// Id requestu: z naglowka x-request-id (np. od warstwy stron) albo losowe; wraca w odpowiedzi i trafia do logow/problemow.
import { requestId } from 'hono/request-id';

export const requestIdMiddleware = requestId({ headerName: 'x-request-id', limitLength: 128 });
