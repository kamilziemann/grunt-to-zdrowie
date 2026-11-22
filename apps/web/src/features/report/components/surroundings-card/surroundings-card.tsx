import type { Surroundings } from '@app/contracts';
import { useFormatter, useTranslations } from 'use-intl';

/**
 * Karta "Otoczenie pola" przy szkicu: drzewa przy granicy, najblizszy las i rzad drzew, jaz/zapora/sluza, waly,
 * zrodlo, ujecie wody (sama odleglosc), miejsce, gdzie row wchodzi w rure, i polder. Wiersze bez obiektu w promieniu
 * (waly, zrodlo, ujecie, rura) znikaja; drzewa i budowle zawsze, bo "brak" tez jest informacja. Brak `surroundings`
 * = nic.
 */
export function SurroundingsCard({ surroundings }: { surroundings: Surroundings | undefined }) {
  const t = useTranslations('report.surroundings');
  const format = useFormatter();

  if (!surroundings) return null;
  const { trees, water } = surroundings;
  const meters = (value: number) => format.number(Math.round(value), { maximumFractionDigits: 0 });
  const distance = (value: number) => (value < 1 ? t('touching') : t('distance', { meters: meters(value) }));
  const radius = (value: number) =>
    value >= 1000
      ? t('radiusKm', { value: format.number(value / 1000, { maximumFractionDigits: 1 }) })
      : t('radiusM', { value: meters(value) });
  const orNone = (value: number | null, searchRadius: number) =>
    value === null ? t('none', { radius: radius(searchRadius) }) : distance(value);
  const structure = water.nearestStructure;
  const rows: { key: string; label: string; value: string }[] = [
    {
      key: 'trees',
      label: t('trees'),
      value: [
        t('treesValue', { wooded: meters(trees.woodedEdgeM), edge: meters(trees.edgeM) }),
        ...(trees.openToWind ? [t('openToWind')] : []),
      ].join(' – '),
    },
    { key: 'forest', label: t('forest'), value: orNone(trees.nearestForestM, trees.searchRadiusM) },
    { key: 'treeRow', label: t('treeRow'), value: orNone(trees.nearestTreeRowM, trees.searchRadiusM) },
    {
      key: 'structure',
      label: t('structure'),
      value: !structure
        ? t('none', { radius: radius(water.searchRadiusM) })
        : structure.name
          ? t('structureNamedValue', {
              kind: t(`structureKinds.${structure.kind}`),
              name: structure.name,
              distance: distance(structure.distanceM),
            })
          : t('structureValue', {
              kind: t(`structureKinds.${structure.kind}`),
              distance: distance(structure.distanceM),
            }),
    },
  ];

  if (water.levees > 0 && water.nearestLeveeM !== null) {
    rows.push({
      key: 'levees',
      label: t('levees'),
      value: t('leveesValue', {
        distance: distance(water.nearestLeveeM),
        count: water.levees,
        radius: radius(water.searchRadiusM),
      }),
    });
  }

  if (water.nearestSpring) {
    rows.push({
      key: 'spring',
      label: t('spring'),
      value: water.nearestSpring.name
        ? t('springNamed', {
            name: water.nearestSpring.name,
            distance: distance(water.nearestSpring.distanceM),
          })
        : distance(water.nearestSpring.distanceM),
    });
  }

  if (water.nearestIntakeM !== null) {
    rows.push({ key: 'intake', label: t('intake'), value: distance(water.nearestIntakeM) });
  }

  if (water.pipedJunction) {
    rows.push({
      key: 'junction',
      label: t('junction'),
      value: t('junctionValue', { distance: distance(water.pipedJunction.distanceM) }),
    });
  }

  return (
    <section
      aria-labelledby="otoczenie-pola"
      className="flex flex-col gap-3 rounded-lg border bg-card p-4 print:break-inside-avoid"
      data-testid="surroundings-card"
    >
      <h3 id="otoczenie-pola" className="text-lg font-semibold">
        {t('title')}
      </h3>
      <p className="text-sm text-muted-foreground">{t('intro')}</p>
      <dl className="grid gap-x-4 gap-y-2 text-base sm:grid-cols-[minmax(0,17rem)_1fr]">
        {rows.map((row) => (
          <div key={row.key} className="contents" data-row={row.key}>
            <dt className="font-medium">{row.label}</dt>
            <dd className="-mt-1.5 text-foreground sm:mt-0">{row.value}</dd>
          </div>
        ))}
      </dl>
      {surroundings.drainedLowland && (
        <p className="text-base" data-row="lowland">
          {t('lowland')}
        </p>
      )}
      <p className="text-sm text-muted-foreground">{t('source')}</p>
    </section>
  );
}
