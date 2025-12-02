/*
 * CRASH.JS - С ВНЕДРЕННЫМ ANTI-MINUS
 */
import { currentBalance, updateBalance, writeBetToHistory, currentUser, reduceWager, AntiMinus } from './global.js';

let crashBet = 10.00;
let isGameRunning = false;
let isBetPlaced = false; 
let currentMultiplier = 1.00;
let crashPoint = 0; 
let startTime = 0;
let animationFrameId = null;
let isAutoCashoutEnabled = false;
let autoCashoutTarget = 2.00;
let isProcessingCashout = false; 
let graphMaxTime = 10000; 
let graphMaxMultiplier = 5.0; 
let isCrashed = false; 
let didPlayerWin = false; 
let betInput, mainButton, multiplierDisplay, canvas, ctx, statusElement;
let autoCashoutToggle, autoCashoutInput, betHalfBtn, betDoubleBtn;
const NUM_GRID_LINES_X = 5; 
const NUM_GRID_LINES_Y = 5; 

function generateCrashPoint() {
    let point = 1 / (1 - Math.random());
    point = Math.min(point, 500);
    point = Math.max(point, 1.01);
    
    // --- ANTI-MINUS LOGIC ---
    // Если игра идет, мы проверяем, можем ли мы позволить этот краш-поинт
    // (Упрощение: считаем, что если игрок поставил, и поинт выше автокешаута, это потенциальный проигрыш)
    
    if (isBetPlaced) { // Только если есть ставка
        // Какой выигрыш был бы при таком краш поинте? 
        // Если автовывод стоит меньше поинта -> выигрыш = ставка * автовывод
        // Если автовывода нет -> выигрыш потенциально ставка * поинт (если успеет забрать)
        
        let potentialWin = 0;
        let effectiveMult = point;
        
        if (isAutoCashoutEnabled && autoCashoutTarget < point) {
            effectiveMult = autoCashoutTarget;
        }
        // Считаем худший сценарий (игрок забирает на пике)
        potentialWin = (crashBet * effectiveMult) - crashBet;
        
        if (!AntiMinus.canUserWin(potentialWin, crashBet)) {
            // Если выигрыш запрещен, крашим НИЖЕ автовывода или мгновенно
            const safePoint = isAutoCashoutEnabled ? (autoCashoutTarget - 0.01) : 1.05;
            point = Math.max(1.00, Math.min(point, safePoint));
            console.warn("Crash: Anti-Minus corrected point to " + point);
        }
    }
    // ------------------------
    
    return parseFloat(point.toFixed(2));
}

// ... (mapTimeToX, mapMultiplierToY, mapXToTime, calculateMultiplier без изменений) ...
function mapTimeToX(elapsed) { return (elapsed / graphMaxTime) * canvas.width; }
function mapMultiplierToY(multiplier) {
    const yRange = Math.max(1.0, graphMaxMultiplier - 1.0);
    return canvas.height - ((multiplier - 1.0) / yRange) * canvas.height;
}
function mapXToTime(pixelX) { return (pixelX / canvas.width) * graphMaxTime; }
function calculateMultiplier(elapsed) { return Math.pow(1.0115, elapsed / 100); }

function updateMainButtonState(state, payout = 0) {
    if (!mainButton) return;
    mainButton.classList.remove('cashout-mode', 'skip-mode');
    if (state === 'start') {
        mainButton.textContent = 'НАЧАТЬ ИГРУ';
        mainButton.disabled = false;
    } else if (state === 'cashout') {
        mainButton.textContent = `ЗАБРАТЬ (${payout} ₽)`;
        mainButton.classList.add('cashout-mode');
        mainButton.disabled = false;
    } else if (state === 'skip') {
        mainButton.textContent = 'В ИГРЕ...';
        mainButton.classList.add('skip-mode');
        mainButton.disabled = true; 
    } else if (state === 'wait') {
        mainButton.textContent = 'ОЖИДАНИЕ...';
        mainButton.disabled = true;
    }
}

function gameLoop() {
    const elapsed = performance.now() - startTime;
    let rawMultiplier = calculateMultiplier(elapsed);
    
    if (elapsed > graphMaxTime) graphMaxTime = elapsed * 1.2;
    if (rawMultiplier > graphMaxMultiplier) graphMaxMultiplier = rawMultiplier * 1.2;
    
    if (rawMultiplier >= crashPoint) {
        currentMultiplier = crashPoint;
        endGame(didPlayerWin); 
        return;
    }
    currentMultiplier = rawMultiplier;
    drawGraph(elapsed, currentMultiplier, false);
    
    if (isGameRunning) {
        if (isAutoCashoutEnabled && isBetPlaced && currentMultiplier >= autoCashoutTarget) {
            cashout();
        } else {
            updateMultiplierDisplay(currentMultiplier, 'running');
            if (isBetPlaced) {
                const payout = (crashBet * currentMultiplier).toFixed(2);
                updateMainButtonState('cashout', payout);
            }
        }
        animationFrameId = requestAnimationFrame(gameLoop);
    } else {
        updateMultiplierDisplay(currentMultiplier, 'simulating'); 
        animationFrameId = requestAnimationFrame(gameLoop);
    }
}

function updateMultiplierDisplay(multiplier, state = 'running', finalCrashPoint = null) {
    if (!multiplierDisplay) return;
    if (state === 'running') {
        multiplierDisplay.textContent = `${multiplier.toFixed(2)}x`;
        multiplierDisplay.style.color = 'var(--color-text)'; 
        multiplierDisplay.classList.remove('win', 'loss', 'hidden');
    } else if (state === 'loss') {
        multiplierDisplay.textContent = `${finalCrashPoint.toFixed(2)}x`; 
        multiplierDisplay.classList.add('loss');
        multiplierDisplay.style.color = ''; 
    } else if (state === 'idle') {
        multiplierDisplay.textContent = '1.00x';
        multiplierDisplay.classList.remove('win', 'loss', 'hidden');
        multiplierDisplay.style.color = 'var(--color-text)';
    }
}

function drawGraphGrid() {
    if (!canvas || !ctx) return;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'; 
    ctx.lineWidth = 1;
    ctx.font = '14px Arial';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'; 
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= NUM_GRID_LINES_X; i++) {
        const x = mapTimeToX((i / NUM_GRID_LINES_X) * graphMaxTime); 
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    const yRange = Math.max(1.0, graphMaxMultiplier - 1.0); 
    for (let i = 0; i <= NUM_GRID_LINES_Y; i++) {
        const multiplierValue = 1.0 + (yRange * (NUM_GRID_LINES_Y - i) / NUM_GRID_LINES_Y);
        const y = mapMultiplierToY(multiplierValue);
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }
}

function drawGraph(elapsed, multiplier, crashed) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGraphGrid();
    const colorOrange = '#f7b733'; 
    const colorRed = '#ff477e'; 
    ctx.strokeStyle = crashed ? colorRed : colorOrange;
    ctx.lineWidth = 4;
    ctx.shadowColor = crashed ? colorRed : colorOrange;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.moveTo(mapTimeToX(0), mapMultiplierToY(1.0)); 
    let finalTime = elapsed;
    if (crashed) finalTime = 100 * Math.log(crashPoint) / Math.log(1.0115);
    const currentPixelX = mapTimeToX(finalTime);
    for (let px = 1; px <= currentPixelX; px++) {
        let timeAtPixel = mapXToTime(px);
        if (timeAtPixel > finalTime) timeAtPixel = finalTime;
        let multAtPixel = calculateMultiplier(timeAtPixel);
        if (multAtPixel > multiplier) multAtPixel = multiplier;
        let y = mapMultiplierToY(multAtPixel);
        ctx.lineTo(px, y);
    }
    ctx.stroke();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
}

async function handleMainAction() {
    if (isGameRunning && isBetPlaced) await cashout();
    else if (!isGameRunning) await startGame();
}

async function startGame() {
    crashBet = parseFloat(parseFloat(betInput.value).toFixed(2));
    if (crashBet <= 0 || isNaN(crashBet)) return document.getElementById('crash-status').textContent = '⚠️ Неверная ставка!';
    if (crashBet > currentBalance) return document.getElementById('crash-status').textContent = '⚠️ Недостаточно средств!';
    
    updateBalance(-crashBet);
    reduceWager(crashBet);
    
    isGameRunning = true;
    isBetPlaced = true;
    isCrashed = false; 
    didPlayerWin = false; 
    isProcessingCashout = false;
    graphMaxTime = 10000;
    graphMaxMultiplier = 2.0; 
    
    // Сгенерируем поинт (Anti-Minus уже работает внутри)
    crashPoint = generateCrashPoint();
    startTime = performance.now();
    
    statusElement.textContent = ''; 
    statusElement.classList.remove('win', 'loss');
    betInput.parentElement.style.pointerEvents = 'none';
    betInput.parentElement.style.opacity = 0.6;
    updateMainButtonState('wait'); 
    animationFrameId = requestAnimationFrame(gameLoop);
}

async function cashout() {
    if (!isGameRunning || !isBetPlaced || isProcessingCashout) return;
    isProcessingCashout = true; 
    const cashoutMultiplier = currentMultiplier; 
    const winnings = crashBet * cashoutMultiplier;
    
    const betData = { username: currentUser, game: 'crash', result: `${cashoutMultiplier.toFixed(2)}x`, betAmount: crashBet, amount: winnings - crashBet, multiplier: `${cashoutMultiplier.toFixed(2)}x` };
    writeBetToHistory(betData); 
    updateBalance(winnings);
    
    isBetPlaced = false; 
    didPlayerWin = true; 
    statusElement.textContent = `Выигрыш ${winnings.toFixed(2)} RUB`; 
    statusElement.classList.add('win');
    updateMultiplierDisplay(cashoutMultiplier, 'win'); 
    updateMainButtonState('skip');
}

function endGame(didWin) {
    cancelAnimationFrame(animationFrameId);
    isGameRunning = false;
    isProcessingCashout = false; 
    const crashTime = 100 * Math.log(crashPoint) / Math.log(1.0115);
    drawGraph(crashTime, crashPoint, true); 
    if (didWin) {
        updateMultiplierDisplay(null, 'loss', crashPoint); 
    } else {
        if (isBetPlaced) {
            statusElement.textContent = `Проигрыш ${crashBet.toFixed(2)} RUB`;
            statusElement.classList.add('loss');
            const betData = { username: currentUser, game: 'crash', result: '💥 CRASH', betAmount: crashBet, amount: -crashBet, multiplier: '0.00x' };
            writeBetToHistory(betData);
        }
        updateMultiplierDisplay(null, 'loss', crashPoint); 
    }
    setTimeout(() => {
        isCrashed = false;
        didPlayerWin = false; 
        graphMaxTime = 10000;
        graphMaxMultiplier = 2.0;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGraphGrid(); 
        updateMultiplierDisplay(1.00, 'idle');
        statusElement.textContent = '';
        statusElement.classList.remove('win', 'loss');
        betInput.parentElement.style.pointerEvents = 'auto';
        betInput.parentElement.style.opacity = 1;
        updateMainButtonState('start');
    }, 2000);
}

function handleAutoCashoutToggleChange() {
    isAutoCashoutEnabled = autoCashoutToggle.checked;
    autoCashoutInput.disabled = !isAutoCashoutEnabled;
    autoCashoutInput.parentElement.style.opacity = isAutoCashoutEnabled ? 1 : 0.5;
}
function handleAutoCashoutInput() {
    let val = parseFloat(autoCashoutInput.value);
    if (!isNaN(val)) autoCashoutTarget = val;
}
function formatAutoCashoutInput() {
    let val = parseFloat(autoCashoutInput.value);
    if (isNaN(val) || val < 1.01) val = 1.01;
    autoCashoutInput.value = val.toFixed(2);
    autoCashoutTarget = val;
}

export function initCrash() {
    betInput = document.getElementById('crash-bet');
    mainButton = document.getElementById('crash-main-button');
    multiplierDisplay = document.getElementById('crash-multiplier-display');
    canvas = document.getElementById('crash-canvas');
    statusElement = document.getElementById('crash-status');
    autoCashoutToggle = document.getElementById('crash-auto-cashout-toggle');
    autoCashoutInput = document.getElementById('crash-auto-cashout-input');
    betHalfBtn = document.querySelector('#crash-game .bet-half');
    betDoubleBtn = document.querySelector('#crash-game .bet-double');

    if (!canvas) return;
    ctx = canvas.getContext('2d');
    function resizeCanvas() {
        const wrapper = document.querySelector('.crash-graph-wrapper');
        if (wrapper) { canvas.width = wrapper.clientWidth; canvas.height = wrapper.clientHeight; drawGraphGrid(); }
    }
    window.addEventListener('resize', resizeCanvas);
    setTimeout(resizeCanvas, 100);
    if (mainButton) mainButton.addEventListener('click', handleMainAction);
    if (autoCashoutToggle) { autoCashoutToggle.addEventListener('change', handleAutoCashoutToggleChange); handleAutoCashoutToggleChange(); }
    if (autoCashoutInput) { autoCashoutInput.addEventListener('input', handleAutoCashoutInput); autoCashoutInput.addEventListener('blur', formatAutoCashoutInput); }
    if (betHalfBtn) betHalfBtn.addEventListener('click', () => { if(isGameRunning) return; betInput.value = Math.max(1.00, (parseFloat(betInput.value)||0)/2).toFixed(2); });
    if (betDoubleBtn) betDoubleBtn.addEventListener('click', () => { if(isGameRunning) return; betInput.value = Math.min(currentBalance, (parseFloat(betInput.value)||0)*2).toFixed(2); });
}
