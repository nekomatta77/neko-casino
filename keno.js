/*
 * (ИЗМЕНЕНО: УДАЛЕНА ЛОГИКА ТУРБО ИЗ АВТО-РЕЖИМА)
 */
import { currentBalance, updateBalance, writeBetToHistory, currentUser, reduceWager } from './global.js';

const KENO_GRID_SIZE = 40;
const KENO_DRAW_SIZE = 10; 
const MAX_SELECTION = 10;
const REVEAL_SPEED_MS = 150; 

const PAYOUT_TABLES = {
    easy: {
        1: { 1: 3.96 },
        2: { 1: 2, 2: 3.8 },
        3: { 1: 1, 2: 2.2, 3: 20 },
        4: { 1: 0, 2: 2, 3: 8.4, 4: 100 },
        5: { 1: 0, 2: 1.5, 3: 3.6, 4: 20, 5: 250 },
        6: { 1: 0, 2: 1, 3: 2, 4: 7.5, 5: 100, 6: 700 },
        7: { 1: 0, 2: 1.2, 3: 1.6, 4: 3.5, 5: 15, 6: 225, 7: 700 },
        8: { 1: 0, 2: 1.1, 3: 1.5, 4: 2, 5: 3.5, 6: 39, 7: 100, 8: 800 },
        9: { 1: 0, 2: 1.2, 3: 1.3, 4: 1.7, 5: 2.5, 6: 7.5, 7: 50, 8: 250, 9: 1000 },
        10: { 1: 0, 2: 1.1, 3: 1.2, 4: 1.3, 5: 1.8, 6: 3.5, 7: 13, 8: 50, 9: 250, 10: 1000 }
    },
    medium: { 1: {1:3.96}, 2:{1:1.8,2:5.1}, 3:{2:2.8,3:50}, 4:{2:1.1,3:13.3,4:100}, 5:{2:1,3:3,4:35,5:350}, 6:{3:3,4:9,5:180,6:710}, 7:{3:2,4:7,5:30,6:400,7:800}, 8:{3:2,4:4,5:11,6:67,7:400,8:900}, 9:{3:2,4:2.5,5:5,6:15,7:100,8:500,9:1000}, 10:{3:1.6,4:2,5:4,6:7,7:25,8:100,9:500,10:1000} },
    high: { 1: {1:3.96}, 2:{2:17.1}, 3:{3:81.5}, 4:{3:10,4:259}, 5:{3:4.5,4:48,5:450}, 6:{4:11,5:350,6:710}, 7:{4:7,5:90,6:400,7:800}, 8:{4:5,5:20,6:270,7:600,8:900}, 9:{4:4,5:11,6:56,7:500,8:800,9:1000}, 10:{4:3.5,5:8,6:13,7:64,8:500,9:800,10:1000} }
};

let isGameActive = false;
let currentBet = 10.00;
let currentRisk = 'easy'; 
let selectedNumbers = []; 
let drawnNumbers = []; 
let isTurboMode = false; 
let isAutoMode = false; // Режим авто-игры

// Элементы DOM
let grid, betInput, playButton, clearButton, autoPickButton, payoutBar, statusElement;
let betHalfButton, betDoubleButton;
let kenoResultOverlay, kenoResultMultiplier, kenoResultWinnings;
let turboButton, turboIcon;
let riskButtons;
let tabButtons, manualPanel, autoPanel;

// Элементы Авто-игры
let autoGameActive = false;
let autoGamesRemaining = 0;
let autoStartButton, autoCountInput, autoBetInput;
let autoBetHalfBtn, autoBetDoubleBtn;

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
        
        item.innerHTML = `
            <div class="keno-paw-wrapper">
                <img src="assets/grey_paw.png" alt="x" class="paw-grey">
                <img src="assets/keno_paw.png" alt="HIT" class="paw-color">
            </div>
            <span class="keno-gem-mult">x${multiplier}</span>
        `;
        payoutBar.appendChild(item);
    }
}

function updatePayoutScaleFill(hitCount) {
    const items = payoutBar.querySelectorAll('.keno-gem-item');
    
    items.forEach(item => {
        const itemHits = parseInt(item.getAttribute('data-hit-count'));
        
        item.classList.remove('active');
        if (itemHits <= hitCount) {
            item.classList.add('active');
        }
    });
}

function updateControlsUI() {
    const selectionCount = selectedNumbers.length;
    const bet = isAutoMode ? parseFloat(autoBetInput.value) : parseFloat(betInput.value);

    // Логика для ручного режима
    playButton.disabled = (selectionCount === 0) || isGameActive || autoGameActive;
    autoPickButton.disabled = isGameActive || autoGameActive;
    clearButton.disabled = (selectionCount === 0) || isGameActive || autoGameActive;
    
    if (selectionCount > 0) {
        playButton.textContent = `СДЕЛАТЬ СТАВКУ`;
    } else {
        playButton.textContent = `ВЫБЕРИТЕ ЧИСЛА`;
    }

    // Логика для авто режима
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

    if (isGameActive || autoGameActive) {
        grid.classList.add('disabled');
        tabButtons.forEach(btn => btn.disabled = true);
    } else {
        grid.classList.remove('disabled');
        tabButtons.forEach(btn => btn.disabled = false);
    }
}

function resetGame(clearSelection = true) {
    // Не сбрасываем isGameActive здесь, это делает caller
    drawnNumbers = [];

    if (kenoResultOverlay) kenoResultOverlay.classList.add('hidden');
    
    grid.querySelectorAll('.keno-cell').forEach(cell => {
        cell.classList.remove('hit', 'miss', 'drawn', 'idle', 'win');
        cell.innerHTML = cell.getAttribute('data-number');
        if (clearSelection) cell.classList.remove('selected');
    });
    
    if (statusElement) {
        statusElement.textContent = '';
        statusElement.classList.remove('win', 'loss');
    }
    
    if (clearSelection) selectedNumbers = [];
    
    updatePayoutTableUI();
    
    const items = payoutBar.querySelectorAll('.keno-gem-item');
    items.forEach(i => i.classList.remove('active'));
    
    updateControlsUI();
}

function handleCellClick(e) {
    if (isGameActive || autoGameActive) return;
    
    grid.querySelectorAll('.keno-cell').forEach(c => {
        c.classList.remove('hit', 'miss', 'drawn', 'idle', 'win');
        c.innerHTML = c.getAttribute('data-number');
    });
    if (kenoResultOverlay) kenoResultOverlay.classList.add('hidden');
    if (statusElement) statusElement.textContent = '';

    const cell = e.currentTarget;
    const number = parseInt(cell.getAttribute('data-number'));
    const index = selectedNumbers.indexOf(number);

    if (index > -1) {
        selectedNumbers.splice(index, 1);
        cell.classList.remove('selected');
    } else {
        if (selectedNumbers.length < MAX_SELECTION) {
            selectedNumbers.push(number);
            cell.classList.add('selected');
        }
    }
    
    updatePayoutScaleFill(-1); 
    updatePayoutTableUI();
    updateControlsUI();
}

function handleClear() {
    if (isGameActive || autoGameActive) return;
    resetGame(true); 
}

function handleAutoPick() {
    if (isGameActive || autoGameActive) return;
    handleClear();
    let availableNumbers = Array.from({ length: KENO_GRID_SIZE }, (_, i) => i + 1);
    for (let i = 0; i < MAX_SELECTION; i++) {
        const randomIndex = Math.floor(Math.random() * availableNumbers.length);
        const number = availableNumbers.splice(randomIndex, 1)[0];
        selectedNumbers.push(number);
        const cell = grid.querySelector(`.keno-cell[data-number="${number}"]`);
        if (cell) cell.classList.add('selected');
    }
    updatePayoutTableUI();
    updateControlsUI();
}

function handleTurboToggle() {
    isTurboMode = !isTurboMode;
    const img1 = turboButton.querySelector('img');
    // const img2 = autoTurboButton.querySelector('img'); // REMOVED
    const src = isTurboMode ? 'assets/thunder_on.png' : 'assets/thunder_off.png';
    
    img1.src = src;
    // img2.src = src; // REMOVED
    
    if (isTurboMode) {
        turboButton.classList.add('active');
        // autoTurboButton.classList.add('active'); // REMOVED
    } else {
        turboButton.classList.remove('active');
        // autoTurboButton.classList.remove('active'); // REMOVED
    }
}

function handleTabSwitch(e) {
    if (isGameActive || autoGameActive) return;
    const mode = e.currentTarget.getAttribute('data-mode');
    
    tabButtons.forEach(btn => btn.classList.remove('active'));
    e.currentTarget.classList.add('active');
    
    if (mode === 'manual') {
        manualPanel.classList.remove('hidden');
        autoPanel.classList.add('hidden');
        isAutoMode = false;
    } else {
        manualPanel.classList.add('hidden');
        autoPanel.classList.remove('hidden');
        isAutoMode = true;
    }
    updateControlsUI();
}

function handleRiskSwitch(e) {
    if (isGameActive || autoGameActive) return;
    const risk = e.currentTarget.getAttribute('data-risk');
    currentRisk = risk;
    
    riskButtons.forEach(btn => btn.classList.remove('active'));
    e.currentTarget.classList.add('active');
    
    updatePayoutTableUI();
}

// Возвращает Promise для ожидания завершения игры
async function handlePlayKeno() {
    // Определяем ставку в зависимости от режима
    currentBet = isAutoMode ? parseFloat(autoBetInput.value) : parseFloat(betInput.value);
    
    if (selectedNumbers.length === 0 || currentBet <= 0 || isNaN(currentBet) || currentBet > currentBalance) {
        if (autoGameActive) stopAutoGame();
        return;
    }

    resetGame(false); 
    isGameActive = true;
    updateControlsUI(); 
    updateBalance(-currentBet);
    reduceWager(currentBet);

    drawnNumbers = [];
    const numberPool = Array.from({ length: KENO_GRID_SIZE }, (_, i) => i + 1);
    for (let i = 0; i < KENO_DRAW_SIZE; i++) {
        const randomIndex = Math.floor(Math.random() * numberPool.length);
        drawnNumbers.push(numberPool.splice(randomIndex, 1)[0]);
    }

    let hitsCount = 0;
    if (isTurboMode) {
        hitsCount = calculateHits(drawnNumbers, selectedNumbers);
        instantReveal(drawnNumbers, selectedNumbers, hitsCount);
    } else {
        hitsCount = await animateReveal(drawnNumbers, selectedNumbers);
    }

    const picksCount = selectedNumbers.length;
    const multiplier = PAYOUT_TABLES[currentRisk][picksCount][hitsCount] || 0;
    const winnings = currentBet * multiplier;
    
    if (winnings > 0) updateBalance(winnings);

    writeBetToHistory({
        username: currentUser,
        game: 'keno',
        result: `${hitsCount}/${picksCount} (${multiplier.toFixed(2)}x)`,
        betAmount: currentBet,
        amount: winnings - currentBet,
        multiplier: `${multiplier.toFixed(2)}x`
    });
    
    // Показываем результат только в ручном режиме или в конце автоигры (по желанию, пока скрываем оверлей в авто, чтобы не мешал)
    if (!autoGameActive && kenoResultOverlay && kenoResultMultiplier && kenoResultWinnings) {
        kenoResultMultiplier.textContent = `${multiplier.toFixed(2)}x`;
        kenoResultWinnings.textContent = `${winnings.toFixed(2)} RUB`;
        kenoResultOverlay.classList.remove('win', 'loss');
        if (winnings > 0) kenoResultOverlay.classList.add('win');
        else kenoResultOverlay.classList.add('loss');
        kenoResultOverlay.classList.remove('hidden');
    }
    
    isGameActive = false;
    updateControlsUI();
    return true; // Игра завершена успешно
}

async function startAutoGame() {
    if (autoGameActive) {
        stopAutoGame();
        return;
    }
    
    const countVal = parseInt(autoCountInput.value);
    autoGamesRemaining = (isNaN(countVal) || countVal <= 0) ? Infinity : countVal;
    
    if (selectedNumbers.length === 0) return;
    
    autoGameActive = true;
    updateControlsUI();
    
    while (autoGameActive && autoGamesRemaining > 0) {
        // Проверка баланса перед игрой
        currentBet = parseFloat(autoBetInput.value);
        if (currentBalance < currentBet) {
            stopAutoGame();
            break;
        }
        
        await handlePlayKeno();
        
        if (autoGamesRemaining !== Infinity) {
            autoGamesRemaining--;
        }
        updateControlsUI(); // Обновляем счетчик на кнопке
        
        await sleep(500); // Всегда используем стандартную задержку, игнорируя isTurboMode
    }
    
    stopAutoGame();
}

function stopAutoGame() {
    autoGameActive = false;
    autoGamesRemaining = 0;
    updateControlsUI();
}


function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function animateReveal(drawnNumbers, selectedNumbers) {
    let currentHits = 0;
    for (const number of drawnNumbers) {
        await sleep(REVEAL_SPEED_MS);
        const cell = grid.querySelector(`.keno-cell[data-number="${number}"]`);
        if (!cell) continue;

        const isSelected = selectedNumbers.includes(number);
        if (isSelected) {
            cell.classList.add('hit'); 
            cell.innerHTML = `<img src="assets/keno_paw.png" class="keno-cell-icon">`;
            currentHits++;
        } else {
            cell.classList.add('drawn');
        }
        updatePayoutScaleFill(currentHits);
    }
    await sleep(REVEAL_SPEED_MS * 2);
    for (let i = 1; i <= KENO_GRID_SIZE; i++) {
        if (selectedNumbers.includes(i) && !drawnNumbers.includes(i)) {
             const cell = grid.querySelector(`.keno-cell[data-number="${i}"]`);
             if(cell) cell.classList.add('miss');
        }
    }
    return currentHits; 
}

function calculateHits(drawn, selected) {
    let hits = 0;
    for (const number of drawn) { if (selected.includes(number)) hits++; }
    return hits;
}

function instantReveal(drawnNumbers, selectedNumbers, hitsCount) {
    for (let i = 1; i <= KENO_GRID_SIZE; i++) {
        const cell = grid.querySelector(`.keno-cell[data-number="${i}"]`);
        if (!cell) continue;
        const isSelected = selectedNumbers.includes(i);
        const isDrawn = drawnNumbers.includes(i);

        if (isSelected && isDrawn) {
            cell.classList.add('hit');
            cell.innerHTML = `<img src="assets/keno_paw.png" class="keno-cell-icon">`;
        } else if (isSelected && !isDrawn) {
            cell.classList.add('miss');
        } else if (!isSelected && isDrawn) {
            cell.classList.add('drawn');
        }
    }
    updatePayoutScaleFill(hitsCount);
}

function setupBetActions(inputEl, halfBtn, doubleBtn) {
    if (halfBtn) {
        halfBtn.addEventListener('click', () => {
            let val = parseFloat(inputEl.value) || 0;
            inputEl.value = Math.max(1.00, val / 2).toFixed(0);
        });
    }
    if (doubleBtn) {
        doubleBtn.addEventListener('click', () => {
            let val = parseFloat(inputEl.value) || 0;
            inputEl.value = Math.min(currentBalance, val * 2).toFixed(0);
        });
    }
}

export function initKeno() {
    grid = document.getElementById('keno-grid');
    betInput = document.getElementById('keno-bet');
    playButton = document.getElementById('keno-play-button');
    clearButton = document.getElementById('keno-clear-button');
    autoPickButton = document.getElementById('keno-autopick-button');
    payoutBar = document.getElementById('keno-payout-bar');
    statusElement = document.getElementById('keno-status');
    
    // Кнопки модификаторов ручного режима
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
    
    // Элементы авто режима
    autoStartButton = document.getElementById('keno-auto-start-button');
    autoCountInput = document.getElementById('keno-auto-count');
    // autoTurboButton = document.getElementById('keno-auto-turbo-button'); // REMOVED
    autoBetInput = document.getElementById('keno-auto-bet');
    autoBetHalfBtn = document.querySelector('#keno-auto-panel .bet-half');
    autoBetDoubleBtn = document.querySelector('#keno-auto-panel .bet-double');

    if (!grid) return; 

    // Слушатели
    playButton.addEventListener('click', handlePlayKeno);
    clearButton.addEventListener('click', handleClear);
    autoPickButton.addEventListener('click', handleAutoPick);
    
    if (turboButton) turboButton.addEventListener('click', handleTurboToggle);
    // if (autoTurboButton) autoTurboButton.addEventListener('click', handleTurboToggle); // REMOVED
    if (autoStartButton) autoStartButton.addEventListener('click', startAutoGame);
    
    riskButtons.forEach(btn => btn.addEventListener('click', handleRiskSwitch));
    tabButtons.forEach(btn => btn.addEventListener('click', handleTabSwitch));
    
    if (kenoResultOverlay) kenoResultOverlay.addEventListener('click', () => kenoResultOverlay.classList.add('hidden'));
    
    // Настройка кнопок ставок для обоих режимов
    setupBetActions(betInput, betHalfButton, betDoubleButton);
    setupBetActions(autoBetInput, autoBetHalfBtn, autoBetDoubleBtn);

    createGrid();
    resetGame(true); 
}
