const dotenv = require('dotenv');
const path = require('path');
// Load env from project root .env
dotenv.config({ path: path.join(__dirname, '.env') });
// Fallback: also try public/.env if key is still missing
if (!process.env.OPENAI_API_KEY) {
  dotenv.config({ path: path.join(__dirname, 'public', '.env') });
}
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Serve static files
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));
app.use(express.json({ limit: '1mb' }));

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
console.log(`[server] OpenAI key loaded: ${process.env.OPENAI_API_KEY ? 'yes' : 'no'} | model: ${MODEL}`);

// Basic story graph – Corporate Citistate
const story = {
  start: {
    id: 'start',
    text: 'Welcome to Corporate Citistate — where neon halos crown glass towers and ambitions run vertical.',
    choices: [
      { id: 'enter_tower', text: 'Enter the Corporate Tower', desc: 'A monolith of glass and compliance. Executive floors hum with curated power.' },
      { id: 'explore_market', text: 'Explore the Neon Market', desc: 'Pop-up stalls broadcast firmware futures. Deals, debts, and data.' }
    ]
  },
  enter_tower: {
    id: 'enter_tower',
    text: 'Security gates hum. A biometric scanner watches with synthetic patience.',
    choices: [
      { id: 'talk_guard', text: 'Talk to Security', desc: 'Ask for guidance. Speak softly. Let the system believe in you.' },
      { id: 'sprint_elevator', text: 'Sprint for the Elevators', desc: 'Beat the lock. Ride momentum into the logistical heart.' }
    ]
  },
  explore_market: {
    id: 'explore_market',
    text: 'The market glows with contraband firmware and corporate-approved dreams.',
    choices: [
      { id: 'approach_vendor', text: 'Approach a Vendor', desc: 'They trade in possibilities. Prices fluctuate with your pulse.' },
      { id: 'follow_drone', text: 'Follow a Courier Drone', desc: 'Shadow logistics gives away the city’s respiration.' }
    ]
  },
  talk_guard: {
    id: 'talk_guard',
    text: 'The guard tilts their visor. “Credentials?” The city holds its breath.',
    choices: [
      { id: 'flash_badge', text: 'Flash a Temporary Badge' },
      { id: 'retreat_lobby', text: 'Retreat to the Lobby' }
    ]
  },
  sprint_elevator: {
    id: 'sprint_elevator',
    text: 'You dash. Doors slide. For an instant, the tower believes you belong.',
    choices: [
      { id: 'penthouse', text: 'Aim for the Penthouse' },
      { id: 'data_floor', text: 'Descend to the Data Floor' }
    ]
  },
  approach_vendor: {
    id: 'approach_vendor',
    text: '“Looking for futures?” the vendor grins, offering a glowing wafer.',
    choices: [
      { id: 'buy_wafer', text: 'Buy the Quantum Wafer' },
      { id: 'decline_wafer', text: 'Decline Politely' }
    ]
  },
  follow_drone: {
    id: 'follow_drone',
    text: 'The drone weaves alleys like a whisper, leading you to a loading dock.',
    choices: [
      { id: 'dock_terminal', text: 'Access the Dock Terminal' },
      { id: 'hide_crates', text: 'Hide Among the Crates' }
    ]
  },
  // Some simple endpoints
  flash_badge: { id: 'flash_badge', text: 'The scanner blinks green. Access granted.', choices: [] },
  retreat_lobby: { id: 'retreat_lobby', text: 'You step back. The lobby orchestra resumes its hum.', choices: [] },
  penthouse: { id: 'penthouse', text: 'The skyline unfolds like a ledger. You made it to the top — tonight.', choices: [] },
  data_floor: { id: 'data_floor', text: 'Rows of servers breathe frost. Secrets sleep in patterns.', choices: [] },
  buy_wafer: { id: 'buy_wafer', text: 'The wafer warms your palm. A future rewrites itself.', choices: [] },
  decline_wafer: { id: 'decline_wafer', text: '“Wise,” they smirk. Some futures cost too much.', choices: [] },
  dock_terminal: { id: 'dock_terminal', text: 'Terminals chirp compliance. A portal opens.', choices: [] },
  hide_crates: { id: 'hide_crates', text: 'You vanish between shipments; the city forgets you — for now.', choices: [] }
};

function getNodePayload(nodeId) {
  const node = story[nodeId];
  if (!node) return null;
  // Clone minimal payload for client
  return {
    id: node.id,
    text: node.text,
    choices: (node.choices || []).map(c => ({ id: c.id, text: c.text }))
  };
}

io.on('connection', (socket) => {
  const start = getNodePayload('start');
  socket.emit('story-start', start);

  socket.on('choice-selected', (choiceId) => {
    const next = getNodePayload(choiceId);
    if (!next) {
      socket.emit('error-message', { message: `Unknown choice id: ${choiceId}` });
      return;
    }
    socket.emit('update-scene', next);
  });

  socket.on('restart', () => {
    const startAgain = getNodePayload('start');
    socket.emit('update-scene', startAgain);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Threadweaver online at http://localhost:${PORT}`);
});

// Lightweight chat proxy to OpenAI Responses API
app.post('/api/chat', async (req, res) => {
  try {
    const { npcId, personaSeed, messages } = req.body || {};
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'Missing OPENAI_API_KEY' });
    }
    // Lightweight in-memory character memory to create small arcs
    const parsePersona = () => {
      try { return JSON.parse(personaSeed || '{}'); } catch { return { seed: String(personaSeed||'') }; }
    };
    global.__NPC_MEMORY__ = global.__NPC_MEMORY__ || new Map();
    const key = npcId || 'unknown';
    if (!global.__NPC_MEMORY__.has(key)) {
      const p = parsePersona();
      const archetypes = ['runaway analyst','street poet','tower custodian','market fixer','drone tuner','sound cartographer'];
      const secrets = ['owes a quiet debt','stole a sunset file','can hear elevators dream','keeps a ghost-radio','maps footsteps','feeds stray servers'];
      const goals = ['find a lost packet','repair a broken loop','leave the tower','buy time for a friend','teach the city a song','win one honest trade'];
      const moods = ['wry','sardonic','sweet','deadpan','chaotic','earnest','snarky','soft-spoken'];
      const family = ['single','married','it\'s complicated','roommates forever','recently divorced'];
      const partner = ['Ari','Bo','Cyra','Dax','Eve','Fox','Gale','Halo','Iris','Jett'];
      const pets = ['koi drone','street cat','ferret','gecko','pigeon','robo-moth'];
      const hobbies = ['hoards neon postcards','writes micro-haikus','speed-cooks dumplings','repairs junk synths','chases sunsets','brews silly tea'];
      const stressors = ['late rent','tower audits','wedding planning','sibling drama','broken drone','boss texts at 2am'];
      const favorites = ['dumplings','noodles','spicy tofu','sweet buns','sour synthpop','old jazz'];
      const gossipTarget = ['tower exec','market broker','drone union','street vendor','archivist','security chief'];
      const rumorBits = ['seeing someone in secret','embezzling time credits','opening a speakeasy','planning to flee the city','rigging a raffle','hoarding batteries'];
      const rand = (arr) => arr[Math.floor(Math.random()*arr.length)];
      global.__NPC_MEMORY__.set(key, {
        name: p.name || 'Nyx',
        role: p.role || rand(archetypes),
        quirk: p.quirk || rand(secrets),
        goal: rand(goals),
        mood: rand(moods),
        family: rand(family),
        partner: rand(partner),
        pet: rand(pets),
        hobby: rand(hobbies),
        stressor: rand(stressors),
        favorite: rand(favorites),
        gossip: `${rand(gossipTarget)} is ${rand(rumorBits)}`,
        arcStep: 0,
        seed: p.seed || personaSeed || ''
      });
    }
    const mem = global.__NPC_MEMORY__.get(key);
    mem.arcStep += 1;

    const styleRules = [
      'Write 1–2 short lines.',
      'Plain, direct phrasing; minimal flourish; feel conversational.',
      'Unpredictable tone each turn (friendly, brusque, distracted, sarcastic, excited, annoyed, goofy).',
      'Push the arc a little each turn (tiny reveal/action/choice).',
      'Often share personal life (gossip, family, wedding plans, stress, pet antics, favorite food/music).',
      'About 30%: end with a playful hook or one-line riddle.'
    ].join(' ');

    const system = `You are NPC ${mem.name} — ${mem.role} — in Threadweaver. Mood: ${mem.mood}. Family: ${mem.family}${mem.family==='married'?` to ${mem.partner}`:''}. Pet: ${mem.pet}. Hobby: ${mem.hobby}. Stressor: ${mem.stressor}. Favorite: ${mem.favorite}. Gossip you might share: ${mem.gossip}. Quirk: ${mem.quirk}. Quiet goal: ${mem.goal}. Arc step: ${mem.arcStep}. ${styleRules} Avoid repetition. Keep continuity.`;
    const history = Array.isArray(messages) ? messages : [];
    const isIntro = history.length === 0;
    const introCue = 'First line only: 3–10 words, can be abrupt (e.g., \'Busy. What?\', \'Hey—careful.\', \'Need something?\'). No backstory, no exposition.';
    const transcript = [system, isIntro ? `user: ${introCue}` : '', ...history.map(m => `${m.role}: ${m.content}`)].filter(Boolean).join('\n');
    const payload = { model: MODEL, input: transcript, max_output_tokens: isIntro ? 40 : 80, temperature: 1.05 };
    const r = await axios.post('https://api.openai.com/v1/responses', payload, {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        ...(process.env.OPENAI_ORG_ID ? { 'OpenAI-Organization': process.env.OPENAI_ORG_ID } : {}),
        ...(process.env.OPENAI_PROJECT_ID ? { 'OpenAI-Project': process.env.OPENAI_PROJECT_ID } : {})
      },
      timeout: 20000
    });
    const text = r.data?.output_text || (Array.isArray(r.data?.output) && r.data.output[0]?.content?.[0]?.text) || '';
    res.json({ text });
  } catch (err) {
    const detail = err?.response?.data || err.message;
    console.error('Chat error', detail);
    res.status(500).json({ error: 'chat_failed', detail });
  }
});

// Simple health endpoint (no secrets)
app.get('/api/health', (req, res) => {
  res.json({ ok: true, hasKey: Boolean(process.env.OPENAI_API_KEY), model: MODEL, org: Boolean(process.env.OPENAI_ORG_ID), project: Boolean(process.env.OPENAI_PROJECT_ID) });
});


