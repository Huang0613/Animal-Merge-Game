// 1. 全域變數初始化
let score = 0;
let gameOver = false;
let isStarting = false;
let currentPreview = null;
let nextLevel = 0;
let scoreText;
const DEAD_LINE_Y = 100;
let highScore = localStorage.getItem('animal_high_score') || 0;

const ANIMAL_DATA = [
    { radius: 20, color: 0xffadad, pts: 2 },
    { radius: 30, color: 0xffd6a5, pts: 4 },
    { radius: 45, color: 0xfdffb6, pts: 8 },
    { radius: 60, color: 0xcaffbf, pts: 16 },
    { radius: 80, color: 0x9bf6ff, pts: 32 },
    { radius: 100, color: 0xa0c4ff, pts: 64 },
    { radius: 130, color: 0xbdb2ff, pts: 128 }
];

const config = {
    type: Phaser.AUTO,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 400,
        height: 600
    },
    backgroundColor: '#fdf6e3', 
    physics: {
        default: 'matter',
        matter: { gravity: { y: 1.2 }, debug: false }
    },
    scene: { create: create, update: update }
};

const game = new Phaser.Game(config);

function create() {
    this.matter.world.setBounds(0, 0, 400, 600, 32, true, true, false, true);
    this.matter.world.pause(); 

    // 繪製紅色死亡虛線
    const graphics = this.add.graphics();
    graphics.lineStyle(2, 0xff0000, 0.5);
    graphics.beginPath();
    for (let i = 0; i < 400; i += 10) {
        graphics.moveTo(i, DEAD_LINE_Y);
        graphics.lineTo(i + 5, DEAD_LINE_Y);
    }
    graphics.strokePath();

    scoreText = this.add.text(20, 20, 'SCORE: 0', { 
        fontSize: '32px', fill: '#2ecc71', fontFamily: '"Courier New", Courier, monospace',
        fontStyle: 'bold', stroke: '#000000', strokeThickness: 8
    }).setDepth(100);

    prepareNext(this);
    if (currentPreview) currentPreview.setVisible(false);

    // 開始畫面 UI
    const centerX = 200;
    const centerY = 300;
    const startOverlay = this.add.rectangle(centerX, centerY, 400, 600, 0x000000, 0.5).setDepth(5000);
    const startTitle = this.add.text(centerX, centerY - 100, '動物合成大作戰', { 
        fontSize: '40px', fill: '#ffffff', fontFamily: 'Microsoft JhengHei', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(5001);
    const startBtn = this.add.circle(centerX, centerY + 50, 70, 0x2ecc71).setInteractive({ useHandCursor: true }).setDepth(5001);
    startBtn.setStrokeStyle(6, 0xffffff);
    const startBtnText = this.add.text(centerX, centerY + 50, '開始遊戲', { 
        fontSize: '28px', fill: '#ffffff', fontFamily: 'Microsoft JhengHei', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(5002);

    startBtn.once('pointerdown', () => {
        this.matter.world.resume(); 
        isStarting = true;
        startOverlay.destroy(); startTitle.destroy(); startBtn.destroy(); startBtnText.destroy();
        this.time.delayedCall(500, () => {
            isStarting = false;
            if (currentPreview) currentPreview.setVisible(true);
        });
    });

    this.input.on('pointerup', (pointer) => {
        if (gameOver || this.matter.world.paused || isStarting) return;
        spawnAnimal(this, pointer.x, 50, nextLevel);
        prepareNext(this);
    });

    // 合成邏輯
    this.matter.world.on('collisionstart', (event) => {
        if (gameOver) return;
        event.pairs.forEach(pair => {
            const { bodyA, bodyB } = pair;
            if (bodyA.gameObject && bodyB.gameObject && bodyA.gameObject.level === bodyB.gameObject.level) {
                const level = bodyA.gameObject.level;
                if (level < ANIMAL_DATA.length - 1) {
                    const newX = (bodyA.position.x + bodyB.position.x) / 2;
                    const newY = (bodyA.position.y + bodyB.position.y) / 2;
                    score += ANIMAL_DATA[level].pts;
                    scoreText.setText('SCORE: ' + score);
                    bodyA.gameObject.destroy(); 
                    bodyB.gameObject.destroy();
                    spawnAnimal(this, newX, newY, level + 1);
                    if (level + 1 === ANIMAL_DATA.length - 1) showWinMessage(this);
                }
            }
        });
    });
}

function update() {
    if (gameOver || this.matter.world.paused || isStarting) return;
    if (currentPreview) currentPreview.x = this.input.activePointer.x;

    const allBodies = this.matter.world.getAllBodies();
    allBodies.forEach(body => {
        if (body.gameObject && !body.isNew && body.gameObject !== currentPreview) {
            // 🌟 核心修正：加入速度判定，球必須靜止且超線才判輸，防止誤觸當機
            const isMovingSlowly = Math.abs(body.velocity.y) < 0.2;
            if (body.bounds.min.y < DEAD_LINE_Y && isMovingSlowly) {
                if (!body.gameObject.overTime) body.gameObject.overTime = 0;
                // 累積時間超過約 1.5 秒才執行 endGame
                if (++body.gameObject.overTime > 100) endGame(this);
            } else {
                body.gameObject.overTime = 0;
            }
        }
    });
}

// 🌟 補上遺失的 endGame 函數，這就是之前當機的原因！
function endGame(scene) {
    if (gameOver) return;
    gameOver = true;
    scene.matter.world.pause(); // 停止物理運算防止黑屏

    if (score > highScore) {
        highScore = score;
        localStorage.setItem('animal_high_score', highScore);
    }

    const endGroup = scene.add.container(200, 300).setDepth(7000);
    const overlay = scene.add.rectangle(0, 0, 400, 600, 0x000000, 0.75);
    const title = scene.add.text(0, -150, 'GAME OVER', { 
        fontSize: '56px', fill: '#ff7675', fontStyle: 'bold', stroke: '#ffffff', strokeThickness: 6 
    }).setOrigin(0.5);

    const curScoreText = scene.add.text(0, -40, `本次得分: ${score}`, { 
        fontSize: '32px', fill: '#ffffff', fontFamily: 'Microsoft JhengHei', fontStyle: 'bold'
    }).setOrigin(0.5);

    const hiScoreText = scene.add.text(0, 20, `最高紀錄: ${highScore}`, { 
        fontSize: '28px', fill: '#f1c40f', fontFamily: 'Microsoft JhengHei', fontStyle: 'bold'
    }).setOrigin(0.5);

    const btn = scene.add.circle(0, 140, 65, 0xe67e22).setInteractive({ useHandCursor: true });
    btn.setStrokeStyle(4, 0xffffff);
    const btnText = scene.add.text(0, 140, '再玩一次', { 
        fontSize: '24px', fill: '#fff', fontStyle: 'bold', fontFamily: 'Microsoft JhengHei'
    }).setOrigin(0.5);

    endGroup.add([overlay, title, curScoreText, hiScoreText, btn, btnText]);

    btn.on('pointerdown', () => { 
        // 🌟 核心修正：直接刷新頁面解決物理引擎殘留導致的黑屏
        window.location.reload(); 
    });
}

function showWinMessage(scene) {
    scene.matter.world.pause(); 
    gameOver = true;

    const winGroup = scene.add.container(200, 300).setDepth(8000);
    const overlay = scene.add.rectangle(0, 0, 400, 600, 0x000000, 0.6);
    const textY = -120;

    const winTitle = scene.add.text(0, textY, '恭喜達成', { 
        fontSize: '56px', fill: '#f1c40f', fontFamily: 'Microsoft JhengHei', fontStyle: 'bold', 
        stroke: '#ffffff', strokeThickness: 8, padding: { top: 20, bottom: 20 }
    }).setOrigin(0.5);

    const emojiOffset = 145; // 緊湊型彩炮位置
    const emojiStyle = { fontSize: '48px', padding: { top: 15, bottom: 15, left: 10, right: 10 } };
    const leftEmoji = scene.add.text(-emojiOffset, textY - 10, '🎊', emojiStyle).setOrigin(0.5);
    const rightEmoji = scene.add.text(emojiOffset, textY - 10, '🎊', emojiStyle).setOrigin(0.5);

    const subTitle = scene.add.text(0, textY + 70, '你合成了最終動物！', { 
        fontSize: '26px', fill: '#ffffff', fontFamily: 'Microsoft JhengHei', fontStyle: 'bold'
    }).setOrigin(0.5);

    const winBtn = scene.add.circle(0, 110, 65, 0x2ecc71).setInteractive({ useHandCursor: true });
    winBtn.setStrokeStyle(4, 0xffffff);
    const winBtnText = scene.add.text(0, 110, '繼續挑戰', { 
        fontSize: '24px', fill: '#ffffff', fontStyle: 'bold', fontFamily: 'Microsoft JhengHei'
    }).setOrigin(0.5);

    winGroup.add([overlay, winTitle, leftEmoji, rightEmoji, subTitle, winBtn, winBtnText]);

    winBtn.on('pointerdown', () => {
        gameOver = false;
        scene.matter.world.resume();
        winGroup.destroy();
    });
}

function prepareNext(scene) {
    if (currentPreview) currentPreview.destroy();
    nextLevel = Math.floor(Math.random() * 3);
    const data = ANIMAL_DATA[nextLevel];
    currentPreview = scene.add.circle(200, 50, data.radius, data.color);
    currentPreview.setStrokeStyle(2, 0x000000).setDepth(10);
}

function spawnAnimal(scene, x, y, level) {
    const data = ANIMAL_DATA[level];
    const circle = scene.add.circle(x, y, data.radius, data.color);
    circle.setStrokeStyle(2, 0x333333).level = level;
    const ball = scene.matter.add.gameObject(circle, {
        shape: { type: 'circle', radius: data.radius },
        restitution: 0.4
    });
    ball.isNew = true; 
    scene.time.delayedCall(1000, () => { if (ball) ball.isNew = false; });
    return circle;
}