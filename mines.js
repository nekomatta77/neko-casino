/*
 * (ИЗМЕНЕНО: ЗАДАЧА 1 - Добавлен "ШАГ #" в шкалу)
 */
import { currentBalance, updateBalance, MINES_GRID_SIZE, writeBetToHistory, currentUser, reduceWager } from './global.js';

// --- ЛОКАЛЬНЫЕ ПЕРЕМЕННЫЕ MINES ---
let isGameActive = false;
let currentMines = 3;
let currentBet = 10.00;
let safeCells = []; 
let revealedCount = 0;

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
function getMultiplierForSafeCells(safeCount, totalMines) {
    const total = MINES_GRID_SIZE; 
    const safe = total - totalMines; 

    if (safeCount === 0) return 1.00;
    if (safeCount > safe) return 0;

    let cumulativeMultiplier = 1.00;
    for (let i = 0; i < safeCount; i++) {
        const probability = (safe - i) / (total - i);
        const stepMultiplier = 0.99 / probability;
        cumulativeMultiplier *= stepMultiplier;
    }
    return parseFloat(cumulativeMultiplier.toFixed(2));
}

// --- ОСНОВНАЯ ЛОГИКА ---
function createMinesGrid() {
    const grid = document.getElementById('mines-grid');
    if (!grid) return;
    grid.innerHTML = ''; 
    
    for (let i = 0; i < MINES_GRID_SIZE; i++) {
        const cell = document.createElement('div');
        cell.classList.add('mine-cell', 'closed');
        cell.setAttribute('data-index', i);
        grid.appendChild(cell);
    }
}

// (ЗАДАЧА 1) Функция генерации списка множителей (Добавлен ШАГ)
function renderMultipliersBar(minesCount) {
    const bar = document.getElementById('mines-multipliers-bar');
    if (!bar) return;
    bar.innerHTML = '';

    const safeCountTotal = MINES_GRID_SIZE - minesCount;
    
    // Генерируем список для всех безопасных шагов
    for (let i = 1; i <= safeCountTotal; i++) {
        const mult = getMultiplierForSafeCells(i, minesCount);
        
        const item = document.createElement('div');
        item.classList.add('mines-multiplier-item');
        item.setAttribute('data-step', i);
        
        // ИЗМЕНЕНО: Добавлен .step-label
        item.innerHTML = `
            <span class="step-label">ШАГ ${i}</span>
            <span class="multiplier-value">${mult}x</span>
        `;
        
        bar.appendChild(item);
    }
}

// Обновление активного множителя в баре
function updateMultipliersBarUI() {
    const bar = document.getElementById('mines-multipliers-bar');
    if (!bar) return;

    const items = bar.querySelectorAll('.mines-multiplier-item');
    
    // Снимаем активный класс со всех
    items.forEach(item => item.classList.remove('active'));

    if (isGameActive && revealedCount > 0) {
        const currentItem = bar.querySelector(`.mines-multiplier-item[data-step="${revealedCount}"]`);
        if (currentItem) {
            currentItem.classList.add('active');
            currentItem.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }
}


async function startGame() {
    currentMines = parseInt(document.getElementById('mines-count-input').value); 

    if (currentBet <= 0 || isNaN(currentBet) || currentMines < 1 || currentMines > 24 || isNaN(currentMines)) {
        document.getElementById('mines-status').textContent = '⚠️ Проверьте ставку и количество мин (от 1 до 24)!';
        return;
    }
    
    if (currentBet > currentBalance) {
        const statusElement = document.getElementById('mines-status');
        statusElement.textContent = '⚠️ Недостаточно средств!';
        statusElement.classList.add('loss');
        return;
    }
    
    isGameActive = true;
    revealedCount = 0;
    
    // Мгновенное списание
    updateBalance(-currentBet);
    reduceWager(currentBet);
    
    createMinesGrid(); 
    placeMines(currentMines); 
    
    renderMultipliersBar(currentMines);
    
    const statusElement = document.getElementById('mines-status');
    statusElement.textContent = ''; 
    statusElement.classList.remove('win', 'loss'); 
    
    updateMinesUI(); 
    
    document.querySelectorAll('.mine-cell.closed').forEach(cell => {
        cell.addEventListener('click', handleCellClick, { once: true });
    });
}

function updateMinesUI() {
    const startButton = document.getElementById('mines-start-button');
    const cashoutButton = document.getElementById('mines-cashout-button');
    
    const controls = document.querySelector('.mines-controls');
    controls.style.opacity = isGameActive ? 0.5 : 1;
    controls.style.pointerEvents = isGameActive ? 'none' : 'auto';
    
    updateMultipliersBarUI();

    if (isGameActive) {
        const currentTotalMultiplier = getMultiplierForSafeCells(revealedCount, currentMines);
        const currentPayout = currentBet * currentTotalMultiplier;
        
        cashoutButton.textContent = `Забрать (${currentPayout.toFixed(2)} RUB)`;
        cashoutButton.classList.remove('hidden');
        startButton.classList.add('hidden');
        
    } else {
        cashoutButton.classList.add('hidden');
        startButton.classList.remove('hidden');
        cashoutButton.textContent = `Забрать`; 
    }
}

function placeMines(count) {
    const grid = document.getElementById('mines-grid');
    if (!grid) return;

    safeCells = Array(MINES_GRID_SIZE).fill(false);
    const mineIndices = new Set();
    
    while (mineIndices.size < count) {
        const randomIndex = Math.floor(Math.random() * MINES_GRID_SIZE);
        mineIndices.add(randomIndex);
    }

    mineIndices.forEach(index => {
        safeCells[index] = true; // true = Mine
    });
}

function showAllMines(didWin) {
    const cells = document.querySelectorAll('.mine-cell');
    cells.forEach((cell, index) => {
        cell.removeEventListener('click', handleCellClick);
        if (cell.classList.contains('closed')) {
            cell.classList.remove('closed');
            if (safeCells[index]) {
                cell.classList.add('bomb');
                cell.innerHTML = `<img src="assets/mines_mine.png" alt="Mine" class="mine-cell-icon">`;
            } else {
                cell.classList.add('safe');
                cell.innerHTML = `<img src="assets/mines_fish.png" alt="Fish" class="mine-cell-icon">`;
            }
        }
    });
}

function handleCellClick(e) {
    if (!isGameActive) return;

    const cell = e.currentTarget;
    const index = parseInt(cell.getAttribute('data-index'));

    if (safeCells[index]) {
        // BOMB
        cell.classList.remove('closed');
        cell.classList.add('bomb');
        cell.innerHTML = `<img src="assets/mines_mine.png" alt="Mine" class="mine-cell-icon">`;
        
        showAllMines(false);
        
        const statusElement = document.getElementById('mines-status');
        statusElement.textContent = `Проигрыш ${currentBet.toFixed(2)} RUB`;
        statusElement.classList.add('loss');
        
        const betData = {
            username: currentUser,
            game: 'mines',
            result: '💣 BOMB',
            betAmount: currentBet, 
            amount: -currentBet, 
            multiplier: '0.00x' 
        };
        writeBetToHistory(betData);
        
        endGame(false);
        
    } else {
        // SAFE
        cell.classList.remove('closed');
        cell.classList.add('safe');
        cell.innerHTML = `<img src="assets/mines_fish.png" alt="Fish" class="mine-cell-icon">`;
        revealedCount++;
        
        if (revealedCount === MINES_GRID_SIZE - currentMines) {
            cashoutGame(); 
        }
        
        updateMinesUI();
    }
}

async function cashoutGame() {
    if (!isGameActive) return;
    
    const finalMultiplier = getMultiplierForSafeCells(revealedCount, currentMines);
    const totalWinnings = currentBet * finalMultiplier;
    
    const netProfit = totalWinnings - currentBet;
    const betData = {
        username: currentUser,
        game: 'mines',
        result: `${finalMultiplier.toFixed(2)}x`,
        betAmount: currentBet, 
        amount: netProfit, 
        multiplier: `${finalMultiplier.toFixed(2)}x` 
    };
    
    writeBetToHistory(betData);
    updateBalance(totalWinnings); 
    
    showAllMines(true); 
    
    const statusElement = document.getElementById('mines-status');
    statusElement.textContent = `Выигрыш ${totalWinnings.toFixed(2)} RUB`;
    statusElement.classList.add('win');
    
    endGame(true);
}

function endGame(didWin) {
    isGameActive = false;
    updateMinesUI(); 
    revealedCount = 0;
}

document.addEventListener('DOMContentLoaded', () => {
    
    const startButton = document.getElementById('mines-start-button');
    if (startButton) {
        startButton.addEventListener('click', startGame);
    }
    
    const cashoutButton = document.getElementById('mines-cashout-button');
    if (cashoutButton) {
        cashoutButton.addEventListener('click', cashoutGame);
    }
    
    const betInput = document.getElementById('mines-bet');
    if (betInput) {
        betInput.addEventListener('input', () => {
            let newVal = parseFloat(betInput.value);
            if (isNaN(newVal)) newVal = 0; 
            currentBet = newVal; 
            updateMinesUI();
        });
        betInput.addEventListener('blur', () => {
            if (isNaN(currentBet) || currentBet < 1.00) {
                currentBet = 1.00;
            }
            betInput.value = currentBet.toFixed(2);
            updateMinesUI();
        });
    }
});

export function initMines() {
    const minesCountInput = document.getElementById('mines-count-input');
    const minesCountButtons = document.querySelectorAll('.mines-count-btn');

    if (minesCountInput && minesCountButtons) {
        const updateActiveButton = (count) => {
            let countAsInt = parseInt(count);
            minesCountButtons.forEach(btn => {
                if (btn.getAttribute('data-count') == countAsInt) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
            if (![5, 10, 15, 24].includes(countAsInt)) {
                minesCountButtons.forEach(btn => btn.classList.remove('active'));
            }
        };

        minesCountInput.value = currentMines;
        updateActiveButton(currentMines);

        minesCountButtons.forEach(button => {
            button.addEventListener('click', () => {
                const count = parseInt(button.getAttribute('data-count'));
                currentMines = count;
                minesCountInput.value = count;
                updateActiveButton(count);
                if (!isGameActive) { 
                    renderMultipliersBar(count);
                    updateMinesUI();
                }
            });
        });

        minesCountInput.addEventListener('input', () => {
            let val = parseInt(minesCountInput.value);
            if (val > 24) val = 24;
            if (isNaN(val) || val < 1) {
                currentMines = 1; 
            } else {
                currentMines = val;
            }
            updateActiveButton(currentMines);
            if (!isGameActive) {
                renderMultipliersBar(currentMines);
                updateMinesUI();
            }
        });
    }

    const betInput = document.getElementById('mines-bet');
    const betHalfButton = document.querySelector('.mines-controls .bet-half');
    const betDoubleButton = document.querySelector('.mines-controls .bet-double');

    if (betHalfButton) {
        betHalfButton.addEventListener('click', () => {
            let currentVal = parseFloat(betInput.value);
            if (isNaN(currentVal)) currentVal = 0;
            let newVal = Math.max(1.00, currentVal / 2); 
            betInput.value = newVal.toFixed(2);
            currentBet = newVal; 
            updateMinesUI();
        });
    }

    if (betDoubleButton) {
        betDoubleButton.addEventListener('click', () => {
            let currentVal = parseFloat(betInput.value);
            if (isNaN(currentVal)) currentVal = 0;
            let newVal = Math.min(currentBalance, currentVal * 2);
            betInput.value = newVal.toFixed(2);
            currentBet = newVal; 
            updateMinesUI();
        });
    }
    
    const betMinButton = document.querySelector('.mines-controls .bet-min');
    const betMaxButton = document.querySelector('.mines-controls .bet-max');
    
    if (betMinButton) {
        betMinButton.addEventListener('click', () => {
            let newVal = 1.00; 
            betInput.value = newVal.toFixed(2);
            currentBet = newVal; 
            updateMinesUI(); 
        });
    }
    
    if (betMaxButton) {
        betMaxButton.addEventListener('click', () => {
            let newVal = currentBalance; 
            betInput.value = newVal.toFixed(2);
            currentBet = newVal; 
            updateMinesUI(); 
        });
    }
    
    createMinesGrid(); 
    renderMultipliersBar(currentMines); 
    updateMinesUI();
}
