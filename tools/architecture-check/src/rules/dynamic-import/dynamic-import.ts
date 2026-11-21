// dynamic-import: import() tylko w plikach pasujacych do dynamicImports.allow (globy wzgledem roota).
import { matchesAny } from '../../glob';
import type { Rule, Violation } from '../../types';
import { violation } from '../helpers';

export const dynamicImport: Rule = {
  id: 'dynamic-import',
  description: 'Importy dynamiczne tylko w katalogach z dynamicImports.allow.',
  run(ctx) {
    const out: Violation[] = [];
    const { allow } = ctx.config.dynamicImports;

    for (const file of ctx.files) {
      if (matchesAny(allow, file.path)) continue;

      for (const imp of file.imports) {
        if (imp.kind !== 'dynamic') continue;
        out.push(
          violation(
            'dynamic-import',
            file.path,
            imp.line,
            `Import dynamiczny '${imp.specifier}' poza dozwolonymi katalogami (dynamicImports.allow).`,
          ),
        );
      }
    }

    return out;
  },
};
