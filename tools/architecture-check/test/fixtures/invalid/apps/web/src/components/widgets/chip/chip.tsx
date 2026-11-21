'use client';

import { labelOf } from '../badge/badge-label';
import { Badge } from '../badge';
import { Input } from '../forms/input';

export const Chip = (): string => `${Badge.name}${Input.name}${labelOf('chip')}`;
