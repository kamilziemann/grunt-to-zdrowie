import type { WaterReport } from '@app/contracts';
import { Waves } from 'lucide-react';
import { useFormatter, useTranslations } from 'use-intl';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

import { percentOf } from '../../utils/report-data';

/**
 * Czesc dzialki pod woda wg BDOT10k (jezioro, staw, koryto): mowimy, ile to procent i hektarow, i ze zalecenia oraz
 * ilosci wody do podlewania dotycza tylko ladu. Gdy woda zajmuje ponad polowe, a ewidencja milczy, mocniejsza
 * ramka "to wyglada na jezioro" stoi w `LandUseNotice` - wtedy ta znika.
 */
export function WaterInFieldNotice({ report }: { report: WaterReport }) {
  const t = useTranslations('report.waterInField');
  const format = useFormatter();
  const water = report.waterInField;

  if (!water || report.limitations.includes('likely_water')) return null;
  const hectares = (value: number) => format.number(value, { maximumFractionDigits: 1 });

  return (
    <Alert className="text-base print:break-inside-avoid" data-testid="water-in-field">
      <Waves aria-hidden="true" />
      <AlertTitle className="line-clamp-none text-lg leading-snug font-semibold text-balance">
        {t('title', { percent: percentOf(water.areaShare), water: hectares(water.areaHa) })}
      </AlertTitle>
      <AlertDescription className="text-base text-foreground">
        {t('text', { land: hectares(water.landAreaHa) })}
      </AlertDescription>
    </Alert>
  );
}
