// ============================================================================
//  TANUSHRI SKATE DASH — a simple Mario-style auto-runner on roller skates.
//  Tanushri skates forward automatically; jump over cones & pits, duck under
//  banners, and grab EGGS (she loves eggs). Eat eggs to fuel her FART BOOST.
//  The weather rolls through sunny → cloudy → rainy → sunset → night → snow.
//  One life — go for distance!
//
//  Character: a hand-drawn cartoon "bobblehead" (no photo) — a big spring-
//  wobbling head with her features on a little skating body.
// ============================================================================

const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;

const GROUND_Y = 470;   // screen-y of the top surface of the ground
const PLAYER_X = 175;   // player's fixed horizontal screen position

// --- Movement tunables --------------------------------------------------------
const GRAVITY = 2300;
const JUMP_VELOCITY = 820;
const MAX_JUMPS = 2;
const SPEED_START = 300;
const SPEED_MAX = 650;
const SPEED_RAMP = 0.012;

// --- Fart boost ---------------------------------------------------------------
const BOOST_MAX = 100;
const BOOST_PER_EGG = 20;
const FART_COST = 30;
const FART_DURATION = 0.7;
const FART_SPEED_MULT = 1.75;
const FART_POP = -360;

// --- Player collider (heights match the drawn art so hits look fair) ----------
const PW = 44;
const PH_STAND = 170;
const PH_DUCK = 132;
const HEAD_R = 40;

const BEST_KEY = 'tanushri_skate_best';

// --- Palette ------------------------------------------------------------------
const C = {
    grass: 0x67c23a, grassEdge: 0x4e9e2c,
    dirt: 0xbb7b3c, dirtDark: 0x96612c,
    // roller skates
    boot: 0xffffff, bootCuff: 0xff9ec2, skateWheel: 0xff6fa5, skatePlate: 0xcfcfd6,
    // outfit (denim halter top + leggings)
    top: 0x9db7d6, topDark: 0x7b96bd, topStitch: 0xdce6f2,
    legs: 0x44506c, legsDark: 0x353e54,
    // face / features (fairer skin, thick straight brown hair, big pointy nose)
    skin: 0xf3d4b6, skinShade: 0xddb18c, skinLight: 0xfdead6,
    hair: 0x6b4423, hairHi: 0x8a5a31, hairDark: 0x4f3018,
    brow: 0x4f3018, lash: 0x2a1c10,
    eyeWhite: 0xfaf7f4, iris: 0x5b3a1f, pupil: 0x231307,
    lip: 0xc77f6b, lipLight: 0xdb9a86, mouthIn: 0x6e2b2b, tongue: 0xe98f86,
    blush: 0xf0a48c, earring: 0xf2c84b,
    // pickups / hazards
    eggShell: 0xfdf3df, eggShade: 0xe6d3b0, eggSpeck: 0xc8a06a, eggShine: 0xffffff,
    coneA: 0xff7a1a, coneB: 0xffffff, coneBase: 0x4a2c12,
    banner: 0x7e57c2, bannerEdge: 0x5e3da0, post: 0x4a4a55,
    // fart
    fart: 0x9bbf4a, fart2: 0xc4b24a,
    ink: 0x14233f, white: 0xffffff,
};

// ============================================================================
//  Weather — phases the run cycles through as distance grows.
// ============================================================================
const PHASE_LEN = 1500;
const WEATHER = [
    { name: 'Sunny',  skyTop: 0x4aa6ec, skyBot: 0xcdeeff, sun: 0xffe48a, sunGlow: 0xfff3c4, sunA: 1.0, cloud: 0xffffff, cloudA: 0.9,  overcast: 0.0,  precip: 'none', night: false },
    { name: 'Cloudy', skyTop: 0x8fa6bd, skyBot: 0xd7e2ec, sun: 0xfff3c4, sunGlow: 0xfff3c4, sunA: 0.3, cloud: 0xeef2f6, cloudA: 0.95, overcast: 0.3,  precip: 'none', night: false },
    { name: 'Rainy',  skyTop: 0x49596d, skyBot: 0x8c9bab, sun: 0x9aa7b4, sunGlow: 0x9aa7b4, sunA: 0.0, cloud: 0x9aa7b4, cloudA: 0.95, overcast: 0.5,  precip: 'rain', night: false },
    { name: 'Sunset', skyTop: 0xef7a45, skyBot: 0xffd9a0, sun: 0xff8c42, sunGlow: 0xffd9a0, sunA: 1.0, cloud: 0xf6c9a0, cloudA: 0.8,  overcast: 0.05, precip: 'none', night: false },
    { name: 'Night',  skyTop: 0x0e1633, skyBot: 0x33406b, sun: 0xeef1ff, sunGlow: 0xbfc8e8, sunA: 1.0, cloud: 0x46527a, cloudA: 0.6,  overcast: 0.1,  precip: 'none', night: true  },
    { name: 'Snowy',  skyTop: 0x9fb0c4, skyBot: 0xe6eef5, sun: 0xffffff, sunGlow: 0xffffff, sunA: 0.2, cloud: 0xf2f6fa, cloudA: 0.95, overcast: 0.4,  precip: 'snow', night: false },
];
function lerp(a, b, t) { return a + (b - a) * t; }
function lerpColor(a, b, t) {
    const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    return (Math.round(lerp(ar, br, t)) << 16) | (Math.round(lerp(ag, bg, t)) << 8) | Math.round(lerp(ab, bb, t));
}
function weatherAt(dist) {
    const L = WEATHER.length;
    const seg = dist / PHASE_LEN;
    const i = Math.floor(seg);
    const frac = seg - i;
    const cur = WEATHER[((i % L) + L) % L];
    const nxt = WEATHER[(((i + 1) % L) + L) % L];
    return {
        skyTop: lerpColor(cur.skyTop, nxt.skyTop, frac),
        skyBot: lerpColor(cur.skyBot, nxt.skyBot, frac),
        sunColor: lerpColor(cur.sun, nxt.sun, frac),
        sunGlow: lerpColor(cur.sunGlow, nxt.sunGlow, frac),
        sunA: lerp(cur.sunA, nxt.sunA, frac),
        cloud: lerpColor(cur.cloud, nxt.cloud, frac),
        cloudA: lerp(cur.cloudA, nxt.cloudA, frac),
        overcast: lerp(cur.overcast, nxt.overcast, frac),
        night: frac < 0.5 ? cur.night : nxt.night,
        precip: cur.precip,
        precipInt: Math.sin(Phaser.Math.Clamp(frac, 0, 1) * Math.PI),
        name: frac < 0.5 ? cur.name : nxt.name,
    };
}

// ============================================================================
//  Sound — Web Audio API, tones generated in the browser (no audio files).
// ============================================================================
let audioCtx;
function getAudioCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}
function playTone(freq, duration, type = 'square', volume = 0.07) {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(gain); gain.connect(ctx.destination);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.start();
    osc.stop(ctx.currentTime + duration);
}
function playSequence(notes, volume = 0.07, type = 'square') {
    const ctx = getAudioCtx();
    const start = ctx.currentTime;
    notes.forEach(([freq, dur, offset]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        osc.connect(gain); gain.connect(ctx.destination);
        const t0 = start + offset;
        gain.gain.setValueAtTime(volume, t0);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.start(t0);
        osc.stop(t0 + dur);
    });
}
function sfxJump()  { playTone(520, 0.12, 'square', 0.06); }
function sfxJump2() { playTone(700, 0.12, 'square', 0.05); }
function sfxEgg()   { playSequence([[988, 0.07, 0], [1319, 0.12, 0.06]], 0.06); }
function sfxStart() { playSequence([[523, 0.09, 0], [659, 0.09, 0.09], [784, 0.14, 0.18]], 0.06); }
function sfxCrash() { playSequence([[300, 0.12, 0], [220, 0.16, 0.1], [140, 0.3, 0.24]], 0.08, 'sawtooth'); }
function sfxDud()   { playTone(120, 0.1, 'square', 0.03); }
function sfxFart() {
    // Classic cartoon fart: a low sawtooth "raspberry" whose pitch is wobbled by
    // a square LFO (the brap-brap motorboat texture) and droops as it trails off.
    const ctx = getAudioCtx();
    const t = ctx.currentTime;
    const dur = 0.5 + Math.random() * 0.28;
    const base = 95 + Math.random() * 35;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(base + 35, t);
    osc.frequency.linearRampToValueAtTime(base * 0.55, t + dur);

    const lfo = ctx.createOscillator();   // the flutter
    lfo.type = 'square';
    lfo.frequency.setValueAtTime(25 + Math.random() * 8, t);
    lfo.frequency.linearRampToValueAtTime(11, t + dur);
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 40;
    lfo.connect(lfoGain); lfoGain.connect(osc.frequency);

    const lp = ctx.createBiquadFilter();  // soften the buzz so it sounds "wet"
    lp.type = 'lowpass';
    lp.frequency.value = 900;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.14, t + 0.04);
    g.gain.setValueAtTime(0.12, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(lp); lp.connect(g); g.connect(ctx.destination);
    osc.start(t); lfo.start(t);
    osc.stop(t + dur + 0.02); lfo.stop(t + dur + 0.02);
}

// --- Personal best (localStorage) --------------------------------------------
function getBest() { return parseInt(localStorage.getItem(BEST_KEY) || '0', 10); }
function setBest(v) { localStorage.setItem(BEST_KEY, String(v)); }

// ============================================================================
//  Global leaderboard (Firebase Firestore) — shared online top scores.
//  Reuses the same Firebase project as the Breakout game; skate scores live in
//  their own 'skate_scores' collection. The apiKey is a PUBLIC identifier (not a
//  secret) — real security lives in the Firestore rules in the Firebase console.
//  All calls fail gracefully (return null/false) so the game still works offline.
// ============================================================================
const firebaseConfig = {
    apiKey: "AIzaSyDBTRmxAPWqUjEgK9UrWGSCPImLt6e8dac",
    authDomain: "breakoutgame-fefa7.firebaseapp.com",
    projectId: "breakoutgame-fefa7",
    storageBucket: "breakoutgame-fefa7.firebasestorage.app",
    messagingSenderId: "306321430842",
    appId: "1:306321430842:web:8832b71b6c465678ccd803"
};
let db = null;
try {
    if (window.firebase) { firebase.initializeApp(firebaseConfig); db = firebase.firestore(); }
} catch (e) { console.warn('[Leaderboard] Firebase unavailable:', e); }
const SCORES_COLLECTION = 'skate_scores';

// Returns a score-sorted array of top entries, or null if the request failed
// (offline / rules / not set up). Callers treat null as "show offline".
async function fetchLeaderboard(limit = 10) {
    if (!db) return null;
    try {
        const snap = await db.collection(SCORES_COLLECTION).get();
        const scores = snap.docs.map((d) => d.data()).filter((s) => typeof s.score === 'number');
        scores.sort((a, b) => b.score - a.score);
        return scores.slice(0, limit);
    } catch (e) { console.error('[Leaderboard] fetch failed', e); return null; }
}
async function submitScore({ name, score, eggs }) {
    if (!db) return false;
    try {
        await db.collection(SCORES_COLLECTION).add({
            name, score, eggs,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        return true;
    } catch (e) { console.error('[Leaderboard] submit failed', e); return false; }
}

// --- Player name (localStorage so you only set it once per device) ------------
const NAME_KEY = 'tanushri_skate_name';
function getPlayerName() { return localStorage.getItem(NAME_KEY) || ''; }
function setPlayerName(n) { localStorage.setItem(NAME_KEY, n); }
function promptForName() {
    const cur = getPlayerName();
    const input = window.prompt('Enter your name for the leaderboard (1-12 chars):', cur);
    if (input === null) return null;
    const cleaned = input.trim().slice(0, 12);
    if (!cleaned) return null;
    setPlayerName(cleaned);
    return cleaned;
}

// ============================================================================
//  Character art
// ============================================================================

// Draw one leg + roller skate from the hip to a foot at (fx, contactY).
function drawSkate(g, hipX, hipY, fx, contactY) {
    const ankleY = contactY - 18;
    // leg (legging) with a slight knee bend toward the front
    g.lineStyle(12, C.legs, 1);
    g.beginPath();
    g.moveTo(hipX, hipY);
    g.lineTo((hipX + fx) / 2 + 3, (hipY + ankleY) / 2);
    g.lineTo(fx, ankleY);
    g.strokePath();
    // skate: wheels, plate, boot, cuff, toe-stop
    g.fillStyle(C.skateWheel, 1);
    g.fillCircle(fx - 5, contactY - 3.4, 3.6);
    g.fillCircle(fx + 7, contactY - 3.4, 3.6);
    g.fillStyle(C.skatePlate, 1);
    g.fillRect(fx - 8, contactY - 8, 19, 3);
    g.fillStyle(C.boot, 1);
    g.fillRoundedRect(fx - 8, contactY - 20, 21, 13, 4);   // toe extends forward (+x)
    g.fillStyle(C.bootCuff, 1);
    g.fillRoundedRect(fx - 6, contactY - 23, 13, 7, 3);
    g.fillStyle(C.skateWheel, 1);
    g.fillCircle(fx + 12, contactY - 2.5, 2.6);             // toe stop
    g.lineStyle(1.5, 0xcacaca, 0.9);
    g.beginPath(); g.moveTo(fx - 3, contactY - 18); g.lineTo(fx + 4, contactY - 16); g.strokePath();
    g.beginPath(); g.moveTo(fx - 3, contactY - 14); g.lineTo(fx + 4, contactY - 12); g.strokePath();
}

// Draw the skating body (everything below the neck) into `g`. Returns the head
// center + chin pivot, so the caller can draw + wobble the head on top.
//   opts: { ducking, airborne, moving, stridePhase, t }
function drawSkater(g, cx, feetY, opts) {
    const ducking = !!opts.ducking;
    const airborne = !!opts.airborne;
    const moving = !!opts.moving;
    const lean = airborne ? 11 : 7;
    const bob = (moving && !airborne) ? Math.abs(Math.sin(opts.stridePhase)) * 1.6 : 0;

    const bodyX = cx + lean;
    const hipY = feetY - (ducking ? 40 : 66) - bob;
    const shoulderY = hipY - (ducking ? 18 : 30);
    const headY = shoulderY - HEAD_R + 6;
    const headX = bodyX + (airborne ? 3 : 0);
    const chinY = headY + HEAD_R;

    // speed lines
    if (moving && !airborne) {
        g.lineStyle(3, 0xffffff, 0.5);
        for (let i = 0; i < 3; i++) {
            const ly = feetY - 30 - i * 26;
            const flick = ((opts.t * 700) % 40);
            g.beginPath();
            g.moveTo(cx - 52 - flick - i * 8, ly);
            g.lineTo(cx - 24 - flick - i * 8, ly);
            g.strokePath();
        }
    }

    // ---- legs + roller skates (alternating stride) ----
    const feet = [];
    for (let i = 0; i < 2; i++) {
        let fx, contactY;
        if (airborne) {                       // tucked, staggered
            fx = bodyX + (i ? 16 : -8);
            contactY = feetY - (i ? 4 : 16);
        } else if (!moving) {                  // neutral stance (title / ready)
            fx = bodyX + (i ? 14 : -12);
            contactY = feetY;
        } else {                               // skating glide: smooth, long strides
            const phase = opts.stridePhase + i * Math.PI;
            fx = bodyX + Math.cos(phase) * 27;                       // long reach forward/back
            contactY = feetY - Math.max(0, -Math.sin(phase)) * 13;   // lift only during the forward swing
        }
        feet.push({ fx, contactY });
    }
    feet.sort((a, b) => a.fx - b.fx);          // draw back (left) leg first
    for (const f of feet) drawSkate(g, bodyX, hipY, f.fx, f.contactY);

    // ---- torso (denim halter top) ----
    const torsoH = (hipY - shoulderY) + 6;
    g.fillStyle(C.top, 1);
    g.fillRoundedRect(bodyX - 16, shoulderY, 32, torsoH, 9);
    g.fillStyle(C.topDark, 0.45);
    g.fillRoundedRect(bodyX - 16, shoulderY, 11, torsoH, 9);
    g.lineStyle(2, C.topStitch, 0.8);
    g.beginPath(); g.moveTo(bodyX - 9, shoulderY + 3); g.lineTo(bodyX, shoulderY - 7); g.lineTo(bodyX + 9, shoulderY + 3); g.strokePath();

    // ---- arms ----
    g.lineStyle(8, C.skin, 1);
    g.beginPath();
    g.moveTo(bodyX + 6, shoulderY + 8);
    g.lineTo(bodyX + 28, shoulderY + (ducking ? 4 : 16));
    g.strokePath();
    g.fillStyle(C.skin, 1);
    g.fillCircle(bodyX + 28, shoulderY + (ducking ? 4 : 16), 4.5);
    g.lineStyle(8, C.skinShade, 1);
    g.beginPath();
    g.moveTo(bodyX - 6, shoulderY + 9);
    g.lineTo(bodyX - 22, shoulderY + 14);
    g.strokePath();

    // ---- short neck ----
    g.fillStyle(C.skin, 1);
    g.fillRect(headX - 7, shoulderY - 4, 14, (chinY - shoulderY) + 6);

    return { headX, headY, chinX: headX, chinY };
}

// Draw the cartoon head into `g` around a local CHIN pivot (head center is at
// (0, -HEAD_R)). The caller rotates `g` about this pivot for the bobble.
//   opts: { blink, mouthOpen }
function drawHead(g, opts) {
    const r = HEAD_R;
    const cy = -r;
    const blink = !!opts.blink;
    const open = !!opts.mouthOpen;

    // ---- back hair: thick straight mass + long straight locks ----
    g.fillStyle(C.hair, 1);
    g.fillEllipse(0, cy - 6, (r + 12) * 2, (r + 15) * 2);
    g.fillRoundedRect(-r - 10, cy - 10, 22, r * 1.75, 6);   // thick straight left lock
    g.fillRoundedRect(r - 12, cy - 10, 22, r * 1.75, 6);    // thick straight right lock
    g.fillStyle(C.hairHi, 0.4);
    g.fillRoundedRect(-r - 6, cy - 6, 7, r * 1.5, 4);
    g.fillRoundedRect(r + 1, cy - 6, 7, r * 1.5, 4);

    // ---- ears + earrings ----
    g.fillStyle(C.skin, 1);
    g.fillCircle(-r * 0.92, cy + r * 0.16, r * 0.16);
    g.fillCircle(r * 0.92, cy + r * 0.16, r * 0.16);
    g.fillStyle(C.earring, 1);
    g.fillCircle(-r * 0.94, cy + r * 0.42, r * 0.09);
    g.fillCircle(r * 0.94, cy + r * 0.42, r * 0.09);

    // ---- face ----
    g.fillStyle(C.skin, 1);
    g.fillEllipse(0, cy, r * 1.84, r * 2.02);
    g.fillStyle(C.skinShade, 0.18);
    g.fillEllipse(0, cy + r * 0.55, r * 1.25, r * 0.85);

    // ---- blush ----
    g.fillStyle(C.blush, 0.4);
    g.fillEllipse(-r * 0.56, cy + r * 0.34, r * 0.4, r * 0.24);
    g.fillEllipse(r * 0.56, cy + r * 0.34, r * 0.4, r * 0.24);

    // ---- thick straight center-parted fringe (flat hairline, square-ish) ----
    g.fillStyle(C.hair, 1);
    g.fillRoundedRect(-r * 1.0, cy - r * 1.18, r * 0.98, r * 0.95, 8);  // left curtain
    g.fillRoundedRect(r * 0.02, cy - r * 1.18, r * 0.98, r * 0.95, 8);  // right curtain
    g.fillTriangle(-r * 0.06, cy - r * 0.55, -r * 0.5, cy - r * 0.95, -r * 0.02, cy - r * 0.95); // part sweep L
    g.fillTriangle(r * 0.06, cy - r * 0.55, r * 0.5, cy - r * 0.95, r * 0.02, cy - r * 0.95);     // part sweep R
    g.fillStyle(C.hairHi, 0.35);
    g.fillRoundedRect(-r * 0.92, cy - r * 1.12, r * 0.22, r * 0.8, 4);

    // ---- eyebrows ----
    const ex = r * 0.44;
    const browY = cy - r * 0.16;
    g.lineStyle(Math.max(2, r * 0.07), C.brow, 1);
    g.beginPath(); g.arc(-ex, browY, r * 0.3, Phaser.Math.DegToRad(208), Phaser.Math.DegToRad(332), false); g.strokePath();
    g.beginPath(); g.arc(ex, browY, r * 0.3, Phaser.Math.DegToRad(208), Phaser.Math.DegToRad(332), false); g.strokePath();

    // ---- eyes ----
    const eyeY = cy + r * 0.06;
    const ew = r * 0.46, eh = r * 0.4;
    if (blink) {
        g.lineStyle(Math.max(2, r * 0.06), C.lash, 1);
        g.beginPath(); g.arc(-ex, eyeY, r * 0.2, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160), false); g.strokePath();
        g.beginPath(); g.arc(ex, eyeY, r * 0.2, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160), false); g.strokePath();
    } else {
        [-ex, ex].forEach((x) => {
            g.fillStyle(C.eyeWhite, 1); g.fillEllipse(x, eyeY, ew, eh);
            g.fillStyle(C.iris, 1); g.fillCircle(x, eyeY + r * 0.02, r * 0.17);
            g.fillStyle(C.pupil, 1); g.fillCircle(x, eyeY + r * 0.02, r * 0.085);
            g.fillStyle(0xffffff, 0.9); g.fillCircle(x - r * 0.06, eyeY - r * 0.05, r * 0.05);
        });
        g.lineStyle(Math.max(2, r * 0.06), C.lash, 1);
        [-ex, ex].forEach((x) => { g.beginPath(); g.arc(x, eyeY, ew * 0.55, Phaser.Math.DegToRad(202), Phaser.Math.DegToRad(338), false); g.strokePath(); });
        g.lineStyle(Math.max(1, r * 0.045), C.lash, 1);
        g.beginPath(); g.moveTo(-ex - ew * 0.55, eyeY - eh * 0.05); g.lineTo(-ex - ew * 0.8, eyeY - eh * 0.3); g.strokePath();
        g.beginPath(); g.moveTo(ex + ew * 0.55, eyeY - eh * 0.05); g.lineTo(ex + ew * 0.8, eyeY - eh * 0.3); g.strokePath();
    }

    // ---- BIG POINTY NOSE (her signature feature) ----
    const nTop = cy - r * 0.12;     // bridge starts up between the eyes
    const nW = r * 0.36;            // wide base = big
    const nTipX = r * 0.22;         // tip juts forward (she faces slightly right)
    const nTipY = cy + r * 0.66;    // long, reaching toward the mouth
    g.fillStyle(C.skinShade, 0.45);                                   // cast shadow → makes it pop off the face
    g.fillEllipse(nTipX + r * 0.14, nTipY + r * 0.05, r * 0.36, r * 0.17);
    g.fillStyle(C.skinShade, 0.95);                                  // shaded under/right face of the nose
    g.fillTriangle(0, nTop, nTipX + nW * 0.6, nTipY - 3, nTipX, nTipY + r * 0.03);
    g.fillStyle(C.skin, 1);                                          // main wedge tapering to a point
    g.fillTriangle(-nW, nTop + r * 0.06, nW * 0.5, nTop, nTipX, nTipY);
    g.fillStyle(C.skinLight, 0.9);                                   // bridge highlight
    g.fillTriangle(-nW * 0.55, nTop + r * 0.06, -nW * 0.02, nTop, nTipX - nW * 0.4, nTipY - r * 0.06);
    g.fillStyle(C.skin, 1);                                          // pointed tip
    g.fillCircle(nTipX, nTipY, r * 0.08);
    g.fillStyle(C.skinShade, 1);                                     // two nostrils flanking the tip
    g.fillEllipse(nTipX - nW * 0.5, nTipY - 1, r * 0.08, r * 0.05);
    g.fillEllipse(nTipX + nW * 0.24, nTipY - 1.5, r * 0.06, r * 0.04);

    // ---- mouth (below the long nose) ----
    if (open) {
        g.fillStyle(C.lip, 1); g.fillEllipse(r * 0.02, cy + r * 0.78, r * 0.46, r * 0.32);
        g.fillStyle(C.mouthIn, 1); g.fillEllipse(r * 0.02, cy + r * 0.8, r * 0.3, r * 0.2);
        g.fillStyle(0xffffff, 1); g.fillRoundedRect(r * 0.02 - r * 0.15, cy + r * 0.7, r * 0.3, r * 0.08, 2);
        g.fillStyle(C.tongue, 1); g.fillEllipse(r * 0.02, cy + r * 0.87, r * 0.15, r * 0.09);
    } else {
        g.lineStyle(Math.max(2, r * 0.07), C.lip, 1);
        g.beginPath(); g.arc(r * 0.02, cy + r * 0.78, r * 0.26, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160), false); g.strokePath();
        g.fillStyle(C.lipLight, 0.7); g.fillEllipse(r * 0.02, cy + r * 0.74, r * 0.28, r * 0.08);
    }
}

// Shared bobble-spring state.
function makeBobble() {
    return { ang: 0, angVel: 0, bob: 0, bobVel: 0, blinking: false, nextBlink: 1.5 + Math.random() * 2 };
}
function stepBobble(b, dt, t, vy, grounded, moving) {
    const jiggle = (grounded && moving) ? Math.sin(t * 15) * 0.05 : 0;
    const targetAng = moving
        ? Phaser.Math.Clamp(vy * 0.00035, -0.3, 0.3) + jiggle
        : Math.sin(t * 2.1) * 0.11;
    b.angVel += (100 * (targetAng - b.ang) - 8 * b.angVel) * dt;
    b.ang += b.angVel * dt;
    const targetBob = (grounded && moving) ? Math.sin(t * 15) * 2 : (moving ? 0 : Math.sin(t * 2.1 + 1) * 2);
    b.bobVel += (120 * (targetBob - b.bob) - 9 * b.bobVel) * dt;
    b.bob += b.bobVel * dt;
    if (t > b.nextBlink) {
        b.blinking = true;
        if (t > b.nextBlink + 0.14) { b.blinking = false; b.nextBlink = t + 1.8 + Math.random() * 3; }
    }
}

// Floating name bubble used by both scenes.
function makeNameTag(scene) {
    const c = scene.add.container(0, 0);
    const bg = scene.add.graphics();
    bg.fillStyle(0x14233f, 0.88);
    bg.fillRoundedRect(-50, -13, 100, 26, 8);
    bg.fillTriangle(-7, 12, 7, 12, 0, 20);
    const txt = scene.add.text(0, 0, 'Tanushri', {
        fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    c.add([bg, txt]);
    return c;
}

// ============================================================================
//  Title scene
// ============================================================================
const TITLE_CHAR_X = 188;
const LB = { x0: 322, x1: 778, y0: 268, y1: 462 };  // title leaderboard panel

class TitleScene extends Phaser.Scene {
    constructor() { super('TitleScene'); }

    create() {
        this.t = 0;
        this.bob = makeBobble();
        this.lbTexts = [];

        const sky = this.add.graphics().setDepth(0);
        sky.fillGradientStyle(WEATHER[0].skyTop, WEATHER[0].skyTop, WEATHER[0].skyBot, WEATHER[0].skyBot, 1);
        sky.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        sky.fillStyle(WEATHER[0].sunGlow, 0.5); sky.fillCircle(700, 110, 78);
        sky.fillStyle(WEATHER[0].sun, 1); sky.fillCircle(700, 110, 48);
        sky.fillStyle(C.dirt, 1); sky.fillRect(0, GROUND_Y, GAME_WIDTH, GAME_HEIGHT - GROUND_Y);
        sky.fillStyle(C.grass, 1); sky.fillRect(0, GROUND_Y, GAME_WIDTH, 16);
        sky.fillStyle(C.grassEdge, 1); sky.fillRect(0, GROUND_Y + 14, GAME_WIDTH, 3);

        this.add.text(GAME_WIDTH / 2, 60, 'TANUSHRI', {
            fontFamily: 'system-ui, sans-serif', fontSize: '64px',
            color: '#ffffff', fontStyle: 'bold', stroke: '#e23e6f', strokeThickness: 8,
        }).setOrigin(0.5).setDepth(10);
        this.add.text(GAME_WIDTH / 2, 108, 'S K A T E   D A S H', {
            fontFamily: 'system-ui, sans-serif', fontSize: '23px',
            color: '#14233f', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(10);

        // instruction card (top, full width)
        const cardY = 134;
        const card = this.add.graphics().setDepth(9);
        card.fillStyle(0x14233f, 0.78);
        card.fillRoundedRect(GAME_WIDTH / 2 - 285, cardY, 570, 96, 14);
        const lines = [
            ['SPACE / ↑ / tap = JUMP (again = double-jump)   ·   ↓ / S = DUCK', '#ffffff'],
            ['B / Shift = FART BOOST  —  eat eggs to fuel it (Tanushri loves eggs!)', '#ffd34d'],
            ['Dodge cones & banners, leap the pits, skate as far as you can.', '#bcd0ee'],
        ];
        lines.forEach(([txt, color], i) => {
            this.add.text(GAME_WIDTH / 2, cardY + 22 + i * 25, txt, {
                fontFamily: 'system-ui, sans-serif', fontSize: '14px', color,
            }).setOrigin(0.5).setDepth(10);
        });

        // character (left)
        this.charGfx = this.add.graphics().setDepth(30);
        this.headGfx = this.add.graphics().setDepth(31);
        this.nameTag = makeNameTag(this).setDepth(32);

        // leaderboard panel (right)
        const panel = this.add.graphics().setDepth(9);
        panel.fillStyle(0x14233f, 0.82);
        panel.fillRoundedRect(LB.x0, LB.y0, LB.x1 - LB.x0, LB.y1 - LB.y0, 14);
        panel.lineStyle(2, 0xffd34d, 0.6);
        panel.strokeRoundedRect(LB.x0, LB.y0, LB.x1 - LB.x0, LB.y1 - LB.y0, 14);
        this.add.text((LB.x0 + LB.x1) / 2, LB.y0 + 16, 'GLOBAL TOP 10', {
            fontFamily: 'system-ui, sans-serif', fontSize: '16px', color: '#ffd34d', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(10);
        this.lbPlaceholder = this.add.text((LB.x0 + LB.x1) / 2, LB.y0 + 80, 'loading…', {
            fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#88a', fontStyle: 'italic',
        }).setOrigin(0.5).setDepth(10);

        // prompt
        this.prompt = this.add.text(GAME_WIDTH / 2, GROUND_Y + 76, 'Press SPACE or tap to start', {
            fontFamily: 'system-ui, sans-serif', fontSize: '22px', color: '#ffffff',
            fontStyle: 'bold', stroke: '#14233f', strokeThickness: 4,
        }).setOrigin(0.5).setDepth(10);

        // start input: full-screen zone (low depth) + keyboard. The name button
        // sits on top (higher depth) so tapping it doesn't also start the game.
        const go = () => { getAudioCtx(); sfxStart(); this.scene.start('PlayScene'); };
        this.add.zone(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT)
            .setInteractive().setDepth(5).on('pointerdown', go);
        this.input.keyboard.on('keydown-SPACE', go);
        this.input.keyboard.on('keydown-UP', go);
        this.input.keyboard.on('keydown-ENTER', go);

        this.renderPlayerName();
        this.loadTitleBoard();
    }

    renderPlayerName() {
        if (this.nameText) this.nameText.destroy();
        if (this.bestText) this.bestText.destroy();
        if (this.changeBtn) this.changeBtn.destroy();
        const name = getPlayerName();
        this.nameText = this.add.text(GAME_WIDTH - 14, 12, name ? `Player: ${name}` : 'Player: (not set)', {
            fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: name ? '#ffd34d' : '#e6ecf6',
            stroke: '#14233f', strokeThickness: 4,
        }).setOrigin(1, 0).setDepth(11);
        this.bestText = this.add.text(GAME_WIDTH - 14, 32, `Your best: ${getBest()} m`, {
            fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#cfe0f5',
            stroke: '#14233f', strokeThickness: 4,
        }).setOrigin(1, 0).setDepth(11);
        this.changeBtn = this.add.text(GAME_WIDTH - 14, 50, name ? 'change name' : 'set name', {
            fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#7fe3f0',
            stroke: '#14233f', strokeThickness: 4,
        }).setOrigin(1, 0).setDepth(12).setInteractive({ useHandCursor: true });
        this.changeBtn.on('pointerdown', () => { promptForName(); this.renderPlayerName(); this.loadTitleBoard(); });
    }

    loadTitleBoard() {
        const token = (this._tok = (this._tok || 0) + 1);
        fetchLeaderboard(10).then((scores) => {
            if (this.scene.isActive() && token === this._tok) this.fillTitleBoard(scores);
        });
    }

    fillTitleBoard(scores) {
        if (this.lbPlaceholder) { this.lbPlaceholder.destroy(); this.lbPlaceholder = null; }
        this.lbTexts.forEach((t) => t.destroy());
        this.lbTexts = [];
        const cx = (LB.x0 + LB.x1) / 2;
        if (scores === null) {
            this.lbTexts.push(this.add.text(cx, LB.y0 + 80, 'leaderboard offline', {
                fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#e08a8a',
            }).setOrigin(0.5).setDepth(10));
            return;
        }
        if (scores.length === 0) {
            this.lbTexts.push(this.add.text(cx, LB.y0 + 80, 'No scores yet — be the first!', {
                fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#9aa', fontStyle: 'italic',
            }).setOrigin(0.5).setDepth(10));
            return;
        }
        const me = getPlayerName();
        scores.forEach((s, i) => {
            const isMe = me && s.name === me;
            const row = `${String(i + 1).padStart(2, ' ')}.   ${String(s.score).padStart(5, ' ')} m    ${s.name}`;
            this.lbTexts.push(this.add.text(LB.x0 + 26, LB.y0 + 42 + i * 15, row, {
                fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '13px',
                color: isMe ? '#ffd34d' : (i === 0 ? '#8bd450' : '#e7eefb'),
                fontStyle: isMe ? 'bold' : 'normal',
            }).setOrigin(0, 0.5).setDepth(10));
        });
    }

    update(_time, delta) {
        const dt = Math.min(delta / 1000, 0.04);
        this.t += dt;
        stepBobble(this.bob, dt, this.t, 0, true, false);

        this.charGfx.clear();
        const info = drawSkater(this.charGfx, TITLE_CHAR_X, GROUND_Y, {
            ducking: false, airborne: false, moving: false, stridePhase: 0, t: this.t,
        });
        this.headGfx.clear();
        this.headGfx.setPosition(info.chinX, info.chinY + this.bob.bob);
        this.headGfx.setRotation(this.bob.ang);
        drawHead(this.headGfx, { blink: this.bob.blinking, mouthOpen: false });

        this.nameTag.setPosition(info.headX, info.headY - HEAD_R - 22 + this.bob.bob * 0.5);
        this.prompt.setAlpha(0.45 + 0.55 * Math.abs(Math.sin(this.t * 3)));
    }
}

// ============================================================================
//  Play scene — the game.
// ============================================================================
class PlayScene extends Phaser.Scene {
    constructor() { super('PlayScene'); }

    create() {
        this.state = 'ready';
        this.t = 0;
        this.scrollX = 0;
        this.speed = SPEED_START;

        this.feet = GROUND_Y;
        this.vy = 0;
        this.grounded = true;
        this.ducking = false;
        this.downHeld = false;
        this.jumpsLeft = MAX_JUMPS;
        this.bob = makeBobble();

        this.boost = 0;
        this.boostTimer = 0;

        this.pits = [];
        this.obstacles = [];
        this.eggs = [];
        this.fart = [];
        this.spawnX = 760;
        this.eggsCollected = 0;
        this.score = 0;
        this._goToken = null;   // guards async leaderboard work against restarts

        // weather particle pools + stars (fixed pools, drawn by intensity)
        this.rainPool = Array.from({ length: 110 }, () => ({ x: Math.random() * GAME_WIDTH, y: Math.random() * GROUND_Y, len: 8 + Math.random() * 8, sp: 720 + Math.random() * 320 }));
        this.snowPool = Array.from({ length: 90 }, () => ({ x: Math.random() * GAME_WIDTH, y: Math.random() * GROUND_Y, r: 1.6 + Math.random() * 2.6, sp: 50 + Math.random() * 55, sway: Math.random() * Math.PI * 2 }));
        this.stars = Array.from({ length: 70 }, () => ({ x: Math.random() * GAME_WIDTH, y: Math.random() * (GROUND_Y - 120), p: Math.random() * Math.PI * 2, s: 0.6 + Math.random() * 1.5 }));
        this._w = weatherAt(0);

        this.bg = this.add.graphics().setDepth(0);
        this.worldGfx = this.add.graphics().setDepth(10);
        this.fxGfx = this.add.graphics().setDepth(20);
        this.charGfx = this.add.graphics().setDepth(30);
        this.headGfx = this.add.graphics().setDepth(31);
        this.weatherGfx = this.add.graphics().setDepth(35);
        this.nameTag = makeNameTag(this).setDepth(32);

        this.scoreText = this.add.text(16, 14, '0 m', {
            fontFamily: 'system-ui, sans-serif', fontSize: '26px', color: '#ffffff',
            fontStyle: 'bold', stroke: '#14233f', strokeThickness: 4,
        }).setDepth(40);
        this.eggText = this.add.text(16, 48, 'Eggs: 0', {
            fontFamily: 'system-ui, sans-serif', fontSize: '16px', color: '#fdf3df',
            stroke: '#14233f', strokeThickness: 3,
        }).setDepth(40);
        this.boostLabel = this.add.text(16, 72, 'FART BOOST  (B / Shift)', {
            fontFamily: 'system-ui, sans-serif', fontSize: '11px', color: '#bfe39a',
            stroke: '#14233f', strokeThickness: 3,
        }).setDepth(40);
        this.boostGfx = this.add.graphics().setDepth(40);
        this.weatherText = this.add.text(GAME_WIDTH / 2, 16, 'Sunny', {
            fontFamily: 'system-ui, sans-serif', fontSize: '16px', color: '#ffffff',
            fontStyle: 'bold', stroke: '#14233f', strokeThickness: 4,
        }).setOrigin(0.5, 0).setDepth(40);
        this.bestText = this.add.text(GAME_WIDTH - 16, 16, `Best: ${getBest()} m`, {
            fontFamily: 'system-ui, sans-serif', fontSize: '16px', color: '#ffffff',
            stroke: '#14233f', strokeThickness: 3,
        }).setOrigin(1, 0).setDepth(40);

        this.readyText = this.add.text(GAME_WIDTH / 2, 250, 'Press SPACE / tap to skate!', {
            fontFamily: 'system-ui, sans-serif', fontSize: '28px', color: '#ffffff',
            fontStyle: 'bold', stroke: '#14233f', strokeThickness: 5,
        }).setOrigin(0.5).setDepth(40);

        this.ensureSpawns();

        this.input.keyboard.on('keydown-SPACE', () => this.onJump());
        this.input.keyboard.on('keydown-UP', () => this.onJump());
        this.input.keyboard.on('keydown-W', () => this.onJump());
        this.input.keyboard.on('keydown-B', () => this.tryFart());
        this.input.keyboard.on('keydown-SHIFT', () => this.tryFart());
        this.input.keyboard.on('keydown-DOWN', () => { this.downHeld = true; });
        this.input.keyboard.on('keyup-DOWN', () => { this.downHeld = false; });
        this.input.keyboard.on('keydown-S', () => { this.downHeld = true; });
        this.input.keyboard.on('keyup-S', () => { this.downHeld = false; });
        this.input.keyboard.on('keydown-R', () => { if (this.state === 'over') this.scene.restart(); });
        this.input.keyboard.on('keydown-ESC', () => this.scene.start('TitleScene'));

        // --- touch / pointer ---
        // Tap anywhere = jump (tap again mid-air = double-jump). On touch devices,
        // dedicated DUCK + FART buttons sit in the bottom corners. topOnly input
        // means tapping a button does NOT also trigger the full-screen jump zone.
        this.input.addPointer(2);   // allow holding DUCK while tapping jump
        this.add.zone(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT)
            .setInteractive().setDepth(8)
            .on('pointerdown', () => this.onJump());

        const isTouch = this.sys.game.device.input.touch || navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
        if (isTouch) {
            const y = GAME_HEIGHT - 58;
            // Movement buttons on the left, special action on the right.
            this.makeCircleButton(58,  y, 42, 'DUCK', 0x4dd0e1, 'down',
                () => { this.downHeld = true; }, () => { this.downHeld = false; });
            this.makeCircleButton(154, y, 42, 'JUMP', 0xffd34d, 'up',
                () => this.onJump(), null);
            this.makeCircleButton(GAME_WIDTH - 70, y, 48, 'Fart Boost', 0x8bd450, 'wind',
                () => this.tryFart(), null);
        }
    }

    // Circular on-screen touch button: soft drop shadow + tinted fill + color
    // stroke + top-left highlight + icon glyph + label. Hit area is a true circle.
    makeCircleButton(x, y, r, label, color, icon, onDown, onUp) {
        // drop shadow
        const sh = this.add.graphics().setDepth(41);
        sh.fillStyle(0x000000, 0.3); sh.fillCircle(x + 2, y + 5, r);

        // main button
        const g = this.add.graphics().setDepth(42);
        g.fillStyle(color, 0.32); g.fillCircle(x, y, r);
        g.lineStyle(3, color, 0.95); g.strokeCircle(x, y, r);
        // top-left highlight (pseudo-3D)
        g.fillStyle(0xffffff, 0.22);
        g.fillEllipse(x - r * 0.32, y - r * 0.4, r * 0.95, r * 0.55);

        // icon (upper half of the circle)
        g.fillStyle(0xffffff, 0.95);
        if (icon === 'up') {
            g.fillTriangle(x, y - r * 0.5, x - r * 0.32, y - r * 0.08, x + r * 0.32, y - r * 0.08);
        } else if (icon === 'down') {
            g.fillTriangle(x - r * 0.32, y - r * 0.5, x + r * 0.32, y - r * 0.5, x, y - r * 0.08);
        } else if (icon === 'wind') {
            g.lineStyle(3, 0xffffff, 0.95);
            for (let i = 0; i < 3; i++) {
                const yo = y - r * 0.36 + i * (r * 0.2);
                const len = r * 0.7 - i * (r * 0.05);
                g.beginPath();
                g.moveTo(x - len / 2 - r * 0.04, yo);
                g.lineTo(x + len / 2 - r * 0.04, yo);
                g.strokePath();
            }
        }

        // label (lower half)
        this.add.text(x, y + r * 0.5, label, {
            fontFamily: 'system-ui, sans-serif',
            fontSize: label.length > 6 ? '11px' : '13px',
            color: '#ffffff', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(42);

        // circular hit area
        const zone = this.add.zone(x, y, r * 2, r * 2)
            .setInteractive(new Phaser.Geom.Circle(r, r, r), Phaser.Geom.Circle.Contains)
            .setDepth(43);
        zone.on('pointerdown', () => { if (this.state !== 'over') onDown(); });
        if (onUp) { zone.on('pointerup', onUp); zone.on('pointerout', onUp); }
        return zone;
    }

    onJump() {
        if (this.state === 'ready') { this.startRunning(); return; }
        if (this.state !== 'running') return;
        if (this.jumpsLeft <= 0) return;
        this.vy = -JUMP_VELOCITY;
        this.grounded = false;
        this.jumpsLeft--;
        if (this.jumpsLeft === MAX_JUMPS - 1) sfxJump(); else sfxJump2();
    }

    tryFart() {
        if (this.state === 'ready') { this.startRunning(); }
        if (this.state !== 'running') return;
        if (this.boostTimer > 0) return;
        if (this.boost < FART_COST) { sfxDud(); return; }
        this.boost -= FART_COST;
        this.boostTimer = FART_DURATION;
        this.vy = FART_POP;            // fart thrust pops her up
        this.grounded = false;
        sfxFart();
        this.emitFart(16);
    }

    emitFart(n) {
        for (let i = 0; i < n; i++) {
            this.fart.push({
                x: PLAYER_X - 18 + (Math.random() * 12 - 6),
                y: this.feet - 28 + (Math.random() * 14 - 7),
                vx: -80 - Math.random() * 110,
                vy: -25 + Math.random() * 55,
                r: 7 + Math.random() * 7,
                life: 0.7 + Math.random() * 0.5,
                green: Math.random() < 0.7,
            });
        }
    }

    startRunning() {
        this.state = 'running';
        this.readyText.setVisible(false);
    }

    isGroundAt(worldX) {
        for (const p of this.pits) if (worldX >= p.x && worldX <= p.x + p.w) return false;
        return true;
    }

    ensureSpawns() {
        const horizon = this.scrollX + GAME_WIDTH + 280;
        while (this.spawnX < horizon) this.spawnOne();
    }

    spawnOne() {
        const d = this.scrollX;
        const sp = this.speed;
        const baseGap = Math.max(240, sp * 0.8);
        const roll = Math.random();
        let type;
        if (d < 900) {
            type = roll < 0.72 ? 'egg' : 'cone';
        } else if (d < 1700) {
            type = roll < 0.5 ? 'egg' : (roll < 0.82 ? 'cone' : 'banner');
        } else {
            if (roll < 0.4) type = 'egg';
            else if (roll < 0.62) type = 'cone';
            else if (roll < 0.8) type = 'banner';
            else type = 'pit';
        }

        const x = this.spawnX;
        if (type === 'egg') {
            const n = 3 + Math.floor(Math.random() * 3);
            const baseY = GROUND_Y - 78 - Math.random() * 40;
            for (let i = 0; i < n; i++) {
                const arc = Math.sin((i / (n - 1)) * Math.PI) * 26;
                this.eggs.push({ x: x + i * 40, y: baseY - arc, taken: false });
            }
            this.spawnX = x + n * 40 + baseGap * 0.6 + Math.random() * 120;
        } else if (type === 'cone') {
            const h = 42 + Math.random() * 16;
            this.obstacles.push({ x, w: 38, kind: 'cone', h, hit: false });
            this.spawnX = x + baseGap + Math.random() * 150;
        } else if (type === 'banner') {
            const top = GROUND_Y - 185;
            const bottom = GROUND_Y - (PH_DUCK + 6);
            this.obstacles.push({ x, w: 50, kind: 'banner', top, bottom, hit: false });
            this.spawnX = x + baseGap + 40 + Math.random() * 150;
        } else {
            const w = Phaser.Math.Clamp(sp * 0.46, 80, 185);
            this.pits.push({ x, w });
            const n = 4;
            for (let i = 0; i < n; i++) {
                const arc = Math.sin((i / (n - 1)) * Math.PI) * 40;
                this.eggs.push({ x: x + 12 + (i / (n - 1)) * (w - 24), y: GROUND_Y - 70 - arc, taken: false });
            }
            this.spawnX = x + w + baseGap + Math.random() * 120;
        }
    }

    cull() {
        const left = this.scrollX - 80;
        this.pits = this.pits.filter((p) => p.x + p.w > left);
        this.obstacles = this.obstacles.filter((o) => o.x + o.w > left);
        this.eggs = this.eggs.filter((e) => !e.taken && e.x + 14 > left);
    }

    playerRect() {
        const ph = this.ducking ? PH_DUCK : PH_STAND;
        return { l: PLAYER_X - PW / 2, r: PLAYER_X + PW / 2, t: this.feet - ph, b: this.feet };
    }

    checkCollisions() {
        const pr = this.playerRect();
        for (const e of this.eggs) {
            if (e.taken) continue;
            const sx = e.x - this.scrollX;
            if (sx < pr.l - 14 || sx > pr.r + 14) continue;
            if (Math.abs(sx - PLAYER_X) < PW / 2 + 13 && e.y > pr.t - 13 && e.y < pr.b + 13) {
                e.taken = true;
                this.eggsCollected++;
                this.boost = Math.min(BOOST_MAX, this.boost + BOOST_PER_EGG);
                sfxEgg();
            }
        }
        for (const o of this.obstacles) {
            if (o.hit) continue;
            const cxs = o.x - this.scrollX;
            const ol = cxs - o.w / 2, or = cxs + o.w / 2;
            if (or < pr.l || ol > pr.r) continue;
            let ot, ob;
            if (o.kind === 'cone') { ot = GROUND_Y - o.h; ob = GROUND_Y; }
            else { ot = o.top; ob = o.bottom; }
            if (ob > pr.t && ot < pr.b) { o.hit = true; this.die(); return; }
        }
    }

    die() {
        this.state = 'over';
        sfxCrash();
        this.cameras.main.shake(260, 0.012);
        const isBest = this.score > getBest();
        if (isBest) setBest(this.score);
        this.showGameOver(isBest);
    }

    update(_time, delta) {
        const dt = Math.min(delta / 1000, 0.04);
        this.t += dt;

        if (this.state === 'running') {
            let speedMult = 1;
            if (this.boostTimer > 0) {
                this.boostTimer -= dt;
                speedMult = FART_SPEED_MULT;
                if (Math.random() < 0.8) this.emitFart(2);
            }
            this.speed = Math.min(SPEED_MAX, SPEED_START + this.scrollX * SPEED_RAMP);
            this.scrollX += this.speed * speedMult * dt;
            this.ensureSpawns();
            this.cull();

            this.vy += GRAVITY * dt;
            this.feet += this.vy * dt;
            const groundHere = this.isGroundAt(this.scrollX + PLAYER_X);
            this.grounded = false;
            if (groundHere && this.vy >= 0 && this.feet >= GROUND_Y) {
                this.feet = GROUND_Y; this.vy = 0; this.grounded = true; this.jumpsLeft = MAX_JUMPS;
            }
            this.ducking = this.grounded && this.downHeld;

            if (this.feet > GROUND_Y + 170) this.die();
            if (this.state === 'running') {
                this.checkCollisions();
                this.score = Math.floor(this.scrollX / 10) + this.eggsCollected * 3;
                this.scoreText.setText(`${this.score} m`);
                this.eggText.setText(`Eggs: ${this.eggsCollected}`);
            }
        }

        stepBobble(this.bob, dt, this.t, this.vy, this.grounded, this.state === 'running');
        this.updateParticles(dt);
        this.drawWorld();
        this.drawFx();
        this.drawCharacter();
        this.drawWeatherFx();
        this.drawBoostMeter();
    }

    updateParticles(dt) {
        for (const p of this.fart) {
            p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 26 * dt; p.r += 16 * dt; p.life -= dt;
        }
        this.fart = this.fart.filter((p) => p.life > 0);
        for (const d of this.rainPool) {
            d.y += d.sp * dt; d.x -= 170 * dt;
            if (d.y > GAME_HEIGHT) { d.y = -12; d.x = Math.random() * GAME_WIDTH; }
            if (d.x < -12) d.x += GAME_WIDTH + 24;
        }
        for (const f of this.snowPool) {
            f.y += f.sp * dt; f.x += Math.sin(this.t * 1.4 + f.sway) * 14 * dt;
            if (f.y > GAME_HEIGHT) { f.y = -8; f.x = Math.random() * GAME_WIDTH; }
        }
    }

    // -------- rendering --------
    drawWorld() {
        const w = weatherAt(this.scrollX);
        this._w = w;
        this.weatherText.setText(w.name);

        const g = this.bg;
        g.clear();
        g.fillGradientStyle(w.skyTop, w.skyTop, w.skyBot, w.skyBot, 1);
        g.fillRect(0, 0, GAME_WIDTH, GROUND_Y + 4);

        if (w.night) {
            for (const s of this.stars) {
                const a = 0.35 + 0.6 * Math.abs(Math.sin(this.t * 2 + s.p));
                g.fillStyle(0xffffff, a); g.fillCircle(s.x, s.y, s.s);
            }
            g.fillStyle(w.sunGlow, 0.4); g.fillCircle(645, 120, 70);
            g.fillStyle(w.sunColor, 1); g.fillCircle(645, 120, 46);
            g.fillStyle(0xd2d7ee, 1);
            g.fillCircle(632, 108, 9); g.fillCircle(660, 132, 7); g.fillCircle(652, 104, 5);
        } else if (w.sunA > 0.02) {
            g.fillStyle(w.sunGlow, 0.45 * w.sunA); g.fillCircle(670, 120, 85);
            g.fillStyle(w.sunColor, w.sunA); g.fillCircle(670, 120, 54);
        }

        const cloudOff = (this.scrollX * 0.15) % 360;
        g.fillStyle(w.cloud, w.cloudA);
        for (let i = 0; i < 4; i++) {
            const cxp = Phaser.Math.Wrap(150 + i * 230 - cloudOff, -120, GAME_WIDTH + 120);
            this.cloud(g, cxp, 80 + (i % 2) * 46);
        }
        this.hills(g, lerpColor(0x9bd9a4, 0x6f7f8c, w.overcast), this.scrollX * 0.25, 150, GROUND_Y - 34, 0);
        this.hills(g, lerpColor(0x6cc457, 0x55636e, w.overcast), this.scrollX * 0.45, 120, GROUND_Y - 12, 90);

        this.drawGround();
        this.drawEntities();
    }

    cloud(g, x, y) {
        g.fillCircle(x, y, 22);
        g.fillCircle(x + 24, y + 6, 18);
        g.fillCircle(x - 24, y + 6, 16);
        g.fillRect(x - 24, y + 6, 48, 14);
    }

    hills(g, color, offset, spacing, baseY, phase) {
        g.fillStyle(color, 1);
        const off = offset % spacing;
        for (let x = -spacing; x < GAME_WIDTH + spacing; x += spacing) {
            g.fillCircle(x - off + phase % spacing, baseY, spacing * 0.62);
        }
        g.fillRect(0, baseY, GAME_WIDTH, GROUND_Y - baseY + 4);
    }

    drawGround() {
        const g = this.worldGfx;
        g.clear();
        const snow = (this._w.precip === 'snow') ? this._w.precipInt : 0;
        const intervals = this.pits
            .map((p) => [p.x - this.scrollX, p.x + p.w - this.scrollX])
            .filter(([a, b]) => b > -10 && a < GAME_WIDTH + 10)
            .sort((A, B) => A[0] - B[0]);
        let cursor = 0;
        const spans = [];
        for (const [a, b] of intervals) {
            const end = Phaser.Math.Clamp(a, 0, GAME_WIDTH);
            if (end > cursor) spans.push([cursor, end]);
            cursor = Math.max(cursor, Phaser.Math.Clamp(b, 0, GAME_WIDTH));
        }
        if (cursor < GAME_WIDTH) spans.push([cursor, GAME_WIDTH]);

        for (const [x0, x1] of spans) {
            const wd = x1 - x0;
            if (wd <= 0) continue;
            g.fillStyle(C.dirt, 1);
            g.fillRect(x0, GROUND_Y, wd, GAME_HEIGHT - GROUND_Y);
            g.fillStyle(C.dirtDark, 1);
            for (let bx = x0 + ((this.scrollX % 48)) * -1; bx < x1; bx += 48) {
                const px = Math.max(x0, bx);
                g.fillRect(px, GROUND_Y + 40, Math.min(22, x1 - px), 6);
            }
            g.fillStyle(C.grass, 1);
            g.fillRect(x0, GROUND_Y, wd, 15);
            g.fillStyle(C.grassEdge, 1);
            g.fillRect(x0, GROUND_Y + 13, wd, 3);
            if (snow > 0) { g.fillStyle(0xffffff, 0.55 + 0.35 * snow); g.fillRect(x0, GROUND_Y - 2, wd, 7); }
            if (x0 > 0) { g.fillStyle(C.grassEdge, 1); g.fillRect(x0, GROUND_Y, 4, 26); }
            if (x1 < GAME_WIDTH) { g.fillStyle(C.grassEdge, 1); g.fillRect(x1 - 4, GROUND_Y, 4, 26); }
        }
    }

    drawEntities() {
        const g = this.worldGfx;
        for (const e of this.eggs) {
            if (e.taken) continue;
            const x = e.x - this.scrollX;
            if (x < -20 || x > GAME_WIDTH + 20) continue;
            const by = e.y + Math.sin(this.t * 3 + e.x * 0.05) * 2;
            g.fillStyle(C.eggShell, 1);
            g.fillEllipse(x, by + 2, 17, 22);
            g.fillEllipse(x, by - 5, 13, 16);              // pointier top
            g.fillStyle(C.eggShade, 0.5); g.fillEllipse(x + 3, by + 4, 9, 14);
            g.fillStyle(C.eggSpeck, 0.7);
            g.fillCircle(x - 3, by + 4, 1.3); g.fillCircle(x + 4, by - 2, 1.1); g.fillCircle(x + 1, by + 8, 1);
            g.fillStyle(C.eggShine, 0.9); g.fillEllipse(x - 4, by - 4, 4, 8);
        }
        for (const o of this.obstacles) {
            const x = o.x - this.scrollX;
            if (x < -60 || x > GAME_WIDTH + 60) continue;
            if (o.kind === 'cone') this.drawCone(g, x, o.h);
            else this.drawBanner(g, x, o);
        }
    }

    drawCone(g, x, h) {
        const baseY = GROUND_Y, topY = baseY - h;
        g.fillStyle(C.coneBase, 1); g.fillRoundedRect(x - 22, baseY - 6, 44, 8, 3);
        g.fillStyle(C.coneA, 1); g.fillTriangle(x, topY, x - 18, baseY - 4, x + 18, baseY - 4);
        g.fillStyle(C.coneB, 1);
        const sy = topY + h * 0.42;
        g.fillTriangle(x, sy - 7, x - 9, sy + 4, x + 9, sy + 4);
        g.fillStyle(C.coneA, 1);
        g.fillTriangle(x, sy - 1, x - 5.5, sy + 4, x + 5.5, sy + 4);
    }

    drawBanner(g, x, o) {
        const top = o.top, bottom = o.bottom, w = o.w;
        g.fillStyle(C.post, 1);
        g.fillRect(x - w / 2 - 4, 0, 7, bottom);
        g.fillRect(x + w / 2 - 3, 0, 7, bottom);
        g.fillStyle(C.bannerEdge, 1); g.fillRoundedRect(x - w / 2 - 8, top, w + 16, bottom - top, 7);
        g.fillStyle(C.banner, 1); g.fillRoundedRect(x - w / 2 - 4, top + 4, w + 8, bottom - top - 8, 5);
        g.fillStyle(0xffffff, 0.95);
        for (let i = 0; i < 3; i++) {
            const cy = top + 16 + i * 18;
            g.fillTriangle(x - 12, cy, x + 12, cy, x, cy + 12);
        }
    }

    drawFx() {
        const g = this.fxGfx;
        g.clear();
        for (const p of this.fart) {
            const a = Phaser.Math.Clamp(p.life * 1.3, 0, 0.7);
            g.fillStyle(0x6f8a2e, a * 0.5);
            g.fillCircle(p.x, p.y, p.r + 2);
            g.fillStyle(p.green ? C.fart : C.fart2, a);
            g.fillCircle(p.x, p.y, p.r);
        }
    }

    drawCharacter() {
        this.charGfx.clear();
        const airborne = !this.grounded && this.state !== 'ready';
        const moving = this.state === 'running';
        const info = drawSkater(this.charGfx, PLAYER_X, this.feet, {
            ducking: this.ducking, airborne, moving, stridePhase: this.scrollX * 0.022, t: this.t,
        });
        this.headGfx.clear();
        this.headGfx.setPosition(info.chinX, info.chinY + this.bob.bob);
        this.headGfx.setRotation(this.bob.ang);
        drawHead(this.headGfx, { blink: this.bob.blinking, mouthOpen: airborne || this.boostTimer > 0 });
        this.nameTag.setPosition(info.headX, info.headY - HEAD_R - 22 + this.bob.bob * 0.5);
    }

    drawWeatherFx() {
        const g = this.weatherGfx;
        g.clear();
        const w = this._w;
        const darken = Math.max(w.night ? 0.28 : 0, w.overcast * 0.32);
        if (darken > 0.01) { g.fillStyle(0x0a1430, darken); g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT); }

        if (w.precip === 'rain' && w.precipInt > 0.02) {
            g.lineStyle(2, 0xbcd6ef, 0.5 * w.precipInt);
            const count = Math.floor(this.rainPool.length * w.precipInt);
            for (let i = 0; i < count; i++) {
                const d = this.rainPool[i];
                g.beginPath(); g.moveTo(d.x, d.y); g.lineTo(d.x - 4, d.y + d.len); g.strokePath();
            }
        } else if (w.precip === 'snow' && w.precipInt > 0.02) {
            const count = Math.floor(this.snowPool.length * w.precipInt);
            for (let i = 0; i < count; i++) {
                const f = this.snowPool[i];
                g.fillStyle(0xffffff, 0.85 * w.precipInt);
                g.fillCircle(f.x, f.y, f.r);
            }
        }
    }

    drawBoostMeter() {
        const g = this.boostGfx;
        g.clear();
        const x = 16, y = 88, w = 150, h = 13;
        const ready = this.boost >= FART_COST;
        g.fillStyle(0x14233f, 0.6); g.fillRoundedRect(x - 2, y - 2, w + 4, h + 4, 4);
        g.fillStyle(0x2b3b5a, 1); g.fillRoundedRect(x, y, w, h, 3);
        const fillW = Math.max(0, w * (this.boost / BOOST_MAX));
        if (fillW > 0) {
            g.fillStyle(this.boostTimer > 0 ? 0xffd34d : (ready ? 0x8bd450 : 0x6d8a52), 1);
            g.fillRoundedRect(x, y, fillW, h, 3);
        }
        g.fillStyle(0xffffff, 0.55);
        g.fillRect(x + w * (FART_COST / BOOST_MAX), y, 1.5, h);   // "ready" threshold tick
    }

    showGameOver(isBest) {
        const cx = GAME_WIDTH / 2, cy = GAME_HEIGHT / 2;
        const myToken = (this._goToken = {});

        const panel = this.add.graphics().setDepth(50);
        panel.fillStyle(0x000000, 0.55); panel.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        panel.fillStyle(0x14233f, 0.97);
        panel.fillRoundedRect(cx - 238, cy - 220, 476, 452, 18);
        panel.lineStyle(3, isBest ? 0xffd34d : 0xff5c8a, 1);
        panel.strokeRoundedRect(cx - 238, cy - 220, 476, 452, 18);

        this.add.text(cx, cy - 192, 'WIPEOUT!', {
            fontFamily: 'system-ui, sans-serif', fontSize: '34px', color: '#ff5c8a', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(51);
        this.add.text(cx, cy - 150, `${this.score} m`, {
            fontFamily: 'system-ui, sans-serif', fontSize: '46px', color: '#ffffff', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(51);
        this.add.text(cx, cy - 112, `Eggs: ${this.eggsCollected}    ·    Your best: ${getBest()} m`, {
            fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#fdf3df',
        }).setOrigin(0.5).setDepth(51);

        this.goRank = this.add.text(cx, cy - 88, isBest ? 'NEW PERSONAL BEST!' : '', {
            fontFamily: 'system-ui, sans-serif', fontSize: '15px', color: '#ffd34d', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(51);
        this.add.text(cx, cy - 64, 'GLOBAL TOP 10', {
            fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#9fb6d6',
        }).setOrigin(0.5).setDepth(51);
        this.goLoading = this.add.text(cx, cy - 6, 'saving & loading leaderboard…', {
            fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#88a', fontStyle: 'italic',
        }).setOrigin(0.5).setDepth(51);
        this.goRows = [];

        this.makeButton(cx - 95, cy + 150, 170, 46, 'Skate again', () => this.scene.restart());
        this.makeButton(cx + 95, cy + 150, 170, 46, 'Title', () => this.scene.start('TitleScene'));
        this.add.text(cx, cy + 190, 'SPACE / R = retry    ESC = title', {
            fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#6b6b78',
        }).setOrigin(0.5).setDepth(51);

        this.input.keyboard.once('keydown-SPACE', () => { if (this.state === 'over') this.scene.restart(); });

        this.loadGameOverBoard(myToken);
    }

    async loadGameOverBoard(myToken) {
        // make sure we have a name (prompt once if it's never been set)
        let name = getPlayerName();
        if (!name) name = promptForName() || 'anon';
        if (this._goToken !== myToken) return;

        const submitted = this.score > 0 ? await submitScore({ name, score: this.score, eggs: this.eggsCollected }) : false;
        if (this._goToken !== myToken) return;
        const scores = await fetchLeaderboard(10);
        if (this._goToken !== myToken) return;

        if (this.goLoading) { this.goLoading.destroy(); this.goLoading = null; }
        const cx = GAME_WIDTH / 2, cy = GAME_HEIGHT / 2;

        if (scores === null) {
            this.goRank.setText('Leaderboard offline — score not saved').setColor('#e08a8a');
            return;
        }
        const myRank = scores.findIndex((s) => s.name === name && s.score === this.score);
        if (myRank === 0) this.goRank.setText('NEW #1 GLOBAL!').setColor('#ffd34d');
        else if (myRank > 0) this.goRank.setText(`Ranked #${myRank + 1} on the global board`).setColor('#8bd450');
        else if (submitted) this.goRank.setText("Saved — didn't crack the top 10").setColor('#bcd0ee');

        scores.forEach((s, i) => {
            const isMe = i === myRank;
            const row = `${String(i + 1).padStart(2, ' ')}.   ${String(s.score).padStart(5, ' ')} m    ${s.name}${isMe ? '  ← you' : ''}`;
            this.goRows.push(this.add.text(cx - 150, cy - 44 + i * 16, row, {
                fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '13px',
                color: isMe ? '#ffd34d' : (i === 0 ? '#8bd450' : '#e7eefb'),
                fontStyle: isMe ? 'bold' : 'normal',
            }).setOrigin(0, 0.5).setDepth(51));
        });
    }

    makeButton(x, y, w, h, label, action) {
        const g = this.add.graphics().setDepth(51);
        const draw = (fill) => { g.clear(); g.fillStyle(fill, 1); g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 10); };
        draw(0xff5c8a);
        this.add.text(x, y, label, {
            fontFamily: 'system-ui, sans-serif', fontSize: '17px', color: '#ffffff', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(52);
        const zone = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true }).setDepth(52);
        zone.on('pointerover', () => draw(0xff7ba2));
        zone.on('pointerout', () => draw(0xff5c8a));
        zone.on('pointerdown', () => { playTone(660, 0.08); action(); });
    }
}

// ============================================================================
const config = {
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#4aa6ec',
    // Scale the 800x600 game canvas to fit whatever screen it's on while
    // preserving its 4:3 aspect ratio, centered. The page's gradient backdrop
    // fills any letterbox area so it doesn't read as "broken empty space".
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
    },
    scene: [TitleScene, PlayScene],
};

const game = new Phaser.Game(config);
