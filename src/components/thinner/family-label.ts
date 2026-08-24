import type { RatioFamily } from "@/domain/paint-code";

/** Short "line · finish" identity label — matches the prototype's FAMLABEL,
 * with sprayDecant shortened to match the design reference ("Lacquer · decanted"). */
const FAMILY_LABEL: Record<RatioFamily, string> = {
  gloss: "Acrylic · gloss",
  flat: "Acrylic · flat",
  semi: "Acrylic · semi-gloss",
  metallic: "Acrylic · metallic",
  clear: "Acrylic · clear",
  lacquer: "Lacquer · bottle",
  sprayDecant: "Lacquer · decanted",
  polycarb: "Lacquer · polycarbonate",
  enamel: "Enamel · bottle",
  primer: "Lacquer · primer",
  additive: "Additive",
};

export function familyLabel(family: string): string {
  return FAMILY_LABEL[family as RatioFamily] ?? family;
}
