import { describe, expect, it } from 'vitest';

import * as workerApi from './worker';

describe('@app/start-kit/worker', () => {
  it('eksportuje tylko API wejscia Workera', () => {
    expect(Object.keys(workerApi).toSorted()).toEqual([
      'PAGE_CONTENT_SECURITY_POLICY',
      'getServerFetch',
      'registerServerFetch',
      'withDefaultCacheControl',
      'withSecurityHeaders',
    ]);
  });
});
