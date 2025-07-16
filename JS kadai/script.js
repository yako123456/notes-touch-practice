// キャンバス・描画コンテキストの取得
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('startScreen');

// 画面サイズに合わせてcanvasサイズ・各種値を更新
function resizeCanvasVars() {
    // CSSサイズ取得
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    colWidth = canvas.width / columns;
    
    // 判定ゾーンの計算
    hitZoneBottom = canvas.height - 20;
    hitZoneTop = canvas.height - 180;
    hitZoneHeight = hitZoneBottom - hitZoneTop;
    
    // 判定範囲を3分割
    fastZoneTop = hitZoneTop;
    fastZoneBottom = hitZoneTop + hitZoneHeight * 0.3;
    goodZoneTop = fastZoneBottom;
    goodZoneBottom = hitZoneTop + hitZoneHeight * 0.7;
    lateZoneTop = goodZoneBottom;
    lateZoneBottom = hitZoneBottom;
    
    // クリアボタン位置も再計算
    returnBtnRect = {
        x: canvas.width / 2 - 120,
        y: canvas.height / 2 + 10,
        w: 240,
        h: 40
    };
}

window.addEventListener('resize', () => {
    resizeCanvasVars();
});

// 初期化時にも呼ぶ
window.addEventListener('DOMContentLoaded', () => {
    resizeCanvasVars(); // 初期化はDOMContentLoaded内で
    document.getElementById('resumeBtn').onclick = resumeGame;
    document.getElementById('restartBtn').onclick = restartGame;
    document.getElementById('backToStartBtn').onclick = backToStartScreen;
    document.getElementById('startBtn').onclick = startGame;
});

// ゲーム設定用の変数
let columns = 4; // 列数（キー数に応じて変化）
let colWidth = canvas.width / columns; // 1列の幅
let keys = ['KeyD', 'KeyF', 'KeyJ', 'KeyK']; // 反応するキー
let keyMap = { 'KeyD': 0, 'KeyF': 1, 'KeyJ': 2, 'KeyK': 3 }; // キー→列番号
let fallingSpeed = 3; // 落下速度
let spawnIntervalMs = 200; // 落下間隔（ms）
let clearScore = 100; // クリアスコア

// 判定ゾーンの変数
let hitZoneTop, hitZoneBottom, hitZoneHeight;
let fastZoneTop, fastZoneBottom, goodZoneTop, goodZoneBottom, lateZoneTop, lateZoneBottom;

// ゲーム状態管理用の変数
const fallingObjs = []; // 落下オブジェクト配列
let score = 0; // 現在のスコア
let gameStarted = false; // ゲーム開始フラグ
let isPaused = false; // 一時停止フラグ
let spawnInterval; // 落下オブジェクト生成タイマー
let missCount = 0; // ミス回数
let showReturnBtn = false; // クリア時のボタン表示フラグ

// 統計情報
let stats = {
    fast: 0,
    perfect: 0,
    late: 0,
    miss: 0
};
let returnBtnRect = {
    x: canvas.width / 2 - 120, // 中央配置
    y: canvas.height / 2 + 10, // 位置を少し上に
    w: 240,
    h: 40 // 高さを小さく
}; // クリア時ボタン位置・サイズ
let lastCol = -1; // 直前の列番号
let prevCol = -1; // 2つ前の列番号

// 判定結果を表示するための変数
let judgeTexts = []; // 判定テキストの配列

// 判定テキストのクラス
class JudgeText {
    constructor(x, y, text, color) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.alpha = 1.0;
        this.life = 60; // 60フレーム表示
    }
    
    update() {
        this.y -= 1; // 上に移動
        this.life--;
        this.alpha = this.life / 60;
    }
    
    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}

// 落下オブジェクトのクラス
class Falling {
    // column: どの列に落ちるか
    constructor(column) {
        this.column = column;
        this.x = column * colWidth + Math.max(20, colWidth * 0.05); // 左端から開始
        this.y = -Math.max(20, canvas.height * 0.025); // 初期y座標（画面上部）
        this.speed = fallingSpeed; // 落下速度の画面比率調整を削除
        this.hit = false; // ヒット済みか
        this.missed = false; // ミス済みか
        this.width = colWidth - Math.max(40, colWidth * 0.15); // 横幅（判定エリアと同じ）
        this.height = Math.max(20, canvas.height * 0.025); // 高さ
    }
    
    // 毎フレームy座標を更新
    update() {
        this.y += this.speed;
        
        // ヒットゾーンを通り過ぎた場合、ミス判定
        if (!this.hit && !this.missed && this.y > hitZoneBottom) {
            this.missed = true;
            missCount++;
            stats.miss++;
            // ミス表示
            judgeTexts.push(new JudgeText(
                this.x + this.width / 2, 
                hitZoneBottom, 
                'MISS', 
                'gray'
            ));
        }
    }
    
    // オブジェクトを描画
    draw() {
        let color = 'red';
        if (this.hit) color = 'gray';
        if (this.missed) color = 'darkred';
        
        ctx.fillStyle = color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

// 落下オブジェクトを生成（直近2回の列と被らないように）
function spawn() {
    let col;
    do {
        col = Math.floor(Math.random() * columns);
    } while (col === lastCol || col === prevCol);
    prevCol = lastCol;
    lastCol = col;
    fallingObjs.push(new Falling(col));
}

// ヒットゾーンと各列の説明を描画
function drawHitZone() {
    // 判定バーをノーツと同じサイズで描画
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'; // 半透明の白
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    
    for (let i = 0; i < columns; i++) {
        const x = i * colWidth + Math.max(20, colWidth * 0.05);
        const width = colWidth - Math.max(40, colWidth * 0.15);
        const height = Math.max(20, canvas.height * 0.025); // ノーツと同じ高さ
        const y = hitZoneTop + hitZoneHeight / 2 - height / 2; // 判定ゾーンの中央に配置
        
        // 判定バーを描画
        ctx.fillRect(x, y, width, height);
        ctx.strokeRect(x, y, width, height);
    }
}

// ゲームループ（毎フレーム描画・判定）
function updateGame() {
    if (!gameStarted || isPaused) return; // ゲーム中のみ動作
    ctx.clearRect(0, 0, canvas.width, canvas.height); // 画面クリア
    
    // 落下オブジェクトの更新・描画
    for (let i = fallingObjs.length - 1; i >= 0; i--) {
        const obj = fallingObjs[i];
        obj.update(); // 落下
        obj.draw();   // 描画
        
        // 画面外に出たオブジェクトを削除
        if (obj.y > canvas.height + 100) {
            fallingObjs.splice(i, 1);
        }
    }
    
    drawHitZone(); // ヒットゾーン・説明描画
    
    // 判定テキストの更新・描画
    for (let i = judgeTexts.length - 1; i >= 0; i--) {
        const judgeText = judgeTexts[i];
        judgeText.update();
        judgeText.draw();
        
        if (judgeText.life <= 0) {
            judgeTexts.splice(i, 1);
        }
    }
    
    // スコア・ミス数表示
    ctx.fillStyle = 'white';
    ctx.font = '25px sans-serif';
    ctx.textAlign = 'start';
    ctx.fillText(`Score: ${score}`, 15, 40);
    ctx.fillText(`Miss: ${missCount}`, 15, 70);
    
    if (score >= clearScore) { // クリア判定
        gameClear();
        return;
    }
    requestAnimationFrame(updateGame); // 次フレーム
}

// 判定処理を行う関数
function judgeHit(obj, col) {
    const objCenter = obj.y + obj.height / 2;
    let judge = null;
    let points = 0;
    let color = 'white';
    
    if (objCenter >= fastZoneTop && objCenter <= fastZoneBottom) {
        judge = 'FAST';
        points = 0.5;
        color = 'cyan';
        stats.fast++;
    } else if (objCenter >= goodZoneTop && objCenter <= goodZoneBottom) {
        judge = 'PERFECT';
        points = 1;
        color = 'yellow';
        stats.perfect++;
    } else if (objCenter >= lateZoneTop && objCenter <= lateZoneBottom) {
        judge = 'LATE';
        points = 0.5;
        color = 'red';
        stats.late++;
    } else {
        // ヒットゾーン外での入力はミス
        judge = 'MISS';
        points = 0;
        color = 'gray';
        missCount++;
        stats.miss++;
    }
    
    // 判定テキストを追加
    judgeTexts.push(new JudgeText(
        obj.x + obj.width / 2, 
        objCenter, 
        judge, 
        color
    ));
    
    score += points;
    return judge !== 'MISS';
}

// キー入力イベント
document.addEventListener('keydown', e => {
    if (e.code === 'KeyP' && gameStarted && !isPaused) {
        pauseGame();
        return;
    }
    if (isPaused) return;
    if (!gameStarted && e.code === 'Space') {
        startGame();
        return;
    }
    if (!keyMap.hasOwnProperty(e.code)) return;
    
    const col = keyMap[e.code];
    for (const obj of fallingObjs) {
        if (!obj.hit && !obj.missed && obj.column === col) {
            obj.hit = true;
            judgeHit(obj, col);
            break;
        }
    }
});

// ゲーム開始（設定値取得・初期化・カウントダウン）
function startGame() {
    if (gameStarted) return;
    // 設定フォームから値取得
    const keyStr = document.getElementById('keyConfig').value;
    keys = keyStr.split(',').map(k => k.trim().toUpperCase());
    columns = keys.length;
    keyMap = {};
    for (let i = 0; i < keys.length; i++) {
        keyMap['Key' + keys[i]] = i;
    }
    fallingSpeed = Number(document.getElementById('speedConfig').value) || 3;
    spawnIntervalMs = Number(document.getElementById('intervalConfig').value) || 200;
    clearScore = Number(document.getElementById('clearScoreConfig').value) || 100;
    startScreen.style.display = 'none';
    document.getElementById('pauseMenu').style.display = 'none';
    canvas.style.display = 'block'; // ゲーム開始時にcanvasを表示
    resizeCanvasVars(); // canvas表示後にサイズ再計算
    gameStarted = false;
    isPaused = false;
    score = 0;
    missCount = 0;
    stats = { fast: 0, perfect: 0, late: 0, miss: 0 };
    fallingObjs.length = 0;
    judgeTexts.length = 0;
    showReturnBtn = false;
    lastCol = -1;
    prevCol = -1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    countdown(3); // カウントダウン開始
}

// カウントダウン表示（3,2,1,スタート）
function countdown(n) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.font = '80px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (n > 0) {
        ctx.fillText(n, canvas.width / 2, canvas.height / 2);
        setTimeout(() => countdown(n - 1), 800);
    } else {
        ctx.fillText('スタート!', canvas.width / 2, canvas.height / 2);
        setTimeout(() => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            gameStarted = true;
            spawnInterval = setInterval(spawn, spawnIntervalMs);
            updateGame();
        }, 800);
    }
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
}

// 一時停止処理
function pauseGame() {
    isPaused = true;
    clearInterval(spawnInterval);
    document.getElementById('pauseMenu').style.display = 'flex';
}

// 一時停止解除
function resumeGame() {
    if (!isPaused) return;
    isPaused = false;
    document.getElementById('pauseMenu').style.display = 'none';
    spawnInterval = setInterval(spawn, spawnIntervalMs);
    updateGame();
}

// 最初からやり直し
function restartGame() {
    score = 0;
    missCount = 0;
    stats = { fast: 0, perfect: 0, late: 0, miss: 0 };
    fallingObjs.length = 0;
    judgeTexts.length = 0;
    showReturnBtn = false;
    lastCol = -1;
    prevCol = -1;
    document.getElementById('pauseMenu').style.display = 'none';
    clearInterval(spawnInterval);
    gameStarted = false;
    isPaused = false;
    startGame();
}

// スタート画面に戻る
function backToStartScreen() {
    score = 0;
    missCount = 0;
    stats = { fast: 0, perfect: 0, late: 0, miss: 0 };
    fallingObjs.length = 0;
    judgeTexts.length = 0;
    showReturnBtn = false;
    lastCol = -1;
    prevCol = -1;
    document.getElementById('pauseMenu').style.display = 'none';
    clearInterval(spawnInterval);
    gameStarted = false;
    isPaused = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    document.getElementById('startScreen').style.display = 'block';
    canvas.style.display = 'none';
    
    // Chart.jsのチャートを削除
    const existingChart = document.getElementById('statsChart');
    if (existingChart) {
        existingChart.remove();
    }
}

// クリア時の処理
function gameClear() {
    clearInterval(spawnInterval);
    gameStarted = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'yellow';
    ctx.font = '40px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('クリア！', canvas.width / 2, canvas.height / 2 - 120);
    ctx.fillText(`最終スコア: ${score}`, canvas.width / 2, canvas.height / 2 - 80);
    ctx.fillText(`ミス回数: ${missCount}`, canvas.width / 2, canvas.height / 2 - 40);
    
    // 統計チャートを作成
    createStatsChart();
    
    showReturnBtn = true;
    drawReturnBtn();
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
}

// 統計チャート作成関数
function createStatsChart() {
    // 既存のチャートを削除
    const existingChart = document.getElementById('statsChart');
    if (existingChart) {
        existingChart.remove();
    }
    
    // チャート用のcanvasを作成
    const chartCanvas = document.createElement('canvas');
    chartCanvas.id = 'statsChart';
    chartCanvas.width = 400;
    chartCanvas.height = 200;
    chartCanvas.style.position = 'absolute';
    chartCanvas.style.bottom = '50px';
    chartCanvas.style.left = '50%';
    chartCanvas.style.transform = 'translateX(-50%)';
    chartCanvas.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    chartCanvas.style.borderRadius = '10px';
    chartCanvas.style.border = '2px solid #fff';
    document.body.appendChild(chartCanvas);
    
    // Chart.jsでチャートを作成
    const ctx = chartCanvas.getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['FAST', 'PERFECT', 'LATE', 'MISS'],
            datasets: [{
                label: '判定回数',
                data: [stats.fast, stats.perfect, stats.late, stats.miss],
                backgroundColor: [
                    'rgba(0, 255, 255, 0.8)',  // FAST - シアン
                    'rgba(255, 255, 0, 0.8)',  // PERFECT - 黄色
                    'rgba(255, 0, 0, 0.8)',    // LATE - 赤
                    'rgba(128, 128, 128, 0.8)' // MISS - 灰色
                ],
                borderColor: [
                    'rgba(0, 255, 255, 1)',
                    'rgba(255, 255, 0, 1)',
                    'rgba(255, 0, 0, 1)',
                    'rgba(128, 128, 128, 1)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: false,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: '判定統計',
                    color: '#fff',
                    font: {
                        size: 16
                    }
                },
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#fff',
                        stepSize: 1
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.2)'
                    }
                },
                x: {
                    ticks: {
                        color: '#fff'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.2)'
                    }
                }
            }
        }
    });
}

// クリア時の「スタート画面に戻る」ボタン描画
function drawReturnBtn() {
    ctx.fillStyle = '#333';
    ctx.fillRect(returnBtnRect.x, returnBtnRect.y, returnBtnRect.w, returnBtnRect.h);
    ctx.fillStyle = 'white';
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('スタート画面に戻る', returnBtnRect.x + returnBtnRect.w / 2, returnBtnRect.y + returnBtnRect.h / 2);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
}

// クリア時ボタンのクリック判定
canvas.addEventListener('click', function(e) {
    if (!showReturnBtn) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (x >= returnBtnRect.x && x <= returnBtnRect.x + returnBtnRect.w && y >= returnBtnRect.y && y <= returnBtnRect.y + returnBtnRect.h) {
        backToStartScreen();
    }
});

// 一時停止メニューのボタンイベント
window.addEventListener('DOMContentLoaded', () => {
    resizeCanvasVars();
    document.getElementById('resumeBtn').onclick = resumeGame;
    document.getElementById('restartBtn').onclick = restartGame;
    document.getElementById('backToStartBtn').onclick = backToStartScreen;
    document.getElementById('startBtn').onclick = startGame;
});

// ゲームリセット（スタート画面に戻る）
function resetGame() {
    score = 0;
    missCount = 0;
    stats = { fast: 0, perfect: 0, late: 0, miss: 0 };
    fallingObjs.length = 0;
    judgeTexts.length = 0;
    showReturnBtn = false;
    lastCol = -1;
    prevCol = -1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    document.getElementById('startScreen').style.display = 'block';
    
    // Chart.jsのチャートを削除
    const existingChart = document.getElementById('statsChart');
    if (existingChart) {
        existingChart.remove();
    }
}
