const config = {
    type: Phaser.AUTO,
    // 【修改點】：讓寬度等於螢幕寬度，高度等於螢幕高度
    width: window.innerWidth, 
    height: window.innerHeight,
    backgroundColor: '#fdf6e3',
    physics: {
        default: 'matter',
        matter: { 
            gravity: { y: 1.2 }, 
            debug: false 
        }
    },
    scene: { create: create, update: update }
};

const game = new Phaser.Game(config);

const ANIMAL_DATA = [
    { size: 20, color: 0xffadad, pts: 2 },
    { size: 30, color: 0xffd6a5, pts: 4 },
    { size: 45, color: 0xfdffb6, pts: 8 },
    { size: 60, color: 0xcaffbf, pts: 16 },
    { size: 80, color: 0x9bf6ff, pts: 32 },
    { size: 100, color: 0xa0c4ff, pts: 64 },
    { size: 130, color: 0xbdb2ff, pts: 128 } // 最大等級
];

let currentPreview = null;
let nextLevel = 0;
let score = 0;
let scoreText;
let gameOver = false;
const DEAD_LINE_Y = 100;
let highScore = localStorage.getItem('animal_high_score') || 0;

function create() {
    // 1. 設定邊界
    // 讓遊戲邊界自動抓螢幕的寬度與高度
    this.matter.world.setBounds(0, 0, window.innerWidth, window.innerHeight, 32, true, true, false, true);
    
    // 一開始先暫停物理引擎，等玩家按開始
    this.matter.world.pause();

    // 2. 畫出紅色死亡線
    const graphics = this.add.graphics();
    graphics.lineStyle(2, 0xff0000, 0.5);
    graphics.beginPath();
    for (let i = 0; i < 400; i += 10) {
        graphics.moveTo(i, DEAD_LINE_Y);
        graphics.lineTo(i + 5, DEAD_LINE_Y);
    }
    graphics.strokePath();

    // 3. 顯示像素風分數 (已縮小並上移)
    scoreText = this.add.text(20, 20, 'SCORE: 0', { 
        fontSize: '28px', 
        fill: '#2ecc71', 
        fontFamily: '"Courier New", Courier, monospace', 
        fontStyle: 'bold',
        stroke: '#000000', 
        strokeThickness: 5,
        shadow: { offsetX: 3, offsetY: 3, color: '#000', blur: 0, fill: true }
    }).setDepth(100);

    // 4. 準備第一個球 (先隱藏)
    prepareNext(this);
    if (currentPreview) currentPreview.setVisible(false);

    // --- 🌟 5. 建立開始遊戲畫面 🌟 ---
    const startOverlay = this.add.rectangle(200, 300, 400, 600, 0x000000, 0.7).setDepth(5000);
    const startTitle = this.add.text(200, 200, '動物合成大作戰', { 
        fontSize: '42px', fill: '#ffffff', fontFamily: '"Microsoft JhengHei", sans-serif', fontStyle: 'bold' 
    }).setOrigin(0.5).setDepth(5001);

    const startBtn = this.add.circle(200, 350, 70, 0x2ecc71).setInteractive({ useHandCursor: true }).setDepth(5001);
    startBtn.setStrokeStyle(6, 0xffffff);
    
    const startBtnText = this.add.text(200, 350, '開始遊戲', { 
        fontSize: '28px', fill: '#ffffff', fontFamily: '"Microsoft JhengHei", sans-serif', fontStyle: 'bold' 
    }).setOrigin(0.5).setDepth(5002);

    // 點擊開始按鈕的動作
    startBtn.on('pointerdown', () => {
        this.matter.world.resume(); // 恢復物理
        if (currentPreview) currentPreview.setVisible(true); // 顯示預覽球
        
        // 刪除開始畫面元件
        startOverlay.destroy();
        startTitle.destroy();
        startBtn.destroy();
        startBtnText.destroy();
    });

    // 6. 點擊放置邏輯
    this.input.on('pointerdown', (pointer) => {
        if (gameOver || this.matter.world.paused) return; // 如果暫停中不能放球
        if (pointer.y > 20) {
            spawnAnimal(this, pointer.x, 50, nextLevel);
            prepareNext(this);
        }
    });

    // 7. 合成邏輯 (保持不變)
    this.matter.world.on('collisionstart', (event) => {
        event.pairs.forEach(pair => {
            const { bodyA, bodyB } = pair;
            if (bodyA.gameObject && bodyB.gameObject && 
                bodyA.gameObject.level === bodyB.gameObject.level) {
                const level = bodyA.gameObject.level;
                if (level < ANIMAL_DATA.length - 1) {
                    const newX = (bodyA.position.x + bodyB.position.x) / 2;
                    const newY = (bodyA.position.y + bodyB.position.y) / 2;
                    score += ANIMAL_DATA[level].pts;
                    scoreText.setText('SCORE: ' + score);
                    bodyA.gameObject.destroy();
                    bodyB.gameObject.destroy();
                    const newLevel = level + 1;
                    spawnAnimal(this, newX, newY, newLevel);
                    if (newLevel === ANIMAL_DATA.length - 1) showWinMessage(this);
                }
            }
        });
    });
}

function update() {
    if (gameOver) return;

    if (currentPreview) {
        currentPreview.x = this.input.activePointer.x;
    }

    const allBodies = this.matter.world.getAllBodies();
    
    allBodies.forEach(body => {
        if (body.gameObject && body.gameObject !== currentPreview) {
            // 穩定判定 (無倒數)
            const isMovingSlowly = Math.abs(body.velocity.y) < 1.2;

            if (body.bounds.min.y < DEAD_LINE_Y && body.position.y > 110 && isMovingSlowly) {
                if (!body.gameObject.overLineTime) body.gameObject.overLineTime = 0;
                body.gameObject.overLineTime++;
                if (body.gameObject.overLineTime > 30) {
                    endGame(this);
                }
            } else {
                if (body.gameObject) body.gameObject.overLineTime = 0;
            }
        }
    });
}

function prepareNext(scene) {
    nextLevel = Phaser.Math.Between(0, 2);
    if (currentPreview) currentPreview.destroy();
    const data = ANIMAL_DATA[nextLevel];
    currentPreview = scene.add.circle(200, 50, data.size, data.color);
    currentPreview.setAlpha(0.6).setStrokeStyle(2, 0x333333).setDepth(10);
}

function spawnAnimal(scene, x, y, level) {
    const data = ANIMAL_DATA[level];
    const circle = scene.add.circle(x, y, data.size, data.color);
    circle.setStrokeStyle(2, 0x333333);

    const body = scene.matter.add.gameObject(circle, {
        shape: { type: 'circle', radius: data.size },
        // --- 核心物理調整 ---
        restitution: 0.5,      // 彈性：0.5 ~ 0.6 是最順的，不會過頭
        friction: 0.005,       // 摩擦力：調低，讓球在碰撞後會順著邊緣「滾」開，不會卡住
        frictionAir: 0.02,     // 空氣阻力：讓球在空中掉落時感覺有重量感
        bounce: 0.5,           // 額外彈力
        density: 0.001,        // 密度：讓球輕一點，撞擊感會更靈活
        // ------------------
        sleepThreshold: -1 
    });

    circle.level = level;
    return circle;
}

function endGame(scene) {
    if (gameOver) return;
    gameOver = true;
    scene.matter.world.pause(); 

    if (score > highScore) {
        highScore = score;
        localStorage.setItem('animal_high_score', highScore);
    }

    // 黑色遮罩
    scene.add.rectangle(200, 300, 400, 600, 0x000000, 0.75).setDepth(2000);

    // 標題
    scene.add.text(200, 150, 'GAME OVER', { 
        fontSize: '56px', fill: '#ff7675', fontFamily: 'Arial Black', 
        fontStyle: 'bold', stroke: '#fff', strokeThickness: 8 
    }).setOrigin(0.5).setDepth(2001);

    // 本次得分 (取代原本的 SCORE)
    scene.add.text(200, 260, `本次得分: ${score}`, { 
        fontSize: '32px', fill: '#fff', fontFamily: '"Microsoft JhengHei", sans-serif'
    }).setOrigin(0.5).setDepth(2001);

    // 最高紀錄 (取代原本的 BEST)
    scene.add.text(200, 320, `最高紀錄: ${highScore}`, { 
        fontSize: '28px', fill: '#f1c40f', fontFamily: '"Microsoft JhengHei", sans-serif', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(2001);

    // 按鈕文字改為中文
    const btn = scene.add.circle(200, 440, 65, 0xe67e22).setInteractive({ useHandCursor: true }).setDepth(2001);
    scene.add.text(200, 440, '再玩一次', { 
        fontSize: '24px', fill: '#fff', fontFamily: '"Microsoft JhengHei", sans-serif', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(2002);

    btn.on('pointerdown', () => { 
        score = 0; 
        gameOver = false; 
        scene.scene.restart(); 
    });
}

function showWinMessage(scene) {
    // 防止重複觸發
    if (scene.children.getByName('win_message_group')) return;

    // 暫停遊戲，讓玩家看完提示
    scene.matter.world.pause();
    const originalGameOver = gameOver;
    gameOver = true;

    // 建立一個 Container 來管理所有元件
    const winGroup = scene.add.container(200, 300).setDepth(3000).setName('win_message_group');

    // 背景遮罩 (Container 內是局部座標)
    const overlay = scene.add.rectangle(0, 0, 400, 600, 0x000000, 0.6);
    // 勝利文字
    const winText = scene.add.text(0, -50, '🎉 達成最大！', { 
        fontSize: '40px', fill: '#f1c40f', fontFamily: '"Microsoft JhengHei", sans-serif',
        fontStyle: 'bold', stroke: '#ffffff', strokeThickness: 6
    }).setOrigin(0.5);
    // 按鈕背景
    const goBg = scene.add.circle(0, 80, 60, 0x27ae60).setInteractive({ useHandCursor: true });
    goBg.setStrokeStyle(4, 0xffffff);
    // 按鈕文字
    const goText = scene.add.text(0, 80, '繼續挑戰', { 
        fontSize: '20px', fill: '#ffffff', fontFamily: '"Microsoft JhengHei", sans-serif', fontStyle: 'bold'
    }).setOrigin(0.5);

    winGroup.add([overlay, winText, goBg, goText]);
    
    // 【關鍵修復】：徹底刪除提示
    goBg.on('pointerdown', () => { 
        scene.matter.world.resume(); 
        gameOver = originalGameOver; 
        winGroup.destroy(); // 這一行會刪掉 overlay, winText, goBg, goText
    });
}
