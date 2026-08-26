import { useEffect } from "react";

/**
 * Holds the document on the light theme for the duration of a print job.
 *
 * Everything the app prints - invoices, receipts, vouchers, purchase history -
 * is a paper document, and every one of those print stylesheets is written for
 * ink on white. Under the dark theme they lose: the global dark overrides in
 * `06-admin-modules-and-billing.css` are `[data-theme="dark"] ...` declarations
 * marked `!important` (`.dashboard` alone forces `background: #0d0e12` and
 * `color: #f3f4f6`), which outrank the `@media print` rules on plain classes.
 * The result is a black sheet with white-on-white text - see the invoice page.
 *
 * Same fix as `useExamLightTheme`: rather than trying to out-specify that
 * blanket, turn the attribute off so none of those selectors match. Chrome,
 * Edge, Firefox and Safari all fire `beforeprint`/`afterprint` before laying
 * out the preview, and the `print` media query is watched as well for engines
 * that only surface the change that way (older WebKit).
 *
 * The user's preference is untouched: the attribute is read out of the DOM at
 * print time and written back when the job ends, and nothing writes to the
 * theme store.
 *
 * Mount once, at the app root, alongside `useApplyTheme`.
 */
export function usePrintLightTheme() {
  useEffect(() => {
    const html = document.documentElement;
    const { body } = document;

    let previousHtmlTheme: string | null = null;
    let previousBodyTheme: string | null = null;
    let previousColorScheme = "";
    let printing = false;

    const toLight = () => {
      if (printing) return;
      printing = true;
      previousHtmlTheme = html.getAttribute("data-theme");
      previousBodyTheme = body.getAttribute("data-theme");
      previousColorScheme = html.style.colorScheme;

      html.setAttribute("data-theme", "light");
      body.setAttribute("data-theme", "light");
      /* Without this the UA still paints form controls and scrollbar-adjacent
         chrome from the dark scheme on the printed sheet. */
      html.style.colorScheme = "light";
    };

    const restore = () => {
      if (!printing) return;
      printing = false;
      if (previousHtmlTheme === null) html.removeAttribute("data-theme");
      else html.setAttribute("data-theme", previousHtmlTheme);
      if (previousBodyTheme === null) body.removeAttribute("data-theme");
      else body.setAttribute("data-theme", previousBodyTheme);
      html.style.colorScheme = previousColorScheme;
    };

    window.addEventListener("beforeprint", toLight);
    window.addEventListener("afterprint", restore);

    const media = window.matchMedia?.("print");
    const onMediaChange = (event: MediaQueryListEvent) => (event.matches ? toLight() : restore());
    media?.addEventListener?.("change", onMediaChange);

    return () => {
      window.removeEventListener("beforeprint", toLight);
      window.removeEventListener("afterprint", restore);
      media?.removeEventListener?.("change", onMediaChange);
      restore();
    };
  }, []);
}
