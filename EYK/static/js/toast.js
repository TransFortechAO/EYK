(function () {
  function ensureContainer() {
    var el = document.getElementById('toast-container');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast-container';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    return el;
  }

  var ICONS = {
    success: 'fa-circle-check',
    error: 'fa-circle-exclamation',
    warning: 'fa-triangle-exclamation',
    info: 'fa-circle-info'
  };

  window.showToast = function (message, type) {
    type = type || 'info';
    var container = ensureContainer();
    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.innerHTML = '<i class="fas ' + (ICONS[type] || ICONS.info) + '"></i><span></span>';
    toast.querySelector('span').textContent = message;
    container.appendChild(toast);

    var timer = setTimeout(remove, 5000);
    toast.addEventListener('click', remove);

    function remove() {
      clearTimeout(timer);
      toast.classList.add('toast-leaving');
      toast.addEventListener('animationend', function () { toast.remove(); }, { once: true });
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    var list = document.getElementById('django-messages');
    if (!list) return;
    var typeMap = { success: 'success', error: 'error', warning: 'warning', info: 'info', debug: 'info' };
    list.querySelectorAll('li[data-tag]').forEach(function (li) {
      window.showToast(li.textContent.trim(), typeMap[li.dataset.tag] || 'info');
    });
    list.remove();
  });
})();
