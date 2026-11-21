// layers: plik w warstwie A importuje (w obrebie aplikacji) tylko pliki z A lub z allowed[A].
// Warstwa pliku = pierwszy pasujacy glob z layers.layers (w kolejnosci deklaracji); pliki bez warstwy sa pomijane.
import { relativeTo } from '../../paths';
import type { Rule, Violation } from '../../types';
import { appEntries, layerOf, list, violation } from '../helpers';

export const layers: Rule = {
  id: 'layers',
  description: 'Warstwy aplikacji importuja tylko dozwolone warstwy (apps[...].layers.allowed).',
  run(ctx) {
    const out: Violation[] = [];

    for (const app of appEntries(ctx)) {
      const rules = app.rules.layers;

      if (!rules) continue;
      const known = new Set(Object.keys(rules.layers));

      for (const [layer, allowed] of Object.entries(rules.allowed)) {
        if (!known.has(layer)) {
          out.push(
            violation(
              'layers',
              ctx.configPath,
              0,
              `${app.name}: 'allowed' wskazuje nieznana warstwe '${layer}'.`,
            ),
          );
        }

        for (const target of allowed) {
          if (!known.has(target)) {
            out.push(
              violation(
                'layers',
                ctx.configPath,
                0,
                `${app.name}: warstwa '${layer}' dopuszcza nieznana warstwe '${target}'.`,
              ),
            );
          }
        }
      }

      for (const file of app.files) {
        const layer = layerOf(rules, relativeTo(app.unit.dir, file.path));

        if (layer === null) continue;
        const allowed = rules.allowed[layer] ?? [];

        for (const imp of file.imports) {
          const { resolved } = imp;

          if (resolved.path === null || resolved.unit !== app.unit) continue;
          const targetLayer = layerOf(rules, relativeTo(app.unit.dir, resolved.path));

          if (targetLayer === null || targetLayer === layer || allowed.includes(targetLayer)) continue;
          out.push(
            violation(
              'layers',
              file.path,
              imp.line,
              `Warstwa '${layer}' nie moze importowac warstwy '${targetLayer}' ('${imp.specifier}'). Dozwolone: ${
                allowed.length === 0 ? 'tylko wlasna warstwa' : list(allowed)
              }.`,
            ),
          );
        }
      }
    }

    return out;
  },
};
