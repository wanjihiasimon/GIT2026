const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'events.json');
const MAX_BODY_SIZE = 1024 * 1024;
const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function readEvents() {
  if (!fs.existsSync(DATA_FILE)) return [];
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveEvents(events) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, `${JSON.stringify(events, null, 2)}\n`);
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > MAX_BODY_SIZE) {
        reject(new Error('Request body is too large.'));
        request.destroy();
      }
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Request body must be valid JSON.'));
      }
    });
    request.on('error', reject);
  });
}

function validateEvent(input) {
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const date = typeof input.date === 'string' ? input.date : '';
  const location = typeof input.location === 'string' ? input.location.trim() : '';
  const category = typeof input.category === 'string' ? input.category.trim() : '';
  const notes = typeof input.notes === 'string' ? input.notes.trim() : '';
  const status = ['planned', 'attending', 'done', 'cancelled'].includes(input.status)
    ? input.status
    : 'planned';

  if (!title || title.length > 120) return { error: 'Add a title of 1 to 120 characters.' };
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
    return { error: 'Choose a valid date and time.' };
  }
  if (location.length > 160 || category.length > 40 || notes.length > 1000) {
    return { error: 'One or more fields are too long.' };
  }

  return { event: { title, date, location, category, notes, status } };
}

async function handleApi(request, response, url) {
  const eventId = url.pathname.match(/^\/api\/events\/([^/]+)$/)?.[1];
  if (url.pathname === '/api/events' && request.method === 'GET') {
    return sendJson(response, 200, readEvents());
  }

  if (url.pathname === '/api/events' && request.method === 'POST') {
    const result = validateEvent(await readBody(request));
    if (result.error) return sendJson(response, 400, { error: result.error });
    const events = readEvents();
    const event = { id: randomUUID(), ...result.event, createdAt: new Date().toISOString() };
    events.push(event);
    saveEvents(events);
    return sendJson(response, 201, event);
  }

  if (eventId && request.method === 'PUT') {
    const events = readEvents();
    const index = events.findIndex((event) => event.id === eventId);
    if (index < 0) return sendJson(response, 404, { error: 'Event not found.' });
    const result = validateEvent(await readBody(request));
    if (result.error) return sendJson(response, 400, { error: result.error });
    events[index] = { ...events[index], ...result.event, updatedAt: new Date().toISOString() };
    saveEvents(events);
    return sendJson(response, 200, events[index]);
  }

  if (eventId && request.method === 'DELETE') {
    const events = readEvents();
    const remaining = events.filter((event) => event.id !== eventId);
    if (remaining.length === events.length) return sendJson(response, 404, { error: 'Event not found.' });
    saveEvents(remaining);
    return sendJson(response, 200, { ok: true });
  }

  return sendJson(response, 404, { error: 'Route not found.' });
}

function serveStatic(response, url) {
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    response.writeHead(400);
    return response.end('Invalid URL.');
  }
  const requestedPath = pathname === '/' ? 'index.html' : pathname.slice(1);
  const filePath = path.resolve(PUBLIC_DIR, requestedPath);
  if (!filePath.startsWith(`${PUBLIC_DIR}${path.sep}`)) {
    response.writeHead(403);
    return response.end('Forbidden.');
  }
  fs.readFile(filePath, (error, contents) => {
    if (error) {
      response.writeHead(404);
      return response.end('Not found.');
    }
    response.writeHead(200, {
      'Content-Type': MIME_TYPES[path.extname(filePath)] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(contents);
  });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  if (url.pathname.startsWith('/api/')) {
    try {
      await handleApi(request, response, url);
    } catch (error) {
      if (!response.headersSent) {
        sendJson(response, error.message.includes('valid JSON') || error.message.includes('too large') ? 400 : 500, {
          error: error.message,
        });
      }
    }
    return;
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    return response.end('Method not allowed.');
  }
  serveStatic(response, url);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Gathered is running at http://localhost:${PORT}`);
});