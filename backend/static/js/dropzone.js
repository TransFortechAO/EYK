(function () {
    function enhance(input) {
        var container = input.closest('.form-field') || input.parentElement;
        if (!container) return;

        container.addEventListener('dragover', function (e) {
            e.preventDefault();
            container.classList.add('dropzone-active');
        });
        container.addEventListener('dragleave', function () {
            container.classList.remove('dropzone-active');
        });
        container.addEventListener('drop', function (e) {
            e.preventDefault();
            container.classList.remove('dropzone-active');
            if (e.dataTransfer.files.length) {
                input.files = e.dataTransfer.files;
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        document.querySelectorAll('input[type="file"]').forEach(enhance);
    });
})();
