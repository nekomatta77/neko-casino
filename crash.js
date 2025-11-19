/*
 * (ИЗМЕНЕНО: НОВЫЙ ДИЗАЙН ИНТЕРФЕЙСА)
 */
import { currentBalance, updateBalance, writeBetToHistory, currentUser, reduceWager } from './global.js';

// --- ЛОКАЛЬНЫЕ ПЕРЕМЕННЫЕ CRASH ---
let crashBet = 10.00;
let isGameRunning = false;
let isBetPlaced = false; 
let currentMultiplier = 1.00;
let crashPoint = 0; 
let startTime = 0;
let animationFrameId = null;

// --- Авто-вывод ---
let isAutoCashoutEnabled = false;
let autoCashoutTarget = 2.00;
let isProcessingCashout = false; 

// --- ГРАФИК ---
let graphMaxTime = 10000; 
let graphMaxMultiplier = 5.0; 
let isCrashed = false; 
let didPlayerWin = false; 
let cashoutMultiplierValue = 0.00; 

// --- ЭЛЕМЕНТЫ DOM ---
let betInput, mainButton, multiplierDisplay, canvas, ctx, statusElement;
let savedMultiplierDisplay; 
let autoCashoutToggle, autoCashoutInput;
let betHalfBtn, betDoubleBtn;

const NUM_GRID_LINES_X = 5; 
const NUM_GRID_LINES_Y = 5; 

// ... (Функции generateCrashPoint, mapTimeToX, mapMultiplierToY, mapXToTime, calculateMultiplier - БЕЗ ИЗМЕНЕНИЙ) ...
function generateCrashPoint() {
    let point = 1 / (1 - Math.random());
    point = Math.min(point, 500);
    point = Math.max(point, 1.01);
    return parseFloat(point.toFixed(2));
}
function mapTimeToX(elapsed) { return (elapsed / graphMaxTime) * canvas.width; }
function mapMultiplierToY(multiplier) {
    const baseMultiplier = 1.0;
    const minYRange = 1.0; 
    const yRange = Math.max(minYRange, graphMaxMultiplier - baseMultiplier);
    return canvas.height - ((multiplier - baseMultiplier) / yRange) * canvas.height;
}
function mapXToTime(pixelX) { return (pixelX / canvas.width) * graphMaxTime; }
function calculateMultiplier(elapsed) { return Math.pow(1.0115, elapsed / 100); }

// --- ОБНОВЛЕНИЕ КНОПКИ ---
function updateMainButtonState(state, payout = 0) {
    if (!mainButton) return;
    
    // Сброс классов
    mainButton.classList.remove('cashout-mode', 'skip-mode');
    
    if (state === 'start') {
        mainButton.textContent = 'НАЧАТЬ ИГРУ';
        mainButton.disabled = false;
    } 
    else if (state === 'cashout') {
        mainButton.textContent = `ЗАБРАТЬ (${payout} ₽)`;
        mainButton.classList.add('cashout-mode');
        mainButton.disabled = false;
    }
    else if (state === 'skip') {
        mainButton.textContent = 'В ИГРЕ...';
        mainButton.classList.add('skip-mode');
        mainButton.disabled = true; // Блокируем нажатие, пока идет игра (или можно сделать "Пропустить" анимацию)
    }
    else if (state === 'wait') {
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
        // Симуляция (если игра идет, но мы не ставили) - в текущей версии это не используется,
        // так как игра одиночная
        updateMultiplierDisplay(currentMultiplier, 'simulating'); 
        animationFrameId = requestAnimationFrame(gameLoop);
    }
}

// ... (updateMultiplierDisplay, drawGraphGrid, drawGraph - БЕЗ ИЗМЕНЕНИЙ) ...
function updateMultiplierDisplay(multiplier, state = 'running', finalCrashPoint = null) {
    if (!multiplierDisplay) return;
    if (state === 'running') {
        multiplierDisplay.textContent = `${multiplier.toFixed(2)}x`;
        multiplierDisplay.style.color = 'var(--color-text)'; 
        multiplierDisplay.classList.remove('win', 'loss', 'hidden');
    } else if (state === 'win') {
       // handled externally or keep color
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
    if (isGameRunning && isBetPlaced) {
        await cashout();
    } else if (!isGameRunning) {
        await startGame();
    }
}

async function startGame() {
    crashBet = parseFloat(parseFloat(betInput.value).toFixed(2));
    
    if (crashBet <= 0 || isNaN(crashBet)) {
        statusElement.textContent = '⚠️ Неверная ставка!';
        statusElement.classList.add('loss'); 
        return;
    }
    if (crashBet > currentBalance) {
        statusElement.textContent = '⚠️ Недостаточно средств!';
        statusElement.classList.add('loss'); 
        return;
    }
    
    updateBalance(-crashBet);
    reduceWager(crashBet);
    
    isGameRunning = true;
    isBetPlaced = true;
    isCrashed = false; 
    didPlayerWin = false; 
    cashoutMultiplierValue = 0.00; 
    isProcessingCashout = false;

    graphMaxTime = 10000;
    graphMaxMultiplier = 2.0; 
    
    crashPoint = generateCrashPoint();
    startTime = performance.now();
    
    statusElement.textContent = ''; 
    statusElement.classList.remove('win', 'loss');
    
    // Блокировка интерфейса
    betInput.parentElement.style.pointerEvents = 'none';
    betInput.parentElement.style.opacity = 0.6;
    
    updateMainButtonState('wait'); // Сначала ждем старта анимации
    
    animationFrameId = requestAnimationFrame(gameLoop);
}

async function cashout() {
    if (!isGameRunning || !isBetPlaced || isProcessingCashout) return;
    isProcessingCashout = true; 

    const cashoutMultiplier = currentMultiplier; 
    cashoutMultiplierValue = cashoutMultiplier; 
    const winnings = crashBet * cashoutMultiplier;
    
    const betData = {
        username: currentUser,
        game: 'crash',
        result: `${cashoutMultiplier.toFixed(2)}x`,
        betAmount: crashBet, 
        amount: winnings - crashBet, 
        multiplier: `${cashoutMultiplier.toFixed(2)}x` 
    };
    writeBetToHistory(betData); 
    updateBalance(winnings);
    
    isBetPlaced = false; 
    didPlayerWin = true; 
    
    statusElement.textContent = `Выигрыш ${winnings.toFixed(2)} RUB`; 
    statusElement.classList.add('win');
    updateMultiplierDisplay(cashoutMultiplier, 'win'); 
    
    updateMainButtonState('skip'); // Теперь просто ждем конца
}

function endGame(didWin) {
    cancelAnimationFrame(animationFrameId);
    isGameRunning = false;
    isProcessingCashout = false; 

    const crashTime = 100 * Math.log(crashPoint) / Math.log(1.0115);
    drawGraph(crashTime, crashPoint, true); 

    if (didWin) {
        // Статус уже установлен в cashout
        updateMultiplierDisplay(null, 'loss', crashPoint); 
    } else {
        if (isBetPlaced) {
            statusElement.textContent = `Проигрыш ${crashBet.toFixed(2)} RUB`;
            statusElement.classList.add('loss');
            
            const betData = {
                username: currentUser,
                game: 'crash',
                result: '💥 CRASH',
                betAmount: crashBet, 
                amount: -crashBet, 
                multiplier: '0.00x' 
            };
            writeBetToHistory(betData);
        } else {
             // Если мы уже забрали, статус не трогаем
        }
        updateMultiplierDisplay(null, 'loss', crashPoint); 
    }
    
    // Возвращаем интерфейс
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

// Обработчики Авто-вывода
function handleAutoCashoutToggleChange() {
    isAutoCashoutEnabled = autoCashoutToggle.checked;
    autoCashoutInput.disabled = !isAutoCashoutEnabled;
    if(isAutoCashoutEnabled) {
        autoCashoutInput.parentElement.style.opacity = 1;
    } else {
        autoCashoutInput.parentElement.style.opacity = 0.5;
    }
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
    
    // Canvas Resize Logic
    function resizeCanvas() {
        const wrapper = document.querySelector('.crash-graph-wrapper');
        if (wrapper) {
            canvas.width = wrapper.clientWidth;
            canvas.height = wrapper.clientHeight;
            drawGraphGrid();
        }
    }
    window.addEventListener('resize', resizeCanvas);
    // Init resize after layout
    setTimeout(resizeCanvas, 100);
    
    if (mainButton) {
        mainButton.addEventListener('click', handleMainAction);
    }
    
    if (autoCashoutToggle) {
        autoCashoutToggle.addEventListener('change', handleAutoCashoutToggleChange);
        // Init state
        handleAutoCashoutToggleChange();
    }
    if (autoCashoutInput) {
        autoCashoutInput.addEventListener('input', handleAutoCashoutInput);
        autoCashoutInput.addEventListener('blur', formatAutoCashoutInput);
    }
    
    if (betHalfBtn) {
        betHalfBtn.addEventListener('click', () => {
            if(isGameRunning) return;
            let val = parseFloat(betInput.value) || 0;
            betInput.value = Math.max(1.00, val / 2).toFixed(0);
        });
    }
    if (betDoubleBtn) {
        betDoubleBtn.addEventListener('click', () => {
            if(isGameRunning) return;
            let val = parseFloat(betInput.value) || 0;
            betInput.value = Math.min(currentBalance, val * 2).toFixed(0);
        });
    }
}
