// LifeOS home-screen widget for Scriptable (iOS). PRD F22.
// Copy this from LifeOS → More → Integrations → "Copy widget script".
// Run it once in Scriptable to paste your token (kept in the iPhone Keychain,
// never in this file). Widget parameter: score, water, spend or next
// (default: small = score, medium = next block, large = everything).

const SUMMARY_URL = '__LIFEOS_SUMMARY_URL__';
const TOKEN_KEY = 'lifeos_widget_token';
const CACHE_FILE = 'lifeos-widget.json';
const REFRESH_MIN = 15;

const C = {
  bg: '#0A0F1C',
  card: '#131B2E',
  text: '#F8FAFC',
  muted: '#94A3B8',
  track: '#1E293B',
  blue: '#60A5FA',
  water: '#38BDF8',
  green: '#34D399',
  red: '#FB7185',
  orange: '#FB923C',
};

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

function fmt(n) {
  // Indian grouping: 1,23,456
  const s = String(Math.round(n));
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return rest + ',' + last3;
}

function clock(iso) {
  const d = new Date(iso);
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ap = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return h + ':' + m + ' ' + ap;
}

function hhmm(t) {
  const h = Number(t.slice(0, 2));
  const m = t.slice(3, 5);
  return (h % 12 || 12) + ':' + m + ' ' + (h >= 12 ? 'pm' : 'am');
}

function cachePath() {
  const fm = FileManager.local();
  return fm.joinPath(fm.documentsDirectory(), CACHE_FILE);
}

async function load() {
  const token = Keychain.contains(TOKEN_KEY) ? Keychain.get(TOKEN_KEY) : null;
  if (!token) return { state: 'no-token' };
  const req = new Request(SUMMARY_URL);
  req.method = 'GET';
  req.headers = { Authorization: 'Bearer ' + token };
  req.timeoutInterval = 10;
  try {
    const body = await req.loadJSON();
    const status = req.response ? req.response.statusCode : 0;
    if (status === 401) return { state: 'reconnect' };
    if (status !== 200) throw new Error('HTTP ' + status);
    FileManager.local().writeString(cachePath(), JSON.stringify(body));
    return { state: 'ok', data: body };
  } catch (e) {
    const fm = FileManager.local();
    if (fm.fileExists(cachePath())) {
      return { state: 'cached', data: JSON.parse(fm.readString(cachePath())) };
    }
    return { state: 'offline' };
  }
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

function ring(size, pct, color, label) {
  const ctx = new DrawContext();
  ctx.size = new Size(size, size);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  const c = size / 2;
  const r = size * 0.4;
  const w = size * 0.11;
  ctx.setStrokeColor(new Color(C.track));
  ctx.setLineWidth(w);
  ctx.strokeEllipse(new Rect(c - r, c - r, r * 2, r * 2));
  const sweep = Math.max(0, Math.min(1, pct)) * 360;
  if (sweep > 0) {
    const pts = [];
    const steps = Math.max(2, Math.round(sweep / 3));
    for (let i = 0; i <= steps; i++) {
      const a = ((-90 + (sweep * i) / steps) * Math.PI) / 180;
      pts.push(new Point(c + r * Math.cos(a), c + r * Math.sin(a)));
    }
    const p = new Path();
    p.addLines(pts);
    ctx.addPath(p);
    ctx.setStrokeColor(new Color(color));
    ctx.setLineWidth(w);
    ctx.strokePath();
    ctx.setFillColor(new Color(color));
    for (const q of [pts[0], pts[pts.length - 1]]) {
      ctx.fillEllipse(new Rect(q.x - w / 2, q.y - w / 2, w, w));
    }
  }
  ctx.setTextColor(new Color(C.text));
  ctx.setFont(Font.boldSystemFont(size * 0.22));
  ctx.setTextAlignedCenter();
  ctx.drawTextInRect(label, new Rect(0, c - size * 0.14, size, size * 0.3));
  return ctx.getImage();
}

function bar(width, pct, color, tick) {
  const h = 6;
  const ctx = new DrawContext();
  ctx.size = new Size(width, h + 6);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  const track = new Path();
  track.addRoundedRect(new Rect(0, 3, width, h), 3, 3);
  ctx.addPath(track);
  ctx.setFillColor(new Color(C.track));
  ctx.fillPath();
  const fw = Math.max(0, Math.min(1, pct)) * width;
  if (fw > 0) {
    const fill = new Path();
    fill.addRoundedRect(new Rect(0, 3, fw, h), 3, 3);
    ctx.addPath(fill);
    ctx.setFillColor(new Color(color));
    ctx.fillPath();
  }
  if (tick !== null && tick !== undefined) {
    ctx.setFillColor(new Color(C.text));
    ctx.fillRect(new Rect(Math.min(width - 2, tick * width), 0, 2, h + 6));
  }
  return ctx.getImage();
}

function text(stack, s, size, color, weight) {
  const t = stack.addText(s);
  t.font = weight === 'bold' ? Font.boldSystemFont(size) : Font.systemFont(size);
  t.textColor = new Color(color || C.text);
  t.lineLimit = 1;
  t.minimumScaleFactor = 0.6;
  return t;
}

function header(w, d) {
  const row = w.addStack();
  row.centerAlignContent();
  text(row, 'LIFEOS', 11, C.muted, 'bold');
  row.addSpacer();
  if (d) text(row, clock(d.updated_at), 11, C.muted);
  w.addSpacer(6);
}

function base() {
  const w = new ListWidget();
  w.backgroundColor = new Color(C.card);
  w.setPadding(14, 14, 14, 14);
  w.refreshAfterDate = new Date(Date.now() + REFRESH_MIN * 60 * 1000);
  w.url = 'scriptable:///run/' + encodeURIComponent(Script.name());
  return w;
}

function message(title, body) {
  const w = base();
  header(w, null);
  text(w, title, 15, C.text, 'bold');
  w.addSpacer(4);
  const t = text(w, body, 12, C.muted);
  t.lineLimit = 3;
  return w;
}

function scoreBlock(w, d) {
  const row = w.addStack();
  row.centerAlignContent();
  const pct = d.score === null ? 0 : d.score / 100;
  row.addImage(ring(64, pct, C.blue, d.score === null ? '—' : d.score + '%'));
  row.addSpacer(10);
  const col = row.addStack();
  col.layoutVertically();
  text(col, String(d.streak), 26, C.text, 'bold');
  text(col, 'day streak', 11, C.muted);
  w.addSpacer(6);
  text(w, d.done + ' of ' + d.counted + ' done', 11, C.muted);
}

function waterBlock(w, d, width) {
  text(w, fmt(d.water_ml), 26, C.text, 'bold');
  text(w, 'of ' + fmt(d.water_target) + ' ml', 11, C.muted);
  w.addSpacer(4);
  const behind = d.water_behind > 0;
  const tick = d.water_target > 0 ? (d.water_ml + d.water_behind) / d.water_target : null;
  w.addImage(bar(width, d.water_ml / Math.max(1, d.water_target), C.water, behind ? tick : null));
  w.addSpacer(2);
  text(
    w,
    behind ? fmt(d.water_behind) + ' ml behind' : 'On pace',
    11,
    behind ? C.red : C.green,
    'bold',
  );
}

function spendBlock(w, d, width) {
  text(
    w,
    new Date(d.date + 'T00:00:00').toLocaleString('en-IN', { month: 'long' }).toUpperCase(),
    11,
    C.muted,
    'bold',
  );
  text(w, '₹' + fmt(d.month_spend), 24, C.text, 'bold');
  w.addSpacer(4);
  const day = Number(d.date.slice(8, 10));
  const days = new Date(Number(d.date.slice(0, 4)), Number(d.date.slice(5, 7)), 0).getDate();
  const over = d.month_spend > d.month_budget;
  w.addImage(
    bar(width, d.month_spend / Math.max(1, d.month_budget), over ? C.red : C.blue, day / days),
  );
  w.addSpacer(2);
  text(w, 'of ₹' + fmt(d.month_budget), 11, C.muted);
}

function nextBlock(w, d) {
  const b = d.next_block;
  if (!b) {
    text(w, 'Day done', 20, C.text, 'bold');
    text(w, 'Nothing left on today’s plan.', 12, C.muted);
    return;
  }
  text(
    w,
    b.status === 'now'
      ? 'NOW · UNTIL ' + hhmm(b.end).toUpperCase()
      : 'NEXT · ' + hhmm(b.start).toUpperCase(),
    11,
    C.blue,
    'bold',
  );
  text(w, b.title, 22, C.text, 'bold');
  w.addSpacer();
  if (d.after) text(w, 'Then: ' + d.after.title + ' ' + hhmm(d.after.start), 12, C.muted);
}

function top3Block(w, d) {
  if (!d.top3.length) return;
  w.addSpacer(8);
  text(w, 'TOP 3', 11, C.muted, 'bold');
  for (const t of d.top3) text(w, (t.done ? '✓ ' : '○ ') + t.title, 12, t.done ? C.muted : C.text);
}

function build(r) {
  if (r.state === 'no-token')
    return message(
      'Connect LifeOS',
      'Run this script once in Scriptable and paste your LifeOS token.',
    );
  if (r.state === 'reconnect')
    return message(
      'Reconnect in LifeOS',
      'This token was revoked or is wrong. Make a new one in LifeOS → Integrations.',
    );
  if (r.state === 'offline')
    return message('Offline', 'No data yet. It will fill in when the phone is online.');
  const d = r.data;
  const family = config.widgetFamily || 'medium';
  const kind =
    (args.widgetParameter || '').trim().toLowerCase() ||
    (family === 'small' ? 'score' : family === 'large' ? 'all' : 'next');
  const w = base();
  header(w, d);
  const width = family === 'small' ? 130 : 290;
  if (kind === 'water') waterBlock(w, d, width);
  else if (kind === 'spend') spendBlock(w, d, width);
  else if (kind === 'score') scoreBlock(w, d);
  else if (kind === 'next') nextBlock(w, d);
  else {
    scoreBlock(w, d);
    w.addSpacer(8);
    nextBlock(w, d);
    w.addSpacer(8);
    waterBlock(w, d, width);
    top3Block(w, d);
  }
  if (r.state === 'cached') {
    w.addSpacer(4);
    text(w, 'Offline · from ' + clock(d.updated_at), 10, C.orange);
  }
  return w;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

async function setup() {
  const a = new Alert();
  a.title = 'LifeOS widget';
  a.message = 'Paste the token from LifeOS → More → Integrations (starts with lifeos_pat_).';
  a.addSecureTextField('lifeos_pat_…', '');
  a.addAction('Save');
  a.addCancelAction('Cancel');
  if ((await a.present()) === -1) return;
  const token = a.textFieldValue(0).trim();
  if (token) Keychain.set(TOKEN_KEY, token);
}

if (config.runsInApp && !config.runsInWidget) {
  const menu = new Alert();
  menu.title = 'LifeOS widget';
  menu.addAction('Set token');
  menu.addAction('Preview small');
  menu.addAction('Preview medium');
  menu.addAction('Preview large');
  menu.addCancelAction('Done');
  const pick = await menu.present();
  if (pick === 0) await setup();
  if (pick >= 1 && pick <= 3) {
    const w = build(await load());
    if (pick === 1) await w.presentSmall();
    if (pick === 2) await w.presentMedium();
    if (pick === 3) await w.presentLarge();
  }
} else {
  Script.setWidget(build(await load()));
}
Script.complete();
