/*
 * (ИЗМЕНЕНО: ЗАДАЧА 1 - Убраны await для моментального старта)
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
let betInput, startButton, cashoutButton, multiplierDisplay, canvas, ctx, statusElement;
let savedMultiplierDisplay; 
let autoCashoutToggle, autoCashoutInput, autoCashoutWrapper;

const NUM_GRID_LINES_X = 5; 
const NUM_GRID_LINES_Y = 5; 

function generateCrashPoint() {
    let point = 1 / (1 - Math.random());
    point = Math.min(point, 500);
    point = Math.max(point, 1.01);
    return parseFloat(point.toFixed(2));
}

function mapTimeToX(elapsed) {
    return (elapsed / graphMaxTime) * canvas.width;
}
function mapMultiplierToY(multiplier) {
    const baseMultiplier = 1.0;
    const minYRange = 1.0; 
    const yRange = Math.max(minYRange, graphMaxMultiplier - baseMultiplier);
    return canvas.height - ((multiplier - baseMultiplier) / yRange) * canvas.height;
}
function mapXToTime(pixelX) {
    return (pixelX / canvas.width) * graphMaxTime;
}
function calculateMultiplier(elapsed) {
    const multiplier = Math.pow(1.0115, elapsed / 100); 
    return multiplier;
}

function updateCashoutButtonUI(multiplier) {
    if (cashoutButton && isBetPlaced && isGameRunning) {
        const bet = crashBet;
        const payout = (bet * multiplier).toFixed(2);
        cashoutButton.textContent = `Забрать ${payout} RUB`;
        cashoutButton.classList.add('blue-button');
    }
}

function gameLoop() {
    const elapsed = performance.now() - startTime;
    let rawMultiplier = calculateMultiplier(elapsed);
    
    if (elapsed > graphMaxTime) {
        graphMaxTime = elapsed * 1.2;
    }
    if (rawMultiplier > graphMaxMultiplier) {
        graphMaxMultiplier = rawMultiplier * 1.2;
    }
    
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
            updateCashoutButtonUI(currentMultiplier); 
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
        multiplierDisplay.style.color = 'var(--color-orange)'; 
        multiplierDisplay.classList.remove('win', 'loss', 'hidden');
        if (savedMultiplierDisplay) savedMultiplierDisplay.classList.add('hidden'); 
    
    } else if (state === 'simulating') {
        multiplierDisplay.textContent = `${multiplier.toFixed(2)}x`;
        multiplierDisplay.style.color = 'var(--color-orange)'; 
        multiplierDisplay.classList.remove('win', 'loss', 'hidden');
        if (savedMultiplierDisplay) savedMultiplierDisplay.classList.remove('hidden'); 
        
    } else if (state === 'win') {
        if (savedMultiplierDisplay) {
            savedMultiplierDisplay.textContent = `${multiplier.toFixed(2)}x`; 
            savedMultiplierDisplay.classList.remove('hidden');
        }
        
    } else if (state === 'loss') {
        multiplierDisplay.textContent = `${finalCrashPoint.toFixed(2)}x`; 
        multiplierDisplay.classList.add('loss');
        multiplierDisplay.classList.remove('win', 'hidden');
        multiplierDisplay.style.color = ''; 
        if (!didPlayerWin && savedMultiplierDisplay) savedMultiplierDisplay.classList.add('hidden'); 
        
    } else if (state === 'idle') {
        multiplierDisplay.textContent = '1.00x';
        multiplierDisplay.classList.remove('win', 'loss', 'hidden');
        multiplierDisplay.style.color = 'var(--color-text)';
        if (savedMultiplierDisplay) savedMultiplierDisplay.classList.add('hidden'); 
    }
}

function drawGraphGrid() {
    if (!canvas || !ctx) return;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'; 
    ctx.lineWidth = 1;
    ctx.font = '14px Arial';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'; 
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i <= NUM_GRID_LINES_X; i++) {
        const x = mapTimeToX((i / NUM_GRID_LINES_X) * graphMaxTime); 
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
        if (i > 0) { 
            const timeLabel = `${((i / NUM_GRID_LINES_X) * graphMaxTime / 1000).toFixed(1)}s`;
            ctx.fillText(timeLabel, x, canvas.height - 10);
        }
    }

    const yRange = Math.max(1.0, graphMaxMultiplier - 1.0); 

    for (let i = 0; i <= NUM_GRID_LINES_Y; i++) {
        const multiplierValue = 1.0 + (yRange * (NUM_GRID_LINES_Y - i) / NUM_GRID_LINES_Y);
        const y = mapMultiplierToY(multiplierValue);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
        if (i < NUM_GRID_LINES_Y) { 
            const multLabel = `${multiplierValue.toFixed(1)}x`;
            ctx.textAlign = 'left';
            ctx.fillText(multLabel, 10, y);
            ctx.textAlign = 'center'; 
        }
    }
}

function drawGraph(elapsed, multiplier, crashed) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGraphGrid();

    const colorOrange = '#f7b733'; 
    const colorRed = '#ff477e'; 
    
    ctx.strokeStyle = crashed ? colorRed : colorOrange;
    ctx.lineWidth = 3;
    ctx.shadowColor = crashed ? colorRed : colorOrange;
    ctx.shadowBlur = 10;
    
    ctx.beginPath();
    ctx.moveTo(mapTimeToX(0), mapMultiplierToY(1.0)); 
    
    let finalTime = elapsed;
    if (crashed) {
        finalTime = 100 * Math.log(crashPoint) / Math.log(1.0115);
    }
    
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

async function startGame() {
    cashoutButton.removeEventListener('click', skipToEnd);
    cashoutButton.addEventListener('click', cashout);

    crashBet = parseFloat(parseFloat(betInput.value).toFixed(2));
    
    if (crashBet <= 0 || isNaN(crashBet)) {
        statusElement.textContent = '⚠️ Неверная ставка!';
        return;
    }
    if (crashBet - currentBalance > 0.000001) { 
        statusElement.textContent = '⚠️ Недостаточно средств!';
        statusElement.classList.add('loss'); 
        return;
    }
    
    // ИЗМЕНЕНО: Убран await для моментального старта
    updateBalance(-crashBet);
    reduceWager(crashBet);
    
    isGameRunning = true;
    isBetPlaced = true;
    isCrashed = false; 
    didPlayerWin = false; 
    cashoutMultiplierValue = 0.00; 
    
    isProcessingCashout = false;

    graphMaxTime = 10000;
    graphMaxMultiplier = 5.0; 
    
    crashPoint = generateCrashPoint();
    startTime = performance.now();
    
    statusElement.textContent = ''; 
    statusElement.classList.remove('win', 'loss');
    
    startButton.classList.add('hidden');
    cashoutButton.classList.remove('hidden');
    cashoutButton.textContent = 'Забрать'; 
    cashoutButton.disabled = false;
    cashoutButton.classList.remove('blue-button');
    
    document.querySelector('.crash-controls .bet-input-group').classList.add('disabled');
    if (autoCashoutWrapper) autoCashoutWrapper.classList.add('disabled');
    
    animationFrameId = requestAnimationFrame(gameLoop);
}

async function cashout() {
    if (!isGameRunning || !isBetPlaced || isProcessingCashout) return;

    isProcessingCashout = true; 

    try {
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
        // ИЗМЕНЕНО: Убран await
        writeBetToHistory(betData); 
        
        // ИЗМЕНЕНО: Убран await
        updateBalance(winnings);
        
        isBetPlaced = false; 
        isGameRunning = false; 
        didPlayerWin = true; 
        
        statusElement.textContent = ''; 
        updateMultiplierDisplay(cashoutMultiplier, 'win'); 
        
        cashoutButton.textContent = 'Пропустить';
        cashoutButton.disabled = false;
        cashoutButton.classList.add('blue-button'); 
        
        cashoutButton.removeEventListener('click', cashout);
        cashoutButton.addEventListener('click', skipToEnd);
    } catch (e) {
        console.error("Ошибка в cashout:", e);
        isProcessingCashout = false; 
    }
}

function skipToEnd() {
    if (isCrashed) return; 
    currentMultiplier = crashPoint; 
    endGame(didPlayerWin); 
}

function endGame(didWin) {
    cancelAnimationFrame(animationFrameId);
    isGameRunning = false;
    isCrashed = true; 
    isProcessingCashout = false; 

    const crashTime = 100 * Math.log(crashPoint) / Math.log(1.0115);

    if (crashTime > graphMaxTime) graphMaxTime = crashTime * 1.1;
    if (crashPoint > graphMaxMultiplier) graphMaxMultiplier = crashPoint * 1.1;
    
    drawGraph(crashTime, crashPoint, true); 

    if (didWin) {
        const winnings = crashBet * cashoutMultiplierValue;
        statusElement.textContent = `Выигрыш ${winnings.toFixed(2)} RUB`;
        statusElement.classList.add('win');
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
            // ИЗМЕНЕНО: Убран await
            writeBetToHistory(betData);
        } else {
            statusElement.textContent = `Краш на ${crashPoint.toFixed(2)}x`;
            statusElement.classList.add('loss');
        }
        updateMultiplierDisplay(null, 'loss', crashPoint); 
    }
    
    cashoutButton.classList.remove('blue-button'); 

    isBetPlaced = false;
    cashoutButton.disabled = true;

    setTimeout(() => {
        statusElement.textContent = '';
        statusElement.classList.remove('win', 'loss');
        
        updateMultiplierDisplay(1.00, 'idle');
        
        isCrashed = false;
        didPlayerWin = false; 
        cashoutMultiplierValue = 0.00;
        graphMaxTime = 10000;
        graphMaxMultiplier = 5.0;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGraphGrid(); 
        
        startButton.classList.remove('hidden');
        cashoutButton.classList.add('hidden');
        
        cashoutButton.removeEventListener('click', skipToEnd);
        cashoutButton.addEventListener('click', cashout);

        document.querySelector('.crash-controls .bet-input-group').classList.remove('disabled');
        if (autoCashoutWrapper) autoCashoutWrapper.classList.remove('disabled');
        
    }, 2000);
}

function handleAutoCashoutToggleChange() {
    isAutoCashoutEnabled = autoCashoutToggle.checked;
}

function handleAutoCashoutInput() {
    let val = parseFloat(autoCashoutInput.value);
    if (!isNaN(val)) {
        autoCashoutTarget = val;
    }
}

function formatAutoCashoutInput() {
    let val = parseFloat(autoCashoutInput.value);
    if (isNaN(val) || val < 1.01) {
        val = 1.01;
    }
    autoCashoutInput.value = val.toFixed(2);
    autoCashoutTarget = val;
}

export function initCrash() {
    betInput = document.getElementById('crash-bet');
    startButton = document.getElementById('crash-start-button');
    cashoutButton = document.getElementById('crash-cashout-button');
    multiplierDisplay = document.getElementById('crash-multiplier-display');
    canvas = document.getElementById('crash-canvas');
    statusElement = document.getElementById('crash-status');
    
    autoCashoutToggle = document.getElementById('crash-auto-cashout-toggle');
    autoCashoutInput = document.getElementById('crash-auto-cashout-input');
    autoCashoutWrapper = document.querySelector('.auto-cashout-input-wrapper');
    
    const graphWrapper = document.querySelector('.crash-graph-wrapper');
    if (graphWrapper) {
        savedMultiplierDisplay = document.getElementById('crash-saved-multiplier');
        if (!savedMultiplierDisplay) {
            savedMultiplierDisplay = document.createElement('div');
            savedMultiplierDisplay.id = 'crash-saved-multiplier';
            savedMultiplierDisplay.className = 'crash-multiplier-saved hidden';
            graphWrapper.appendChild(savedMultiplierDisplay);
        }
    }
    
    const betHalfButton = document.querySelector('#crash-game .bet-half');
    const betDoubleButton = document.querySelector('#crash-game .bet-double');
    const betMinButton = document.querySelector('#crash-game .bet-min');
    const betMaxButton = document.querySelector('#crash-game .bet-max');

    if (!canvas) {
        return; 
    }
    
    ctx = canvas.getContext('2d');
    
    function resizeCanvas() {
        const wrapper = document.querySelector('.crash-graph-wrapper');
        if (wrapper) {
            canvas.width = wrapper.clientWidth;
            canvas.height = wrapper.clientHeight;
            
            if (isCrashed) {
                const crashTime = 100 * Math.log(crashPoint) / Math.log(1.0115);
                drawGraph(crashTime, crashPoint, true);
            } else if (currentMultiplier > 1.00) {
                const elapsed = performance.now() - startTime;
                const multiplier = calculateMultiplier(elapsed);
                drawGraph(elapsed, multiplier, false);
            } else {
                drawGraphGrid(); 
            }
        }
    }
    window.addEventListener('resize', resizeCanvas);
    
    if (startButton) {
        startButton.addEventListener('click', startGame);
    }
    
    if (cashoutButton) {
        cashoutButton.addEventListener('click', cashout);
    }
    
    if (betHalfButton && betInput) {
        betHalfButton.addEventListener('click', () => {
            let currentVal = parseFloat(betInput.value);
            if (isNaN(currentVal)) currentVal = 0;
            let newVal = Math.max(1.00, currentVal / 2); 
            betInput.value = newVal.toFixed(2);
            crashBet = newVal;
        });
    }

    if (betDoubleButton && betInput) {
        betDoubleButton.addEventListener('click', () => {
            let currentVal = parseFloat(betInput.value);
            if (isNaN(currentVal)) currentVal = 0;
            let newVal = Math.min(currentBalance, currentVal * 2);
            betInput.value = newVal.toFixed(2);
            crashBet = newVal;
        });
    }
    
    if (betMinButton) {
        betMinButton.addEventListener('click', () => {
            let newVal = 1.00;
            betInput.value = newVal.toFixed(2);
            crashBet = newVal;
        });
    }
    
    if (betMaxButton) {
        betMaxButton.addEventListener('click', () => {
            let newVal = currentBalance; 
            betInput.value = newVal.toFixed(2);
            crashBet = newVal; 
        });
    }
    
    if (autoCashoutToggle) {
        autoCashoutToggle.addEventListener('change', handleAutoCashoutToggleChange);
    }
    if (autoCashoutInput) {
        autoCashoutInput.addEventListener('input', handleAutoCashoutInput);
        autoCashoutInput.addEventListener('blur', formatAutoCashoutInput);
    }

    function waitForCanvasSizeAndResize() {
        const wrapper = document.querySelector('.crash-graph-wrapper');
        if (wrapper && wrapper.clientWidth > 0 && wrapper.clientHeight > 0) {
            resizeCanvas();
            updateMultiplierDisplay(1.00, 'idle');
            handleAutoCashoutToggleChange();
            formatAutoCashoutInput();
        } else {
            requestAnimationFrame(waitForCanvasSizeAndResize);
        }
    }
    
    waitForCanvasSizeAndResize();
}
