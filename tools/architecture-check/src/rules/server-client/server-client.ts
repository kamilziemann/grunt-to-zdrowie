// server-client: pliki 'use client' oraz katalogi z noFeatureImportsFrom nie importuja kodu serwerowego (serverOnly);
// katalogi z noFeatureImportsFrom nie importuja features. `import type` z kodu serwerowego jest dozwolony
// (znika w runtime), import typu z features - nie (components/ui ma nie znac features).
import { matchesAny } from '../../glob';
import { relativeTo } from '../../paths';
import type { Rule, Violation } from '../../types';
import { appEntries, violation } from '../helpers';

const FEATURES_DIR = 'src/features/';

export const serverClient: Rule = {
  id: 'server-client',
  description:
    "Pliki 'use client' i wspolne katalogi nie importuja kodu serwerowego; wspolne katalogi nie znaja features.",
  run(ctx) {
    const out: Violation[] = [];

    for (const app of appEntries(ctx)) {
      const serverOnly = app.rules.serverOnly ?? [];
      const shared = app.rules.noFeatureImportsFrom ?? [];

      if (serverOnly.length === 0 && shared.length === 0) continue;

      for (const file of app.files) {
        const relative = relativeTo(app.unit.dir, file.path);
        const isShared = matchesAny(shared, relative);

        if (!file.useClient && !isShared) continue;
        // plik, ktory sam jest serverOnly (np. src/lib/server/*), moze importowac inny kod serwerowy
        const guardsServer = file.useClient || !matchesAny(serverOnly, relative);

        for (const imp of file.imports) {
          const { resolved } = imp;

          if (resolved.path === null || resolved.unit !== app.unit) continue;
          const target = relativeTo(app.unit.dir, resolved.path);

          if (guardsServer && !imp.typeOnly && matchesAny(serverOnly, target)) {
            out.push(
              violation(
                'server-client',
                file.path,
                imp.line,
                file.useClient
                  ? `Plik 'use client' importuje kod serwerowy '${imp.specifier}' (${target}).`
                  : `${relative} nie moze importowac kodu serwerowego '${imp.specifier}' (${target}).`,
              ),
            );
          }

          if (isShared && target.startsWith(FEATURES_DIR)) {
            out.push(
              violation(
                'server-client',
                file.path,
                imp.line,
                `${relative} nie moze importowac features ('${imp.specifier}'). Katalogi z noFeatureImportsFrom nie znaja features.`,
              ),
            );
          }
        }
      }
    }

    return out;
  },
};
