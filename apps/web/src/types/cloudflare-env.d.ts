// Typ `env` z `cloudflare:workers` w wejsciu Workera: te same bindingi i zmienne co API (@app/env/server), bez
// generowanego worker-configuration.d.ts - jedno zrodlo typow srodowiska.
import type { RawServerEnv } from '@app/env/server';

declare global {
  namespace Cloudflare {
    interface Env extends RawServerEnv {}
  }
}
