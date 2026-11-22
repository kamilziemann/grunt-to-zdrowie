import { cn } from '@/lib/utils/cn';

/**
 * Znak aplikacji: kropla z kielkiem w mietowym kole (karta stylu). Ozdobny - nazwa aplikacji stoi obok jako tekst.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground',
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-[60%]"
      >
        <path d="M12 2.8c3.6 4.3 6.2 7.8 6.2 10.9a6.2 6.2 0 0 1-12.4 0c0-3.1 2.6-6.6 6.2-10.9z" />
        <path d="M12 19v-5" />
        <path d="M12 15c0-2.1 1.4-3.3 3.2-3.3 0 2-1.3 3.3-3.2 3.3z" />
      </svg>
    </span>
  );
}
