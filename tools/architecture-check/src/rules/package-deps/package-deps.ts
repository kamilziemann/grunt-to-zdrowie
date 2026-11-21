// package-deps: paczka importuje tylko paczki z `allowed`; graf `allowed` jest acykliczny;
// kazda paczka/aplikacja w zeskanowanych plikach jest zadeklarowana w konfiguracji.
import { stronglyConnectedComponents } from '../../graph';
import type { Rule, Violation } from '../../types';
import { list, violation } from '../helpers';

export const packageDeps: Rule = {
  id: 'package-deps',
  description: 'Paczki importuja tylko paczki wymienione w packages[...].allowed (graf bez cykli).',
  run(ctx) {
    const out: Violation[] = [];
    const { packages } = ctx.config;
    const names = new Set(Object.keys(packages));

    for (const [name, rules] of Object.entries(packages)) {
      for (const dep of rules.allowed) {
        if (dep === name) {
          out.push(
            violation('package-deps', ctx.configPath, 0, `Paczka ${name}: 'allowed' zawiera ja sama.`),
          );
        } else if (!names.has(dep)) {
          out.push(
            violation(
              'package-deps',
              ctx.configPath,
              0,
              `Paczka ${name}: 'allowed' wskazuje nieznana paczke ${dep}.`,
            ),
          );
        }
      }
    }

    const edges = new Map<string, string[]>();

    for (const [name, rules] of Object.entries(packages)) {
      edges.set(
        name,
        rules.allowed.filter((dep) => names.has(dep)),
      );
    }

    for (const component of stronglyConnectedComponents([...names], edges)) {
      out.push(
        violation(
          'package-deps',
          ctx.configPath,
          0,
          `Cykl w grafie paczek (allowed): ${[...component, component[0] ?? ''].join(' -> ')}.`,
        ),
      );
    }

    for (const unit of ctx.units) {
      if (unit.declared || unit.kind === 'tool') continue;
      const first = ctx.files.find((file) => file.unit === unit);

      if (!first) continue;
      const where = unit.kind === 'app' ? 'apps' : 'packages';

      out.push(
        violation(
          'package-deps',
          first.path,
          0,
          `${unit.name} (${unit.dir}) nie jest zadeklarowana w architecture.config.ts (${where}).`,
        ),
      );
    }

    for (const file of ctx.files) {
      const unit = file.unit;

      if (!unit || unit.kind !== 'package' || !unit.declared) continue;
      const allowed = packages[unit.name]?.allowed ?? [];

      for (const imp of file.imports) {
        const target = imp.resolved.unit;

        if (!target || target === unit) continue;

        if (target.kind === 'tool') {
          out.push(
            violation(
              'package-deps',
              file.path,
              imp.line,
              `Paczka ${unit.name} importuje narzedzie ${target.name} ('${imp.specifier}'). Narzedzia nie sa zaleznoscia paczek.`,
            ),
          );
          continue;
        }

        if (target.kind !== 'package' || allowed.includes(target.name)) continue;
        out.push(
          violation(
            'package-deps',
            file.path,
            imp.line,
            `Paczka ${unit.name} nie moze importowac ${target.name} ('${imp.specifier}'). Dozwolone: ${list(allowed)}. Dodaj zaleznosc w architecture.config.ts (packages[...].allowed).`,
          ),
        );
      }
    }

    return out;
  },
};
