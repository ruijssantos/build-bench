/** "Tamiya 74540 HG Trigger" → "74540" — a short label for tight spaces (the
 * phone header pill, the dry-tip panel title). Falls back to the full model
 * name if it doesn't contain a model-number-shaped token. */
export function shortRigLabel(model: string): string {
  return model.match(/\b\d{3,6}\b/)?.[0] ?? model;
}
