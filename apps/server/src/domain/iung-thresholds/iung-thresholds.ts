// Wartosci progowe klimatycznego bilansu wodnego (mm) oznaczajace susze dla grup upraw i kategorii gleb - zalacznik
// do rozporzadzenia MRiRW z 11 kwietnia 2019 r., w postaci publikowanej przez System Monitoringu Suszy Rolniczej
// IUNG-PIB: https://susza.iung.pulawy.pl/progi/ (odczyt i porownanie wszystkich 784 wartosci ze strona: 2026-11-21).
// Wartosci sa jednakowe dla wszystkich wojewodztw. Susza wystepuje, gdy KBW okresu jest NIZSZY od progu. Progi
// porownujemy z KBW = opad - ewapotranspiracja potencjalna, bez mnozenia przez Kc (to robi bilans strefy korzeniowej).
import type { IungCropGroup, SoilCategory } from '@app/contracts';

import { IUNG_PERIOD_COUNT } from '../iung-periods';

/** "x" w tabeli: w tym okresie uprawa nie traci plonu z powodu suszy, wiec nie jest oceniana. */
const X = 'not_assessed';
/** "-" w tabeli: uprawy nie prowadzi sie na tej kategorii gleby (burak cukrowy na glebach I kategorii). */
const NG = 'not_grown';

type Cell = number | typeof X | typeof NG;

/** [kategoria I, II, III, IV][okres 1-14] */
type Table = readonly [readonly Cell[], readonly Cell[], readonly Cell[], readonly Cell[]];

const THRESHOLDS: Readonly<Record<IungCropGroup, Table>> = {
  winter_cereals: [
    [-129, -132, -137, -145, -154, -165, -180, -199, -220, X, X, X, X, X],
    [-150, -153, -158, -166, -175, -186, -201, -220, -241, X, X, X, X, X],
    [-188, -191, -196, -204, -213, -224, -239, -258, -279, X, X, X, X, X],
    [-215, -218, -223, -231, -240, -251, -266, -285, -306, X, X, X, X, X],
  ],
  spring_cereals: [
    [-125, -127, -130, -135, -142, -153, -169, -186, -207, X, X, X, X, X],
    [-144, -146, -149, -154, -161, -172, -188, -205, -226, X, X, X, X, X],
    [-174, -176, -179, -184, -191, -202, -218, -235, -256, X, X, X, X, X],
    [-194, -196, -199, -204, -211, -222, -238, -255, -276, X, X, X, X, X],
  ],
  maize_grain: [
    [X, X, X, -168, -161, -156, -153, -152, -153, -154, -156, -158, -161, -164],
    [X, X, X, -200, -193, -188, -185, -184, -185, -186, -188, -190, -193, -196],
    [X, X, X, -236, -229, -224, -221, -220, -221, -222, -224, -226, -229, -232],
    [X, X, X, -271, -264, -259, -256, -255, -256, -257, -259, -261, -264, -267],
  ],
  maize_silage: [
    [X, X, X, -168, -161, -156, -153, -152, -152, -152, -153, -155, -157, -160],
    [X, X, X, -200, -193, -188, -185, -184, -184, -184, -185, -187, -189, -192],
    [X, X, X, -236, -229, -224, -221, -220, -220, -220, -221, -223, -225, -228],
    [X, X, X, -271, -264, -259, -256, -255, -255, -255, -256, -258, -260, -263],
  ],
  rapeseed: [
    [-207, -187, -170, -155, -142, -132, X, X, X, X, X, X, -138, -138],
    [-232, -211, -193, -177, -165, -155, X, X, X, X, X, X, -158, -158],
    [-275, -254, -236, -220, -208, -198, X, X, X, X, X, X, -205, -205],
    [-297, -276, -258, -242, -230, -220, X, X, X, X, X, X, -230, -230],
  ],
  potato: [
    [X, X, -238, -232, -226, -219, -210, -200, -189, -178, -168, -157, -147, X],
    [X, X, -257, -251, -245, -238, -229, -219, -208, -197, -187, -176, -166, X],
    [X, X, -286, -280, -274, -267, -258, -248, -237, -226, -216, -205, -195, X],
    [X, X, -306, -300, -294, -287, -278, -268, -257, -246, -236, -225, -215, X],
  ],
  sugar_beet: [
    [NG, NG, NG, NG, NG, NG, NG, NG, NG, NG, NG, NG, NG, NG],
    [-250, -248, -245, -241, -237, -232, -226, -220, -212, -202, -192, -182, -169, -155],
    [-277, -275, -272, -268, -264, -259, -253, -247, -239, -229, -219, -209, -196, -182],
    [-296, -294, -291, -287, -283, -278, -272, -266, -258, -248, -238, -228, -215, -201],
  ],
  hops: [
    [X, X, X, -230, -220, -212, -205, -199, -194, -190, -186, -182, X, X],
    [X, X, X, -248, -238, -230, -223, -217, -212, -208, -204, -200, X, X],
    [X, X, X, -285, -275, -267, -260, -254, -249, -245, -241, -237, X, X],
    [X, X, X, -302, -292, -284, -277, -271, -266, -262, -258, -254, X, X],
  ],
  tobacco: [
    [X, X, X, -189, -187, -186, -185, -186, -187, -190, -195, -200, X, X],
    [X, X, X, -201, -199, -198, -197, -198, -199, -202, -207, -212, X, X],
    [X, X, X, -227, -225, -224, -223, -224, -225, -228, -233, -238, X, X],
    [X, X, X, -240, -238, -237, -236, -237, -238, -241, -246, -251, X, X],
  ],
  field_vegetables: [
    [X, X, X, -189, -187, -185, -184, -184, -184, -185, -187, -188, X, X],
    [X, X, X, -207, -205, -203, -202, -202, -202, -203, -205, -206, X, X],
    [X, X, X, -243, -241, -239, -238, -238, -238, -239, -241, -242, X, X],
    [X, X, X, -263, -261, -259, -258, -258, -258, -259, -261, -262, X, X],
  ],
  berry_shrubs: [
    [-149, -148, -147, -147, -149, -154, -159, -162, -163, -162, -160, -157, X, X],
    [-166, -165, -164, -164, -166, -171, -176, -179, -180, -179, -177, -174, X, X],
    [-200, -199, -198, -198, -200, -205, -210, -213, -214, -213, -211, -208, X, X],
    [-217, -216, -215, -215, -217, -222, -227, -230, -231, -230, -228, -225, X, X],
  ],
  fruit_trees: [
    [-168, -171, -175, -180, -187, -193, -199, -205, -210, -215, -220, -223, X, X],
    [-190, -193, -197, -202, -209, -215, -221, -227, -232, -237, -242, -245, X, X],
    [-229, -232, -236, -241, -248, -254, -260, -266, -271, -276, -281, -284, X, X],
    [-249, -252, -256, -261, -268, -274, -280, -286, -291, -296, -301, -304, X, X],
  ],
  strawberry: [
    [-133, -137, -143, -152, -163, -178, -190, -198, -202, X, X, X, X, X],
    [-150, -154, -160, -169, -180, -195, -207, -215, -219, X, X, X, X, X],
    [-183, -187, -193, -202, -213, -228, -240, -248, -252, X, X, X, X, X],
    [-204, -208, -214, -223, -234, -249, -261, -269, -273, X, X, X, X, X],
  ],
  pulses: [
    [X, X, X, -161, -161, -163, -165, -166, -167, -168, -170, -172, -174, -176],
    [X, X, X, -182, -182, -184, -186, -187, -188, -189, -191, -193, -195, -197],
    [X, X, X, -213, -213, -215, -217, -218, -219, -220, -222, -224, -226, -228],
    [X, X, X, -234, -234, -236, -238, -239, -240, -241, -243, -245, -247, -249],
  ],
};

export type IungThreshold =
  | { kind: 'threshold'; thresholdMm: number }
  | { kind: 'not_assessed' }
  | { kind: 'not_grown' };

/** Prog suszy dla grupy upraw, kategorii gleby i numeru okresu (1-14). */
export function iungThreshold(group: IungCropGroup, category: SoilCategory, periodNo: number): IungThreshold {
  if (!Number.isInteger(periodNo) || periodNo < 1 || periodNo > IUNG_PERIOD_COUNT) {
    throw new RangeError(`IUNG period out of range: ${periodNo}`);
  }

  const cell = THRESHOLDS[group][category - 1]?.[periodNo - 1];

  if (cell === undefined || cell === X) return { kind: 'not_assessed' };

  if (cell === NG) return { kind: 'not_grown' };

  return { kind: 'threshold', thresholdMm: cell };
}

/** Prog w mm albo null, gdy uprawa nie jest oceniana w tym okresie albo nie rosnie na tej glebie. */
export function iungThresholdMm(
  group: IungCropGroup,
  category: SoilCategory,
  periodNo: number,
): number | null {
  const found = iungThreshold(group, category, periodNo);

  return found.kind === 'threshold' ? found.thresholdMm : null;
}
