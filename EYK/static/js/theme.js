(function () {
  function applyTheme(theme) {
    if (theme === 'auto') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }

  function currentTheme() {
    return localStorage.getItem('eyk-theme') || 'auto';
  }

  function nextTheme(theme) {
    if (theme === 'auto') return 'dark';
    if (theme === 'dark') return 'light';
    return 'auto';
  }

  document.addEventListener('DOMContentLoaded', function () {
    var toggle = document.getElementById('theme-toggle');
    if (!toggle) return;
    toggle.addEventListener('click', function () {
      var theme = nextTheme(currentTheme());
      localStorage.setItem('eyk-theme', theme);
      applyTheme(theme);
      toggle.setAttribute('aria-label', 'Tema: ' + theme + '. Clica para mudar.');
    });
  });
})();
