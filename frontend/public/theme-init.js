(function () {
  try {
    var saved = window.localStorage.getItem("vh-theme");
    var theme =
      saved === "light" || saved === "dark"
        ? saved
        : window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
    // The favicon is intentionally theme-independent — see index.html.
  } catch {
    document.documentElement.setAttribute("data-theme", "light");
  }
})();
