import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Laczy klasy Tailwind bez konfliktow (clsx + tailwind-merge) - jak w shadcn/ui. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
