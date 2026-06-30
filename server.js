/*
 * Drug Craft — optional Claude-powered backend
 * ------------------------------------------------------------------
 * The game is fully playable WITHOUT this server (the browser falls back to
 * the local deterministic engine in engine.js). Run this only if you want
 * true open-ended, LLM-generated combinations like the real Infinite Craft.
 *
 *   1. npm install
 *   2. export ANTHROPIC_API_KEY=sk-ant-...
 *   3. npm start            # serves the game + /api/combine on :8787
 *   4. open http://localhost:8787 and tick the "AI mode" box
 *
 * It serves the static game files too, so the relative "/api/combine"
 * endpoint the front-end probes just works.
 *
 * Model: defaults to Claude Haiku 4.5 — combining two short words into a
 * name + emoji + category is a small, latency-sensitive, high-volume task,
 * which is exactly Haiku's sweet spot. Override with DRUGCRAFT_MODEL
 * (e.g. claude-opus-4-8) if you want a beefier model.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const PORT = process.env.PORT || 8787;
const MODEL = process.env.DRUGCRAFT_MODEL || 'claude-haiku-4-5';
const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

// Deterministic, satirical framing. We want a fun pop-culture name + emoji,
// never any real-world synthesis detail.
const SYSTEM = [
  'You are the combination engine for "Drug Craft", a satirical Infinite-Craft-style',
  'web game. The player merges two elements; you invent ONE resulting element.',
  '',
  'Rules:',
  '- Output is a short, witty, pop-culture / slang name (1-3 words), a single emoji,',
  '  and a category.',
  '- Lean into satire and harm-reduction-flavoured humour, not glorification.',
  '- NEVER include synthesis routes, dosages, quantities, reagents, or any real',
  '  how-to information. Names only — this is a word game, like Infinite Craft.',
  '- Be deterministic: the same pair of inputs should yield the same result.',
  '- category must be one of: natural, cannabis, stimulant, opioid, psychedelic,',
  '  dissociative, synthetic, depressant, pharmaceutical, paraphernalia, people,',
  '  crime, lab, hazard, base.'
].join('\n');

const RESULT_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    emoji: { type: 'string' },
    category: {
      type: 'string',
      enum: ['natural', 'cannabis', 'stimulant', 'opioid', 'psychedelic',
             'dissociative', 'synthetic', 'depressant', 'pharmaceutical',
             'paraphernalia', 'people', 'crime', 'lab', 'hazard', 'base']
    }
  },
  required: ['name', 'emoji', 'category'],
  additionalProperties: false
};

// In-memory cache: keep results stable + avoid re-billing repeat combos.
const cache = new Map();
const pairKey = (a, b) => [a, b].map(s => String(s).toLowerCase()).sort().join(' + ');

async function combineWithClaude(a, b) {
  const key = pairKey(a.name, b.name);
  if (cache.has(key)) return cache.get(key);

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 200,
    system: SYSTEM,
    output_config: { format: { type: 'json_schema', schema: RESULT_SCHEMA } },
    messages: [{
      role: 'user',
      content: `Combine "${a.name}" (${a.category}) + "${b.name}" (${b.category}). ` +
               `Invent the single resulting Drug Craft element.`
    }]
  });

  // With output_config.format the first text block is guaranteed valid JSON.
  const text = message.content.find(b => b.type === 'text');
  const result = JSON.parse(text.text);
  cache.set(key, result);
  return result;
}

/* ---------------- static file serving ---------------- */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon'
};

function serveStatic(req, res) {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';
  // Prevent path traversal.
  const safePath = path.normalize(path.join(__dirname, urlPath));
  if (!safePath.startsWith(__dirname)) { res.writeHead(403); res.end('Forbidden'); return; }

  fs.readFile(safePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(safePath)] || 'application/octet-stream' });
    res.end(data);
  });
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const server = http.createServer((req, res) => {
  if (req.url.split('?')[0] === '/api/combine') {
    cors(res);
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    if (req.method !== 'POST') { res.writeHead(405); res.end(); return; }

    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e5) req.destroy(); // basic guard
    });
    req.on('end', async () => {
      try {
        const { a, b } = JSON.parse(body || '{}');
        if (!a || !b || !a.name || !b.name) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'expected { a, b } with name fields' }));
          return;
        }
        const result = await combineWithClaude(a, b);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        console.error('combine error:', err && err.message ? err.message : err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'combination failed' }));
      }
    });
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`\n🧪  Drug Craft running at http://localhost:${PORT}`);
  console.log(`    AI model: ${MODEL}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('    ⚠️  ANTHROPIC_API_KEY is not set — /api/combine will error.');
    console.log('        The game still works in offline mode (untick AI mode).');
  }
  console.log('');
});
