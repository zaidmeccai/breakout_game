const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;

// --- Firebase setup ---
// The API key here is NOT a secret — it's a public identifier for your Firebase
// project. Real security lives in your Firestore security rules (set in the
// Firebase console). Safe to commit to GitHub.
const firebaseConfig = {
    apiKey: "AIzaSyDBTRmxAPWqUjEgK9UrWGSCPImLt6e8dac",
    authDomain: "breakoutgame-fefa7.firebaseapp.com",
    projectId: "breakoutgame-fefa7",
    storageBucket: "breakoutgame-fefa7.firebasestorage.app",
    messagingSenderId: "306321430842",
    appId: "1:306321430842:web:8832b71b6c465678ccd803"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const SCORES_COLLECTION = 'breakout_scores';

// --- Levels ---
const COLOR_MAP = {
    'R': 0xef476f,
    'O': 0xff8c42,
    'Y': 0xffd166,
    'G': 0x06d6a0,
    'B': 0x118ab2
};

const LEVELS = [
    [
        "RRRRRRRR",
        "OOOOOOOO",
        "YYYYYYYY",
        "GGGGGGGG",
        "BBBBBBBB"
    ],
    [
        "...RR...",
        "..OOOO..",
        ".YYYYYY.",
        "GGGGGGGG",
        "BBBBBBBB"
    ],
    [
        "R.R.R.R.",
        ".O.O.O.O",
        "Y.Y.Y.Y.",
        ".G.G.G.G",
        "BBBBBBBB"
    ]
];

// --- Global leaderboard (Firestore) ---
// Returns sorted list of top entries for a level, or null if the request failed
// (e.g. offline, rules block, project not set up). Callers can treat null as
// "show offline message".
async function fetchLeaderboard(levelIndex, limit = 10) {
    try {
        const snapshot = await db.collection(SCORES_COLLECTION)
            .where('level', '==', levelIndex)
            .get();
        const scores = snapshot.docs.map(d => d.data());
        scores.sort((a, b) => a.time - b.time);
        return scores.slice(0, limit);
    } catch (e) {
        console.error('[Leaderboard] fetch failed', e);
        return null;
    }
}

async function submitScore({ name, level, time }) {
    try {
        await db.collection(SCORES_COLLECTION).add({
            name, level, time,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return true;
    } catch (e) {
        console.error('[Leaderboard] submit failed', e);
        return false;
    }
}

// --- Player name (kept in localStorage so you only set it once per device) ---
const NAME_KEY = 'breakout_player_name';
function getPlayerName() { return localStorage.getItem(NAME_KEY) || ''; }
function setPlayerName(name) { localStorage.setItem(NAME_KEY, name); }

// Synchronous browser prompt — ugly but zero-effort. Could be replaced with a
// proper in-game text input later.
function promptForName() {
    const current = getPlayerName();
    const input = window.prompt('Enter your player name (1-12 chars):', current);
    if (input === null) return null; // cancelled
    const cleaned = input.trim().slice(0, 12);
    if (!cleaned) return null;
    setPlayerName(cleaned);
    return cleaned;
}

function formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const tenths = Math.floor((ms % 1000) / 100);
    return `${seconds}.${tenths}s`;
}

// --- Sound (Web Audio API — generates tones in the browser, no audio files) ---
let audioCtx;
function getAudioCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}

function playTone(freq, duration, type = 'square', volume = 0.08) {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.start();
    osc.stop(ctx.currentTime + duration);
}

function playSequence(notes, volume = 0.08) {
    const ctx = getAudioCtx();
    const startTime = ctx.currentTime;
    notes.forEach(([freq, dur, offset]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(ctx.destination);
        const t0 = startTime + offset;
        gain.gain.setValueAtTime(volume, t0);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.start(t0);
        osc.stop(t0 + dur);
    });
}

// --- Menu Scene: clickable level tiles, player name, global top 3 per tile ---
class MenuScene extends Phaser.Scene {
    constructor() { super('MenuScene'); }

    create() {
        // Title
        this.add.text(GAME_WIDTH / 2, 60, 'BREAKOUT', {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '52px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.add.text(GAME_WIDTH / 2, 105, 'Click a level to play', {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '17px',
            color: '#aaaaaa'
        }).setOrigin(0.5);

        // Player name + change link (top-right)
        this.renderPlayerName();

        // Tiles
        const tileW = 210;
        const tileH = 290;
        const gap = 30;
        const totalW = LEVELS.length * tileW + (LEVELS.length - 1) * gap;
        const startX = (GAME_WIDTH - totalW) / 2 + tileW / 2;
        const tileY = 310;

        this.tileSlots = []; // for async leaderboard fills
        LEVELS.forEach((pattern, index) => {
            this.createTile(startX + index * (tileW + gap), tileY, tileW, tileH, index, pattern);
        });

        this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 22,
            '← → move paddle    SPACE launch    ESC return to menu',
            { fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#666666' }
        ).setOrigin(0.5);

        // Kick off async leaderboard fetches — placeholders get replaced when they resolve
        LEVELS.forEach((_, i) => {
            fetchLeaderboard(i, 3).then(scores => {
                if (this.scene.isActive()) this.populateTileLeaderboard(i, scores);
            });
        });
    }

    renderPlayerName() {
        if (this.nameDisplay) this.nameDisplay.destroy();
        if (this.nameChangeBtn) this.nameChangeBtn.destroy();

        const name = getPlayerName();
        this.nameDisplay = this.add.text(GAME_WIDTH - 16, 16,
            name ? `Player: ${name}` : 'Player: (not set)',
            {
                fontFamily: 'system-ui, sans-serif',
                fontSize: '14px',
                color: name ? '#ffd166' : '#999999'
            }
        ).setOrigin(1, 0);

        this.nameChangeBtn = this.add.text(GAME_WIDTH - 16, 38,
            name ? 'change' : 'set name',
            { fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#4dd0e1' }
        ).setOrigin(1, 0);
        this.nameChangeBtn.setInteractive({ useHandCursor: true });
        this.nameChangeBtn.on('pointerdown', () => {
            promptForName();
            this.renderPlayerName();
        });
    }

    createTile(x, y, w, h, levelIndex, pattern) {
        const bg = this.add.rectangle(x, y, w, h, 0x252b48);
        bg.setStrokeStyle(2, 0x4dd0e1);
        bg.setInteractive({ useHandCursor: true });

        this.add.text(x, y - 115, `LEVEL ${levelIndex + 1}`, {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '22px', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5);

        this.drawMiniPreview(x, y - 55, pattern);

        // Placeholder leaderboard text — replaced once fetch returns
        const header = this.add.text(x, y + 30, 'Top Times', {
            fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#888888'
        }).setOrigin(0.5);
        const placeholder = this.add.text(x, y + 55, 'loading…', {
            fontFamily: 'system-ui, sans-serif', fontSize: '13px',
            color: '#666666', fontStyle: 'italic'
        }).setOrigin(0.5);

        this.tileSlots[levelIndex] = { x, y, header, dynamicTexts: [placeholder] };

        bg.on('pointerover', () => {
            bg.setFillStyle(0x303860);
            bg.setStrokeStyle(2, 0xffffff);
        });
        bg.on('pointerout', () => {
            bg.setFillStyle(0x252b48);
            bg.setStrokeStyle(2, 0x4dd0e1);
        });
        bg.on('pointerdown', () => {
            playTone(659, 0.08);
            // Force a name before letting them start
            if (!getPlayerName()) {
                const chosen = promptForName();
                this.renderPlayerName();
                if (!chosen) return;
            }
            this.scene.start('GameScene', { level: levelIndex });
        });
    }

    populateTileLeaderboard(levelIndex, scores) {
        const slot = this.tileSlots[levelIndex];
        if (!slot) return;
        slot.dynamicTexts.forEach(t => t.destroy());
        slot.dynamicTexts = [];

        if (scores === null) {
            slot.dynamicTexts.push(this.add.text(slot.x, slot.y + 55, 'offline', {
                fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#cc6666'
            }).setOrigin(0.5));
            return;
        }
        if (scores.length === 0) {
            slot.dynamicTexts.push(this.add.text(slot.x, slot.y + 55, 'be the first!', {
                fontFamily: 'system-ui, sans-serif', fontSize: '13px',
                color: '#777777', fontStyle: 'italic'
            }).setOrigin(0.5));
            return;
        }

        const me = getPlayerName();
        scores.forEach((s, i) => {
            const isMe = s.name === me;
            const label = `${i + 1}. ${formatTime(s.time)}  ${s.name}`;
            slot.dynamicTexts.push(this.add.text(slot.x, slot.y + 50 + i * 18, label, {
                fontFamily: 'system-ui, sans-serif', fontSize: '13px',
                color: isMe ? '#ffd166' : (i === 0 ? '#06d6a0' : '#cccccc')
            }).setOrigin(0.5));
        });
    }

    drawMiniPreview(x, y, pattern) {
        const bw = 18, bh = 6, gp = 1;
        const cols = pattern[0].length;
        const startPX = x - (cols * (bw + gp) - gp) / 2 + bw / 2;
        const startPY = y - (pattern.length * (bh + gp) - gp) / 2 + bh / 2;
        for (let r = 0; r < pattern.length; r++) {
            for (let c = 0; c < cols; c++) {
                const ch = pattern[r][c];
                if (!COLOR_MAP[ch]) continue;
                this.add.rectangle(startPX + c * (bw + gp), startPY + r * (bh + gp), bw, bh, COLOR_MAP[ch]);
            }
        }
    }
}

// --- Game Scene ---
class GameScene extends Phaser.Scene {
    constructor() { super('GameScene'); }

    init(data) {
        this.levelIndex = data && data.level !== undefined ? data.level : 0;
    }

    create() {
        this.score = 0;
        this.gameOver = false;
        this.gameWon = false;
        this.ballLaunched = false;
        this.startTime = 0;
        this.finalTime = 0;

        this.physics.world.setBoundsCollision(true, true, true, false);

        this.paddle = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 40, 110, 18, 0x4dd0e1);
        this.physics.add.existing(this.paddle);
        this.paddle.body.setImmovable(true);
        this.paddle.body.setCollideWorldBounds(true);

        this.ball = this.add.circle(GAME_WIDTH / 2, GAME_HEIGHT - 60, 9, 0xffffff);
        this.physics.add.existing(this.ball);
        this.ball.body.setCircle(9);
        this.ball.body.setBounce(1, 1);
        this.ball.body.setCollideWorldBounds(true);
        this.ball.body.onWorldBounds = true;

        this.physics.world.on('worldbounds', () => {
            if (this.ballLaunched && !this.gameOver && !this.gameWon) {
                playTone(330, 0.04, 'square', 0.04);
            }
        });

        this.bricks = this.physics.add.staticGroup();
        this.buildBricks(LEVELS[this.levelIndex]);

        this.physics.add.collider(this.ball, this.paddle, this.hitPaddle, null, this);
        this.physics.add.collider(this.ball, this.bricks, this.hitBrick, null, this);

        this.cursors = this.input.keyboard.createCursorKeys();

        // HUD
        this.scoreText = this.add.text(16, 16, 'Score: 0', {
            fontFamily: 'system-ui, sans-serif', fontSize: '20px', color: '#ffffff'
        });
        this.add.text(GAME_WIDTH / 2, 16, `Level ${this.levelIndex + 1}`, {
            fontFamily: 'system-ui, sans-serif', fontSize: '20px', color: '#ffffff'
        }).setOrigin(0.5, 0);
        this.timeText = this.add.text(GAME_WIDTH - 16, 16, 'Time: 0.0s', {
            fontFamily: 'system-ui, sans-serif', fontSize: '20px', color: '#ffffff'
        }).setOrigin(1, 0);
        this.add.text(16, GAME_HEIGHT - 22, 'ESC = menu', {
            fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#666666'
        });

        this.messageText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'Press SPACE to launch', {
            fontFamily: 'system-ui, sans-serif', fontSize: '28px', color: '#ffffff', align: 'center'
        }).setOrigin(0.5);

        this.input.keyboard.on('keydown-SPACE', () => {
            if (!this.ballLaunched && !this.gameOver && !this.gameWon) {
                this.ballLaunched = true;
                this.startTime = Date.now();
                const speedMult = 1 + this.levelIndex * 0.1;
                this.ball.body.setVelocity(180 * speedMult, -340 * speedMult);
                this.messageText.setVisible(false);
                playTone(523, 0.1);
            }
        });

        this.input.keyboard.on('keydown-ESC', () => {
            this.scene.start('MenuScene');
        });
    }

    buildBricks(pattern) {
        const cols = pattern[0].length;
        const brickW = 80, brickH = 26, gap = 8;
        const totalW = cols * brickW + (cols - 1) * gap;
        const startX = (GAME_WIDTH - totalW) / 2 + brickW / 2;
        const startY = 70;
        for (let row = 0; row < pattern.length; row++) {
            for (let col = 0; col < cols; col++) {
                const ch = pattern[row][col];
                if (!COLOR_MAP[ch]) continue;
                const brick = this.add.rectangle(
                    startX + col * (brickW + gap),
                    startY + row * (brickH + gap),
                    brickW, brickH, COLOR_MAP[ch]
                );
                this.physics.add.existing(brick, true);
                brick.setData('row', row);
                this.bricks.add(brick);
            }
        }
    }

    update() {
        if (this.gameOver || this.gameWon) {
            this.paddle.body.setVelocityX(0);
            return;
        }
        if (this.cursors.left.isDown) {
            this.paddle.body.setVelocityX(-450);
        } else if (this.cursors.right.isDown) {
            this.paddle.body.setVelocityX(450);
        } else {
            this.paddle.body.setVelocityX(0);
        }

        if (!this.ballLaunched) {
            this.ball.x = this.paddle.x;
            this.ball.y = this.paddle.y - 20;
            this.ball.body.updateFromGameObject();
            return;
        }

        this.timeText.setText('Time: ' + formatTime(Date.now() - this.startTime));

        if (this.ball.y > GAME_HEIGHT + 20) {
            this.endGame(false);
            return;
        }
        if (this.bricks.countActive() === 0) {
            this.endGame(true);
        }
    }

    hitPaddle(ball, paddle) {
        const offset = ball.x - paddle.x;
        ball.body.setVelocityX(offset * 8);
        if (ball.body.velocity.y > -50) {
            ball.body.setVelocityY(-Math.abs(ball.body.velocity.y) - 50);
        }
        playTone(180, 0.06, 'square', 0.07);
    }

    hitBrick(ball, brick) {
        const row = brick.getData('row');
        brick.destroy();
        this.score += 10;
        this.scoreText.setText('Score: ' + this.score);
        playTone(523 + (4 - row) * 90, 0.08, 'square', 0.07);
    }

    async endGame(won) {
        this.ball.body.setVelocity(0, 0);
        this.finalTime = Date.now() - this.startTime;

        if (won) {
            this.gameWon = true;
            playSequence([[523, 0.1, 0], [659, 0.1, 0.1], [784, 0.1, 0.2], [1047, 0.35, 0.3]]);
            // Submit to Firestore (silently fails if offline — game still works)
            await submitScore({
                name: getPlayerName() || 'anon',
                level: this.levelIndex,
                time: this.finalTime
            });
        } else {
            this.gameOver = true;
            this.ball.setVisible(false);
            playSequence([[440, 0.15, 0], [330, 0.15, 0.15], [220, 0.35, 0.3]]);
        }

        // Bail if user clicked Menu/Replay/etc. during the await
        if (!this.scene.isActive()) return;

        this.showEndPanelShell(won);
        const scores = await fetchLeaderboard(this.levelIndex, 10);
        if (!this.scene.isActive()) return;
        this.populateLeaderboard(scores, won);
    }

    showEndPanelShell(won) {
        this.messageText.setVisible(false);

        const panelX = GAME_WIDTH / 2;
        const panelY = GAME_HEIGHT / 2;
        const panel = this.add.rectangle(panelX, panelY, 480, 480, 0x000000, 0.9);
        panel.setStrokeStyle(2, won ? 0x06d6a0 : 0xef476f);

        this.add.text(panelX, panelY - 205, won ? 'LEVEL CLEARED' : 'GAME OVER', {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '28px',
            color: won ? '#06d6a0' : '#ef476f',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        if (won) {
            this.add.text(panelX, panelY - 168, `Your Time: ${formatTime(this.finalTime)}`, {
                fontFamily: 'system-ui, sans-serif', fontSize: '17px', color: '#ffffff'
            }).setOrigin(0.5);
        }

        // Leaderboard panel (populated async)
        this.add.text(panelX, panelY - 130, `Level ${this.levelIndex + 1} — Global Top 10`, {
            fontFamily: 'system-ui, sans-serif', fontSize: '15px', color: '#aaaaaa'
        }).setOrigin(0.5);

        this.leaderboardLoadingText = this.add.text(panelX, panelY - 50, 'loading leaderboard…', {
            fontFamily: 'system-ui, sans-serif', fontSize: '14px',
            color: '#777777', fontStyle: 'italic'
        }).setOrigin(0.5);

        // Buttons
        const hasNext = this.levelIndex < LEVELS.length - 1;
        const buttons = [];
        if (won && hasNext) {
            buttons.push({ label: 'Next Level', action: () => this.scene.restart({ level: this.levelIndex + 1 }) });
        }
        buttons.push({ label: 'Replay', action: () => this.scene.restart({ level: this.levelIndex }) });
        buttons.push({ label: 'Menu', action: () => this.scene.start('MenuScene') });

        const buttonW = 125, buttonH = 38, btnGap = 10;
        const totalBW = buttons.length * buttonW + (buttons.length - 1) * btnGap;
        const buttonStartX = panelX - totalBW / 2 + buttonW / 2;
        const buttonY = panelY + 195;
        buttons.forEach((b, i) => {
            this.createButton(buttonStartX + i * (buttonW + btnGap), buttonY, buttonW, buttonH, b.label, b.action);
        });
    }

    populateLeaderboard(scores, won) {
        if (this.leaderboardLoadingText) {
            this.leaderboardLoadingText.destroy();
            this.leaderboardLoadingText = null;
        }

        const panelX = GAME_WIDTH / 2;
        const panelY = GAME_HEIGHT / 2;
        const me = getPlayerName();

        if (scores === null) {
            this.add.text(panelX, panelY - 50, 'Leaderboard offline.\nYour time was saved locally and will sync later.', {
                fontFamily: 'system-ui, sans-serif', fontSize: '14px',
                color: '#cc6666', align: 'center'
            }).setOrigin(0.5);
            return;
        }

        if (scores.length === 0) {
            this.add.text(panelX, panelY - 50, '— no times yet —', {
                fontFamily: 'system-ui, sans-serif', fontSize: '14px',
                color: '#666666', fontStyle: 'italic'
            }).setOrigin(0.5);
            return;
        }

        // Did our run land in the top 10? (matching on time + name is good enough)
        const myRank = won
            ? scores.findIndex(s => s.name === (me || 'anon') && s.time === this.finalTime)
            : -1;

        // Show rank badge (won case)
        if (won && myRank === 0) {
            this.add.text(panelX, panelY - 100, '🏆 NEW #1 GLOBAL!', {
                fontFamily: 'system-ui, sans-serif', fontSize: '16px',
                color: '#ffd166', fontStyle: 'bold'
            }).setOrigin(0.5);
        } else if (won && myRank > 0) {
            this.add.text(panelX, panelY - 100, `Ranked #${myRank + 1} of top 10`, {
                fontFamily: 'system-ui, sans-serif', fontSize: '15px', color: '#cccccc'
            }).setOrigin(0.5);
        } else if (won) {
            this.add.text(panelX, panelY - 100, "Didn't crack the top 10", {
                fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#888888'
            }).setOrigin(0.5);
        }

        // Top 10 list
        const startY = panelY - 75;
        scores.forEach((s, i) => {
            const isMe = i === myRank;
            const rankColor = isMe ? '#ffd166' : (i === 0 ? '#06d6a0' : '#ffffff');
            // Single text line with simple padding
            const rankStr = String(i + 1).padStart(2, ' ');
            const timeStr = formatTime(s.time).padStart(7, ' ');
            const nameStr = s.name + (isMe ? '  ← you' : '');
            this.add.text(panelX, startY + i * 20,
                `${rankStr}.   ${timeStr}    ${nameStr}`,
                {
                    fontFamily: 'monospace, monospace',
                    fontSize: '14px',
                    color: rankColor
                }
            ).setOrigin(0.5);
        });
    }

    createButton(x, y, w, h, label, action) {
        const bg = this.add.rectangle(x, y, w, h, 0x4dd0e1);
        bg.setInteractive({ useHandCursor: true });
        this.add.text(x, y, label, {
            fontFamily: 'system-ui, sans-serif',
            fontSize: '15px', color: '#1a1a2e', fontStyle: 'bold'
        }).setOrigin(0.5);
        bg.on('pointerover', () => bg.setFillStyle(0x80deea));
        bg.on('pointerout', () => bg.setFillStyle(0x4dd0e1));
        bg.on('pointerdown', () => {
            playTone(523, 0.08);
            action();
        });
    }
}

const config = {
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent: 'game',
    backgroundColor: '#1a1a2e',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: [MenuScene, GameScene]
};

const game = new Phaser.Game(config);
