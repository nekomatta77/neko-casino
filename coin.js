/*
 * (ИЗМЕНЕНО: НОВЫЙ ДИЗАЙН ПАНЕЛИ)
 */
import { currentBalance, updateBalance, writeBetToHistory, currentUser, reduceWager } from './global.js';

// --- ЛОКАЛЬНЫЕ ПЕРЕМЕННЫЕ COINFLIP ---
let isGameActive = false;
let currentBet = 10.00;
let currentLevel = 0; 
let currentPayout = 0.00; 
let isFlipping = false; 

const MULTIPLIERS = [
    1.8, 3.6, 5.4, 7.2, 9.0, 10.8, 12.6, 14.4, 16.2, 18.0, 
    19.8, 21.6, 23.4, 25.2, 27.0, 28.8, 30.6, 32.4, 34.2, 36.0, 
    37.8, 39.6, 41.4, 43.2, 45.0, 46.8, 48.6, 50.4, 52.2, 54.0, 
    55.8, 57.6, 59.4, 61.2, 63.0, 64.8, 66.6, 68.4, 70.2, 72.0, 
    73.8, 75.6, 77.4, 79.2, 81.0, 82.8, 84.6, 86.4, 88.2, 90.0  
];

// --- ЭЛЕМЕНТЫ DOM ---
let betInput, choiceOrelBtn, choiceReshkaBtn, cashoutBtn, choiceWrapper, statusElement, coinFlipper, startButton;
let betHalfBtn, betDoubleBtn;

function updateControlsUI() {
    const betInputRow = document.querySelector('#coin-game .keno-bet-input-row');
    
    if (isGameActive) {
        // Игра идет:
        startButton.classList.add('hidden'); // Скрываем старт
        
        if (currentLevel === 0) {
            // Начало игры: показываем выбор
            choiceWrapper.classList.remove('hidden');
            cashoutBtn.classList.add('hidden');
        } else {
            // Уровень > 0: показываем выбор И кнопку забрать
            choiceWrapper.classList.remove('hidden');
            cashoutBtn.classList.remove('hidden');
            cashoutBtn.textContent = `ЗАБРАТЬ (${currentPayout.toFixed(2)} ₽)`;
        }
        
        // Блокируем инпут ставки
        if(betInputRow) betInputRow.style.pointerEvents = 'none';
        if(betInputRow) betInputRow.style.opacity = '0.5';

    } else {
        // Игра не идет:
        startButton.classList.remove('hidden'); // Показываем старт
        choiceWrapper.classList.add('hidden');  // Скрываем выбор
        cashoutBtn.classList.add('hidden');     // Скрываем забрать
        
        // Разблокируем инпут
        if(betInputRow) betInputRow.style.pointerEvents = 'auto';
        if(betInputRow) betInputRow.style.opacity = '1';
        
        currentLevel = 0;
        currentPayout = 0.00;
        updateMultiplierHighlight();
    }
    
    // Блокировка во время анимации
    if (isFlipping) {
        choiceWrapper.style.pointerEvents = 'none';
        choiceWrapper.style.opacity = 0.5;
        cashoutBtn.disabled = true;
    } else {
        choiceWrapper.style.pointerEvents = 'auto';
        choiceWrapper.style.opacity = 1;
        cashoutBtn.disabled = false;
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
    
    // Списываем ставку сразу при старте
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

    // Если это первый ход (currentLevel === 0), игра уже активна (нажата Start), ставка списана
    // Просто запускаем флип
    
    const choice = e.currentTarget.getAttribute('data-choice'); 
    isFlipping = true;
    updateControlsUI(); 
    
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
            
            const currentMultiplier = MULTIPLIERS[currentLevel - 1];
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
        updateControlsUI(); 
        updateMultiplierHighlight();
    });
}

async function handleCashout() {
    if (isFlipping || !isGameActive) return;

    const finalMultiplier = MULTIPLIERS[currentLevel - 1] || 0;
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

    if (!startButton) return; 
    
    startButton.addEventListener('click', handleStartGame);
    
    choiceOrelBtn.addEventListener('click', handleChoice);
    choiceReshkaBtn.addEventListener('click', handleChoice);
    
    cashoutBtn.addEventListener('click', handleCashout);

    if (betHalfBtn) {
        betHalfBtn.addEventListener('click', () => {
            if(isGameActive) return;
            let currentVal = parseFloat(betInput.value) || 0;
            betInput.value = Math.max(1.00, currentVal / 2).toFixed(0);
        });
    }

    if (betDoubleBtn) {
        betDoubleBtn.addEventListener('click', () => {
            if(isGameActive) return;
            let currentVal = parseFloat(betInput.value) || 0;
            betInput.value = Math.min(currentBalance, currentVal * 2).toFixed(0);
        });
    }
    
    updateControlsUI();
}
