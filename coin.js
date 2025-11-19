/*
 * (ИЗМЕНЕНО: DECIMAL BETS)
 */
import { currentBalance, updateBalance, writeBetToHistory, currentUser, reduceWager } from './global.js';

// --- ЛОКАЛЬНЫЕ ПЕРЕМЕННЫЕ COINFLIP ---
let isGameActive = false;
let currentBet = 10.00;
let currentLevel = 0; 
let currentPayout = 0.00; 
let isFlipping = false; 

const MULTIPLIERS = Array.from({ length: 30 }, (_, i) => ((i + 1) * 1.80).toFixed(2));

// --- ЭЛЕМЕНТЫ DOM ---
let betInput, choiceOrelBtn, choiceReshkaBtn, cashoutBtn, choiceWrapper, statusElement, coinFlipper, startButton;
let betHalfBtn, betDoubleBtn;

function renderCoinMultipliers() {
    const bar = document.querySelector('.coin-multipliers-bar');
    if (!bar) return;
    bar.innerHTML = ''; 
    MULTIPLIERS.forEach((mult, index) => {
        const level = index + 1;
        const item = document.createElement('div');
        item.classList.add('coin-multiplier-item');
        item.setAttribute('data-level', level);
        item.innerHTML = `
            <span class="coin-step-label">ШАГ ${level}</span>
            <span class="value">${mult}x</span>
        `;
        bar.appendChild(item);
    });
}

function updateControlsUI() {
    const betInputRow = document.querySelector('#coin-game .keno-bet-input-row');
    
    if (isGameActive) {
        // Игра идет:
        startButton.classList.add('hidden');
        
        // Блокируем инпут ставки
        if(betInputRow) betInputRow.style.pointerEvents = 'none';
        if(betInputRow) betInputRow.style.opacity = '0.5';
        
        if (currentLevel === 0) {
            // СТАРТ ИГРЫ (0 побед):
            choiceWrapper.classList.remove('hidden');
            
            // ВАЖНО: Скрываем кнопку "Забрать", она недоступна на 0 шаге
            cashoutBtn.classList.add('hidden'); 
            cashoutBtn.disabled = true; 
        } else {
            // ЕСТЬ ПОБЕДА (currentLevel > 0):
            choiceWrapper.classList.remove('hidden');
            
            // ВАЖНО: Показываем кнопку "Забрать"
            cashoutBtn.classList.remove('hidden');
            cashoutBtn.disabled = false; 
            
            cashoutBtn.innerHTML = `ЗАБРАТЬ<br><span style="font-size: 0.9em;">${currentPayout.toFixed(2)} RUB</span>`;
        }

    } else {
        // ИГРА НЕ ИДЕТ:
        startButton.classList.remove('hidden'); 
        choiceWrapper.classList.add('hidden');
        
        // Скрываем и блокируем кнопку "Забрать"
        cashoutBtn.classList.add('hidden');     
        cashoutBtn.disabled = true;
        
        // Разблокируем инпут
        if(betInputRow) betInputRow.style.pointerEvents = 'auto';
        if(betInputRow) betInputRow.style.opacity = '1';
        
        currentLevel = 0;
        currentPayout = 0.00;
        updateMultiplierHighlight();
    }
    
    // Блокировка во время анимации монетки
    if (isFlipping) {
        choiceWrapper.style.pointerEvents = 'none';
        choiceWrapper.style.opacity = 0.5;
        cashoutBtn.disabled = true; // Блокируем "Забрать" во время анимации
    } else if (isGameActive && currentLevel > 0) {
        choiceWrapper.style.pointerEvents = 'auto';
        choiceWrapper.style.opacity = 1;
        cashoutBtn.disabled = false; // Разблокируем после анимации, если есть выигрыш
    } else if (isGameActive) {
        choiceWrapper.style.pointerEvents = 'auto';
        choiceWrapper.style.opacity = 1;
    }
}

function updateMultiplierHighlight() {
    const items = document.querySelectorAll('.coin-multiplier-item');
    items.forEach((item, index) => {
        const level = parseInt(item.getAttribute('data-level'));
        if (level === currentLevel) {
            item.classList.add('active');
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        } else {
            item.classList.remove('active');
        }
    });
}

function handleStartGame() {
    if (isFlipping || isGameActive) return;

    currentBet = parseFloat(betInput.value);
    
    if (currentBet <= 0 || isNaN(currentBet)) {
        statusElement.textContent = '⚠️ Неверная ставка!';
        statusElement.classList.add('loss'); 
        return;
    }
    if (currentBet > currentBalance) {
        statusElement.textContent = '⚠️ Недостаточно средств!';
        statusElement.classList.add('loss'); 
        return;
    }
    
    updateBalance(-currentBet);
    reduceWager(currentBet);
    
    statusElement.textContent = 'Выберите сторону';
    statusElement.classList.remove('win', 'loss');
    
    isGameActive = true;
    currentLevel = 0;
    
    updateControlsUI();
}

async function handleChoice(e) {
    if (isFlipping || !isGameActive) return; 

    const choice = e.currentTarget.getAttribute('data-choice'); 
    isFlipping = true;
    updateControlsUI(); // Блокирует кнопки
    
    const result = Math.random() < 0.5 ? 'orel' : 'reshka';
    
    playFlipAnimation(result, async () => {
        if (result === choice) {
            currentLevel++;
            
            if (currentLevel > MULTIPLIERS.length) {
                statusElement.textContent = `Максимальный выигрыш!`;
                statusElement.classList.add('win');
                await handleCashout(); 
                return;
            }
            
            const currentMultiplier = parseFloat(MULTIPLIERS[currentLevel - 1]);
            currentPayout = currentBet * currentMultiplier;
            
            statusElement.textContent = `Вы угадали! (x${currentMultiplier.toFixed(2)})`;
            statusElement.classList.remove('win', 'loss');
            statusElement.classList.add('win');
            
        } else {
            statusElement.textContent = `Проигрыш ${currentBet.toFixed(2)} RUB`; 
            statusElement.classList.add('loss');
            statusElement.classList.remove('win');
            
            writeBetToHistory({
                username: currentUser,
                game: 'coin',
                result: '❌ Loss',
                betAmount: currentBet,
                amount: -currentBet,
                multiplier: '0.00x'
            });
            
            isGameActive = false;
        }
        
        isFlipping = false;
        updateControlsUI(); // Разблокирует и обновит
        updateMultiplierHighlight();
    });
}

async function handleCashout() {
    if (isFlipping || !isGameActive) return;

    const finalMultiplier = parseFloat(MULTIPLIERS[currentLevel - 1] || 0);
    const netProfit = currentPayout - currentBet;

    updateBalance(currentPayout);
    
    writeBetToHistory({
        username: currentUser,
        game: 'coin',
        result: `${finalMultiplier.toFixed(2)}x`,
        betAmount: currentBet,
        amount: netProfit,
        multiplier: `${finalMultiplier.toFixed(2)}x`
    });
    
    statusElement.textContent = `Выигрыш ${currentPayout.toFixed(2)} RUB`;
    statusElement.classList.add('win');
    statusElement.classList.remove('loss');
    
    isGameActive = false;
    isFlipping = false;
    updateControlsUI();
}

function playFlipAnimation(result, onComplete) {
    if (!coinFlipper) return;
    
    coinFlipper.classList.remove('flip-orel', 'flip-reshka');
    void coinFlipper.offsetWidth; 

    if (result === 'orel') {
        coinFlipper.classList.add('flip-orel'); 
    } else {
        coinFlipper.classList.add('flip-reshka'); 
    }

    setTimeout(onComplete, 1500);
}

export function initCoin() {
    betInput = document.getElementById('coin-bet');
    startButton = document.getElementById('coin-start-button');
    choiceWrapper = document.getElementById('coin-choice-buttons');
    choiceOrelBtn = document.getElementById('coin-choice-orel');
    choiceReshkaBtn = document.getElementById('coin-choice-reshka');
    cashoutBtn = document.getElementById('coin-cashout-button');
    statusElement = document.getElementById('coin-status');
    coinFlipper = document.getElementById('coin-flipper');
    
    betHalfBtn = document.querySelector('#coin-game .bet-half');
    betDoubleBtn = document.querySelector('#coin-game .bet-double');

    renderCoinMultipliers();

    if (!startButton) return; 
    
    startButton.addEventListener('click', handleStartGame);
    
    choiceOrelBtn.addEventListener('click', handleChoice);
    choiceReshkaBtn.addEventListener('click', handleChoice);
    
    cashoutBtn.addEventListener('click', handleCashout);

    if (betHalfBtn) {
        betHalfBtn.addEventListener('click', () => {
            if(isGameActive) return;
            let currentVal = parseFloat(betInput.value) || 0;
            // ИЗМЕНЕНО: toFixed(2)
            betInput.value = Math.max(1.00, currentVal / 2).toFixed(2);
        });
    }

    if (betDoubleBtn) {
        betDoubleBtn.addEventListener('click', () => {
            if(isGameActive) return;
            let currentVal = parseFloat(betInput.value) || 0;
            // ИЗМЕНЕНО: toFixed(2)
            betInput.value = Math.min(currentBalance, currentVal * 2).toFixed(2);
        });
    }
    
    // Принудительный сброс при инициализации
    isGameActive = false;
    currentLevel = 0;
    updateControlsUI();
}
