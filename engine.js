/*
 * Drug Craft — combination engine
 * ------------------------------------------------------------------
 * Pure, deterministic, dependency-free. Given two elements it always
 * returns the same result, so the world is stable across sessions
 * (just like Infinite Craft). Three layers are tried in order:
 *
 *   1. Explicit recipes   — hand-authored, satisfying early-game tree
 *   2. Transform rules     — "modifier" elements (Fire, Water, Money,
 *                            Needle, Press, Law...) reshape any substance
 *   3. Procedural blend    — hash-driven name + emoji + category, so the
 *                            tree never dead-ends and feels endless
 *
 * Everything is offline. An optional Claude backend can override layer 3
 * (see server.js + game.js), but the game is fully playable without it.
 *
 * Educational/satirical project. No real synthesis information is encoded.
 */
(function (global) {
  'use strict';

  /* ----------------------------------------------------------------
   * Base (starting) elements — the four pillars of the craft
   * ---------------------------------------------------------------- */
  const BASE_ELEMENTS = [
    { id: 'plant',    name: 'Plant',    emoji: '🌿', category: 'natural' },
    { id: 'chemical', name: 'Chemical', emoji: '⚗️', category: 'synthetic' },
    { id: 'water',    name: 'Water',    emoji: '💧', category: 'base' },
    { id: 'fire',     name: 'Fire',     emoji: '🔥', category: 'base' }
  ];

  /* ----------------------------------------------------------------
   * Helpers
   * ---------------------------------------------------------------- */
  function slug(name) {
    return String(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // cyrb53 — fast, well-distributed 53-bit string hash. Deterministic.
  function hash(str) {
    let h1 = 0xdeadbeef ^ 0, h2 = 0x41c6ce57 ^ 0;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }

  function pick(arr, seed) {
    return arr[seed % arr.length];
  }

  function titleCase(s) {
    return s.replace(/\w\S*/g, function (t) {
      return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
    });
  }

  // Stable key for a pair (order-independent).
  function pairKey(aId, bId) {
    return [aId, bId].sort().join('+');
  }

  /* ----------------------------------------------------------------
   * Layer 1 — explicit recipes
   * A hand-authored tech tree. Keys are order-independent "a+b" of ids.
   * ---------------------------------------------------------------- */
  const RAW_RECIPES = {
    // --- Tier 1: from the four pillars ---
    'plant+plant':       { name: 'Cannabis',    emoji: '🌿', category: 'cannabis' },
    'plant+water':       { name: 'Poppy',       emoji: '🌺', category: 'natural' },
    'chemical+plant':    { name: 'Coca Leaf',   emoji: '🍃', category: 'natural' },
    'fire+plant':        { name: 'Smoke',       emoji: '💨', category: 'base' },
    'chemical+chemical': { name: 'Acid',        emoji: '🧪', category: 'synthetic' },
    'chemical+water':    { name: 'Solvent',     emoji: '🧴', category: 'synthetic' },
    'chemical+fire':     { name: 'Reaction',    emoji: '🧫', category: 'synthetic' },
    'fire+water':        { name: 'Steam',       emoji: '♨️', category: 'base' },
    'fire+fire':         { name: 'Lab Burner',  emoji: '🔥', category: 'lab' },
    'water+water':       { name: 'Saline',      emoji: '💧', category: 'base' },

    // --- Infrastructure ---
    'fire+reaction':     { name: 'Lab',         emoji: '🔬', category: 'lab' },
    'chemical+lab':      { name: 'Lab',         emoji: '🔬', category: 'lab' },
    'lab+water':         { name: 'Beaker',      emoji: '🧪', category: 'lab' },
    'smoke+water':       { name: 'Bong',        emoji: '🌀', category: 'paraphernalia' },
    'fire+smoke':        { name: 'Lighter',     emoji: '🔥', category: 'paraphernalia' },

    // --- Cannabis branch ---
    'cannabis+fire':     { name: 'Joint',       emoji: '🚬', category: 'cannabis' },
    'cannabis+cannabis': { name: 'Hash',        emoji: '🟤', category: 'cannabis' },
    'cannabis+chemical': { name: 'THC Wax',     emoji: '🍯', category: 'cannabis' },
    'cannabis+water':    { name: 'Edible',      emoji: '🍪', category: 'cannabis' },
    'cannabis+lab':      { name: 'Distillate',  emoji: '💛', category: 'cannabis' },
    'bong+cannabis':     { name: 'Stoner',      emoji: '😶‍🌫️', category: 'people' },

    // --- Stimulant branch (coca) ---
    'chemical+coca-leaf': { name: 'Cocaine',    emoji: '❄️', category: 'stimulant' },
    'coca-leaf+lab':      { name: 'Cocaine',    emoji: '❄️', category: 'stimulant' },
    'cocaine+fire':       { name: 'Crack',      emoji: '🪨', category: 'stimulant' },
    'cocaine+water':      { name: 'Freebase',   emoji: '🌬️', category: 'stimulant' },
    'cocaine+cocaine':    { name: 'Kilo',       emoji: '🧱', category: 'product' },

    // --- Meth branch ---
    'chemical+solvent':   { name: 'Pseudo',     emoji: '🧴', category: 'synthetic' },
    'lab+solvent':        { name: 'Meth',       emoji: '💎', category: 'stimulant' },
    'fire+pseudo':        { name: 'Meth',       emoji: '💎', category: 'stimulant' },
    'meth+meth':          { name: 'Crystal Meth', emoji: '💠', category: 'stimulant' },
    'lab+meth':           { name: 'Blue Meth',  emoji: '🔵', category: 'stimulant' },

    // --- Opioid branch (poppy) ---
    'fire+poppy':         { name: 'Opium',      emoji: '🌑', category: 'opioid' },
    'chemical+poppy':     { name: 'Opium',      emoji: '🌑', category: 'opioid' },
    'lab+opium':          { name: 'Morphine',   emoji: '💊', category: 'opioid' },
    'chemical+opium':     { name: 'Morphine',   emoji: '💊', category: 'opioid' },
    'chemical+morphine':  { name: 'Heroin',     emoji: '🩸', category: 'opioid' },
    'lab+morphine':       { name: 'Heroin',     emoji: '🩸', category: 'opioid' },
    'chemical+heroin':    { name: 'Fentanyl',   emoji: '☠️', category: 'opioid' },
    'lab+fentanyl':       { name: 'Carfentanil', emoji: '💀', category: 'opioid' },

    // --- Psychedelic branch ---
    'acid+chemical':      { name: 'LSD',        emoji: '🌈', category: 'psychedelic' },
    'acid+plant':         { name: 'Ergot',      emoji: '🌾', category: 'natural' },
    'lab+ergot':          { name: 'LSD',        emoji: '🌈', category: 'psychedelic' },
    'plant+steam':        { name: 'Mushroom',   emoji: '🍄', category: 'natural' },
    'mushroom+mushroom':  { name: 'Psilocybin', emoji: '🍄‍🟫', category: 'psychedelic' },
    'chemical+mushroom':  { name: 'Psilocybin', emoji: '🍄‍🟫', category: 'psychedelic' },
    'cannabis+acid':      { name: 'DMT',        emoji: '👁️', category: 'psychedelic' },
    'acid+steam':         { name: 'Peyote',     emoji: '🌵', category: 'natural' },
    'lab+peyote':         { name: 'Mescaline',  emoji: '🌵', category: 'psychedelic' },

    // --- Dissociatives / party ---
    'chemical+steam':     { name: 'Ether',      emoji: '🌫️', category: 'dissociative' },
    'ether+lab':          { name: 'Ketamine',   emoji: '🐴', category: 'dissociative' },
    'chemical+acid':      { name: 'MDMA',       emoji: '💗', category: 'stimulant' },
    'lab+mdma':           { name: 'Ecstasy',    emoji: '💊', category: 'stimulant' },
    'mdma+water':         { name: 'Molly',      emoji: '🫧', category: 'stimulant' },
    'chemical+gas':       { name: 'Nitrous',    emoji: '🎈', category: 'dissociative' },

    // --- Paraphernalia & people ---
    'chemical+lab-burner': { name: 'Needle',    emoji: '💉', category: 'paraphernalia' },
    'heroin+needle':       { name: 'Junkie',    emoji: '🧟', category: 'people' },
    'smoke+smoke':         { name: 'Pipe',      emoji: '🟫', category: 'paraphernalia' },
    'crack+pipe':          { name: 'Crackhead', emoji: '😵', category: 'people' },
    'lab+pipe':            { name: 'Pill Press', emoji: '🛠️', category: 'paraphernalia' },

    // --- Meta / business ---
    'cocaine+kilo':        { name: 'Cartel',    emoji: '💼', category: 'crime' },
    'kilo+kilo':           { name: 'Drug Lord', emoji: '🤵', category: 'crime' },
    'cartel+fire':         { name: 'Cartel War', emoji: '💥', category: 'crime' },
    'crack+crack':         { name: 'Crack Epidemic', emoji: '🏚️', category: 'crime' }
  };

  // Normalize raw recipe keys to sorted pair keys for safe lookup.
  const RECIPES = {};
  Object.keys(RAW_RECIPES).forEach(function (k) {
    const parts = k.split('+');
    RECIPES[pairKey(parts[0], parts[1])] = RAW_RECIPES[k];
  });

  /* ----------------------------------------------------------------
   * Layer 2 — transform rules
   * If one input is a "modifier" and the other is any element, reshape it.
   * Each rule: test the modifier against an element's id/name, and build a
   * result from the *other* element. Order of checks matters (first match).
   * ---------------------------------------------------------------- */
  const MODIFIERS = [
    {
      match: /fire|flame|heat|lighter|burner|torch/,
      skip: /smoke|joint|ash|crack/, // already "burnt"
      build: function (e, seed) {
        const t = pick(['Smoked ', 'Burnt ', 'Hot '], seed);
        return { name: t + e.name, emoji: '💨', category: e.category };
      }
    },
    {
      match: /^water$|liquid|saline|solvent/,
      skip: /solution|liquid|syrup/,
      build: function (e, seed) {
        const t = pick([e.name + ' Solution', 'Liquid ' + e.name, e.name + ' Syrup'], seed);
        return { name: t, emoji: '🧴', category: e.category };
      }
    },
    {
      match: /needle|syringe/,
      build: function (e) {
        return { name: e.name + ' Shot', emoji: '💉', category: e.category };
      }
    },
    {
      match: /pipe|bong/,
      build: function (e) {
        return { name: e.name + ' Hit', emoji: '🟫', category: e.category };
      }
    },
    {
      match: /press|pill/,
      build: function (e) {
        return { name: e.name + ' Pill', emoji: '💊', category: 'pharmaceutical' };
      }
    },
    {
      match: /lab|beaker|distillate/,
      skip: /lab|beaker/,
      build: function (e, seed) {
        const t = pick(['Synthetic ', 'Refined ', 'Pure '], seed);
        return { name: t + e.name, emoji: '✨', category: e.category };
      }
    },
    {
      match: /money|cash|kilo|cartel/,
      skip: /money|cash|empire|lord/,
      build: function (e, seed) {
        const t = pick([e.name + ' Empire', e.name + ' Money', e.name + ' Operation'], seed);
        return { name: t, emoji: '💰', category: 'crime' };
      }
    },
    {
      match: /police|cop|law|dea|narc/,
      build: function (e) {
        return { name: e.name + ' Bust', emoji: '🚔', category: 'crime' };
      }
    }
  ];

  // Categories that should NOT be treated as the "substance" in a transform
  // (i.e. a modifier hitting another modifier just blends procedurally).
  function applyModifiers(a, b, seed) {
    const order = [[a, b], [b, a]];
    for (let i = 0; i < order.length; i++) {
      const mod = order[i][0], subj = order[i][1];
      const hay = (mod.id + ' ' + mod.name).toLowerCase();
      for (let r = 0; r < MODIFIERS.length; r++) {
        const rule = MODIFIERS[r];
        if (rule.match.test(hay)) {
          const subjHay = (subj.id + ' ' + subj.name).toLowerCase();
          if (rule.skip && rule.skip.test(subjHay)) continue;
          // Don't let a modifier transform another instance of itself oddly.
          const out = rule.build(subj, seed);
          if (out && out.name.toLowerCase() !== subj.name.toLowerCase()) {
            return out;
          }
        }
      }
    }
    return null;
  }

  /* ----------------------------------------------------------------
   * Layer 3 — procedural blend
   * Deterministic, hash-seeded. Produces a novel, on-theme element.
   * ---------------------------------------------------------------- */
  const CATEGORY_EMOJI = {
    natural:        ['🌿', '🍃', '🌱', '🌺', '🍄', '🌵', '🌾'],
    cannabis:       ['🌿', '🟤', '🍪', '💚', '🚬'],
    stimulant:      ['❄️', '⚡', '💎', '💗', '🔆', '🌀'],
    opioid:         ['💊', '🩸', '😵‍💫', '🌑', '💉'],
    psychedelic:    ['🌈', '👁️', '🌀', '🔮', '🦄', '🍄'],
    dissociative:   ['🌫️', '🐴', '🌀', '🎈', '💫'],
    synthetic:      ['⚗️', '🧪', '🧫', '🧬', '☣️'],
    depressant:     ['😴', '🍷', '💤', '🥃'],
    pharmaceutical: ['💊', '🩹', '🏥', '🧴'],
    paraphernalia:  ['🟫', '💉', '🌀', '🛠️', '🔥'],
    people:         ['🧟', '😵', '🤡', '🧑‍🔬', '🥴'],
    crime:          ['💰', '💼', '🚔', '💥', '⛓️', '🤵'],
    lab:            ['🔬', '🧪', '⚗️', '🥼'],
    hazard:         ['☠️', '💀', '☣️', '⚠️'],
    base:           ['💨', '♨️', '🌫️', '✨']
  };

  // How "intense" each category is — used to escalate when two strong
  // categories combine (e.g. opioid + stimulant -> hazard / "speedball").
  const INTENSITY = {
    base: 0, natural: 1, lab: 1, paraphernalia: 1, pharmaceutical: 2,
    cannabis: 2, depressant: 3, dissociative: 3, psychedelic: 4,
    stimulant: 4, synthetic: 4, opioid: 5, people: 2, crime: 5, hazard: 6
  };

  const BLEND_TEMPLATES = [
    function (a, b) { return a.name + ' ' + b.name; },
    function (a, b) { return b.name + ' ' + a.name; },
    function (a, b) { return portmanteau(a.name, b.name); },
    function (a, b) { return a.name + '-Laced ' + b.name; },
    function (a, b) { return 'Street ' + b.name; },
    function (a, b) { return 'Designer ' + a.name; },
    function (a, b) { return 'Bootleg ' + b.name; },
    function (a, b) { return a.name + ' Cocktail'; },
    function (a, b) { return 'Cut ' + a.name; },
    function (a, b) { return 'Homemade ' + b.name; },
    function (a, b) { return a.name + ' Blend'; }
  ];

  function portmanteau(x, y) {
    const a = x.split(' ')[0];
    const b = y.split(' ').slice(-1)[0];
    const head = a.slice(0, Math.max(2, Math.ceil(a.length / 2)));
    const tail = b.slice(Math.floor(b.length / 2));
    return titleCase(head + tail);
  }

  function chooseCategory(a, b, seed) {
    const ia = INTENSITY[a.category] || 1;
    const ib = INTENSITY[b.category] || 1;
    // Two potent substances => escalate toward hazard occasionally.
    if (ia >= 4 && ib >= 4 && (seed % 3 === 0)) return 'hazard';
    // Otherwise inherit the more "interesting" (higher intensity) parent.
    if (ia === ib) return seed % 2 ? a.category : b.category;
    return ia > ib ? a.category : b.category;
  }

  function proceduralBlend(a, b, seed) {
    const category = chooseCategory(a, b, seed);
    let name = pick(BLEND_TEMPLATES, seed)(a, b);
    name = titleCase(name.replace(/\s+/g, ' ').trim());

    // Avoid producing a name identical to either input.
    if (name.toLowerCase() === a.name.toLowerCase() ||
        name.toLowerCase() === b.name.toLowerCase()) {
      name = portmanteau(a.name, b.name);
    }
    const pool = CATEGORY_EMOJI[category] || CATEGORY_EMOJI.base;
    const emoji = pick(pool, Math.floor(seed / 7));
    return { name: name, emoji: emoji, category: category };
  }

  /* ----------------------------------------------------------------
   * Public: combine(a, b)
   * a, b are element objects { id, name, emoji, category }.
   * Returns a fully-formed element { id, name, emoji, category }.
   * Deterministic for a given unordered pair.
   * ---------------------------------------------------------------- */
  function combine(a, b) {
    // Canonicalize order so the result is identical regardless of which token
    // was dragged onto which. The seed is already order-independent, but the
    // transform/blend templates use positional inputs, so we sort here too.
    if (a.id > b.id) { const t = a; a = b; b = t; }

    const key = pairKey(a.id, b.id);
    const seed = hash(key);

    let result = RECIPES[key] || null;
    if (!result) result = applyModifiers(a, b, seed);
    if (!result) result = proceduralBlend(a, b, seed);

    // Finalize: ensure id + clean shape.
    return {
      id: slug(result.name),
      name: result.name,
      emoji: result.emoji || '✨',
      category: result.category || 'synthetic'
    };
  }

  const Engine = {
    BASE_ELEMENTS: BASE_ELEMENTS,
    combine: combine,
    slug: slug,
    hash: hash,
    CATEGORY_EMOJI: CATEGORY_EMOJI
  };

  // UMD-ish export: browser global + CommonJS (for the optional server/tests).
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Engine;
  }
  global.DrugCraftEngine = Engine;
})(typeof window !== 'undefined' ? window : globalThis);
