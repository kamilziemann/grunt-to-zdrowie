// Walidacja odpowiedzi API, ktore nie maja typu w @app/contracts (np. katalog). Niezgodny ksztalt
// staje sie RpcError (upstream_failed), wiec UI obsluzy go ta sama sciezka, co inne bledy API.
import { HTTP_STATUS_BY_CODE, PROBLEM_CODES, problemType } from '@app/contracts';
import { RpcError } from '@app/rpc';
import type { ZodType } from 'zod';

export function parseApiResponse<T>(schema: ZodType<T>, data: unknown, what = 'odpowiedz API'): T {
  const result = schema.safeParse(data);

  if (result.success) return result.data;
  const code = PROBLEM_CODES.UPSTREAM_FAILED;
  const detail = result.error.issues
    .slice(0, 3)
    .map((issue) => `${issue.path.map(String).join('.') || '(root)'}: ${issue.message}`)
    .join('; ');

  throw new RpcError({
    type: problemType(code),
    title: `Unexpected shape of ${what}`,
    status: HTTP_STATUS_BY_CODE[code],
    detail,
    code,
  });
}
