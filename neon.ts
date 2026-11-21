// Konfiguracja Neon (Postgres z PostGIS): `neon deploy` stosuje ją do projektu i ściąga DATABASE_URL do .env.local.
import { defineConfig } from '@neon/config/v1';

export default defineConfig({
  // Declare your Neon services here
  auth: false,
  // Branch policy: per-branch tuning
  branch: (branch) => {
    if (branch.isDefault) {
      // Default branch: no overrides, uses project defaults
      return {};
    }

    if (!branch.exists) {
      // New non-default branches: auto-expire
      // Run `neon checkout <name>` to create a new branch with these settings
      return { ttl: '7d' };
    }

    // Existing branch: no changes
    return {};
  },
});
