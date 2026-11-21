// Schemat OpenAPI modulu me - kontrakt z @app/contracts z nazwa komponentu.
import { meSchema } from '@app/contracts';

export const meDto = meSchema.meta({ id: 'Me' });
