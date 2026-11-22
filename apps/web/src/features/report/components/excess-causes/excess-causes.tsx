import type { WaterReport } from '@app/contracts';
import { CloudRain, Waves, Workflow } from 'lucide-react';
import type { ReactNode } from 'react';
import { useFormatter, useTranslations } from 'use-intl';

import { excessFacts, rankSide } from '../../utils/report-data';

/**
 * Sekcja 3 przy nadmiarze wody ("Skad nadmiar wody"): to, co raport wie - deszcz na tle lat, bilans 60 dni na plusie,
 * zaglebienia bez odplywu i miejsca, gdzie zbiera sie woda, rowy, ktore odprowadzaja nadmiar. Silnik nie liczy
 * przyczyn nadmiaru, wiec to fakty z oceny i z mapy miejsc, bez wag.
 */
export function ExcessCauses({ report }: { report: WaterReport }) {
  const t = useTranslations('report.causes.excess');
  const format = useFormatter();
  const facts = excessFacts(report);
  const mm = (value: number) => format.number(value, { maximumFractionDigits: 0 });
  const items: { key: string; icon: ReactNode; text: string }[] = [];
  const icon = (Icon: typeof CloudRain) => (
    <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-water" />
  );

  if (facts.rain) {
    const ratio = facts.rain.sumMm / Math.max(facts.rain.medianMm, 1);

    items.push({
      key: 'rain',
      icon: icon(CloudRain),
      text: t('rain', {
        days: facts.rain.days,
        sum: mm(facts.rain.sumMm),
        median: mm(facts.rain.medianMm),
        // "ok. 4 razy wiecej" dopiero od dwukrotnosci normy
        times: ratio >= 2 ? Math.round(ratio) : 0,
        ...rankSide(facts.rain.rank, facts.rain.years),
        years: facts.rain.years,
      }),
    });
  }

  if (facts.balance) {
    items.push({
      key: 'balance',
      icon: icon(CloudRain),
      text: t('balance', {
        precip: mm(facts.balance.precipMm),
        et: mm(facts.balance.evapotranspirationMm),
        left: mm(facts.balance.balanceMm),
      }),
    });
  }

  if (facts.depressions.count > 0 || facts.collecting > 0) {
    items.push({
      key: 'zones',
      icon: icon(Waves),
      text: [
        facts.depressions.count > 0
          ? facts.depressions.volumeM3 > 0
            ? t('depressionsVolume', {
                count: facts.depressions.count,
                volume: format.number(Math.round(facts.depressions.volumeM3 / 100) * 100),
              })
            : t('depressions', { count: facts.depressions.count })
          : null,
        facts.collecting > 0 ? t('collecting', { count: facts.collecting }) : null,
        t('zonesNote'),
      ]
        .filter(Boolean)
        .join(' '),
    });
  }

  if (facts.ditchInFieldM !== null || facts.ditchNearWetZones) {
    items.push({
      key: 'ditches',
      icon: icon(Workflow),
      text:
        facts.ditchInFieldM === null
          ? t('ditchesNear')
          : t('ditchesLength', { meters: mm(facts.ditchInFieldM) }),
    });
  }

  return (
    <div className="flex flex-col gap-3" data-testid="excess-causes">
      <p className="text-base">{t('intro')}</p>
      {items.length === 0 ? (
        <p className="text-base text-muted-foreground">{t('none')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.key}
              className="flex items-start gap-3 rounded-lg border bg-card p-4 text-base print:break-inside-avoid"
              data-fact={item.key}
            >
              {item.icon}
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
