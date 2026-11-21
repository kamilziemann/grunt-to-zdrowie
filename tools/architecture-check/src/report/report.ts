// Formaty raportu: text (dla ludzi), github (adnotacje ::error w Actions), json (dla narzedzi).
import type { CheckResult, Violation } from '../types';

export type ReportFormat = 'text' | 'github' | 'json';

const plural = (n: number, one: string, few: string, many: string): string => {
  if (n === 1) return one;
  const mod10 = n % 10;
  const mod100 = n % 100;

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;

  return many;
};

function groupByRule(violations: readonly Violation[]): Map<string, Violation[]> {
  const groups = new Map<string, Violation[]>();

  for (const item of violations) {
    const group = groups.get(item.rule);

    if (group) group.push(item);
    else groups.set(item.rule, [item]);
  }

  return groups;
}

export function formatText(result: CheckResult): string {
  const files = `${result.filesScanned} ${plural(result.filesScanned, 'plik', 'pliki', 'plikow')}`;

  if (result.violations.length === 0) return `OK: brak naruszen architektury (przeskanowano ${files}).\n`;
  const lines: string[] = [];

  for (const [rule, items] of groupByRule(result.violations)) {
    lines.push(`${rule} (${items.length})`);

    for (const item of items) {
      const where = item.line > 0 ? `${item.file}:${item.line}` : item.file;

      lines.push(`  ${where}  ${item.rule}  ${item.message}`);
    }

    lines.push('');
  }

  const total = result.violations.length;
  const ruleCount = Object.keys(result.counts).length;

  lines.push(
    `Razem: ${total} ${plural(total, 'naruszenie', 'naruszenia', 'naruszen')} w ${ruleCount} ${plural(
      ruleCount,
      'regule',
      'regulach',
      'regulach',
    )} (przeskanowano ${files}). Reguly: architecture.config.ts, opis: AGENTS.md.`,
  );

  return `${lines.join('\n')}\n`;
}

const escapeData = (text: string): string =>
  text.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
const escapeProperty = (text: string): string =>
  escapeData(text).replaceAll(':', '%3A').replaceAll(',', '%2C');

/** Adnotacje GitHub Actions (workflow commands); jedna linia na naruszenie. */
export function formatGithub(result: CheckResult): string {
  const lines = result.violations.map((item) => {
    const props = [`file=${escapeProperty(item.file)}`];

    if (item.line > 0) props.push(`line=${item.line}`);
    props.push(`title=${escapeProperty(`architecture: ${item.rule}`)}`);

    return `::error ${props.join(',')}::${escapeData(item.message)}`;
  });

  lines.push(
    result.violations.length === 0
      ? `::notice title=architecture::OK, brak naruszen (przeskanowano ${result.filesScanned} plikow)`
      : `::notice title=architecture::${result.violations.length} naruszen w ${Object.keys(result.counts).length} regulach`,
  );

  return `${lines.join('\n')}\n`;
}

export function formatJson(result: CheckResult): string {
  return `${JSON.stringify(result, null, 2)}\n`;
}

export function formatReport(result: CheckResult, format: ReportFormat): string {
  if (format === 'github') return formatGithub(result);
  if (format === 'json') return formatJson(result);

  return formatText(result);
}
