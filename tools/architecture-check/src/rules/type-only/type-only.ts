// type-only: aplikacja importuje inna aplikacje tylko, gdy para jest w typeOnlyImports - i tylko jako `import type`.
// import() i require() nigdy nie sa type-only. Wyjatek `runtime` pary: wskazane pliki moga importowac wskazane
// specyfikatory w runtime (np. wejscie Workera montuje API z innej aplikacji) - kazdy inny plik dalej tylko typy.
import { matchesAny } from '../../glob';
import type { Rule, Violation } from '../../types';
import { violation } from '../helpers';

export const typeOnly: Rule = {
  id: 'type-only',
  description: 'Importy miedzy aplikacjami tylko jako import type i tylko dla par z typeOnlyImports.',
  run(ctx) {
    const out: Violation[] = [];
    const apps = new Set(Object.keys(ctx.config.apps));

    for (const pair of ctx.config.typeOnlyImports) {
      for (const name of [pair.from, pair.to]) {
        if (!apps.has(name)) {
          out.push(
            violation('type-only', ctx.configPath, 0, `typeOnlyImports wskazuje nieznana aplikacje ${name}.`),
          );
        }
      }
    }

    for (const file of ctx.files) {
      const unit = file.unit;

      if (!unit || unit.kind !== 'app') continue;

      for (const imp of file.imports) {
        const target = imp.resolved.unit;

        if (!target || target === unit || target.kind !== 'app') continue;
        const pair = ctx.config.typeOnlyImports.find((p) => p.from === unit.name && p.to === target.name);

        if (!pair) {
          out.push(
            violation(
              'type-only',
              file.path,
              imp.line,
              `Aplikacja ${unit.name} nie moze importowac aplikacji ${target.name} ('${imp.specifier}').`,
            ),
          );
          continue;
        }

        if (imp.typeOnly) continue;

        const runtime = pair.runtime;
        const relative = file.path.slice(unit.dir.length + 1);

        if (runtime && runtime.specifiers.includes(imp.specifier) && matchesAny(runtime.files, relative))
          continue;

        out.push(
          violation(
            'type-only',
            file.path,
            imp.line,
            `Import z ${target.name} w ${unit.name} musi byc 'import type' ('${imp.specifier}').`,
          ),
        );
      }
    }

    return out;
  },
};
