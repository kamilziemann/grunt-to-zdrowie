// deep-import: `@scope/pkg/<subpath>` tylko gdy subpath jest w `exports` package.json albo w deepImports.allowSubpaths;
// import wzgledny nie moze wychodzic poza wlasna paczke/aplikacje.
import type { Rule, Violation } from '../../types';
import { violation } from '../helpers';

export const deepImport: Rule = {
  id: 'deep-import',
  description: 'Importy do paczek workspace tylko przez publiczne API (exports) lub dozwolone subpathy.',
  run(ctx) {
    const out: Violation[] = [];
    const { allowSubpaths } = ctx.config.deepImports;
    const allowedByConfig = (specifier: string): boolean =>
      allowSubpaths.some((allowed) =>
        allowed.endsWith('/') ? specifier.startsWith(allowed) : specifier === allowed,
      );

    for (const file of ctx.files) {
      for (const imp of file.imports) {
        const { resolved } = imp;

        if (resolved.kind === 'workspace' && resolved.subpath !== null && !resolved.exported) {
          if (allowedByConfig(imp.specifier)) continue;
          out.push(
            violation(
              'deep-import',
              file.path,
              imp.line,
              `Gleboki import '${imp.specifier}'. Importuj z publicznego API ${resolved.unit?.name ?? 'paczki'} (package.json exports) albo dodaj subpath do deepImports.allowSubpaths.`,
            ),
          );
          continue;
        }

        if (resolved.crossesUnit) {
          const targetName = resolved.unit?.name ?? 'poza workspace';

          out.push(
            violation(
              'deep-import',
              file.path,
              imp.line,
              `Import wzgledny '${imp.specifier}' wychodzi poza ${file.unit?.name ?? 'jednostke'} (do ${targetName}). Uzyj specyfikatora paczki (${ctx.config.scope}/...).`,
            ),
          );
        }
      }
    }

    return out;
  },
};
