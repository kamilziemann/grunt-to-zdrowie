// siblings: rodzenstwo w katalogu (modules/*, services/*, features/*) nie importuje swojego wnetrza nawzajem.
// Plik w <dir>/<a>/** moze importowac z <dir>/<b>/ (b != a) wylacznie <dir>/<b>/<publicFile>; pusty publicFile = nigdy.
// Pliki spoza <dir> (np. entry, app/) nie podlegaja tej regule - w apps/web to jest regula "feature-imports".
import { firstSegment, joinPosix, relativeTo } from '../../paths';
import type { Rule, Violation } from '../../types';
import { appEntries, violation } from '../helpers';

export const siblings: Rule = {
  id: 'siblings',
  description: 'Rodzenstwo (modules, services, features) importuje sie tylko przez publiczny plik.',
  run(ctx) {
    const out: Violation[] = [];

    for (const app of appEntries(ctx)) {
      for (const rule of app.rules.siblings ?? []) {
        const base = joinPosix(app.unit.dir, rule.dir);

        for (const file of app.files) {
          if (!file.path.startsWith(`${base}/`)) continue;
          const own = firstSegment(relativeTo(base, file.path));

          if (own === null) continue;

          for (const imp of file.imports) {
            const target = imp.resolved.path;

            if (target === null || !target.startsWith(`${base}/`)) continue;
            const targetRelative = relativeTo(base, target);
            const other = firstSegment(targetRelative);

            if (other === null || other === own) continue;
            if (rule.publicFile !== '' && targetRelative === `${other}/${rule.publicFile}`) continue;
            const message =
              rule.publicFile === ''
                ? `${rule.dir}/${own} importuje ${rule.dir}/${other} ('${imp.specifier}'). Rodzenstwo w ${rule.dir} nie importuje sie nawzajem.`
                : `${rule.dir}/${own} importuje wnetrze ${rule.dir}/${other} ('${imp.specifier}'). Uzyj publicznego API: ${rule.dir}/${other}/${rule.publicFile}.`;

            out.push(violation('siblings', file.path, imp.line, message));
          }
        }
      }
    }

    return out;
  },
};
