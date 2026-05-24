const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;

// --- Levels ---
// Each level is a 5-row pattern. Each character is one brick (or empty):
//   R = red, O = orange, Y = yellow, G = green, B = blue
//   . = empty space (no brick)
// To add a new level, just add another pattern to this array — the game
// will pick up the new level automatically and update "Level X / Y".
const COLOR_MAP = {
    'R': 0xef476f,
    'O': 0xff8c42,
    'Y': 0xffd166,
    'G': 0x06d6a0,
    'B': 0x118ab2
};

const LEVELS = [
    // Level 1: classic full grid
    [
        "RRRRRRRR",
        "OOOOOOOO",
        "YYYYYYYY",
        "GGGGGGGG",
        "BBBBBBBB"
    ],
    // Level 2: pyramid
    [
        "...RR...",
        "..OOOO..",
        ".YYYYYY.",
        "GGGGGGGG",
        "BBBBBBBB"
    ],
    // Level 3: gaps require precision
    [
        "R.R.R.R.",
        ".O.O.O.O",
        "Y.Y.Y.Y.",
        ".G.G.G.G",
        "BBBBBBBB"
    ]
];

// --- Sound (Web Audio API — generates tones in the browser, no audio files needed) ---
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
    scene: {
        init: init,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

let paddle;
let ball;
let bricks;
let cursors;
let scoreText;
let levelText;
let messageText;
let score = 0;
let currentLevel = 0;
let gameOver = false;
let gameWon = false;
let levelComplete = false;
let ballLaunched = false;

// init() runs before create() on every scene start/restart.
// The "data" object is what we pass to scene.restart({...}) — we use it to
// tell the new scene whether this is a level advance or a fresh start.
function init(data) {
    if (data && data.advance) {
        currentLevel++;
        // keep score across levels
    } else {
        currentLevel = 0;
        score = 0;
    }
}

function create() {
    gameOver = false;
    gameWon = false;
    levelComplete = false;
    ballLaunched = false;

    this.physics.world.setBoundsCollision(true, true, true, false);

    // Paddle
    paddle = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 40, 110, 18, 0x4dd0e1);
    this.physics.add.existing(paddle);
    paddle.body.setImmovable(true);
    paddle.body.setCollideWorldBounds(true);

    // Ball
    ball = this.add.circle(GAME_WIDTH / 2, GAME_HEIGHT - 60, 9, 0xffffff);
    this.physics.add.existing(ball);
    ball.body.setCircle(9);
    ball.body.setBounce(1, 1);
    ball.body.setCollideWorldBounds(true);
    ball.body.onWorldBounds = true;

    this.physics.world.on('worldbounds', () => {
        if (ballLaunched && !gameOver && !gameWon && !levelComplete) {
            playTone(330, 0.04, 'square', 0.04);
        }
    });

    // Build bricks from the current level's pattern
    bricks = this.physics.add.staticGroup();
    const pattern = LEVELS[currentLevel];
    const cols = pattern[0].length;
    const brickW = 80;
    const brickH = 26;
    const gap = 8;
    const totalW = cols * brickW + (cols - 1) * gap;
    const startX = (GAME_WIDTH - totalW) / 2 + brickW / 2;
    const startY = 70;

    for (let row = 0; row < pattern.length; row++) {
        for (let col = 0; col < cols; col++) {
            const ch = pattern[row][col];
            if (!COLOR_MAP[ch]) continue; // empty space — skip
            const x = startX + col * (brickW + gap);
            const y = startY + row * (brickH + gap);
            const brick = this.add.rectangle(x, y, brickW, brickH, COLOR_MAP[ch]);
            this.physics.add.existing(brick, true);
            brick.setData('row', row);
            bricks.add(brick);
        }
    }

    // Collisions
    this.physics.add.collider(ball, paddle, hitPaddle, null, this);
    this.physics.add.collider(ball, bricks, hitBrick, null, this);

    // Input
    cursors = this.input.keyboard.createCursorKeys();

    // UI: score (left) and level (right)
    scoreText = this.add.text(16, 16, 'Score: ' + score, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        color: '#ffffff'
    });
    levelText = this.add.text(GAME_WIDTH - 16, 16, `Level ${currentLevel + 1} / ${LEVELS.length}`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        color: '#ffffff'
    }).setOrigin(1, 0);

    messageText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'Press SPACE to launch', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '28px',
        color: '#ffffff',
        align: 'center'
    }).setOrigin(0.5);

    // SPACE behavior depends on what state we're in
    this.input.keyboard.on('keydown-SPACE', () => {
        if (levelComplete) {
            this.scene.restart({ advance: true });
        } else if (gameOver || gameWon) {
            this.scene.restart();
        } else if (!ballLaunched) {
            ballLaunched = true;
            // Ball gets 10% faster per level
            const speedMult = 1 + currentLevel * 0.1;
            ball.body.setVelocity(180 * speedMult, -340 * speedMult);
            messageText.setVisible(false);
            playTone(523, 0.1);
        }
    });
}

function update() {
    if (gameOver || gameWon || levelComplete) {
        paddle.body.setVelocityX(0);
        return;
    }

    if (cursors.left.isDown) {
        paddle.body.setVelocityX(-450);
    } else if (cursors.right.isDown) {
        paddle.body.setVelocityX(450);
    } else {
        paddle.body.setVelocityX(0);
    }

    if (!ballLaunched) {
        ball.x = paddle.x;
        ball.y = paddle.y - 20;
        ball.body.updateFromGameObject();
        return;
    }

    if (ball.y > GAME_HEIGHT + 20) {
        gameOver = true;
        ball.body.setVelocity(0, 0);
        ball.setVisible(false);
        messageText.setText('Game Over\nPress SPACE to restart');
        messageText.setVisible(true);
        playSequence([[440, 0.15, 0], [330, 0.15, 0.15], [220, 0.35, 0.3]]);
        return;
    }

    if (bricks.countActive() === 0) {
        ball.body.setVelocity(0, 0);
        if (currentLevel < LEVELS.length - 1) {
            // More levels remaining
            levelComplete = true;
            messageText.setText(`Level ${currentLevel + 1} Complete!\nPress SPACE for next level`);
            messageText.setVisible(true);
            playSequence([[523, 0.1, 0], [659, 0.15, 0.1]]);
        } else {
            // Final level cleared
            gameWon = true;
            messageText.setText('You Win!\nAll levels cleared\nPress SPACE to restart');
            messageText.setVisible(true);
            playSequence([[523, 0.1, 0], [659, 0.1, 0.1], [784, 0.1, 0.2], [1047, 0.35, 0.3]]);
        }
    }
}

function hitPaddle(ball, paddle) {
    const offset = ball.x - paddle.x;
    ball.body.setVelocityX(offset * 8);
    if (ball.body.velocity.y > -50) {
        ball.body.setVelocityY(-Math.abs(ball.body.velocity.y) - 50);
    }
    playTone(180, 0.06, 'square', 0.07);
}

function hitBrick(ball, brick) {
    const row = brick.getData('row');
    brick.destroy();
    score += 10;
    scoreText.setText('Score: ' + score);
    playTone(523 + (4 - row) * 90, 0.08, 'square', 0.07);
}
