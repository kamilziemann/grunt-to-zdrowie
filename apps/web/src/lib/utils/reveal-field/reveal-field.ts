// Pokazanie pola z bledem po wyslaniu formularza: przewiniecie do niego (takze w panelu z wlasnym przewijaniem) i fokus.

export interface RevealFieldOptions {
  /** gdzie ma stanac pole: `start` = u gory (dlugie grupy), `center` = na srodku (pojedyncze pole) */
  block?: ScrollLogicalPosition;
}

/**
 * Przewija `area` do widoku i daje fokus `focusTarget` bez drugiego przewiniecia. Sam fokus przewija przegladarka
 * "do krawedzi", a tam pole chowa sie pod przyklejonym przyciskiem albo naglowkiem - dlatego przewijamy jawnie,
 * z marginesem z CSS (`scroll-margin`). Przy `prefers-reduced-motion` bez plynnej animacji.
 */
export function revealField(
  area: HTMLElement,
  focusTarget: HTMLElement | null,
  { block = 'start' }: RevealFieldOptions = {},
): void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  area.scrollIntoView({ block, behavior: reduced ? 'auto' : 'smooth' });
  focusTarget?.focus({ preventScroll: true });
}
