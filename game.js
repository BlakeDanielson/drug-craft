/*
 * Drug Craft — UI / game controller
 * Handles state, persistence, pointer drag-and-drop (mouse + touch),
 * the discoveries sidebar, search/sort, the optional AI backend, and
 * all the little flourishes (toasts, sparkle bursts, "first discovery").
 *
 * Depends on engine.js (window.DrugCraftEngine).
 */
(function () {
  'use strict';

  var Engine = window.DrugCraftEngine;

  /* ------------------------- persistence ------------------------- */
  var LS = {
    disc: 'drugcraft.discoveries.v1',
    canvas: 'drugcraft.canvas.v1',
    newIds: 'drugcraft.newids.v1',
    sort: 'drugcraft.sort.v1',
    ai: 'drugcraft.ai.v1'
  };

  function load(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  /* ------------------------- state ------------------------- */
  // discoveries: id -> { id, name, emoji, category, at }
  var discoveries = {};
  var newIds = {};            // id -> true   (unseen "NEW" badge)
  var tokens = [];            // [{ uid, id, el, x, y }]
  var uidSeq = 1;
  var sortMode = load(LS.sort, 'time');
  var aiEnabled = load(LS.ai, false);

  // AI endpoints to try, in order. Relative works when served by server.js;
  // localhost fallback covers opening index.html directly.
  var AI_ENDPOINTS = ['/api/combine', 'http://localhost:8787/api/combine'];
  var aiEndpoint = null; // discovered at runtime

  /* ------------------------- dom ------------------------- */
  var $ = function (s) { return document.querySelector(s); };
  var canvasEl = $('#canvas');
  var listEl = $('#item-list');
  var countEl = $('#discovery-count');
  var hintEl = $('#canvas-hint');
  var searchEl = $('#search');
  var sortBtn = $('#sort-btn');
  var toastEl = $('#toast');
  var aiToggle = $('#ai-toggle');
  var aiStatus = $('#ai-status');

  /* =====================================================================
   * Init
   * ===================================================================== */
  function init() {
    var savedDisc = load(LS.disc, null);
    if (savedDisc && savedDisc.length) {
      savedDisc.forEach(function (d) { discoveries[d.id] = d; });
    } else {
      // First run: seed the four base elements.
      Engine.BASE_ELEMENTS.forEach(function (b) { addDiscovery(b, false); });
    }

    var savedNew = load(LS.newIds, []);
    savedNew.forEach(function (id) { newIds[id] = true; });

    aiEnabled = !!aiEnabled;
    aiToggle.checked = aiEnabled;
    updateAiStatus(aiEnabled ? 'pending' : 'off');

    renderSort();
    renderList();
    restoreCanvas();
    wireEvents();
    updateHint();
  }

  /* =====================================================================
   * Discoveries
   * ===================================================================== */
  function addDiscovery(el, isNew) {
    if (!discoveries[el.id]) {
      discoveries[el.id] = {
        id: el.id, name: el.name, emoji: el.emoji,
        category: el.category, at: Object.keys(discoveries).length
      };
      if (isNew) newIds[el.id] = true;
      persistDiscoveries();
      return true; // genuinely new
    }
    return false;
  }

  function persistDiscoveries() {
    save(LS.disc, Object.keys(discoveries).map(function (k) { return discoveries[k]; }));
    save(LS.newIds, Object.keys(newIds));
  }

  function sortedDiscoveries() {
    var arr = Object.keys(discoveries).map(function (k) { return discoveries[k]; });
    if (sortMode === 'name') {
      arr.sort(function (a, b) { return a.name.localeCompare(b.name); });
    } else if (sortMode === 'category') {
      arr.sort(function (a, b) {
        return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
      });
    } else { // time
      arr.sort(function (a, b) { return a.at - b.at; });
    }
    return arr;
  }

  /* =====================================================================
   * Sidebar rendering
   * ===================================================================== */
  function renderList() {
    var q = (searchEl.value || '').trim().toLowerCase();
    var arr = sortedDiscoveries().filter(function (d) {
      return !q || d.name.toLowerCase().indexOf(q) >= 0 || d.category.indexOf(q) >= 0;
    });

    countEl.textContent = Object.keys(discoveries).length;
    listEl.innerHTML = '';

    if (!arr.length) {
      var empty = document.createElement('div');
      empty.className = 'item-empty';
      empty.textContent = q ? 'No matches.' : 'No discoveries yet.';
      listEl.appendChild(empty);
      return;
    }

    arr.forEach(function (d) {
      var item = document.createElement('button');
      item.className = 'item' + (newIds[d.id] ? ' is-new' : '');
      item.type = 'button';
      item.dataset.id = d.id;
      item.title = d.name + ' · ' + d.category;
      item.innerHTML = '<span class="emoji">' + d.emoji + '</span><span class="label"></span>';
      item.querySelector('.label').textContent = d.name;
      listEl.appendChild(item);
    });
  }

  function renderSort() {
    var labels = { time: 'Time', name: 'A–Z', category: 'Type' };
    sortBtn.textContent = 'Sort: ' + labels[sortMode];
  }

  /* =====================================================================
   * Canvas tokens
   * ===================================================================== */
  function makeToken(disc, x, y, spawnAnim) {
    var el = document.createElement('div');
    el.className = 'token' + (spawnAnim ? ' spawn' : '');
    el.innerHTML = '<span class="emoji">' + disc.emoji + '</span><span class="label"></span>';
    el.querySelector('.label').textContent = disc.name;
    canvasEl.appendChild(el);

    var rec = { uid: uidSeq++, id: disc.id, el: el, x: x, y: y };
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    tokens.push(rec);
    el._rec = rec;
    updateHint();
    return rec;
  }

  function removeToken(rec) {
    var i = tokens.indexOf(rec);
    if (i >= 0) tokens.splice(i, 1);
    if (rec.el && rec.el.parentNode) rec.el.parentNode.removeChild(rec.el);
    persistCanvas();
    updateHint();
  }

  function clearCanvas() {
    tokens.slice().forEach(function (t) {
      if (t.el && t.el.parentNode) t.el.parentNode.removeChild(t.el);
    });
    tokens = [];
    persistCanvas();
    updateHint();
  }

  function persistCanvas() {
    save(LS.canvas, tokens.map(function (t) { return { id: t.id, x: t.x, y: t.y }; }));
  }

  function restoreCanvas() {
    var saved = load(LS.canvas, []);
    saved.forEach(function (s) {
      var d = discoveries[s.id];
      if (d) makeToken(d, s.x, s.y, false);
    });
  }

  function updateHint() {
    hintEl.classList.toggle('hidden', tokens.length > 0);
  }

  /* Where to drop a freshly spawned token (sidebar click) */
  function spawnPoint() {
    var r = canvasEl.getBoundingClientRect();
    var jitter = function (n) { return (Math.random() - 0.5) * n; };
    return {
      x: r.width / 2 - 50 + jitter(140),
      y: r.height / 2 - 18 + jitter(120)
    };
  }

  /* =====================================================================
   * Combining
   * ===================================================================== */
  function combineDiscoveries(aId, bId, cb) {
    var a = discoveries[aId], b = discoveries[bId];
    if (!a || !b) { cb(null); return; }

    if (aiEnabled && aiEndpoint !== false) {
      aiCombine(a, b, function (res) {
        if (res) { cb(res); }
        else { cb(Engine.combine(a, b)); } // graceful fallback
      });
    } else {
      cb(Engine.combine(a, b));
    }
  }

  // Merge two tokens: produce a result token at their midpoint.
  function mergeTokens(dragged, target) {
    var midX = (dragged.x + target.x) / 2;
    var midY = (dragged.y + target.y) / 2;

    dragged.el.classList.add('merging');
    target.el.classList.add('merging');

    combineDiscoveries(dragged.id, target.id, function (result) {
      removeToken(dragged);
      removeToken(target);
      if (!result) return;

      var isNew = addDiscovery(result, true);
      var rec = makeToken(discoveries[result.id], midX, midY, true);
      persistCanvas();

      if (isNew) {
        celebrate(rec, result);
        renderList();
      } else {
        toast(result.emoji + ' ' + result.name, false);
        // Seeing it again clears the NEW badge.
        if (newIds[result.id]) { delete newIds[result.id]; persistDiscoveries(); renderList(); }
      }
    });
  }

  function celebrate(rec, result) {
    toast('First Discovery: ' + result.emoji + ' ' + result.name + '!', true);
    var r = rec.el.getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    var sparks = ['✨', '⭐', '🎉', result.emoji, '💫'];
    for (var i = 0; i < 7; i++) {
      var s = document.createElement('div');
      s.className = 'burst';
      s.textContent = sparks[i % sparks.length];
      s.style.left = cx + 'px';
      s.style.top = cy + 'px';
      var ang = (Math.PI * 2 * i) / 7;
      s.style.setProperty('--bx', Math.cos(ang) * 70 + 'px');
      s.style.setProperty('--by', Math.sin(ang) * 70 + 'px');
      document.body.appendChild(s);
      (function (node) { setTimeout(function () { node.remove(); }, 720); })(s);
    }
  }

  /* =====================================================================
   * Drag and drop (pointer events: mouse + touch unified)
   * ===================================================================== */
  var drag = null; // { rec, offX, offY, moved }

  function clientToCanvas(clientX, clientY) {
    var r = canvasEl.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  }

  function clampToken(rec) {
    var r = canvasEl.getBoundingClientRect();
    var w = rec.el.offsetWidth, h = rec.el.offsetHeight;
    rec.x = Math.max(0, Math.min(rec.x, r.width - w));
    rec.y = Math.max(0, Math.min(rec.y, r.height - h));
  }

  function startDrag(rec, clientX, clientY) {
    var p = clientToCanvas(clientX, clientY);
    drag = { rec: rec, offX: p.x - rec.x, offY: p.y - rec.y, moved: false };
    rec.el.classList.add('dragging');
    // bring to front
    canvasEl.appendChild(rec.el);
  }

  function moveDrag(clientX, clientY) {
    if (!drag) return;
    var p = clientToCanvas(clientX, clientY);
    drag.rec.x = p.x - drag.offX;
    drag.rec.y = p.y - drag.offY;
    drag.moved = true;
    clampToken(drag.rec);
    drag.rec.el.style.left = drag.rec.x + 'px';
    drag.rec.el.style.top = drag.rec.y + 'px';
    highlightTarget();
  }

  function tokenCenter(rec) {
    return { x: rec.x + rec.el.offsetWidth / 2, y: rec.y + rec.el.offsetHeight / 2 };
  }

  function findTargetUnder(rec) {
    var c = tokenCenter(rec);
    // topmost (last appended) token that contains the dragged token's center
    for (var i = tokens.length - 1; i >= 0; i--) {
      var t = tokens[i];
      if (t === rec) continue;
      var l = t.x, top = t.y, w = t.el.offsetWidth, h = t.el.offsetHeight;
      if (c.x >= l && c.x <= l + w && c.y >= top && c.y <= top + h) return t;
    }
    return null;
  }

  function highlightTarget() {
    var target = findTargetUnder(drag.rec);
    tokens.forEach(function (t) {
      if (t !== drag.rec) t.el.classList.toggle('drop-target', t === target);
    });
  }

  function endDrag() {
    if (!drag) return;
    var rec = drag.rec;
    rec.el.classList.remove('dragging');
    tokens.forEach(function (t) { t.el.classList.remove('drop-target'); });

    if (drag.moved) {
      var target = findTargetUnder(rec);
      if (target) { mergeTokens(rec, target); drag = null; return; }
      persistCanvas();
    }
    drag = null;
  }

  /* =====================================================================
   * Event wiring
   * ===================================================================== */
  function wireEvents() {
    // Start dragging a canvas token
    canvasEl.addEventListener('pointerdown', function (e) {
      var tokenEl = e.target.closest && e.target.closest('.token');
      if (!tokenEl || !tokenEl._rec) return;
      e.preventDefault();
      startDrag(tokenEl._rec, e.clientX, e.clientY);
    });

    // Double-click / double-tap a canvas token to remove it
    canvasEl.addEventListener('dblclick', function (e) {
      var tokenEl = e.target.closest && e.target.closest('.token');
      if (tokenEl && tokenEl._rec) removeToken(tokenEl._rec);
    });

    window.addEventListener('pointermove', function (e) {
      if (drag) { e.preventDefault(); moveDrag(e.clientX, e.clientY); }
    }, { passive: false });

    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);

    // Sidebar: click an item to spawn it; press-and-drag to carry it onto the canvas
    listEl.addEventListener('pointerdown', function (e) {
      var item = e.target.closest && e.target.closest('.item');
      if (!item) return;
      var id = item.dataset.id;
      var d = discoveries[id];
      if (!d) return;

      e.preventDefault();
      // Clear NEW badge on interaction.
      if (newIds[id]) { delete newIds[id]; persistDiscoveries(); renderList(); }

      var sp = spawnPoint();
      var rec = makeToken(d, sp.x, sp.y, true);
      persistCanvas();
      // Begin a drag carried by the pointer — but DON'T snap the token to the
      // cursor (the cursor is over the sidebar, off-canvas). A plain click
      // leaves the token at its spawn point; moving the pointer onto the
      // canvas makes it follow. This avoids two same-item clicks landing on
      // the same clamped spot and auto-merging.
      rec.el.classList.add('dragging');
      canvasEl.appendChild(rec.el); // bring to front
      drag = { rec: rec, offX: rec.el.offsetWidth / 2, offY: rec.el.offsetHeight / 2, moved: false };
    });

    // Search
    searchEl.addEventListener('input', renderList);

    // Sort cycling
    sortBtn.addEventListener('click', function () {
      sortMode = sortMode === 'time' ? 'name' : sortMode === 'name' ? 'category' : 'time';
      save(LS.sort, sortMode);
      renderSort();
      renderList();
    });

    // Clear table
    $('#clear-canvas').addEventListener('click', clearCanvas);

    // Reset everything
    $('#reset-btn').addEventListener('click', function () {
      if (!confirm('Reset all progress? This wipes every discovery and the table.')) return;
      [LS.disc, LS.canvas, LS.newIds].forEach(function (k) { localStorage.removeItem(k); });
      discoveries = {}; newIds = {}; clearCanvas();
      Engine.BASE_ELEMENTS.forEach(function (b) { addDiscovery(b, false); });
      renderList();
      toast('Progress reset. Back to basics. 🌿', false);
    });

    // AI mode toggle
    aiToggle.addEventListener('change', function () {
      aiEnabled = aiToggle.checked;
      save(LS.ai, aiEnabled);
      if (aiEnabled) { updateAiStatus('pending'); probeAi(); }
      else { updateAiStatus('off'); aiEndpoint = null; }
    });

    if (aiEnabled) probeAi();
  }

  /* =====================================================================
   * Toast
   * ===================================================================== */
  var toastTimer = null;
  function toast(msg, gold) {
    toastEl.textContent = msg;
    toastEl.classList.toggle('gold', !!gold);
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, gold ? 2600 : 1600);
  }

  /* =====================================================================
   * Optional AI backend (Claude via server.js)
   * ===================================================================== */
  function updateAiStatus(state) {
    aiStatus.className = 'ai-status' + (state === 'on' ? ' on' : state === 'err' ? ' err' : '');
    aiStatus.textContent = state === 'on' ? 'on' : state === 'err' ? 'offline' : state === 'pending' ? '…' : 'off';
  }

  function probeAi() {
    // Try each endpoint with a tiny ping; first that responds wins.
    var tried = 0;
    function next() {
      if (tried >= AI_ENDPOINTS.length) { aiEndpoint = false; updateAiStatus('err'); return; }
      var url = AI_ENDPOINTS[tried++];
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ a: { name: 'Water', emoji: '💧', category: 'base' },
                               b: { name: 'Fire', emoji: '🔥', category: 'base' } })
      }).then(function (r) {
        if (r.ok) { aiEndpoint = url; updateAiStatus('on'); }
        else next();
      }).catch(next);
    }
    next();
  }

  function aiCombine(a, b, cb) {
    if (!aiEndpoint) { cb(null); return; }
    fetch(aiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ a: a, b: b })
    }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (j && j.name) { cb({ name: j.name, emoji: j.emoji || '✨', category: j.category || 'synthetic' }); }
        else cb(null);
      })
      .catch(function () { updateAiStatus('err'); cb(null); });
  }

  /* ------------------------- go ------------------------- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
