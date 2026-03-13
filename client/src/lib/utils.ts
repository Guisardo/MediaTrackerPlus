import clsx, { type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines multiple class name values using clsx and deduplicates
 * conflicting Tailwind CSS classes using tailwind-merge.
 *
 * @param inputs - One or more class name values (strings, arrays, objects, or falsy values)
 * @returns A single merged class name string
 *
 * @example
 * cn('px-4 py-2', condition && 'bg-blue-500', 'px-6')
 * // => 'py-2 bg-blue-500 px-6' (px-6 wins over px-4)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
