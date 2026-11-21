// Skan plikow (include minus exclude) i ekstrakcja importow; potem rozwiazanie importow na jednostki/pliki.
import { scanPaths } from '../glob';
import { extractImports } from '../imports';
import type { Resolver } from '../resolver';
import type { AnalyzedFile, ScannedFile } from '../types';

export async function scanFiles(
  root: string,
  include: readonly string[],
  exclude: readonly string[],
): Promise<ScannedFile[]> {
  const paths = scanPaths(root, include, exclude);

  return Promise.all(
    paths.map(async (path) => {
      const source = await Bun.file(`${root}/${path}`).text();
      const { imports, useClient } = extractImports(source);

      return { path, imports, useClient };
    }),
  );
}

export function analyzeFiles(files: readonly ScannedFile[], resolver: Resolver): AnalyzedFile[] {
  return files.map((file) => ({
    path: file.path,
    useClient: file.useClient,
    unit: resolver.unitOf(file.path),
    imports: file.imports.map((record) => ({
      ...record,
      resolved: resolver.resolve(file.path, record.specifier),
    })),
  }));
}
