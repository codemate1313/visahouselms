/**
 * The single owner of `body { overflow }`.
 *
 * Six places used to lock body scroll by hand - the mobile sidebar, the shared
 * Modal, two dashboard panels, the marketing auth overlay and the module editor
 * - and each restored it differently. Some wrote back `""`, others wrote back
 * whatever they happened to read on the way in.
 *
 * That second kind is the trap. Open a modal while the mobile drawer already
 * has the body locked and the modal reads "hidden" as the value to restore; when
 * it closes it faithfully puts "hidden" back, and from that moment nothing on
 * any screen scrolls again until the page is reloaded. Nothing looks broken,
 * which is what makes it hard to place.
 *
 * Counting fixes it: overlapping locks nest, and the body is only released when
 * the last holder lets go. Each caller gets a release function that is safe to
 * call more than once, since React runs effect cleanups more than once.
 */

let holders = 0;
let restoreTo = "";

export function lockBodyScroll(): () => void {
  if (holders === 0) {
    restoreTo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  holders += 1;

  let released = false;
  return function release() {
    if (released) return;
    released = true;
    holders = Math.max(0, holders - 1);
    if (holders === 0) {
      document.body.style.overflow = restoreTo;
    }
  };
}
