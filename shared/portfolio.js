/* Theme toggle shared by every page. Dark is the default; the choice is
   remembered per browser under "pf-theme" when storage is available. */
(function () {
  var root = document.documentElement;
  try { var saved = localStorage.getItem("pf-theme"); if (saved === "light" || saved === "dark") root.setAttribute("data-theme", saved); } catch (e) {}
  function label(btn) {
    var dark = root.getAttribute("data-theme") !== "light";
    btn.textContent = dark ? "Light" : "Dark";
    btn.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
  }
  document.addEventListener("DOMContentLoaded", function () {
    var btn = document.querySelector(".pf-theme");
    if (!btn) return;
    label(btn);
    btn.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("pf-theme", next); } catch (e) {}
      label(btn);
    });
  });
})();
