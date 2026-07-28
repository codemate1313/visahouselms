import type { SelectOption } from "@/components/ui";

/**
 * Helpers for turning a domain's `{ value: label }` map into the option list
 * `SearchableSelect` expects.
 *
 * Filters across the app were each rebuilding these arrays by hand, which is
 * how the same enum ended up spelled slightly differently on different screens.
 * Defining the map once and deriving the options keeps value and label in sync.
 */

/** The empty-string value every "All …" filter entry uses to mean "no filter". */
export const ANY_VALUE = "" as const;

/** Placeholder rendered where a record has no value for a column. */
export const EMPTY_PLACEHOLDER = "-" as const;

/**
 * Builds options from a label map, preserving the map's key order.
 *
 * @param labels  key -> human label
 * @param allLabel  when given, prepends an "All …" entry carrying `ANY_VALUE`
 */
export function toOptions<K extends string>(
  labels: Readonly<Record<K, string>>,
  allLabel?: string,
): SelectOption[] {
  const options: SelectOption[] = (Object.keys(labels) as K[]).map((value) => ({
    value,
    label: labels[value],
  }));

  return allLabel === undefined ? options : [{ value: ANY_VALUE, label: allLabel }, ...options];
}

/**
 * Builds options from records loaded at runtime (institutes, plans, courses …).
 * The `all` entry is optional for the same reason as above.
 */
export function toEntityOptions<T>(
  items: readonly T[],
  getValue: (item: T) => string | number,
  getLabel: (item: T) => string,
  allLabel?: string,
): SelectOption[] {
  const options: SelectOption[] = items.map((item) => ({
    value: getValue(item),
    label: getLabel(item),
  }));

  return allLabel === undefined ? options : [{ value: ANY_VALUE, label: allLabel }, ...options];
}
