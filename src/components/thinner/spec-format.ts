const THINNER_TYPE_LABEL: Record<string, string> = {
  acrylic_retarder: "Acrylic, retarder",
  lacquer_retarder: "Lacquer, retarder",
  enamel_x20: "Enamel, X-20",
};

export function thinnerTypeLabel(thinnerType: string | null): string {
  if (!thinnerType) return "—";
  return THINNER_TYPE_LABEL[thinnerType] ?? thinnerType;
}
