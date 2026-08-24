/** "18–22 psi" → { value: "18–22", unit: "psi" } for the split phone/desktop spec tiles. */
export function splitValueUnit(text: string): { value: string; unit: string } {
  const m = text.match(/^(.*)\s+(\S+)$/);
  if (!m) return { value: text, unit: "" };
  return { value: m[1], unit: m[2] };
}

/** Break a sentence at its first comma, for the two-line desktop spec tile. */
export function splitAtComma(text: string): string[] {
  const i = text.indexOf(",");
  if (i === -1) return [text];
  return [text.slice(0, i).trim(), text.slice(i + 1).trim()];
}

const THINNER_TYPE_LABEL: Record<string, string> = {
  acrylic_retarder: "Acrylic, retarder",
  lacquer_retarder: "Lacquer, retarder",
  enamel_x20: "Enamel, X-20",
};

export function thinnerTypeLabel(thinnerType: string | null): string {
  if (!thinnerType) return "—";
  return THINNER_TYPE_LABEL[thinnerType] ?? thinnerType;
}
