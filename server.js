// Hitfit Tribe backend: a small JSON API for the admin page.
// No dependencies — run with `node server.js` (Node 18+).
//
// Storage:
// - With GITHUB_TOKEN set, saved content and photos are committed to the GitHub repo, and the
//   GitHub Pages site picks them up on its next deploy.
// - Without it (local development), they are saved under local-data/ and this server also
//   serves the website.

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 8000;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_REPO = process.env.GITHUB_REPO || 'spoortifitanalyze/Hitfit-Tribe';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://spoortifitanalyze.github.io')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const toEmailList = (value) =>
  value
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

// Owners can always log in and are the only ones who can add or remove other admins.
const OWNER_EMAILS = toEmailList(process.env.OWNER_EMAILS || 'bheed.spoorti@gmail.com,hitendra2309@gmail.com');

const ROOT = __dirname;
const LOCAL_DATA_DIR = path.join(ROOT, 'local-data');
const DEFAULT_CONTENT_FILE = path.join(ROOT, 'data', 'default-content.json');

// Paths inside the repo (GitHub mode) or inside local-data/ (local mode).
const CONTENT_PATH = 'data/content.json';
const ADMINS_PATH = 'data/admins.json';

const MAX_BODY_BYTES = 8 * 1024 * 1024;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_PLANS = 12;
const MAX_TESTIMONIALS = 3;
const MAX_GALLERY_PHOTOS = 4;
const MAX_ADMINS = 50;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const CACHE_TTL_MS = 60 * 1000;

const PUBLIC_FILES = new Set([
  '/index.html',
  '/styles.css',
  '/script.js',
  '/assets/logo.png',
  '/admin/index.html',
  '/admin/admin.js',
  '/admin/config.js'
]);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp'
};

const PHOTO_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const sessions = new Map();

const badRequest = (message, status = 400) => Object.assign(new Error(message), { status });

// ---------- storage ----------

const githubStorage = {
  cache: new Map(),

  async request(repoPath, options = {}) {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${repoPath}`, {
      ...options,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...options.headers
      }
    });
    if (response.status === 404) return null;
    if (!response.ok) {
      console.error(`GitHub ${options.method || 'GET'} ${repoPath} failed:`, response.status, await response.text());
      throw new Error('Could not reach GitHub.');
    }
    return response.json();
  },

  async getFile(repoPath) {
    return this.request(`${repoPath}?ref=${encodeURIComponent(GITHUB_BRANCH)}`);
  },

  async readJson(repoPath) {
    const cached = this.cache.get(repoPath);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    const file = await this.getFile(repoPath);
    const data = file ? JSON.parse(Buffer.from(file.content, 'base64').toString('utf8')) : null;
    this.cache.set(repoPath, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return data;
  },

  async writeFile(repoPath, buffer, message) {
    const existing = await this.getFile(repoPath);
    await this.request(repoPath, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        content: buffer.toString('base64'),
        branch: GITHUB_BRANCH,
        ...(existing ? { sha: existing.sha } : {})
      })
    });
  },

  async writeJson(repoPath, data, message) {
    await this.writeFile(repoPath, Buffer.from(`${JSON.stringify(data, null, 2)}\n`), message);
    this.cache.set(repoPath, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  }
};

const fileStorage = {
  resolve(repoPath) {
    return path.join(LOCAL_DATA_DIR, repoPath);
  },

  async readJson(repoPath) {
    const file = this.resolve(repoPath);
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  },

  async writeFile(repoPath, buffer) {
    const file = this.resolve(repoPath);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(`${file}.tmp`, buffer);
    fs.renameSync(`${file}.tmp`, file);
  },

  async writeJson(repoPath, data) {
    await this.writeFile(repoPath, Buffer.from(JSON.stringify(data, null, 2)));
  }
};

const storage = GITHUB_TOKEN ? githubStorage : fileStorage;

const readContent = async () =>
  (await storage.readJson(CONTENT_PATH)) || JSON.parse(fs.readFileSync(DEFAULT_CONTENT_FILE, 'utf8'));

// ---------- admin list ----------

const readAddedAdmins = async () => (await storage.readJson(ADMINS_PATH)) || [];

const isOwner = (email) => OWNER_EMAILS.includes(email);
const isAdmin = async (email) => isOwner(email) || (await readAddedAdmins()).includes(email);

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;

const listAdmins = async () => [
  ...OWNER_EMAILS.map((email) => ({ email, owner: true })),
  ...(await readAddedAdmins()).map((email) => ({ email, owner: false }))
];

// ---------- content validation ----------

const cleanText = (value, maxLength) => String(value ?? '').trim().slice(0, maxLength);

const validateContent = (input) => {
  if (!input || typeof input !== 'object') throw badRequest('Invalid content.');

  const plans = Array.isArray(input.plans) ? input.plans : [];
  const testimonials = Array.isArray(input.testimonials) ? input.testimonials : [];
  const gallery = Array.isArray(input.gallery) ? input.gallery : [];

  if (plans.length > MAX_PLANS) throw badRequest(`You can add up to ${MAX_PLANS} training plans.`);
  if (testimonials.length > MAX_TESTIMONIALS) throw badRequest(`You can add up to ${MAX_TESTIMONIALS} testimonials.`);
  if (gallery.length > MAX_GALLERY_PHOTOS) throw badRequest(`You can add up to ${MAX_GALLERY_PHOTOS} gallery photos.`);

  const isPhotoPath = (value) => /^uploads\/[\w.-]+$/.test(value);

  const profilePhoto = cleanText(input.profilePhoto, 200);
  if (profilePhoto && !isPhotoPath(profilePhoto)) throw badRequest('Invalid profile photo path.');

  const galleryPhotos = gallery.map((photo) => cleanText(photo, 200));
  if (!galleryPhotos.every(isPhotoPath)) throw badRequest('Invalid gallery photo path.');

  const content = {
    profilePhoto,
    gallery: galleryPhotos,
    about: {
      heading: cleanText(input.about?.heading, 200),
      body: cleanText(input.about?.body, 5000)
    },
    plans: plans.map((plan) => ({
      title: cleanText(plan?.title, 120),
      description: cleanText(plan?.description, 1500),
      audience: cleanText(plan?.audience, 500),
      prerequisites: cleanText(plan?.prerequisites, 500)
    })),
    testimonials: testimonials.map((item) => ({
      name: cleanText(item?.name, 80),
      comment: cleanText(item?.comment, 1000)
    }))
  };

  if (content.plans.some((plan) => !plan.title)) throw badRequest('Every training plan needs a title.');
  if (content.testimonials.some((item) => !item.name || !item.comment)) {
    throw badRequest('Every testimonial needs a name and a comment.');
  }

  return content;
};

// ---------- auth ----------

const createSession = (email) => {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { email, expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
};

const getSession = async (req) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const session = token && sessions.get(token);
  if (!session) return null;
  // A removed admin loses access immediately, even mid-session.
  if (session.expiresAt < Date.now() || !(await isAdmin(session.email))) {
    sessions.delete(token);
    return null;
  }
  return { token, ...session };
};

// ---------- http helpers ----------

const setCorsHeaders = (req, res) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '600');
    res.setHeader('Vary', 'Origin');
  }
};

const sendJson = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': MIME_TYPES['.json'], 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
};

const sendNotFound = (res) => {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
};

const readJsonBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(badRequest('Request is too large.', 413));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(badRequest('Invalid JSON.'));
      }
    });
    req.on('error', reject);
  });

const serveFile = (res, filePath) => {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      sendNotFound(res);
      return;
    }
    const type = MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff' });
    res.end(data);
  });
};

// Local development only: in production the website is served by GitHub Pages.
const serveStatic = async (res, pathname) => {
  if (pathname === '/') pathname = '/index.html';
  // Redirect so the admin page's relative asset paths resolve the same way as on GitHub Pages.
  if (pathname === '/admin') {
    res.writeHead(301, { Location: '/admin/' });
    res.end();
    return;
  }
  if (pathname === '/admin/') pathname = '/admin/index.html';

  if (PUBLIC_FILES.has(pathname)) {
    serveFile(res, path.join(ROOT, pathname));
    return;
  }

  if (pathname === `/${CONTENT_PATH}` && storage === fileStorage) {
    sendJson(res, 200, await readContent());
    return;
  }

  if (pathname.startsWith('/uploads/') && storage === fileStorage) {
    const filePath = fileStorage.resolve(`uploads/${path.basename(pathname)}`);
    if (MIME_TYPES[path.extname(filePath).toLowerCase()]?.startsWith('image/')) {
      serveFile(res, filePath);
      return;
    }
  }

  sendNotFound(res);
};

// ---------- API routes ----------

const handleApi = async (req, res, pathname) => {
  if (pathname === '/api/content' && req.method === 'GET') {
    sendJson(res, 200, await readContent());
    return;
  }

  if (pathname === '/api/login' && req.method === 'POST') {
    const email = normalizeEmail((await readJsonBody(req)).email);
    if (!(await isAdmin(email))) {
      sendJson(res, 401, { error: 'Access denied. This email is not an approved admin.' });
      return;
    }
    sendJson(res, 200, { token: createSession(email), email, owner: isOwner(email) });
    return;
  }

  const session = await getSession(req);
  if (!session) {
    sendJson(res, 401, { error: 'Please log in again.' });
    return;
  }

  if (pathname === '/api/logout' && req.method === 'POST') {
    sessions.delete(session.token);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (pathname === '/api/me' && req.method === 'GET') {
    sendJson(res, 200, { email: session.email, owner: isOwner(session.email) });
    return;
  }

  if (pathname === '/api/content' && req.method === 'PUT') {
    const content = validateContent(await readJsonBody(req));
    await storage.writeJson(CONTENT_PATH, content, `Update website content (by ${session.email})`);
    sendJson(res, 200, content);
    return;
  }

  if (pathname === '/api/photo' && req.method === 'POST') {
    const { dataUrl, kind } = await readJsonBody(req);
    const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(String(dataUrl || ''));
    if (!match) throw badRequest('Please upload a JPG, PNG, or WebP image.');
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > MAX_PHOTO_BYTES) throw badRequest('Photo must be 5 MB or smaller.', 413);

    const prefix = kind === 'gallery' ? 'gallery' : 'profile';
    const photoPath = `uploads/${prefix}-${Date.now()}${PHOTO_TYPES[match[1]]}`;
    await storage.writeFile(photoPath, buffer, `Upload ${prefix} photo (by ${session.email})`);
    sendJson(res, 200, { path: photoPath });
    return;
  }

  if (pathname === '/api/admins') {
    if (!isOwner(session.email)) {
      sendJson(res, 403, { error: 'Only owners can manage admin users.' });
      return;
    }

    if (req.method === 'GET') {
      sendJson(res, 200, await listAdmins());
      return;
    }

    if (req.method === 'POST' || req.method === 'DELETE') {
      const email = normalizeEmail((await readJsonBody(req)).email);
      const added = await readAddedAdmins();

      if (req.method === 'POST') {
        if (!isValidEmail(email)) throw badRequest('Please enter a valid email address.');
        if (await isAdmin(email)) throw badRequest('This email is already an admin.');
        if (added.length >= MAX_ADMINS) throw badRequest(`You can add up to ${MAX_ADMINS} admins.`);
        await storage.writeJson(ADMINS_PATH, [...added, email], `Add admin ${email} (by ${session.email})`);
      } else {
        if (isOwner(email)) throw badRequest('Owners cannot be removed.');
        if (!added.includes(email)) throw badRequest('This email is not an admin.');
        await storage.writeJson(
          ADMINS_PATH,
          added.filter((item) => item !== email),
          `Remove admin ${email} (by ${session.email})`
        );
      }

      sendJson(res, 200, await listAdmins());
      return;
    }
  }

  sendJson(res, 404, { error: 'Not found.' });
};

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');

  try {
    if (pathname.startsWith('/api/')) {
      setCorsHeaders(req, res);
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }
      await handleApi(req, res, pathname);
    } else {
      await serveStatic(res, decodeURIComponent(pathname));
    }
  } catch (error) {
    const status = error.status || 500;
    if (status === 500) console.error(error);
    if (!res.headersSent) sendJson(res, status, { error: status === 500 ? 'Server error. Please try again.' : error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Hitfit Tribe admin API running on port ${PORT}`);
  console.log(
    GITHUB_TOKEN
      ? `Saving changes to GitHub: ${GITHUB_REPO} (${GITHUB_BRANCH})`
      : `Local mode: saving to local-data/. Website: http://localhost:${PORT}  Admin: http://localhost:${PORT}/admin/`
  );
});
