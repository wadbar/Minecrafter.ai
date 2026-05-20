import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function withExponentialBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let retries = 0;
  while (true) {
    try {
      return await operation();
    } catch (error: any) {
      if (retries >= maxRetries) {
        throw error;
      }
      const delay = baseDelay * Math.pow(2, retries);
      console.warn(`[RETRY] Operation failed. Retrying in ${delay}ms... (Attempt ${retries + 1}/${maxRetries})`);
      await sleep(delay);
      retries++;
    }
  }
}
