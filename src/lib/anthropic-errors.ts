import Anthropic from "@anthropic-ai/sdk";

/**
 * What went wrong on a call to Claude, said plainly — docs/PLAN.md §5.2, §7.
 *
 * `/api/kits/resolve` and `/api/kits/extract` are the app's only paid calls,
 * and both used to end in the same three-branch chain: a key problem, a rate
 * limit, and one generic "hit a problem" for everything else. That generic
 * branch swallowed the failure the owner of this app is most likely to
 * actually meet — **running out of Anthropic credit** — and reported it in the
 * same words as a transient blip, with nothing in the logs either way.
 *
 * The API's own error taxonomy tells these apart precisely, so this does too:
 *
 *   401 `authentication_error`  the key is malformed, revoked or expired
 *   402 `billing_error`         out of credit, or a payment method problem
 *   403 `permission_error`      the key can't use this model or workspace
 *   400 `invalid_request_error` also what a *self-imposed* spend limit returns
 *   429 `rate_limit_error`      a real rate limit — or the usage tier's
 *                               monthly spend cap, which does not clear on its
 *                               own (and, unlike a rate limit, sends no
 *                               `retry-after`)
 *   5xx / 529                   Anthropic's problem, retryable
 *
 * Note 402 gets no dedicated class in the TypeScript SDK the way 401/403/429
 * do — it lands on the base `APIError` — so it is matched on `status`. That is
 * exactly why it needs a branch here: left to `instanceof Anthropic.APIError`,
 * an empty balance is indistinguishable from a 500.
 *
 * Messages name environment variables and the Console, for the same reason
 * `describeBlobError` does (§1.1, `src/lib/box-art.ts`): this app has one
 * user, who owns the Anthropic account it bills to. None of them echo the key
 * — only whether it was accepted.
 */

/** The SDK retries 408/409/429/5xx and connection failures twice by default,
 * so anything reaching these branches has already been retried. Worth saying
 * in the copy: "try again in a moment" is advice, not a formality. */
export function describeAnthropicError(error: unknown, feature: string): string {
  // Before `APIError`: in this SDK `APIConnectionError` extends it, and it
  // carries no status, so the status checks below would all miss it.
  if (error instanceof Anthropic.APIConnectionError) {
    return `${feature} couldn't reach Anthropic — check the connection and try again.`;
  }

  if (error instanceof Anthropic.AuthenticationError) {
    return `${feature} was refused: Anthropic rejected the API key. It may have been revoked or rotated — set a current ANTHROPIC_API_KEY in Vercel → Settings → Environment Variables, then redeploy.`;
  }

  if (error instanceof Anthropic.APIError && error.status === 402) {
    return `${feature} is out of Anthropic credit — the API refused the call for billing. Top up at console.anthropic.com → Billing (or fix the payment method there), then try again.`;
  }

  if (error instanceof Anthropic.PermissionDeniedError) {
    return `${feature} isn't allowed to use that model on this API key — check the key's workspace and model access in the Anthropic Console.`;
  }

  if (error instanceof Anthropic.RateLimitError) {
    // A plain rate limit says when to come back; the monthly spend cap sends
    // no `retry-after` and keeps failing until the cap lifts or is raised.
    // Telling the person to "try again in a moment" in that second case is
    // advice that can only waste their afternoon.
    const retryAfter = error.headers?.get("retry-after");
    return retryAfter
      ? `${feature} is rate-limited right now — try again in about ${retryAfter}s.`
      : `${feature} was rate-limited with no retry window, which usually means the account has hit its monthly spend cap rather than a per-minute limit. Check usage and limits in the Anthropic Console.`;
  }

  if (error instanceof Anthropic.BadRequestError) {
    // A spend limit set on the organisation or workspace arrives here rather
    // than as a 402, and only its message says so — hence passing it through.
    return `${feature} was rejected by Anthropic: ${truncate(error.message)}`;
  }

  if (error instanceof Anthropic.InternalServerError) {
    return `Anthropic is having trouble right now (HTTP ${error.status}) — ${lower(feature)} should work again shortly.`;
  }

  if (error instanceof Anthropic.APIError) {
    return `${feature} hit an Anthropic API error${error.status ? ` (HTTP ${error.status})` : ""} — try again.`;
  }

  return `${feature} hit a problem — try again.`;
}

/**
 * One structured line per failure, in the function logs.
 *
 * Neither paid route logged anything at all before this: an empty balance, a
 * revoked key and a network blip all produced the same sentence on screen and
 * silence in Vercel's logs, which is the position §7 records the box-art work
 * getting stuck in twice. The request ID is what an Anthropic support ticket
 * needs, and it is only ever on the error object.
 */
export function logAnthropicError(scope: string, error: unknown): void {
  if (error instanceof Anthropic.APIError) {
    console.error(
      `[${scope}] anthropic ${error.constructor.name} status=${error.status ?? "none"} type=${error.type ?? "none"} request=${error.requestID ?? "none"}: ${truncate(error.message)}`,
    );
    return;
  }
  console.error(
    `[${scope}] anthropic call threw:`,
    error instanceof Error ? `${error.constructor.name}: ${error.message}` : String(error),
  );
}

/**
 * Did a web search or web fetch fail inside an otherwise-successful response?
 *
 * Server-tool errors never throw: they arrive as HTTP 200 with an error object
 * where a result list belongs (docs/PLAN.md §5.2). Both paid research routes
 * use this to pick between "the search broke" and "the model answered oddly",
 * which are different things to tell someone.
 *
 * Recursive, and that is the whole point. Both routes originally scanned only
 * the top level of `response.content`, which was correct against the documented
 * shape and wrong in practice: `web_search_20260209` and `web_fetch_20260209`
 * default to running inside code execution ("dynamic filtering"), and their
 * result blocks then nest inside a code execution result where a top-level
 * scan never finds them. `/api/kits/research/investigate` hit that hard enough
 * to lose two paid runs (§7); the same dead check sat unnoticed in
 * `/api/kits/resolve`, whose flag simply never fired. Walking for the error
 * shape works under either setting, so neither route has to care which one it
 * is using.
 */
export function webToolErrored(value: unknown, depth = 0): boolean {
  if (depth > 6 || value === null || typeof value !== "object") return false;

  if (Array.isArray(value)) {
    return value.some((entry) => webToolErrored(entry, depth + 1));
  }

  const record = value as Record<string, unknown>;
  // The error object itself: `{ type: "web_search_tool_result_error",
  // error_code: "max_uses_exceeded" }` and its web-fetch twin. Matched on
  // `error_code` rather than on the exact `type` string, so a third web tool
  // with the same shape is covered without another edit here.
  if (typeof record.error_code === "string") return true;

  return Object.values(record).some((entry) => webToolErrored(entry, depth + 1));
}

function truncate(message: string): string {
  return message.length > 300 ? `${message.slice(0, 300)}…` : message;
}

/** "Kit search" → "kit search", for use mid-sentence. */
function lower(feature: string): string {
  return feature.charAt(0).toLowerCase() + feature.slice(1);
}
