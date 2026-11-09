const $ = (id) => document.getElementById(id);
let selectedFile = null;
let allImages = [];
let visibleCount = 8;
let adminPassword = '';
let toastTimer;
const fmtSize = (bytes) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} Ko` : `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
const fmtDate = (date) => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(date));
function toast(message) { const el = $('toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2600); }
async function api(url, options = {}) { const response = await fetch(url, options); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || 'Une erreur est survenue.'); return data; }
function chooseFile(file) {
  if (!file) return;
  if (!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)) return toast('Format non accepté. Utilise JPG, PNG, WEBP ou GIF.');
  selectedFile = file; $('fileName').textContent = `${file.name} · ${fmtSize(file.size)}`; $('selectedFile').hidden = false; $('uploadBtn').disabled = false; $('result').hidden = true;
}
$('imageInput').addEventListener('change', e => chooseFile(e.target.files[0]));
$('clearFile').addEventListener('click', () => { selectedFile = null; $('imageInput').value = ''; $('selectedFile').hidden = true; $('uploadBtn').disabled = true; });
const dropzone = $('dropzone');
['dragenter','dragover'].forEach(evt => dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.add('dragover'); }));
['dragleave','drop'].forEach(evt => dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.remove('dragover'); }));
dropzone.addEventListener('drop', e => chooseFile(e.dataTransfer.files[0]));
$('uploadForm').addEventListener('submit', e => {
  e.preventDefault(); if (!selectedFile) return;
  const data = new FormData(); data.append('image', selectedFile);
  const xhr = new XMLHttpRequest(); xhr.open('POST', '/api/upload');
  $('progressWrap').hidden = false; $('uploadBtn').disabled = true; $('progressText').textContent = 'Envoi de ton image…';
  xhr.upload.onprogress = event => { if (event.lengthComputable) { const pct = Math.round(event.loaded / event.total * 100); $('progressBar').style.width = `${pct}%`; $('progressPercent').textContent = `${pct}%`; } };
  xhr.onload = async () => {
    let result = {}; try { result = JSON.parse(xhr.responseText); } catch {}
    $('progressWrap').hidden = true; $('progressBar').style.width = '0%';
    if (xhr.status < 200 || xhr.status >= 300) { toast(result.error || 'Échec de l’envoi.'); $('uploadBtn').disabled = false; return; }
    $('resultUrl').value = result.url; $('openResult').href = result.url; $('result').hidden = false; toast('Image hébergée avec succès !');
    selectedFile = null; $('imageInput').value = ''; $('selectedFile').hidden = true; $('uploadBtn').disabled = true; await loadGallery();
  };
  xhr.onerror = () => { $('progressWrap').hidden = true; $('uploadBtn').disabled = false; toast('Impossible de joindre le serveur.'); };
  xhr.send(data);
});
async function copyText(value) { try { await navigator.clipboard.writeText(value); toast('Lien copié dans le presse-papiers.'); } catch { toast('Copie impossible : sélectionne le lien manuellement.'); } }
$('copyResult').addEventListener('click', () => copyText($('resultUrl').value));
$('copyHtml').addEventListener('click', () => copyText(`<img src="${$('resultUrl').value}" alt="Image hébergée sur NEXO CLOUD">`));
function renderGallery() {
  $('imageCount').textContent = allImages.length.toLocaleString('fr-FR');
  $('galleryTotal').textContent = `${allImages.length} image${allImages.length > 1 ? 's' : ''} hébergée${allImages.length > 1 ? 's' : ''}`;
  $('galleryFooter').hidden = allImages.length <= 8;
  $('showMore').hidden = visibleCount >= allImages.length;
  const grid = $('galleryGrid'); grid.replaceChildren();
  const images = allImages.slice(0, visibleCount);
  if (!images.length) { const empty = document.createElement('div'); empty.className = 'empty-state'; empty.innerHTML = '<span>▧</span><b>Aucune image pour le moment</b><small>Sois le premier à héberger un visuel sur NEXO CLOUD.</small>'; grid.append(empty); return; }
  for (const item of images) {
    const card = document.createElement('article'); card.className = 'image-card';
    const preview = document.createElement('a'); preview.className = 'image-preview'; preview.href = item.url; preview.target = '_blank'; preview.rel = 'noopener';
    const img = document.createElement('img'); img.src = item.url; img.alt = item.originalName || 'Image hébergée'; img.loading = 'lazy'; preview.append(img);
    const info = document.createElement('div'); info.className = 'image-info';
    const name = document.createElement('div'); name.className = 'image-name'; name.textContent = item.originalName || item.filename;
    const meta = document.createElement('div'); meta.className = 'image-meta'; meta.innerHTML = `<span>${fmtSize(item.size)}</span><span>${fmtDate(item.createdAt)}</span>`;
    const actions = document.createElement('div'); actions.className = 'image-actions';
    const copy = document.createElement('button'); copy.textContent = 'Copier le lien'; copy.addEventListener('click', () => copyText(item.url));
    const html = document.createElement('button'); html.textContent = 'HTML'; html.addEventListener('click', () => copyText(`<img src="${item.url}" alt="${(item.originalName || 'Image').replaceAll('"','')}" >`));
    actions.append(copy, html);
    if (adminPassword) { const del = document.createElement('button'); del.className = 'delete-btn'; del.textContent = '×'; del.title = 'Supprimer'; del.addEventListener('click', () => deleteImage(item.id)); actions.append(del); }
    info.append(name, meta, actions); card.append(preview, info); grid.append(card);
  }
}
async function loadGallery() { try { allImages = await api('/api/images'); renderGallery(); } catch { $('galleryGrid').innerHTML = '<div class="empty-state"><span>!</span><b>Impossible de charger la galerie</b><small>Vérifie que le serveur est démarré.</small></div>'; } }
$('refreshBtn').addEventListener('click', loadGallery);
$('showMore').addEventListener('click', () => { visibleCount += 8; renderGallery(); });
$('adminOpen').addEventListener('click', () => { $('adminModal').hidden = false; $('adminError').hidden = true; $('adminPassword').focus(); });
$('adminClose').addEventListener('click', () => $('adminModal').hidden = true);
$('adminModal').addEventListener('click', e => { if (e.target === $('adminModal')) $('adminModal').hidden = true; });
function adminError(message) { $('adminError').textContent = message; $('adminError').hidden = false; }
$('adminForm').addEventListener('submit', async e => {
  e.preventDefault(); const password = $('adminPassword').value;
  try { await api('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) }); adminPassword = password; $('adminForm').hidden = true; $('adminDashboard').hidden = false; $('adminError').hidden = true; renderGallery(); await loadAdminStats(); }
  catch (error) { adminError(error.message); }
});
async function loadAdminStats() { try { const stats = await api('/api/admin/stats', { headers: { 'x-admin-password': adminPassword } }); $('adminCount').textContent = stats.count; $('adminStorage').textContent = fmtSize(stats.bytes); } catch (error) { adminError(error.message); } }
async function deleteImage(id) { if (!confirm('Supprimer définitivement cette image ?')) return; try { await api(`/api/admin/images/${id}`, { method: 'DELETE', headers: { 'x-admin-password': adminPassword } }); toast('Image supprimée.'); await loadGallery(); await loadAdminStats(); } catch (error) { toast(error.message); } }
$('adminLogout').addEventListener('click', () => { adminPassword = ''; $('adminForm').hidden = false; $('adminDashboard').hidden = true; $('adminPassword').value = ''; renderGallery(); toast('Déconnexion effectuée.'); });
$('themeBtn').addEventListener('click', () => { document.body.classList.toggle('light'); $('themeBtn').textContent = document.body.classList.contains('light') ? '☀' : '☾'; });
$('year').textContent = new Date().getFullYear();
api('/api/config').then(config => { $('maxSize').textContent = `• ${config.maxFileSizeMb} Mo maximum`; }).catch(() => {});
loadGallery();
