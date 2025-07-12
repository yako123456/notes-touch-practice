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

// ゲーム状態管理用の変数
const fallingObjs = []; // 落下オブジェクト配列
let score = 0; // 現在のスコア
let gameStarted = false; // ゲーム開始フラグ
let isPaused = false; // 一時停止フラグ
let spawnInterval; // 落下オブジェクト生成タイマー
let miss = false; // ミス判定（未使用）
let showReturnBtn = false; // クリア時のボタン表示フラグ
let returnBtnRect = {
    x: canvas.width / 2 - 120, // 中央配置
    y: canvas.height / 2 + 10, // 位置を少し上に
    w: 240,
    h: 40 // 高さを小さく
}; // クリア時ボタン位置・サイズ
let lastCol = -1; // 直前の列番号
let prevCol = -1; // 2つ前の列番号

// 落下オブジェクトのクラス
class Falling {
    // column: どの列に落ちるか
    constructor(column) {
        this.column = column;
        this.x = column * colWidth + Math.max(20, colWidth * 0.05); // x座標（列ごとに計算）
        this.y = -Math.max(40, canvas.height * 0.05); // 初期y座標（画面上部）
        this.speed = fallingSpeed * (canvas.height / 800); // 落下速度も画面比率で調整
        this.hit = false; // ヒット済みか
    }
    // 毎フレームy座標を更新
    update() {
        this.y += this.speed;
    }
    // オブジェクトを描画
    draw() {
        ctx.fillStyle = this.hit ? 'gray' : 'red'; // ヒット済みは灰色、未ヒットは赤
        ctx.fillRect(this.x, this.y, colWidth - Math.max(40, colWidth * 0.15), Math.max(20, canvas.height * 0.025));
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
    ctx.fillStyle = 'white';
    for (let i = 0; i < columns; i++) {
        ctx.fillRect(
            i * colWidth + Math.max(20, colWidth * 0.05),
            canvas.height - Math.max(100, canvas.height * 0.125),
            colWidth - Math.max(40, colWidth * 0.15),
            Math.max(20, canvas.height * 0.025)
        ); // ヒットゾーン
    }
}

// ゲームループ（毎フレーム描画・判定）
function updateGame() {
    if (!gameStarted || isPaused) return; // ゲーム中のみ動作
    ctx.clearRect(0, 0, canvas.width, canvas.height); // 画面クリア
    for (const obj of fallingObjs) {
        obj.update(); // 落下
        obj.draw();   // 描画
    }
    drawHitZone(); // ヒットゾーン・説明描画
    ctx.fillStyle = 'white';
    ctx.font = '25px sans-serif';
    ctx.fillText(`Score: ${score}`, 15, 40); // スコア表示
    if (score >= clearScore) { // クリア判定
        gameClear();
        return;
    }
    requestAnimationFrame(updateGame); // 次フレーム
}

// キー入力イベント
// - Pキー: 一時停止
// - スペース: ゲーム開始
// - 設定キー: ヒット判定
// - 一時停止中は無効
// - ヒット判定はヒットゾーン内のみ

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
        if (!obj.hit && obj.column === col) {
            // 判定枠をヒットゾーンに合わせる（canvas.height - 120 ～ canvas.height - 80）
            if (obj.y >= canvas.height - 180 && obj.y <= canvas.height - 20) {
                obj.hit = true;
                score++;
                break;
            }
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
    miss = false;
    fallingObjs.length = 0;
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
    miss = false;
    fallingObjs.length = 0;
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
    miss = false;
    fallingObjs.length = 0;
    showReturnBtn = false; // ボタン判定を消す
    lastCol = -1;
    prevCol = -1;
    document.getElementById('pauseMenu').style.display = 'none';
    clearInterval(spawnInterval);
    gameStarted = false;
    isPaused = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    document.getElementById('startScreen').style.display = 'block';
    canvas.style.display = 'none'; // スタート画面復帰時にcanvasを非表示
}

// クリア時の処理
function gameClear() {
    clearInterval(spawnInterval);
    gameStarted = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'yellow';
    ctx.font = '40px sans-serif';
    ctx.textAlign = 'center'; // 追加
    ctx.textBaseline = 'middle'; // 追加
    ctx.fillText('クリア！', canvas.width / 2, canvas.height / 2 - 80);
    showReturnBtn = true;
    drawReturnBtn();
    ctx.textAlign = 'start'; // 元に戻す
    ctx.textBaseline = 'alphabetic'; // 元に戻す
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
// - ゲーム再開
// - 最初から
// - スタート画面に戻る

window.addEventListener('DOMContentLoaded', () => {
    resizeCanvasVars(); // 初期化はDOMContentLoaded内で
    document.getElementById('resumeBtn').onclick = resumeGame;
    document.getElementById('restartBtn').onclick = restartGame;
    document.getElementById('backToStartBtn').onclick = backToStartScreen;
    document.getElementById('startBtn').onclick = startGame;
});

// ゲームリセット（スタート画面に戻る）
function resetGame() {
    score = 0;
    miss = false;
    fallingObjs.length = 0;
    showReturnBtn = false;
    lastCol = -1;
    prevCol = -1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    document.getElementById('startScreen').style.display = 'block';
}