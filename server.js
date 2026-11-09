import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3000);
const MAX_MB = Math.max(1, Number(process.env.MAX_FILE_SIZE_MB || 10));
const MAX_BYTES = MAX_MB * 1024 * 1024;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'images.json');
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');

await fs.mkdir(UPLOAD_DIR, { recursive: true });
await fs.mkdir(DATA_DIR, { recursive: true });
try { await fs.access(DB_FILE); } catch { await fs.writeFile(DB_FILE, '[]', 'utf8'); }

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: null
    }
  }
}));
app.use(express.json({ limit: '30kb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d', immutable: true, fallthrough: false }));

const uploadLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Trop de tentatives. Réessaie dans quelques minutes.' } });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Trop de tentatives de connexion.' } });

const storage = multer.memoryStorage();
const uploader = multer({ storage, limits: { fileSize: MAX_BYTES, files: 1 } });

function detectImage(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return { ext: 'png', mime: 'image/png' };
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString())) return { ext: 'gif', mime: 'image/gif' };
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') return { ext: 'webp', mime: 'image/webp' };
  return null;
}

async function readImages() {
  try { return JSON.parse(await fs.readFile(DB_FILE, 'utf8')); }
  catch { return []; }
}
async function writeImages(images) {
  const temp = `${DB_FILE}.tmp`;
  await fs.writeFile(temp, JSON.stringify(images, null, 2), 'utf8');
  await fs.rename(temp, DB_FILE);
}
function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
function requireAdmin(req, res, next) {
  const configured = process.env.ADMIN_PASSWORD;
  if (!configured || configured === 'Change-moi-avec-un-mot-de-passe-long') return res.status(503).json({ error: 'Configure le mot de passe administrateur dans le fichier .env.' });
  if (!safeEqual(req.get('x-admin-password'), configured)) return res.status(401).json({ error: 'Accès administrateur refusé.' });
  next();
}

app.get('/api/config', (req, res) => res.json({ maxFileSizeMb: MAX_MB, accepted: ['JPG', 'PNG', 'WEBP', 'GIF'] }));
app.get('/api/images', async (req, res) => {
  const images = await readImages();
  res.json(images.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(({ id, originalName, filename, mime, size, createdAt }) => ({
    id, originalName, filename, mime, size, createdAt,
    url: `${PUBLIC_BASE_URL}/uploads/${encodeURIComponent(filename)}`
  })));
});
app.post('/api/upload', uploadLimiter, uploader.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Sélectionne une image avant de l’envoyer.' });
  const detected = detectImage(req.file.buffer);
  if (!detected) return res.status(415).json({ error: 'Format refusé. Utilise JPG, PNG, WEBP ou GIF.' });
  const id = crypto.randomUUID();
  const filename = `${id}.${detected.ext}`;
  const imagePath = path.join(UPLOAD_DIR, filename);
  await fs.writeFile(imagePath, req.file.buffer, { flag: 'wx' });
  const image = {
    id, filename, originalName: path.basename(req.file.originalname).slice(0, 140),
    mime: detected.mime, size: req.file.size, createdAt: new Date().toISOString()
  };
  const images = await readImages();
  images.push(image);
  await writeImages(images);
  res.status(201).json({ ...image, url: `${PUBLIC_BASE_URL}/uploads/${encodeURIComponent(filename)}` });
});
app.post('/api/admin/login', loginLimiter, (req, res) => {
  const configured = process.env.ADMIN_PASSWORD;
  if (!configured || configured === 'Change-moi-avec-un-mot-de-passe-long') return res.status(503).json({ error: 'Configure ADMIN_PASSWORD dans .env avant de te connecter.' });
  if (!safeEqual(req.body?.password, configured)) return res.status(401).json({ error: 'Mot de passe incorrect.' });
  res.json({ ok: true });
});
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  const images = await readImages();
  res.json({ count: images.length, bytes: images.reduce((sum, item) => sum + item.size, 0) });
});
app.delete('/api/admin/images/:id', requireAdmin, async (req, res) => {
  const images = await readImages();
  const target = images.find(item => item.id === req.params.id);
  if (!target) return res.status(404).json({ error: 'Image introuvable.' });
  await fs.rm(path.join(UPLOAD_DIR, target.filename), { force: true });
  await writeImages(images.filter(item => item.id !== req.params.id));
  res.json({ ok: true });
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? `Image trop volumineuse. Maximum : ${MAX_MB} Mo.` : 'Envoi impossible.';
    return res.status(400).json({ error: message });
  }
  if (err.status === 404) return res.status(404).send('Image introuvable');
  console.error(err);
  res.status(500).json({ error: 'Une erreur est survenue sur le serveur.' });
});

app.listen(PORT, () => console.log(`NEXO CLOUD prêt : http://localhost:${PORT}`));
