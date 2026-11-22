import type { UserConfig } from '@commitlint/types';

const config: UserConfig = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      1,
      'always',
      [
        'web',
        'server',
        'contracts',
        'db',
        'env',
        'http',
        'rpc',
        'logger',
        'config',
        'tools',
        'docs',
        'ci',
        'deps',
        'release',
      ],
    ],
    'subject-case': [0],
  },
};

export default config;
