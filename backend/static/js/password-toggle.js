// Adiciona automaticamente um botão "mostrar/ocultar" a todos os campos type="password" da página.
document.addEventListener("DOMContentLoaded", function () {
  var EYE_OPEN =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
  var EYE_OFF =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a20.3 20.3 0 0 1 5.06-6.06M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a20.3 20.3 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><path d="M1 1l22 22"></path></svg>';

  document.querySelectorAll('input[type="password"]').forEach(function (input) {
    if (input.closest(".pwd-toggle-wrap")) return;

    var wrap = document.createElement("div");
    wrap.className = "pwd-toggle-wrap";
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pwd-toggle-btn";
    btn.setAttribute("aria-label", "Mostrar palavra-passe");
    btn.innerHTML = EYE_OPEN;

    btn.addEventListener("click", function () {
      var willShow = input.type === "password";
      input.type = willShow ? "text" : "password";
      btn.innerHTML = willShow ? EYE_OFF : EYE_OPEN;
      btn.setAttribute("aria-label", willShow ? "Ocultar palavra-passe" : "Mostrar palavra-passe");
    });

    wrap.appendChild(btn);
  });
});
