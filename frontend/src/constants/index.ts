/*
 * App-wide static data.
 *
 * `domain.ts`  — the vocabulary of the product (statuses, sections,
 *                difficulties, attempt states) as value maps, labels and
 *                ready-made select options.
 * `options.ts` — helpers that derive `SelectOption[]` from those maps, plus
 *                the shared sentinels (`ANY_VALUE`, `EMPTY_PLACEHOLDER`).
 *
 * Import from `@/constants`. Page-specific wording stays in that page's
 * `*.strings.ts`; only genuinely shared vocabulary belongs here.
 */

export * from "./domain";
export * from "./options";
