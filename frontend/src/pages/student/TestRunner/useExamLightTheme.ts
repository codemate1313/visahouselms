import { useEffect } from "react";

/**
 * Holds the document on the light theme while a Final Test is on screen.
 *
 * The exam skin is a reproduction of the LanguageCert delivery client, which
 * has one surface and no dark mode. Restyling around the app's dark theme was
 * never going to hold: the runner's dark rules live in
 * `06-admin-modules-and-billing.css` as `[data-theme="dark"] .test-runner-*`
 * declarations marked `!important`, so no amount of scoped CSS in the skin
 * outranks them. Turning the attribute off is the fix - with `data-theme` set
 * to light, none of those selectors match in the first place, and the skin's
 * own palette is the only one in play.
 *
 * The user's own preference is untouched: it is read back out of the DOM on
 * mount and written back on unmount, so leaving the exam restores whatever
 * they were on. Nothing writes to the theme store, so a refresh mid-attempt
 * still comes back to the exam in light and to the rest of the app in dark.
 */
export function useExamLightTheme(active: boolean) {
  useEffect(() => {
    if (!active) return;

    const html = document.documentElement;
    const { body } = document;
    const previousHtmlTheme = html.getAttribute("data-theme");
    const previousBodyTheme = body.getAttribute("data-theme");
    const previousColorScheme = html.style.colorScheme;

    /* Guarded so the observer below cannot drive itself: once the attributes
       read light, a further mutation record changes nothing. */
    const pin = () => {
      if (html.getAttribute("data-theme") !== "light") html.setAttribute("data-theme", "light");
      if (body.getAttribute("data-theme") !== "light") body.setAttribute("data-theme", "light");
      if (html.style.colorScheme !== "light") html.style.colorScheme = "light";
    };
    pin();

    /* `useApplyTheme` rewrites the attribute whenever the store changes, and
       the store follows the OS - so an operating system that flips to dark
       part way through the exam would otherwise darken the paper mid-answer.
       Re-pinning on mutation covers that without either hook knowing about
       the other. */
    const observer = new MutationObserver(pin);
    observer.observe(html, { attributes: true, attributeFilter: ["data-theme", "style"] });
    observer.observe(body, { attributes: true, attributeFilter: ["data-theme"] });

    return () => {
      observer.disconnect();
      if (previousHtmlTheme === null) html.removeAttribute("data-theme");
      else html.setAttribute("data-theme", previousHtmlTheme);
      if (previousBodyTheme === null) body.removeAttribute("data-theme");
      else body.setAttribute("data-theme", previousBodyTheme);
      html.style.colorScheme = previousColorScheme;
    };
  }, [active]);
}
