/*
 * (ИЗМЕНЕНО: ДОБАВЛЕНА ЛОГИКА КНОПКИ "ОТМЕНИТЬ", DECIMAL BETS)
 */
import { currentBalance, updateBalance, MINES_GRID_SIZE, writeBetToHistory, currentUser, reduceWager } from './global.js';

// --- ЛОКАЛЬНЫЕ ПЕРЕМЕННЫЕ MINES ---
let isGameActive = false;
let currentMines = 3;
let currentBet = 10.00;
let safeCells = []; 
let revealedCount = 0;

// --- ЭЛЕМЕНТЫ DOM ---
let mainButton;

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

function renderMultipliersBar(minesCount) {
    const bar = document.getElementById('mines-multipliers-bar');
    if (!bar) return;
    bar.innerHTML = '';

    const safeCountTotal = MINES_GRID_SIZE - minesCount;
    
    for (let i = 1; i <= safeCountTotal; i++) {
        const mult = getMultiplierForSafeCells(i, minesCount);
        
        const item = document.createElement('div');
        item.classList.add('mines-multiplier-item');
        item.setAttribute('data-step', i);
        
        item.innerHTML = `
            <span class="step-label">ШАГ ${i}</span>
            <span class="multiplier-value">${mult}x</span>
        `;
        
        bar.appendChild(item);
    }
}

function updateMultipliersBarUI() {
    const bar = document.getElementById('mines-multipliers-bar');
    if (!bar) return;

    const items = bar.querySelectorAll('.mines-multiplier-item');
    items.forEach(item => item.classList.remove('active'));

    if (isGameActive && revealedCount > 0) {
        const currentItem = bar.querySelector(`.mines-multiplier-item[data-step="${revealedCount}"]`);
        if (currentItem) {
            currentItem.classList.add('active');
            currentItem.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }
}

async function handleMainAction() {
    if (isGameActive) {
        // Если игра идет
        if (revealedCount === 0) {
            // Если ничего не открыто -> ОТМЕНИТЬ
            await cancelGame();
        } else {
            // Если что-то открыто -> ЗАБРАТЬ
            await cashoutGame();
        }
    } else {
        // Если игра не идет -> НАЧАТЬ
        await startGame();
    }
}


async function startGame() {
    const minesInput = document.getElementById('mines-count-input');
    const betInput = document.getElementById('mines-bet');
    
    currentMines = parseInt(minesInput.value); 
    currentBet = parseFloat(betInput.value);

    if (currentBet <= 0 || isNaN(currentBet) || currentMines < 1 || currentMines > 24 || isNaN(currentMines)) {
        document.getElementById('mines-status').textContent = '⚠️ Проверьте ставку и количество мин!';
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
    
    updateBalance(-currentBet);
    // reduceWager(currentBet); 
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

// Функция ОТМЕНЫ игры (возврат ставки)
async function cancelGame() {
    if (!isGameActive || revealedCount > 0) return;

    isGameActive = false;
    // Возвращаем ставку
    updateBalance(currentBet);
    
    const statusElement = document.getElementById('mines-status');
    statusElement.textContent = 'Ставка возвращена';
    
    updateMinesUI();
    
    // Сброс сетки
    createMinesGrid(); 
}


function updateMinesUI() {
    // Блокировка инпутов
    const inputs = document.querySelectorAll('#mines-game input, #mines-game .mines-count-btn, #mines-game .bet-half, #mines-game .bet-double');
    inputs.forEach(el => el.disabled = isGameActive);
    
    updateMultipliersBarUI();

    if (isGameActive) {
        if (revealedCount === 0) {
            // ВАРИАНТ 3: ИГРА ИДЕТ, НО ЯЧЕЙКИ НЕ ОТКРЫТЫ -> ОТМЕНИТЬ
            mainButton.textContent = `ОТМЕНИТЬ`;
            mainButton.classList.remove('cashout-mode');
            mainButton.classList.add('cancel-mode');
            mainButton.disabled = false; 
        } else {
            // ВАРИАНТ 2: ИГРА ИДЕТ, ЯЧЕЙКИ ОТКРЫТЫ -> ЗАБРАТЬ
            const currentTotalMultiplier = getMultiplierForSafeCells(revealedCount, currentMines);
            const currentPayout = currentBet * currentTotalMultiplier;
            
            mainButton.textContent = `ЗАБРАТЬ (${currentPayout.toFixed(2)} ₽)`;
            mainButton.classList.remove('cancel-mode');
            mainButton.classList.add('cashout-mode');
            mainButton.disabled = false;
        }
        
    } else {
        // ВАРИАНТ 1: ИГРА НЕ ИДЕТ -> НАЧАТЬ
        mainButton.textContent = `НАЧАТЬ ИГРУ`;
        mainButton.classList.remove('cashout-mode', 'cancel-mode');
        mainButton.disabled = false;
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
        // Удаляем листенеры, чтобы нельзя было кликнуть
        const newCell = cell.cloneNode(true);
        cell.parentNode.replaceChild(newCell, cell);
        
        if (newCell.classList.contains('closed')) {
            newCell.classList.remove('closed');
            if (safeCells[index]) {
                newCell.classList.add('bomb');
                newCell.innerHTML = `<img src="assets/mines_mine.png" alt="Mine" class="mine-cell-icon">`;
                if (!didWin) newCell.style.opacity = '1'; 
            } else {
                newCell.classList.add('safe');
                newCell.innerHTML = `<img src="assets/mines_fish.png" alt="Fish" class="mine-cell-icon">`;
                newCell.style.opacity = '0.5'; // Затеняем нераскрытые рыбы
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
        } else {
            updateMinesUI();
        }
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

export function initMines() {
    const minesCountInput = document.getElementById('mines-count-input');
    const minesCountButtons = document.querySelectorAll('.mines-count-btn');
    mainButton = document.getElementById('mines-main-button');

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
            // Если ввели число не из списка кнопок
            if (![3, 5, 10, 24].includes(countAsInt)) {
                minesCountButtons.forEach(btn => btn.classList.remove('active'));
            }
        };

        minesCountInput.value = currentMines;
        updateActiveButton(currentMines);

        minesCountButtons.forEach(button => {
            button.addEventListener('click', () => {
                if (isGameActive) return;
                const count = parseInt(button.getAttribute('data-count'));
                currentMines = count;
                minesCountInput.value = count;
                updateActiveButton(count);
                renderMultipliersBar(count);
            });
        });

        minesCountInput.addEventListener('input', () => {
            if (isGameActive) return;
            let val = parseInt(minesCountInput.value);
            if (val > 24) val = 24;
            if (isNaN(val) || val < 1) {
                // Don't update logic yet, wait for valid input
            } else {
                currentMines = val;
                updateActiveButton(val);
                renderMultipliersBar(val);
            }
        });
        
        // Blur validation
        minesCountInput.addEventListener('blur', () => {
            let val = parseInt(minesCountInput.value);
             if (isNaN(val) || val < 1) {
                 val = 1;
                 minesCountInput.value = 1;
             }
             currentMines = val;
             updateActiveButton(val);
             renderMultipliersBar(val);
        });
    }

    if (mainButton) {
        mainButton.addEventListener('click', handleMainAction);
    }

    const betInput = document.getElementById('mines-bet');
    const betHalfButton = document.querySelector('#mines-game .bet-half');
    const betDoubleButton = document.querySelector('#mines-game .bet-double');

    if (betHalfButton) {
        betHalfButton.addEventListener('click', () => {
            if(isGameActive) return;
            let currentVal = parseFloat(betInput.value);
            if (isNaN(currentVal)) currentVal = 0;
            // ИЗМЕНЕНО: toFixed(2)
            let newVal = Math.max(1.00, currentVal / 2).toFixed(2); 
            betInput.value = newVal;
            currentBet = newVal; 
        });
    }

    if (betDoubleButton) {
        betDoubleButton.addEventListener('click', () => {
            if(isGameActive) return;
            let currentVal = parseFloat(betInput.value);
            if (isNaN(currentVal)) currentVal = 0;
            // ИЗМЕНЕНО: toFixed(2)
            let newVal = Math.min(currentBalance, currentVal * 2).toFixed(2);
            betInput.value = newVal;
            currentBet = newVal; 
        });
    }
    
    createMinesGrid(); 
    renderMultipliersBar(currentMines); 
    updateMinesUI();
}
