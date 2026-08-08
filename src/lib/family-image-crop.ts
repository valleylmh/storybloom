export type FamilyImageCrop = {
  x: number;
  y: number;
  zoom: number;
};

export const DEFAULT_FAMILY_IMAGE_CROP: FamilyImageCrop = {
  x: 50,
  y: 50,
  zoom: 1,
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function normalizeFamilyImageCrop(value: unknown): FamilyImageCrop {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_FAMILY_IMAGE_CROP };
  }

  const candidate = value as Partial<FamilyImageCrop>;
  const x = Number(candidate.x);
  const y = Number(candidate.y);
  const zoom = Number(candidate.zoom);
  return {
    x: Number.isFinite(x) ? clamp(x, 0, 100) : DEFAULT_FAMILY_IMAGE_CROP.x,
    y: Number.isFinite(y) ? clamp(y, 0, 100) : DEFAULT_FAMILY_IMAGE_CROP.y,
    zoom: Number.isFinite(zoom)
      ? clamp(zoom, 1, 2)
      : DEFAULT_FAMILY_IMAGE_CROP.zoom,
  };
}
