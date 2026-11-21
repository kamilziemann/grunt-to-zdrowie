'use client';

import { PACK_NAME } from '../packs/data';
import { labelOf } from './badge-label';

export const Badge = (): string => `${PACK_NAME}${labelOf('badge')}`;
