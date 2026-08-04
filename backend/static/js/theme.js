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

  function getCookie(name) {
    var match = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
    return match ? decodeURIComponent(match[2]) : '';
  }

  document.addEventListener('DOMContentLoaded', function () {
    var toggle = document.getElementById('theme-toggle');
    if (!toggle) return;
    toggle.addEventListener('click', function () {
      var theme = nextTheme(currentTheme());
      localStorage.setItem('eyk-theme', theme);
      applyTheme(theme);
      toggle.setAttribute('aria-label', 'Tema: ' + theme + '. Clica para mudar.');

      var saveUrl = toggle.dataset.saveUrl;
      var temaServidor = theme === 'dark' ? 'escuro' : (theme === 'light' ? 'claro' : 'auto');
      if (saveUrl) {
        var body = new URLSearchParams();
        body.append('tema', temaServidor);
        fetch(saveUrl, { method: 'POST', headers: { 'X-CSRFToken': getCookie('csrftoken') }, body: body });
      }
    });
  });
})();
