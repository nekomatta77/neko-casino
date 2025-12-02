/*
 * MINES.JS - С ВНЕДРЕННЫМ ANTI-MINUS
 */
import { currentBalance, updateBalance, MINES_GRID_SIZE, writeBetToHistory, currentUser, reduceWager, AntiMinus } from './global.js';

let isGameActive = false;
let currentMines = 3;
let currentBet = 10.00;
let safeCells = []; 
let revealedCount = 0;
let mainButton;

function getMultiplierForSafeCells(safeCount, totalMines) {
    const total = MINES_GRID_SIZE; 
    const safe = total - totalMines; 
    if (safeCount === 0) return 1.00;
    if (safeCount > safe) return 0;
    let cumulativeMultiplier = 1.00;
    for (let i = 0; i < safeCount; i++) {
        const probability = (safe - i) / (total - i);
        cumulativeMultiplier *= (0.99 / probability);
    }
    return parseFloat(cumulativeMultiplier.toFixed(2));
}

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
        item.innerHTML = `<span class="step-label">ШАГ ${i}</span><span class="multiplier-value">${mult}x</span>`;
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
        if (revealedCount === 0) await cancelGame();
        else await cashoutGame();
    } else await startGame();
}

async function startGame() {
    const minesInput = document.getElementById('mines-count-input');
    const betInput = document.getElementById('mines-bet');
    currentMines = parseInt(minesInput.value); 
    currentBet = parseFloat(betInput.value);

    if (currentBet <= 0 || isNaN(currentBet) || currentMines < 1 || currentMines > 24) return;
    if (currentBet > currentBalance) {
        const statusElement = document.getElementById('mines-status');
        statusElement.textContent = '⚠️ Недостаточно средств!';
        statusElement.classList.add('loss');
        return;
    }
    
    isGameActive = true;
    revealedCount = 0;
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

async function cancelGame() {
    if (!isGameActive || revealedCount > 0) return;
    isGameActive = false;
    updateBalance(currentBet);
    document.getElementById('mines-status').textContent = 'Ставка возвращена';
    updateMinesUI();
    createMinesGrid(); 
}

function updateMinesUI() {
    const inputs = document.querySelectorAll('#mines-game input, #mines-game .mines-count-btn, #mines-game .bet-half, #mines-game .bet-double');
    inputs.forEach(el => el.disabled = isGameActive);
    updateMultipliersBarUI();

    if (isGameActive) {
        if (revealedCount === 0) {
            mainButton.textContent = `ОТМЕНИТЬ`;
            mainButton.classList.remove('cashout-mode');
            mainButton.classList.add('cancel-mode');
            mainButton.disabled = false; 
        } else {
            const currentTotalMultiplier = getMultiplierForSafeCells(revealedCount, currentMines);
            const currentPayout = currentBet * currentTotalMultiplier;
            mainButton.textContent = `ЗАБРАТЬ (${currentPayout.toFixed(2)} ₽)`;
            mainButton.classList.remove('cancel-mode');
            mainButton.classList.add('cashout-mode');
            mainButton.disabled = false;
        }
    } else {
        mainButton.textContent = `НАЧАТЬ ИГРУ`;
        mainButton.classList.remove('cashout-mode', 'cancel-mode');
        mainButton.disabled = false;
    }
}

function placeMines(count) {
    safeCells = Array(MINES_GRID_SIZE).fill(false); // false = Safe (initially empty)
    const mineIndices = new Set();
    while (mineIndices.size < count) {
        mineIndices.add(Math.floor(Math.random() * MINES_GRID_SIZE));
    }
    mineIndices.forEach(index => safeCells[index] = true); // true = Mine
}

function showAllMines(didWin) {
    const cells = document.querySelectorAll('.mine-cell');
    cells.forEach((cell, index) => {
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
                newCell.style.opacity = '0.5'; 
            }
        }
    });
}

function handleCellClick(e) {
    if (!isGameActive) return;
    const cell = e.currentTarget;
    const index = parseInt(cell.getAttribute('data-index'));

    let isBomb = safeCells[index];

    // --- ANTI-MINUS LOGIC ---
    if (!isBomb) {
        const nextMultiplier = getMultiplierForSafeCells(revealedCount + 1, currentMines);
        const potentialProfit = (currentBet * nextMultiplier) - currentBet;
        
        if (!AntiMinus.canUserWin(potentialProfit, currentBet)) {
            console.warn("Mines: Forced Bomb by Anti-Minus");
            safeCells[index] = true;
            isBomb = true;
            for(let i=0; i<MINES_GRID_SIZE; i++) {
                if(safeCells[i] && i !== index) { 
                    safeCells[i] = false; 
                    break;
                }
            }
        }
    }
    // ------------------------

    if (isBomb) {
        cell.classList.remove('closed');
        cell.classList.add('bomb');
        cell.innerHTML = `<img src="assets/mines_mine.png" alt="Mine" class="mine-cell-icon">`;
        showAllMines(false);
        document.getElementById('mines-status').textContent = `Проигрыш ${currentBet.toFixed(2)} RUB`;
        document.getElementById('mines-status').classList.add('loss');
        
        // UPDATED: Store Mine Count in Result String
        writeBetToHistory({
            username: currentUser, game: 'mines', result: `(${currentMines} Mines) 0.00x`, betAmount: currentBet, amount: -currentBet, multiplier: '0.00x'
        });
        endGame(false);
    } else {
        cell.classList.remove('closed');
        cell.classList.add('safe');
        cell.innerHTML = `<img src="assets/mines_fish.png" alt="Fish" class="mine-cell-icon">`;
        revealedCount++;
        if (revealedCount === MINES_GRID_SIZE - currentMines) cashoutGame(); 
        else updateMinesUI();
    }
}

async function cashoutGame() {
    if (!isGameActive) return;
    const finalMultiplier = getMultiplierForSafeCells(revealedCount, currentMines);
    const totalWinnings = currentBet * finalMultiplier;
    const netProfit = totalWinnings - currentBet;
    
    updateBalance(totalWinnings); 
    
    // UPDATED: Store Mine Count in Result String
    writeBetToHistory({
        username: currentUser, game: 'mines', result: `(${currentMines} Mines) ${finalMultiplier.toFixed(2)}x`, betAmount: currentBet, amount: netProfit, multiplier: `${finalMultiplier.toFixed(2)}x`
    });
    
    showAllMines(true); 
    document.getElementById('mines-status').textContent = `Выигрыш ${totalWinnings.toFixed(2)} RUB`;
    document.getElementById('mines-status').classList.add('win');
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
                if (btn.getAttribute('data-count') == countAsInt) btn.classList.add('active');
                else btn.classList.remove('active');
            });
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
            if (!isNaN(val) && val >= 1) {
                currentMines = val;
                updateActiveButton(val);
                renderMultipliersBar(val);
            }
        });
    }
    if (mainButton) mainButton.addEventListener('click', handleMainAction);
    const betInput = document.getElementById('mines-bet');
    const betHalfButton = document.querySelector('#mines-game .bet-half');
    const betDoubleButton = document.querySelector('#mines-game .bet-double');
    if (betHalfButton) betHalfButton.addEventListener('click', () => {
        if(isGameActive) return;
        let val = parseFloat(betInput.value) || 0;
        betInput.value = Math.max(1.00, val / 2).toFixed(2);
        currentBet = parseFloat(betInput.value);
    });
    if (betDoubleButton) betDoubleButton.addEventListener('click', () => {
        if(isGameActive) return;
        let val = parseFloat(betInput.value) || 0;
        betInput.value = Math.min(currentBalance, val * 2).toFixed(2);
        currentBet = parseFloat(betInput.value);
    });
    createMinesGrid(); 
    renderMultipliersBar(currentMines); 
    updateMinesUI();
}