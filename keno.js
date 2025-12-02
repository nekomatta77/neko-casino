/*
 * KENO.JS - С ВНЕДРЕННЫМ ANTI-MINUS
 */
import { currentBalance, updateBalance, writeBetToHistory, currentUser, reduceWager, AntiMinus } from './global.js';

const KENO_GRID_SIZE = 40;
const KENO_DRAW_SIZE = 10; 
const MAX_SELECTION = 10;
const REVEAL_SPEED_MS = 150; 
const PAYOUT_TABLES = {
    easy: { 1: {1:3.96}, 2:{1:2,2:3.8}, 3:{1:1,2:2.2,3:20}, 4:{2:2,3:8.4,4:100}, 5:{2:1.5,3:3.6,4:20,5:250}, 6:{2:1,3:2,4:7.5,5:100,6:700}, 7:{2:1.2,3:1.6,4:3.5,5:15,6:225,7:700}, 8:{2:1.1,3:1.5,4:2,5:3.5,6:39,7:100,8:800}, 9:{2:1.2,3:1.3,4:1.7,5:2.5,6:7.5,7:50,8:250,9:1000}, 10:{2:1.1,3:1.2,4:1.3,5:1.8,6:3.5,7:13,8:50,9:250,10:1000} },
    medium: { 1: {1:3.96}, 2:{1:1.8,2:5.1}, 3:{2:2.8,3:50}, 4:{2:1.1,3:13.3,4:100}, 5:{2:1,3:3,4:35,5:350}, 6:{3:3,4:9,5:180,6:710}, 7:{3:2,4:7,5:30,6:400,7:800}, 8:{3:2,4:4,5:11,6:67,7:400,8:900}, 9:{3:2,4:2.5,5:5,6:15,7:100,8:500,9:1000}, 10:{3:1.6,4:2,5:4,6:7,7:25,8:100,9:500,10:1000} },
    high: { 1: {1:3.96}, 2:{2:17.1}, 3:{3:81.5}, 4:{3:10,4:259}, 5:{3:4.5,4:48,5:450}, 6:{4:11,5:350,6:710}, 7:{4:7,5:90,6:400,7:800}, 8:{4:5,5:20,6:270,7:600,8:900}, 9:{4:4,5:11,6:56,7:500,8:800,9:1000}, 10:{4:3.5,5:8,6:13,7:64,8:500,9:800,10:1000} }
};

let isGameActive = false;
let currentBet = 10.00;
let currentRisk = 'easy'; 
let selectedNumbers = []; 
let drawnNumbers = []; 
let isTurboMode = false; 
let isAutoMode = false;
let grid, betInput, playButton, clearButton, autoPickButton, payoutBar, statusElement;
let betHalfButton, betDoubleButton, kenoResultOverlay, kenoResultMultiplier, kenoResultWinnings;
let turboButton, riskButtons, tabButtons, manualPanel, autoPanel;
let autoGameActive = false, autoGamesRemaining = 0, autoStartButton, autoCountInput, autoBetInput, autoBetHalfBtn, autoBetDoubleBtn;

function createGrid() {
    grid.innerHTML = '';
    for (let i = 1; i <= KENO_GRID_SIZE; i++) {
        const cell = document.createElement('div');
        cell.classList.add('keno-cell');
        cell.textContent = i;
        cell.setAttribute('data-number', i);
        cell.addEventListener('click', handleCellClick);
        grid.appendChild(cell);
    }
}

function updatePayoutTableUI() {
    payoutBar.innerHTML = '';
    const picks = selectedNumbers.length;
    if (picks === 0) return; 
    const table = PAYOUT_TABLES[currentRisk][picks];
    for (let hits = 0; hits <= picks; hits++) {
        const multiplier = table[hits] || 0;
        const item = document.createElement('div');
        item.classList.add('keno-gem-item');
        item.setAttribute('data-hit-count', hits);
        item.innerHTML = `<div class="keno-paw-wrapper"><img src="assets/grey_paw.png" class="paw-grey"><img src="assets/keno_paw.png" class="paw-color"></div><span class="keno-gem-mult">x${multiplier}</span>`;
        payoutBar.appendChild(item);
    }
}

function updatePayoutScaleFill(hitCount) {
    payoutBar.querySelectorAll('.keno-gem-item').forEach(item => {
        const itemHits = parseInt(item.getAttribute('data-hit-count'));
        if (itemHits <= hitCount) item.classList.add('active');
        else item.classList.remove('active');
    });
}

function updateControlsUI() {
    const selectionCount = selectedNumbers.length;
    playButton.disabled = (selectionCount === 0) || isGameActive || autoGameActive;
    autoPickButton.disabled = isGameActive || autoGameActive;
    clearButton.disabled = (selectionCount === 0) || isGameActive || autoGameActive;
    playButton.textContent = selectionCount > 0 ? `СДЕЛАТЬ СТАВКУ` : `ВЫБЕРИТЕ ЧИСЛА`;
    if (autoGameActive) {
        autoStartButton.textContent = `СТОП (${autoGamesRemaining})`;
        autoStartButton.classList.add('stop-mode');
        autoCountInput.disabled = true;
        autoBetInput.disabled = true;
    } else {
        autoStartButton.textContent = `ЗАПУСТИТЬ АВТО`;
        autoStartButton.classList.remove('stop-mode');
        autoCountInput.disabled = false;
        autoBetInput.disabled = false;
        autoStartButton.disabled = (selectionCount === 0);
    }
    if (isGameActive || autoGameActive) { grid.classList.add('disabled'); tabButtons.forEach(btn => btn.disabled = true); }
    else { grid.classList.remove('disabled'); tabButtons.forEach(btn => btn.disabled = false); }
}

function resetGame(clearSelection = true) {
    drawnNumbers = [];
    if (kenoResultOverlay) kenoResultOverlay.classList.add('hidden');
    grid.querySelectorAll('.keno-cell').forEach(cell => {
        cell.classList.remove('hit', 'miss', 'drawn', 'idle', 'win');
        cell.innerHTML = cell.getAttribute('data-number');
        if (clearSelection) cell.classList.remove('selected');
    });
    if (statusElement) statusElement.textContent = '';
    if (clearSelection) selectedNumbers = [];
    updatePayoutTableUI();
    updateControlsUI();
}

function handleCellClick(e) {
    if (isGameActive || autoGameActive) return;
    const cell = e.currentTarget;
    const number = parseInt(cell.getAttribute('data-number'));
    const index = selectedNumbers.indexOf(number);
    if (index > -1) { selectedNumbers.splice(index, 1); cell.classList.remove('selected'); }
    else { if (selectedNumbers.length < MAX_SELECTION) { selectedNumbers.push(number); cell.classList.add('selected'); } }
    updatePayoutScaleFill(-1); updatePayoutTableUI(); updateControlsUI();
}

function handleClear() { if (!isGameActive && !autoGameActive) resetGame(true); }
function handleAutoPick() {
    if (isGameActive || autoGameActive) return;
    handleClear();
    let availableNumbers = Array.from({ length: KENO_GRID_SIZE }, (_, i) => i + 1);
    for (let i = 0; i < MAX_SELECTION; i++) {
        const randomIndex = Math.floor(Math.random() * availableNumbers.length);
        selectedNumbers.push(availableNumbers.splice(randomIndex, 1)[0]);
        const cell = grid.querySelector(`.keno-cell[data-number="${selectedNumbers[i]}"]`);
        if (cell) cell.classList.add('selected');
    }
    updatePayoutTableUI(); updateControlsUI();
}

function handleTurboToggle() {
    isTurboMode = !isTurboMode;
    turboButton.querySelector('img').src = isTurboMode ? 'assets/thunder_on.png' : 'assets/thunder_off.png';
    if (isTurboMode) turboButton.classList.add('active'); else turboButton.classList.remove('active');
}

function handleTabSwitch(e) {
    if (isGameActive || autoGameActive) return;
    tabButtons.forEach(btn => btn.classList.remove('active'));
    e.currentTarget.classList.add('active');
    if (e.currentTarget.getAttribute('data-mode') === 'manual') { manualPanel.classList.remove('hidden'); autoPanel.classList.add('hidden'); isAutoMode = false; }
    else { manualPanel.classList.add('hidden'); autoPanel.classList.remove('hidden'); isAutoMode = true; }
    updateControlsUI();
}

function handleRiskSwitch(e) {
    if (isGameActive || autoGameActive) return;
    riskButtons.forEach(btn => btn.classList.remove('active'));
    e.currentTarget.classList.add('active');
    currentRisk = e.currentTarget.getAttribute('data-risk');
    updatePayoutTableUI();
}

async function handlePlayKeno() {
    currentBet = isAutoMode ? parseFloat(autoBetInput.value) : parseFloat(betInput.value);
    if (selectedNumbers.length === 0 || currentBet <= 0 || isNaN(currentBet) || currentBet > currentBalance) { if (autoGameActive) stopAutoGame(); return; }

    resetGame(false); 
    isGameActive = true;
    updateControlsUI(); 
    updateBalance(-currentBet);
    reduceWager(currentBet);

    // --- ANTI-MINUS LOGIC ---
    drawnNumbers = [];
    let attempts = 0;
    let allowed = false;
    let multiplier = 0;
    let hitsCount = 0;

    while (!allowed && attempts < 3) {
        drawnNumbers = [];
        const numberPool = Array.from({ length: KENO_GRID_SIZE }, (_, i) => i + 1);
        for (let i = 0; i < KENO_DRAW_SIZE; i++) {
            const randomIndex = Math.floor(Math.random() * numberPool.length);
            drawnNumbers.push(numberPool.splice(randomIndex, 1)[0]);
        }
        
        hitsCount = 0;
        for (const number of drawnNumbers) { if (selectedNumbers.includes(number)) hitsCount++; }
        
        const picksCount = selectedNumbers.length;
        multiplier = PAYOUT_TABLES[currentRisk][picksCount][hitsCount] || 0;
        const profit = (currentBet * multiplier) - currentBet;
        
        if (AntiMinus.canUserWin(profit, currentBet)) {
            allowed = true;
        } else {
            attempts++;
            console.warn("Keno: Anti-Minus regenerating numbers...");
        }
    }
    
    if (!allowed) {
        drawnNumbers = [];
        const safePool = Array.from({ length: KENO_GRID_SIZE }, (_, i) => i + 1).filter(n => !selectedNumbers.includes(n));
        for (let i = 0; i < KENO_DRAW_SIZE; i++) {
            if(safePool.length > 0) {
                const randomIndex = Math.floor(Math.random() * safePool.length);
                drawnNumbers.push(safePool.splice(randomIndex, 1)[0]);
            }
        }
        hitsCount = 0;
        multiplier = 0;
    }
    // ------------------------

    if (isTurboMode) instantReveal(drawnNumbers, selectedNumbers, hitsCount);
    else await animateReveal(drawnNumbers, selectedNumbers);

    const winnings = currentBet * multiplier;
    if (winnings > 0) updateBalance(winnings);

    // --- ОБНОВЛЕНИЕ: Сохраняем полную информацию для модального окна ---
    // Формат: "Risk | Hits/Picks ::: s:1,2,3;d:4,5,6"
    // s = selected numbers, d = drawn numbers
    const resultString = `${currentRisk.charAt(0).toUpperCase() + currentRisk.slice(1)} | ${hitsCount}/${selectedNumbers.length} ::: s:${selectedNumbers.join(',')};d:${drawnNumbers.join(',')}`;
    
    writeBetToHistory({ 
        username: currentUser, 
        game: 'keno', 
        result: resultString, 
        betAmount: currentBet, 
        amount: winnings - currentBet, 
        multiplier: `${multiplier.toFixed(2)}x` 
    });
    
    if (!autoGameActive && kenoResultOverlay) {
        kenoResultMultiplier.textContent = `${multiplier.toFixed(2)}x`;
        kenoResultWinnings.textContent = `${winnings.toFixed(2)} RUB`;
        kenoResultOverlay.classList.remove('win', 'loss', 'hidden');
        kenoResultOverlay.classList.add(winnings > 0 ? 'win' : 'loss');
    }
    
    isGameActive = false;
    updateControlsUI();
    return true; 
}

async function startAutoGame() {
    if (autoGameActive) return stopAutoGame();
    const countVal = parseInt(autoCountInput.value);
    autoGamesRemaining = (isNaN(countVal) || countVal <= 0) ? Infinity : countVal;
    if (selectedNumbers.length === 0) return;
    autoGameActive = true;
    updateControlsUI();
    while (autoGameActive && autoGamesRemaining > 0) {
        currentBet = parseFloat(autoBetInput.value);
        if (currentBalance < currentBet) { stopAutoGame(); break; }
        await handlePlayKeno();
        if (autoGamesRemaining !== Infinity) autoGamesRemaining--;
        updateControlsUI(); 
        await sleep(500); 
    }
    stopAutoGame();
}

function stopAutoGame() { autoGameActive = false; autoGamesRemaining = 0; updateControlsUI(); }
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function animateReveal(drawnNumbers, selectedNumbers) {
    let currentHits = 0;
    for (const number of drawnNumbers) {
        await sleep(REVEAL_SPEED_MS);
        const cell = grid.querySelector(`.keno-cell[data-number="${number}"]`);
        if (!cell) continue;
        if (selectedNumbers.includes(number)) { cell.classList.add('hit'); cell.innerHTML = `<img src="assets/keno_paw.png" class="keno-cell-icon">`; currentHits++; }
        else cell.classList.add('drawn');
        updatePayoutScaleFill(currentHits);
    }
    await sleep(REVEAL_SPEED_MS * 2);
    for (let i = 1; i <= KENO_GRID_SIZE; i++) {
        if (selectedNumbers.includes(i) && !drawnNumbers.includes(i)) { grid.querySelector(`.keno-cell[data-number="${i}"]`).classList.add('miss'); }
    }
}

function instantReveal(drawnNumbers, selectedNumbers, hitsCount) {
    for (let i = 1; i <= KENO_GRID_SIZE; i++) {
        const cell = grid.querySelector(`.keno-cell[data-number="${i}"]`);
        const isSelected = selectedNumbers.includes(i);
        const isDrawn = drawnNumbers.includes(i);
        if (isSelected && isDrawn) { cell.classList.add('hit'); cell.innerHTML = `<img src="assets/keno_paw.png" class="keno-cell-icon">`; }
        else if (isSelected && !isDrawn) cell.classList.add('miss');
        else if (!isSelected && isDrawn) cell.classList.add('drawn');
    }
    updatePayoutScaleFill(hitsCount);
}

function setupBetActions(inputEl, halfBtn, doubleBtn) {
    if (halfBtn) halfBtn.addEventListener('click', () => inputEl.value = Math.max(1.00, (parseFloat(inputEl.value)||0)/2).toFixed(2));
    if (doubleBtn) doubleBtn.addEventListener('click', () => inputEl.value = Math.min(currentBalance, (parseFloat(inputEl.value)||0)*2).toFixed(2));
}

export function initKeno() {
    grid = document.getElementById('keno-grid');
    betInput = document.getElementById('keno-bet');
    playButton = document.getElementById('keno-play-button');
    clearButton = document.getElementById('keno-clear-button');
    autoPickButton = document.getElementById('keno-autopick-button');
    payoutBar = document.getElementById('keno-payout-bar');
    statusElement = document.getElementById('keno-status');
    betHalfButton = document.querySelector('#keno-manual-panel .bet-half');
    betDoubleButton = document.querySelector('#keno-manual-panel .bet-double');
    turboButton = document.getElementById('keno-turbo-button');
    kenoResultOverlay = document.getElementById('keno-result-overlay');
    kenoResultMultiplier = document.getElementById('keno-result-multiplier');
    kenoResultWinnings = document.getElementById('keno-result-winnings');
    riskButtons = document.querySelectorAll('.keno-risk-btn');
    tabButtons = document.querySelectorAll('.keno-tab-btn');
    manualPanel = document.getElementById('keno-manual-panel');
    autoPanel = document.getElementById('keno-auto-panel');
    autoStartButton = document.getElementById('keno-auto-start-button');
    autoCountInput = document.getElementById('keno-auto-count');
    autoBetInput = document.getElementById('keno-auto-bet');
    autoBetHalfBtn = document.querySelector('#keno-auto-panel .bet-half');
    autoBetDoubleBtn = document.querySelector('#keno-auto-panel .bet-double');

    if (!grid) return; 
    playButton.addEventListener('click', handlePlayKeno);
    clearButton.addEventListener('click', handleClear);
    autoPickButton.addEventListener('click', handleAutoPick);
    if (turboButton) turboButton.addEventListener('click', handleTurboToggle);
    if (autoStartButton) autoStartButton.addEventListener('click', startAutoGame);
    riskButtons.forEach(btn => btn.addEventListener('click', handleRiskSwitch));
    tabButtons.forEach(btn => btn.addEventListener('click', handleTabSwitch));
    if (kenoResultOverlay) kenoResultOverlay.addEventListener('click', () => kenoResultOverlay.classList.add('hidden'));
    setupBetActions(betInput, betHalfButton, betDoubleButton);
    setupBetActions(autoBetInput, autoBetHalfBtn, autoBetDoubleBtn);
    createGrid(); resetGame(true); 
}