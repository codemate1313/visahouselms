import "./RequiredMark.css";

/**
 * Red asterisk appended to labels of mandatory form fields. Decorative only —
 * the actual requiredness must still be conveyed via the input's `required`
 * attribute, which browsers and assistive tech already announce.
 */
export function RequiredMark() {
  return (
    <span className="ui-required-mark" aria-hidden="true">
      {" "}
      *
    </span>
  );
}
