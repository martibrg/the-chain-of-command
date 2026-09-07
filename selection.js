// Strumento di selezione rettangolare per esportare porzioni dello schema
// (simile alla selezione rettangolare di Photoshop / allo strumento cattura di Windows)

document.addEventListener('DOMContentLoaded', () => {
  const container = document.querySelector('.image-sequence');
  if (!container) return;

  const images = Array.from(container.querySelectorAll('.seq-img'));

  // ---------- Toolbar ----------
  const toolbar = document.createElement('div');
  toolbar.className = 'selection-toolbar';

  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.textContent = 'be a part';
  toolbar.appendChild(toggleBtn);

  const hint = document.createElement('div');
  hint.className = 'hint';
  hint.textContent = 'click and drag over the scheme to export a piece of the pattern to work on, make it yours.';
  hint.style.display = 'none';
  toolbar.appendChild(hint);

  document.body.appendChild(toolbar);

  // ---------- Overlay di selezione (sopra le immagini) ----------
  const overlay = document.createElement('div');
  overlay.className = 'selection-overlay';
  container.appendChild(overlay);

  const selectionBox = document.createElement('div');
  selectionBox.className = 'selection-box';
  overlay.appendChild(selectionBox);

  // ---------- Pannello anteprima/export ----------
  const panel = document.createElement('div');
  panel.className = 'selection-panel';
  panel.innerHTML = `
    <img alt="selection preview" />
    <div class="panel-actions">
      <button type="button" class="redo-btn">re-take</button>
      <button type="button" class="download-btn">download</button>
    </div>
  `;
  document.body.appendChild(panel);
  const previewImg = panel.querySelector('img');
  const downloadBtn = panel.querySelector('.download-btn');
  const redoBtn = panel.querySelector('.redo-btn');

  let toolActive = false;
  let dragging = false;
  let startX = 0, startY = 0;
  let currentBlobUrl = null;
  let lastCroppedCanvas = null;

  // ---------- Autoscroll durante il trascinamento ----------
  const AUTOSCROLL_EDGE = 90;   // px dal bordo della finestra in cui scatta lo scroll
  const AUTOSCROLL_MAX_SPEED = 22; // px per frame alla massima vicinanza al bordo
  let lastClientX = 0, lastClientY = 0;
  let autoScrollRAF = null;

  function updateSelectionRect(clientX, clientY) {
    const rect = overlay.getBoundingClientRect();
    const curX = clientX - rect.left;
    const curY = clientY - rect.top;
    const left = Math.min(curX, startX);
    const top = Math.min(curY, startY);
    const width = Math.abs(curX - startX);
    const height = Math.abs(curY - startY);
    selectionBox.style.left = left + 'px';
    selectionBox.style.top = top + 'px';
    selectionBox.style.width = width + 'px';
    selectionBox.style.height = height + 'px';
  }

  function autoScrollStep() {
    if (!dragging) { autoScrollRAF = null; return; }

    let dy = 0;
    if (lastClientY < AUTOSCROLL_EDGE) {
      const proximity = (AUTOSCROLL_EDGE - lastClientY) / AUTOSCROLL_EDGE; // 0..1
      dy = -Math.ceil(proximity * AUTOSCROLL_MAX_SPEED);
    } else if (lastClientY > window.innerHeight - AUTOSCROLL_EDGE) {
      const proximity = (lastClientY - (window.innerHeight - AUTOSCROLL_EDGE)) / AUTOSCROLL_EDGE;
      dy = Math.ceil(proximity * AUTOSCROLL_MAX_SPEED);
    }

    if (dy !== 0) {
      window.scrollBy(0, dy);
    }

    // ricalcola sempre il rettangolo: se abbiamo scrollato, la posizione
    // dell'overlay rispetto al puntatore è cambiata anche se il mouse è fermo
    updateSelectionRect(lastClientX, lastClientY);

    autoScrollRAF = requestAnimationFrame(autoScrollStep);
  }

  function startAutoScrollLoop() {
    if (autoScrollRAF === null) {
      autoScrollRAF = requestAnimationFrame(autoScrollStep);
    }
  }

  function stopAutoScrollLoop() {
    if (autoScrollRAF !== null) {
      cancelAnimationFrame(autoScrollRAF);
      autoScrollRAF = null;
    }
  }

  function setToolActive(active) {
    toolActive = active;
    overlay.classList.toggle('active', active);
    toggleBtn.classList.toggle('active', active);
    toggleBtn.textContent = active ? 'cancel selection' : 'be a part';
    hint.style.display = active ? 'block' : 'none';
    if (!active) {
      dragging = false;
      stopAutoScrollLoop();
      selectionBox.style.display = 'none';
      panel.classList.remove('visible');
    }
  }

  toggleBtn.addEventListener('click', () => setToolActive(!toolActive));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && toolActive) setToolActive(false);
  });

  // ---------- Costruzione del "canvas master" ----------
  // Ricompone l'intera sequenza di immagini in un unico canvas,
  // usando come risoluzione la più alta disponibile tra le immagini
  // (in modo che l'export sia nitido e non limitato alla dimensione a schermo).
  function buildMasterCanvas() {
    let scale = window.devicePixelRatio || 1;
    images.forEach((img) => {
      if (img.naturalWidth && img.offsetWidth) {
        const s = img.naturalWidth / img.offsetWidth;
        if (s > scale) scale = s;
      }
    });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(container.offsetWidth * scale);
    canvas.height = Math.round(container.offsetHeight * scale);
    const ctx = canvas.getContext('2d');

    images.forEach((img) => {
      const x = img.offsetLeft * scale;
      const y = img.offsetTop * scale;
      const w = img.offsetWidth * scale;
      const h = img.offsetHeight * scale;
      ctx.drawImage(img, x, y, w, h);
    });

    return { canvas, scale };
  }

  // ---------- Gestione del trascinamento ----------
  overlay.addEventListener('mousedown', (e) => {
    if (!toolActive) return;
    dragging = true;
    lastClientX = e.clientX;
    lastClientY = e.clientY;
    const rect = overlay.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
    selectionBox.style.left = startX + 'px';
    selectionBox.style.top = startY + 'px';
    selectionBox.style.width = '0px';
    selectionBox.style.height = '0px';
    selectionBox.style.display = 'block';
    panel.classList.remove('visible');
    startAutoScrollLoop();
    e.preventDefault();
  });

  // mousemove è ascoltato su window (e non solo sull'overlay) perché durante
  // l'autoscroll il puntatore può restare fermo vicino al bordo della finestra,
  // e comunque vogliamo continuare a ricevere aggiornamenti anche lì
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    lastClientX = e.clientX;
    lastClientY = e.clientY;
    updateSelectionRect(lastClientX, lastClientY);
  });

  window.addEventListener('mouseup', (e) => {
    if (!dragging) return;
    dragging = false;
    stopAutoScrollLoop();

    const left = parseFloat(selectionBox.style.left);
    const top = parseFloat(selectionBox.style.top);
    const width = parseFloat(selectionBox.style.width);
    const height = parseFloat(selectionBox.style.height);

    // ignora selezioni troppo piccole (probabile click accidentale)
    if (width < 6 || height < 6) {
      selectionBox.style.display = 'none';
      return;
    }

    const { canvas: master, scale } = buildMasterCanvas();

    const cropX = Math.round(left * scale);
    const cropY = Math.round(top * scale);
    const cropW = Math.round(width * scale);
    const cropH = Math.round(height * scale);

    const cropped = document.createElement('canvas');
    cropped.width = cropW;
    cropped.height = cropH;
    cropped.getContext('2d').drawImage(master, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    lastCroppedCanvas = cropped;

    if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
    cropped.toBlob((blob) => {
      currentBlobUrl = URL.createObjectURL(blob);
      previewImg.src = currentBlobUrl;
      panel.classList.add('visible');
    }, 'image/png');
  });

  redoBtn.addEventListener('click', () => {
    panel.classList.remove('visible');
    selectionBox.style.display = 'none';
  });

  downloadBtn.addEventListener('click', () => {
    if (!lastCroppedCanvas) return;
    lastCroppedCanvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'your-part.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }, 'image/png');
  });
});
