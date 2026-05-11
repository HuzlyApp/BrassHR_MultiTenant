// lib/utils.ts

import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Combines class names safely
 * - removes falsy values
 * - merges Tailwind classes correctly (no conflicts)
 *
 * Example:
 * cn("p-2", "p-4") => "p-4"
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}