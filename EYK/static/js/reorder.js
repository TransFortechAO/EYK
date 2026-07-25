function initReorder(opts) {
    var grid = document.getElementById(opts.gridId);
    if (!grid) return;

    function getCookie(name) {
        var match = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
        return match ? decodeURIComponent(match[2]) : '';
    }

    var dragging = null;

    grid.querySelectorAll(opts.itemSelector).forEach(function (item) {
        item.addEventListener('dragstart', function () {
            dragging = item;
            item.classList.add('dragging');
        });
        item.addEventListener('dragend', function () {
            item.classList.remove('dragging');
            dragging = null;
            saveOrder();
        });
    });

    grid.addEventListener('dragover', function (e) {
        e.preventDefault();
        var after = getItemAfter(e.clientY, e.clientX);
        if (!dragging) return;
        if (after == null) {
            grid.appendChild(dragging);
        } else {
            grid.insertBefore(dragging, after);
        }
    });

    function getItemAfter(y, x) {
        var items = Array.prototype.slice.call(grid.querySelectorAll(opts.itemSelector + ':not(.dragging)'));
        var closest = { offset: Number.NEGATIVE_INFINITY, element: null };
        items.forEach(function (child) {
            var box = child.getBoundingClientRect();
            var offsetY = y - box.top - box.height / 2;
            if (Math.abs(offsetY) < 40) {
                var offsetX = x - box.left - box.width / 2;
                if (offsetX < 0 && offsetX > closest.offset) {
                    closest = { offset: offsetX, element: child };
                }
            }
        });
        return closest.element;
    }

    function saveOrder() {
        var ids = Array.prototype.map.call(grid.querySelectorAll(opts.itemSelector), function (el) {
            return el.dataset[opts.idAttr];
        });
        var body = new URLSearchParams();
        ids.forEach(function (id) { body.append(opts.fieldName, id); });

        fetch(opts.url, {
            method: 'POST',
            headers: { 'X-CSRFToken': getCookie('csrftoken') },
            body: body,
        }).then(function (r) {
            if (r.ok && window.showToast) {
                window.showToast('Ordem atualizada.', 'success');
            }
        }).catch(function () {
            if (window.showToast) window.showToast('Não foi possível guardar a nova ordem.', 'error');
        });
    }
}
