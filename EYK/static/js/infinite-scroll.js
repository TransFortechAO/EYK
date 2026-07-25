function initInfiniteScroll(opts) {
    var sentinel = document.getElementById(opts.sentinelId);
    var list = document.getElementById(opts.listId);
    var skeleton = document.getElementById(opts.skeletonId);
    if (!sentinel || !list) return;

    var nextUrl = sentinel.dataset.nextUrl;
    var loading = false;

    function baseNextPageUrl(url) {
        // troca /pagina/N/ (ou /N/) pelo numero de pagina seguinte na proxima chamada
        return url;
    }

    function bumpPage(url) {
        return url.replace(/\/pagina\/(\d+)\//, function (m, n) {
            return '/pagina/' + (parseInt(n, 10) + 1) + '/';
        });
    }

    var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting && !loading && nextUrl) {
                loadNext();
            }
        });
    }, { rootMargin: '200px' });

    observer.observe(sentinel);

    function loadNext() {
        loading = true;
        if (skeleton) skeleton.style.display = '';
        fetch(nextUrl, { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (skeleton) skeleton.style.display = 'none';
                var wrapper = document.createElement('div');
                wrapper.innerHTML = data.html;
                while (wrapper.firstChild) {
                    if (wrapper.firstChild.nodeType === 1) {
                        wrapper.firstChild.classList && wrapper.firstChild.classList.add('is-appearing');
                    }
                    list.appendChild(wrapper.firstChild);
                }
                if (data.has_next) {
                    nextUrl = bumpPage(nextUrl);
                } else {
                    nextUrl = null;
                    observer.disconnect();
                }
                loading = false;
            })
            .catch(function () {
                if (skeleton) skeleton.style.display = 'none';
                loading = false;
            });
    }
}
