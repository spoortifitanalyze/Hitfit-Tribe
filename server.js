// Hitfit Tribe backend: serves the website and a small JSON API for the admin page.
// No dependencies — run with `node server.js` (Node 18+).

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 8000;
// Owners can always log in and are the only ones who can add or remove other admins.
const OWNER_EMAILS = (process.env.OWNER_EMAILS || 'bheed.spoorti@gmail.com,hitendra2309@gmail.com')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const ADMINS_FILE = path.join(DATA_DIR, 'admins.json');
const CONTENT_FILE = path.join(DATA_DIR, 'content.json');
const DEFAULT_CONTENT_FILE = path.join(DATA_DIR, 'default-content.json');
const UPLOADS_DIR = path.join(ROOT, 'uploads');

const MAX_BODY_BYTES = 8 * 1024 * 1024;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_PLANS = 12;
const MAX_TESTIMONIALS = 3;
const MAX_ADMINS = 50;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

const PUBLIC_FILES = new Set(['/index.html', '/styles.css', '/script.js', '/admin/index.html', '/admin/admin.js']);

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

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ---------- content storage ----------

const readContent = () => {
  const file = fs.existsSync(CONTENT_FILE) ? CONTENT_FILE : DEFAULT_CONTENT_FILE;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
};

const writeJsonFile = (file, data) => {
  const tempFile = `${file}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2));
  fs.renameSync(tempFile, file);
};

const writeContent = (content) => writeJsonFile(CONTENT_FILE, content);

// ---------- admin list ----------

const readAddedAdmins = () => (fs.existsSync(ADMINS_FILE) ? JSON.parse(fs.readFileSync(ADMINS_FILE, 'utf8')) : []);

const isOwner = (email) => OWNER_EMAILS.includes(email);
const isAdmin = (email) => isOwner(email) || readAddedAdmins().includes(email);

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;

const listAdmins = () => [
  ...OWNER_EMAILS.map((email) => ({ email, owner: true })),
  ...readAddedAdmins().map((email) => ({ email, owner: false }))
];

const badRequest = (message, status = 400) => Object.assign(new Error(message), { status });

const cleanText = (value, maxLength) => String(value ?? '').trim().slice(0, maxLength);

const validateContent = (input) => {
  if (!input || typeof input !== 'object') throw badRequest('Invalid content.');

  const plans = Array.isArray(input.plans) ? input.plans : [];
  const testimonials = Array.isArray(input.testimonials) ? input.testimonials : [];

  if (plans.length > MAX_PLANS) throw badRequest(`You can add up to ${MAX_PLANS} training plans.`);
  if (testimonials.length > MAX_TESTIMONIALS) throw badRequest(`You can add up to ${MAX_TESTIMONIALS} testimonials.`);

  const profilePhoto = cleanText(input.profilePhoto, 200);
  if (profilePhoto && !/^\/uploads\/[\w.-]+$/.test(profilePhoto)) throw badRequest('Invalid profile photo path.');

  const content = {
    profilePhoto,
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

const getSession = (req) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const session = token && sessions.get(token);
  if (!session) return null;
  // A removed admin loses access immediately, even mid-session.
  if (session.expiresAt < Date.now() || !isAdmin(session.email)) {
    sessions.delete(token);
    return null;
  }
  return { token, ...session };
};

// ---------- http helpers ----------

const sendJson = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': MIME_TYPES['.json'], 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
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
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const type = MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff' });
    res.end(data);
  });
};

const serveStatic = (res, pathname) => {
  if (pathname === '/') pathname = '/index.html';
  if (pathname === '/admin' || pathname === '/admin/') pathname = '/admin/index.html';

  if (PUBLIC_FILES.has(pathname)) {
    serveFile(res, path.join(ROOT, pathname));
    return;
  }

  if (pathname.startsWith('/uploads/')) {
    const filePath = path.join(UPLOADS_DIR, path.basename(pathname));
    if (MIME_TYPES[path.extname(filePath).toLowerCase()]?.startsWith('image/')) {
      serveFile(res, filePath);
      return;
    }
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
};

// ---------- API routes ----------

const handleApi = async (req, res, pathname) => {
  if (pathname === '/api/content' && req.method === 'GET') {
    sendJson(res, 200, readContent());
    return;
  }

  if (pathname === '/api/login' && req.method === 'POST') {
    const email = normalizeEmail((await readJsonBody(req)).email);
    if (!isAdmin(email)) {
      sendJson(res, 401, { error: 'Access denied. This email is not an approved admin.' });
      return;
    }
    sendJson(res, 200, { token: createSession(email), email, owner: isOwner(email) });
    return;
  }

  const session = getSession(req);
  if (!session) {
    sendJson(res, 401, { error: 'Please log in again.' });
    return;
  }

  if (pathname === '/api/logout' && req.method === 'POST') {
    sessions.delete(session.token);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (pathname === '/api/content' && req.method === 'PUT') {
    const content = validateContent(await readJsonBody(req));
    writeContent(content);
    sendJson(res, 200, content);
    return;
  }

  if (pathname === '/api/photo' && req.method === 'POST') {
    const { dataUrl } = await readJsonBody(req);
    const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(String(dataUrl || ''));
    if (!match) {
      sendJson(res, 400, { error: 'Please upload a JPG, PNG, or WebP image.' });
      return;
    }
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > MAX_PHOTO_BYTES) {
      sendJson(res, 413, { error: 'Photo must be 5 MB or smaller.' });
      return;
    }
    const fileName = `profile-${Date.now()}${PHOTO_TYPES[match[1]]}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, fileName), buffer);
    sendJson(res, 200, { url: `/uploads/${fileName}` });
    return;
  }

  if (pathname === '/api/me' && req.method === 'GET') {
    sendJson(res, 200, { email: session.email, owner: isOwner(session.email) });
    return;
  }

  if (pathname === '/api/admins') {
    if (!isOwner(session.email)) {
      sendJson(res, 403, { error: 'Only owners can manage admin users.' });
      return;
    }

    if (req.method === 'GET') {
      sendJson(res, 200, listAdmins());
      return;
    }

    if (req.method === 'POST' || req.method === 'DELETE') {
      const email = normalizeEmail((await readJsonBody(req)).email);
      const added = readAddedAdmins();

      if (req.method === 'POST') {
        if (!isValidEmail(email)) throw badRequest('Please enter a valid email address.');
        if (isAdmin(email)) throw badRequest('This email is already an admin.');
        if (added.length >= MAX_ADMINS) throw badRequest(`You can add up to ${MAX_ADMINS} admins.`);
        writeJsonFile(ADMINS_FILE, [...added, email]);
      } else {
        if (isOwner(email)) throw badRequest('Owners cannot be removed.');
        if (!added.includes(email)) throw badRequest('This email is not an admin.');
        writeJsonFile(ADMINS_FILE, added.filter((item) => item !== email));
      }

      sendJson(res, 200, listAdmins());
      return;
    }
  }

  sendJson(res, 404, { error: 'Not found.' });
};

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');

  try {
    if (pathname.startsWith('/api/')) {
      await handleApi(req, res, pathname);
    } else {
      serveStatic(res, decodeURIComponent(pathname));
    }
  } catch (error) {
    const status = error.status || 500;
    if (status === 500) console.error(error);
    if (!res.headersSent) sendJson(res, status, { error: status === 500 ? 'Server error.' : error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Hitfit Tribe running at http://localhost:${PORT}`);
  console.log(`Admin page: http://localhost:${PORT}/admin`);
});
