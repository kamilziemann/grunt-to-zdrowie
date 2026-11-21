// Lista regul w kolejnosci raportowania. Identyfikatory sa stabilne (uzywa ich --only i dokumentacja).
import type { Rule } from '../types';
import { cycles } from './cycles';
import { deepImport } from './deep-import';
import { dynamicImport } from './dynamic-import';
import { folderUnits } from './folder-units';
import { forbiddenModules } from './forbidden-modules';
import { layers } from './layers';
import { noAppImport } from './no-app-import';
import { packageDeps } from './package-deps';
import { serverClient } from './server-client';
import { siblings } from './siblings';
import { typeOnly } from './type-only';

export const rules: readonly Rule[] = [
  packageDeps,
  noAppImport,
  deepImport,
  cycles,
  layers,
  forbiddenModules,
  siblings,
  folderUnits,
  typeOnly,
  dynamicImport,
  serverClient,
];
