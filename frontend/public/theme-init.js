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

    var iconUrl = theme === "dark" ? "/brand/vh-mark-dark-96.png" : "/brand/vh-mark-96.png";
    var favicon = document.getElementById("app-favicon-default");
    if (favicon) favicon.setAttribute("href", iconUrl);
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "light");
  }
})();
