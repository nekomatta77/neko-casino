/*
 * COIN.JS - С ВНЕДРЕННЫМ ANTI-MINUS
 */
import { currentBalance, updateBalance, writeBetToHistory, currentUser, reduceWager, AntiMinus } from './global.js';

let isGameActive = false;
let currentBet = 10.00;
let currentLevel = 0; 
let currentPayout = 0.00; 
let isFlipping = false; 
const MULTIPLIERS = Array.from({ length: 30 }, (_, i) => ((i + 1) * 1.80).toFixed(2));
let betInput, choiceOrelBtn, choiceReshkaBtn, cashoutBtn, choiceWrapper, statusElement, coinFlipper, startButton;
let betHalfBtn, betDoubleBtn;

function renderCoinMultipliers() {
    const bar = document.querySelector('.coin-multipliers-bar');
    if (!bar) return;
    bar.innerHTML = ''; 
    MULTIPLIERS.forEach((mult, index) => {
        const item = document.createElement('div');
        item.classList.add('coin-multiplier-item');
        item.setAttribute('data-level', index + 1);
        item.innerHTML = `<span class="coin-step-label">ШАГ ${index + 1}</span><span class="value">${mult}x</span>`;
        bar.appendChild(item);
    });
}

function updateControlsUI() {
    const betInputRow = document.querySelector('#coin-game .keno-bet-input-row');
    if (isGameActive) {
        startButton.classList.add('hidden');
        if(betInputRow) { betInputRow.style.pointerEvents = 'none'; betInputRow.style.opacity = '0.5'; }
        if (currentLevel === 0) {
            choiceWrapper.classList.remove('hidden');
            cashoutBtn.classList.add('hidden'); 
            cashoutBtn.disabled = true; 
        } else {
            choiceWrapper.classList.remove('hidden');
            cashoutBtn.classList.remove('hidden');
            cashoutBtn.disabled = false; 
            cashoutBtn.innerHTML = `ЗАБРАТЬ<br><span style="font-size: 0.9em;">${currentPayout.toFixed(2)} RUB</span>`;
        }
    } else {
        startButton.classList.remove('hidden'); 
        choiceWrapper.classList.add('hidden');
        cashoutBtn.classList.add('hidden');     
        cashoutBtn.disabled = true;
        if(betInputRow) { betInputRow.style.pointerEvents = 'auto'; betInputRow.style.opacity = '1'; }
        currentLevel = 0; currentPayout = 0.00;
        updateMultiplierHighlight();
    }
    if (isFlipping) {
        choiceWrapper.style.pointerEvents = 'none'; choiceWrapper.style.opacity = 0.5; cashoutBtn.disabled = true; 
    } else if (isGameActive && currentLevel > 0) {
        choiceWrapper.style.pointerEvents = 'auto'; choiceWrapper.style.opacity = 1; cashoutBtn.disabled = false; 
    } else if (isGameActive) {
        choiceWrapper.style.pointerEvents = 'auto'; choiceWrapper.style.opacity = 1;
    }
}

function updateMultiplierHighlight() {
    document.querySelectorAll('.coin-multiplier-item').forEach(item => {
        if (parseInt(item.getAttribute('data-level')) === currentLevel) { item.classList.add('active'); item.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }); }
        else item.classList.remove('active');
    });
}

function handleStartGame() {
    if (isFlipping || isGameActive) return;
    currentBet = parseFloat(betInput.value);
    if (currentBet <= 0 || isNaN(currentBet)) return statusElement.textContent = '⚠️ Неверная ставка!';
    if (currentBet > currentBalance) return statusElement.textContent = '⚠️ Недостаточно средств!';
    
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
    updateControlsUI(); 
    
    // --- ANTI-MINUS LOGIC ---
    // 1. Честный бросок
    let result = Math.random() < 0.5 ? 'orel' : 'reshka';
    
    // 2. Проверка выигрыша
    if (result === choice) {
        // Если угадал, считаем потенциальный выигрыш
        const nextMultiplier = parseFloat(MULTIPLIERS[currentLevel]);
        const potentialProfit = (currentBet * nextMultiplier) - currentBet;
        
        // Спрашиваем контроллер
        if (!AntiMinus.canUserWin(potentialProfit, currentBet)) {
            // Если нельзя -> меняем результат на противоположный
            console.warn("Coin: Anti-Minus flipped result");
            result = (choice === 'orel') ? 'reshka' : 'orel';
        }
    }
    // ------------------------
    
    playFlipAnimation(result, async () => {
        if (result === choice) {
            currentLevel++;
            if (currentLevel > MULTIPLIERS.length) {
                statusElement.textContent = `Максимальный выигрыш!`;
                await handleCashout(); 
                return;
            }
            const currentMultiplier = parseFloat(MULTIPLIERS[currentLevel - 1]);
            currentPayout = currentBet * currentMultiplier;
            statusElement.textContent = `Вы угадали! (x${currentMultiplier.toFixed(2)})`;
            statusElement.classList.add('win');
        } else {
            statusElement.textContent = `Проигрыш ${currentBet.toFixed(2)} RUB`; 
            statusElement.classList.add('loss');
            writeBetToHistory({ username: currentUser, game: 'coin', result: '❌ Loss', betAmount: currentBet, amount: -currentBet, multiplier: '0.00x' });
            isGameActive = false;
        }
        isFlipping = false;
        updateControlsUI(); 
        updateMultiplierHighlight();
    });
}

async function handleCashout() {
    if (isFlipping || !isGameActive) return;
    const finalMultiplier = parseFloat(MULTIPLIERS[currentLevel - 1] || 0);
    const netProfit = currentPayout - currentBet;
    updateBalance(currentPayout);
    writeBetToHistory({ username: currentUser, game: 'coin', result: `${finalMultiplier.toFixed(2)}x`, betAmount: currentBet, amount: netProfit, multiplier: `${finalMultiplier.toFixed(2)}x` });
    statusElement.textContent = `Выигрыш ${currentPayout.toFixed(2)} RUB`;
    statusElement.classList.add('win');
    isGameActive = false;
    isFlipping = false;
    updateControlsUI();
}

function playFlipAnimation(result, onComplete) {
    if (!coinFlipper) return;
    coinFlipper.classList.remove('flip-orel', 'flip-reshka');
    void coinFlipper.offsetWidth; 
    if (result === 'orel') coinFlipper.classList.add('flip-orel'); 
    else coinFlipper.classList.add('flip-reshka'); 
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
    if (betHalfBtn) betHalfBtn.addEventListener('click', () => { if(!isGameActive) betInput.value = Math.max(1.00, (parseFloat(betInput.value)||0)/2).toFixed(2); });
    if (betDoubleBtn) betDoubleBtn.addEventListener('click', () => { if(!isGameActive) betInput.value = Math.min(currentBalance, (parseFloat(betInput.value)||0)*2).toFixed(2); });
    isGameActive = false; currentLevel = 0; updateControlsUI();
}
