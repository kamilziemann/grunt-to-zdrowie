// forbidden-modules: warstwa nie importuje modulow o zakazanych prefiksach (np. services bez hono i drizzle-orm).
// Dotyczy tez `import type` - warstwa ma nie znac tych modulow w ogole.
import { relativeTo } from '../../paths';
import type { Rule, Violation } from '../../types';
import { appEntries, layerOf, matchesModulePrefix, violation } from '../helpers';

export const forbiddenModules: Rule = {
  id: 'forbidden-modules',
  description: 'Warstwy nie importuja zakazanych modulow (apps[...].layers.forbiddenModules).',
  run(ctx) {
    const out: Violation[] = [];

    for (const app of appEntries(ctx)) {
      const rules = app.rules.layers;

      if (!rules?.forbiddenModules) continue;
      const forbidden = rules.forbiddenModules;

      for (const layer of Object.keys(forbidden)) {
        if (!(layer in rules.layers)) {
          out.push(
            violation(
              'forbidden-modules',
              ctx.configPath,
              0,
              `${app.name}: forbiddenModules wskazuje nieznana warstwe '${layer}'.`,
            ),
          );
        }
      }

      for (const file of app.files) {
        const layer = layerOf(rules, relativeTo(app.unit.dir, file.path));

        if (layer === null) continue;
        const prefixes = forbidden[layer] ?? [];

        if (prefixes.length === 0) continue;

        for (const imp of file.imports) {
          const hit = prefixes.find((prefix) => matchesModulePrefix(imp.specifier, prefix));

          if (hit === undefined) continue;
          out.push(
            violation(
              'forbidden-modules',
              file.path,
              imp.line,
              `Warstwa '${layer}' nie moze importowac '${imp.specifier}' (zakazany modul '${hit}').`,
            ),
          );
        }
      }
    }

    return out;
  },
};
