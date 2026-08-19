import type { ImageProvider } from "@/types";

const FREE_REGENERATION_FALLBACK_PROVIDERS = [
  "agnes",
] as const satisfies readonly ImageProvider[];

export function getFreeRegenerationFallbackProviders(): ImageProvider[] {
  return [...FREE_REGENERATION_FALLBACK_PROVIDERS];
}
