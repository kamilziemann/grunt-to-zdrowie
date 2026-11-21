// Plik serverOnly w katalogu z noFeatureImportsFrom (src/lib/**) moze importowac inny kod serwerowy.
import { serverClient } from './client';

export const health = (): unknown => serverClient;
