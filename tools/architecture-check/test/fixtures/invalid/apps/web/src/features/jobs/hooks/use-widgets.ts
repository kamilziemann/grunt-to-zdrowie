import { Chip } from '@/components/widgets';
import { Badge } from '@/components/widgets/badge/badge';
import { Input } from '@/components/widgets/forms/input/input';

export const useWidgets = (): string => `${Badge.name}${Chip.name}${Input.name}`;
