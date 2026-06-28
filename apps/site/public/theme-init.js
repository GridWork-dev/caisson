// Externalized no-flash theme set (was an inline <script> in the root layout). Served from /public
// as a same-origin file so the CSP can drop 'unsafe-inline' from script-src for THIS script — runs
// before paint to honor a previously-chosen light theme without a flash. Loaded blocking in <head>.
// `cs-js` gates the scroll-reveal so content is never stuck hidden without JS (progressive
// enhancement): no class → .cs-reveal renders fully visible.
document.documentElement.classList.add("cs-js");
try {
  var t = localStorage.getItem("cs-theme");
  if (t) document.documentElement.setAttribute("data-theme", t);
} catch {
  /* storage blocked — keep the default dark theme */
}
