/** Naglowek sekcji strony glownej (ta sama skala wszedzie). */
export function SectionTitle({ id, children }: { id: string; children: string }) {
  return (
    <h2 id={id} className="text-3xl font-medium tracking-tight md:text-4xl">
      {children}
    </h2>
  );
}
