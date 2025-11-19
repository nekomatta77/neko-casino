/*
 * (ИЗМЕНЕНО: ЗАДАЧА 1 - Убраны await для моментального старта)
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
let betInput, choiceOrelBtn, choiceReshkaBtn, cashoutBtn, betControls, choiceControls, statusElement, coinFlipper, startButton;

function updateControlsUI() {
    if (isGameActive) {
        betControls.classList.add('hidden');
        startButton.classList.add('hidden');
        choiceControls.classList.remove('hidden'); 
        
        if (currentLevel > 0) {
            cashoutBtn.classList.remove('hidden');
            cashoutBtn.disabled = false;
            cashoutBtn.textContent = `Забрать ${currentPayout.toFixed(2)} RUB`;
        } else {
            cashoutBtn.classList.add('hidden'); 
        }
        
        choiceControls.style.pointerEvents = 'auto';
        choiceControls.style.opacity = 1;
        
    } else {
        betControls.classList.remove('hidden'); 
        startButton.classList.remove('hidden'); 
        choiceControls.classList.add('hidden'); 
        cashoutBtn.classList.add('hidden'); 
        
        choiceControls.style.pointerEvents = 'auto'; 
        choiceControls.style.opacity = 1;
        
        currentLevel = 0;
        currentPayout = 0.00;
        updateMultiplierHighlight();
    }
    
    if (isFlipping) {
        choiceControls.style.pointerEvents = 'none';
        choiceControls.style.opacity = 0.5;
        cashoutBtn.disabled = true;
    }
}

function updateMultiplierHighlight() {
    const items = document.querySelectorAll('.coin-multiplier-item');
    items.forEach((item, index) => {
        const level = parseInt(item.getAttribute('data-level'));
        if (level === currentLevel) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

function handleStartGame() {
    if (isFlipping) return;

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
    
    statusElement.textContent = '';
    statusElement.classList.remove('win', 'loss');
    
    betControls.classList.add('hidden');
    startButton.classList.add('hidden');
    choiceControls.classList.remove('hidden');
}

async function handleChoice(e) {
    if (isFlipping) return; 

    const choice = e.currentTarget.getAttribute('data-choice'); 
    
    if (!isGameActive) {
        currentBet = parseFloat(betInput.value);
        
        if (currentBet > currentBalance) {
            statusElement.textContent = '⚠️ Недостаточно средств!';
            statusElement.classList.add('loss');
            updateControlsUI(); 
            return;
        }
        
        // ИЗМЕНЕНО: Убран await
        updateBalance(-currentBet);
        reduceWager(currentBet);
        
        isGameActive = true;
        currentLevel = 0;
        statusElement.textContent = '...'; 
        statusElement.classList.remove('win', 'loss');
    }

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
            
        } else {
            statusElement.textContent = `Проигрыш ${currentBet.toFixed(2)} RUB`; 
            statusElement.classList.add('loss');
            statusElement.classList.remove('win');
            
            // ИЗМЕНЕНО: Убран await
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

    const finalMultiplier = MULTIPLIERS[currentLevel - 1];
    const netProfit = currentPayout - currentBet;

    // ИЗМЕНЕНО: Убран await
    updateBalance(currentPayout);
    
    // ИЗМЕНЕНО: Убран await
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
    choiceOrelBtn = document.getElementById('coin-choice-orel');
    choiceReshkaBtn = document.getElementById('coin-choice-reshka');
    cashoutBtn = document.getElementById('coin-cashout-button');
    betControls = document.getElementById('coin-bet-controls');
    choiceControls = document.getElementById('coin-choice-buttons');
    statusElement = document.getElementById('coin-status');
    coinFlipper = document.getElementById('coin-flipper');
    startButton = document.getElementById('coin-start-button'); 
    
    const betHalfButton = document.querySelector('#coin-bet-controls .bet-half');
    const betDoubleButton = document.querySelector('#coin-bet-controls .bet-double');
    const betMinButton = document.querySelector('#coin-bet-controls .bet-min');
    const betMaxButton = document.querySelector('#coin-bet-controls .bet-max');

    if (!betInput || !choiceOrelBtn || !choiceReshkaBtn || !cashoutBtn || !startButton) {
        return; 
    }
    
    startButton.addEventListener('click', handleStartGame);
    
    choiceOrelBtn.addEventListener('click', handleChoice);
    choiceReshkaBtn.addEventListener('click', handleChoice);
    
    cashoutBtn.addEventListener('click', handleCashout);

    if (betHalfButton) {
        betHalfButton.addEventListener('click', () => {
            let currentVal = parseFloat(betInput.value);
            if (isNaN(currentVal)) currentVal = 0;
            let newVal = Math.max(1.00, currentVal / 2); 
            betInput.value = newVal.toFixed(2);
        });
    }

    if (betDoubleButton) {
        betDoubleButton.addEventListener('click', () => {
            let currentVal = parseFloat(betInput.value);
            if (isNaN(currentVal)) currentVal = 0;
            let newVal = Math.min(currentBalance, currentVal * 2);
            betInput.value = newVal.toFixed(2);
        });
    }
    
    if (betMinButton) {
        betMinButton.addEventListener('click', () => {
            betInput.value = (1.00).toFixed(2);
        });
    }
    
    if (betMaxButton) {
        betMaxButton.addEventListener('click', () => {
            betInput.value = currentBalance.toFixed(2);
        });
    }
    
    updateControlsUI();
}
