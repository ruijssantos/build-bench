import { PDFDocument } from "pdf-lib";

/**
 * Trims a PDF to its first N pages, server-side — docs/PLAN.md §4.3, §7.
 *
 * The Messages API has no page-range parameter: it reads the whole document or
 * nothing, converting **every** page to an image and extracting its text
 * alongside. So the only way to read five pages of a twenty-four page manual is
 * to hand it a five-page manual, which is what this makes.
 *
 * `pdf-lib` is pure JavaScript with no native dependencies, which is what makes
 * it usable in a serverless function at all.
 */

export interface TrimmedPdf {
  /** The bytes to send — the original when it was already short enough. */
  bytes: Uint8Array;
  /** How many pages the original had. Stored on the row so the UI can say
   * "read the first 5 of 24" rather than leaving the cap invisible. */
  totalPages: number;
  /** How many pages are actually in `bytes`. */
  sentPages: number;
}

/**
 * Returns the first `maxPages` pages, or `null` when the file can't be read as
 * a PDF at all.
 *
 * `null` is a real answer rather than an error: a corrupt or password-protected
 * upload should fail with something a person can act on, not a stack trace from
 * inside a parser. The caller turns it into a sentence.
 *
 * A PDF already at or under the limit comes back **byte-identical** — not
 * re-encoded through `save()`. Re-serialising is not free and, more to the
 * point, it is a chance to subtly change a document that was fine as it was.
 */
export async function firstPages(source: Uint8Array, maxPages: number): Promise<TrimmedPdf | null> {
  let document: PDFDocument;
  try {
    // `ignoreEncryption` so an encrypted-but-readable manual — publishers
    // sometimes set permissions flags on an otherwise open PDF — gets read
    // rather than refused. A genuinely password-protected file still throws
    // and lands in the null branch below.
    document = await PDFDocument.load(source, { ignoreEncryption: true });
  } catch {
    return null;
  }

  const totalPages = document.getPageCount();
  if (totalPages === 0) return null;
  if (totalPages <= maxPages) {
    return { bytes: source, totalPages, sentPages: totalPages };
  }

  try {
    const trimmed = await PDFDocument.create();
    const pages = await trimmed.copyPages(
      document,
      Array.from({ length: maxPages }, (_, i) => i),
    );
    for (const page of pages) trimmed.addPage(page);
    return { bytes: await trimmed.save(), totalPages, sentPages: maxPages };
  } catch {
    // Copying can fail on a structurally odd document even when loading
    // didn't. Falling back to the whole file is the right failure: it costs
    // more than the caller wanted to spend, but it extracts, and the caller
    // is told what it sent.
    return { bytes: source, totalPages, sentPages: totalPages };
  }
}
