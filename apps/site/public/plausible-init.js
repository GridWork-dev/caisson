// Plausible queue stub (externalized from an inline <script> to tighten script-src). Lets
// window.plausible(...) calls that fire before script.js loads enqueue instead of no-op.
window.plausible =
  window.plausible ||
  function () {
    (window.plausible.q = window.plausible.q || []).push(arguments);
  };
