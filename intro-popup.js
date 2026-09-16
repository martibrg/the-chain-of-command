(function () {
  var overlay = document.getElementById('intro-popup-overlay');
  var popup = document.getElementById('intro-popup');
  var reopenBtn = document.getElementById('intro-popup-reopen');

  function openPopup() {
    overlay.classList.add('visible');
  }

  function closePopup() {
    overlay.classList.remove('visible');
  }

  // Si apre non appena la pagina viene caricata
  openPopup();

  // Si chiude cliccando fuori dal popup (ma non sul testo per riaprirlo)
  overlay.addEventListener('click', function (e) {
    if (!popup.contains(e.target)) {
      closePopup();
    }
  });

  // Il testo in basso a sinistra lo riapre
  reopenBtn.addEventListener('click', function () {
    openPopup();
  });
})();
