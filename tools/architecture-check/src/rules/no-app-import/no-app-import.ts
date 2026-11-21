// no-app-import: paczki i narzedzia nie importuja aplikacji (ani przez @scope/app, ani sciezka wzgledna).
import type { Rule, Violation } from '../../types';
import { violation } from '../helpers';

export const noAppImport: Rule = {
  id: 'no-app-import',
  description:
    'Paczki i narzedzia nie importuja kodu aplikacji; zaleznosc idzie tylko z aplikacji do paczek.',
  run(ctx) {
    const out: Violation[] = [];

    for (const file of ctx.files) {
      if (file.unit?.kind === 'app') continue;
      const owner = file.unit?.name ?? file.path;

      for (const imp of file.imports) {
        const target = imp.resolved.unit;

        if (!target || target.kind !== 'app') continue;
        out.push(
          violation(
            'no-app-import',
            file.path,
            imp.line,
            `${owner} importuje aplikacje ${target.name} ('${imp.specifier}'). Zaleznosc musi isc w druga strone: aplikacje importuja paczki.`,
          ),
        );
      }
    }

    return out;
  },
};
