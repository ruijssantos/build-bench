/**
 * The one shape every server action and API route answers with, and the shape
 * the client reads back: docs/PLAN.md §7's rule that a failure always carries
 * a reason the UI can show, never a bare `null` or `false`.
 *
 * `Data` is what a success adds (`Result<{ url: string }>`); `Failure` is what
 * a failure can add beyond its message (`KitResult`'s `promotable`).
 */
export type Result<Data extends object = object, Failure extends object = object> =
  | ({ ok: true } & Data)
  | ({ ok: false; error: string } & Failure);
