import { Chip } from '@/components/widgets';
import { Badge } from '@/components/widgets/badge';
import { Input } from '@/components/widgets/forms/input';

export const useWidgets = (): string => `${Badge.name}${Chip.name}${Input.name}`;
