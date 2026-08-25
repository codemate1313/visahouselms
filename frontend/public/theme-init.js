(function () {
  var lightBackgroundMark = "/brand/vh-mark-96.png";
  var darkBackgroundMark = "/brand/vh-mark-dark-96.png";

  function setFavicon(href) {
    var link = document.getElementById("app-favicon");
    if (!link) {
      link = document.createElement("link");
      link.id = "app-favicon";
      link.rel = "icon";
      link.type = "image/png";
      document.head.appendChild(link);
    }
    if (link.getAttribute("href") !== href) {
      link.setAttribute("href", href);
    }
  }

  function syncFavicon() {
    var darkBrowserChrome =
      window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    setFavicon(darkBrowserChrome ? darkBackgroundMark : lightBackgroundMark);
  }

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
    syncFavicon();
    var media = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
    if (media) {
      if (media.addEventListener) {
        media.addEventListener("change", syncFavicon);
      } else if (media.addListener) {
        media.addListener(syncFavicon);
      }
    }
  } catch {
    document.documentElement.setAttribute("data-theme", "light");
    setFavicon(lightBackgroundMark);
  }
})();
