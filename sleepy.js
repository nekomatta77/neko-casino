/*
 * SLEEPY.JS - Новая игра "Sleepy Cat"
 */

import { currentBalance, updateBalance, writeBetToHistory, currentUser, reduceWager } from './global.js';

// Уровни риска
const DIFFICULTY_STEPS = [
    { multiplier: 1.40, risk: 0.10 }, 
    { multiplier: 1.90, risk: 0.25 }, 
    { multiplier: 2.80, risk: 0.40 }, 
    { multiplier: 4.20, risk: 0.50 }, 
    { multiplier: 6.50, risk: 0.60 }, 
    { multiplier: 10.00, risk: 0.70 },
    { multiplier: 18.00, risk: 0.80 },
    { multiplier: 35.00, risk: 0.90 },
    { multiplier: 70.00, risk: 0.95 },
    { multiplier: 150.00, risk: 0.95 }
];

let isGameActive = false;
let currentBet = 10.00;
let currentStepIndex = -1; 
let currentWinnings = 0.00;
let isStealing = false; 

let catImage, bowlImage, statusLabel;
let actionButton, cashoutButton; 
let betInput;
let sleepyZzz; 
let multipliersBar; 
let riskDisplay; 

function renderSleepyMultipliers() {
    if (!multipliersBar) return;
    multipliersBar.innerHTML = '';

    DIFFICULTY_STEPS.forEach((step, index) => {
        const item = document.createElement('div');
        item.classList.add('coin-multiplier-item'); 
        item.setAttribute('data-step', index);

        item.innerHTML = `
            <span class="coin-step-label">ШАГ ${index + 1}</span>
            <span class="value">${step.multiplier.toFixed(2)}x</span>
        `;
        multipliersBar.appendChild(item);
    });
}

function updateRiskLabel() {
    if (!riskDisplay) return;
    let percentage = 0;
    
    if (isGameActive) {
        const nextStepIdx = currentStepIndex + 1;
        if (nextStepIdx < DIFFICULTY_STEPS.length) {
            percentage = DIFFICULTY_STEPS[nextStepIdx].risk * 100;
            riskDisplay.classList.remove('hidden');
        } else {
            riskDisplay.classList.add('hidden');
            return;
        }
    } else {
        percentage = DIFFICULTY_STEPS[0].risk * 100;
        riskDisplay.classList.remove('hidden');
    }

    riskDisplay.innerHTML = `Шанс разбудить кота: <span style="color: #FF5555;">${percentage.toFixed(0)}%</span>`;
}

function updateSleepyUI() {
    const betInputRow = document.querySelector('#sleepy-game .keno-bet-input-row');
    
    if (!isGameActive && cashoutButton) {
        cashoutButton.classList.remove('loss-mode');
        cashoutButton.disabled = false;
    }

    const items = document.querySelectorAll('#sleepy-multipliers-bar .coin-multiplier-item');
    items.forEach(item => item.classList.remove('active'));

    if (currentStepIndex >= 0) {
        const activeItem = items[currentStepIndex];
        if (activeItem) {
            activeItem.classList.add('active');
            activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }

    updateRiskLabel();

    if (isGameActive) {
        if (betInputRow) {
            betInputRow.style.pointerEvents = 'none';
            betInputRow.style.opacity = '0.5';
        }

        actionButton.textContent = "УКРАСТЬ ЛАКОМСТВО";
        actionButton.classList.remove('hidden');
        
        if (currentStepIndex >= 0) {
            cashoutButton.classList.remove('hidden');
            cashoutButton.disabled = false;
            cashoutButton.innerHTML = `ЗАБРАТЬ<br><span style="font-size: 0.9em;">${currentWinnings.toFixed(2)} RUB</span>`;
            
            // --- ИЗМЕНЕНО: Табличка зеленая при успехе ---
            statusLabel.innerHTML = `Успех! Множитель x${DIFFICULTY_STEPS[currentStepIndex].multiplier.toFixed(2)}`;
            statusLabel.className = 'keno-status-bar win'; // Включаем зеленый стиль
        } else {
            cashoutButton.classList.add('hidden');
            // Старт игры
            statusLabel.innerHTML = `Попробуй укради`;
            statusLabel.className = 'keno-status-bar'; // Нейтральный
        }

    } else {
        actionButton.textContent = "НАЧАТЬ ИГРУ";
        actionButton.classList.remove('hidden'); 
        cashoutButton.classList.add('hidden'); 
        cashoutButton.classList.remove('loss-mode');
        
        if (betInputRow) {
            betInputRow.style.pointerEvents = 'auto';
            betInputRow.style.opacity = '1';
        }
        
        catImage.src = 'assets/sleepy_cat_sleep.png';
        catImage.classList.remove('shake-cat');
        sleepyZzz.classList.remove('hidden');
        
        // Если только что не проиграли/выиграли, сбрасываем текст
        if (!statusLabel.classList.contains('loss') && !statusLabel.classList.contains('win')) {
             statusLabel.innerHTML = `Попробуй укради`;
             statusLabel.className = 'keno-status-bar';
        }
    }

    if (isStealing) {
        actionButton.disabled = true;
        cashoutButton.disabled = true;
    } else {
        actionButton.disabled = false;
    }
}

async function handleAction() {
    if (isStealing) return;

    if (!isGameActive) {
        currentBet = parseFloat(betInput.value);
        
        if (currentBet <= 0 || isNaN(currentBet)) {
            statusLabel.textContent = '⚠️ Неверная ставка!';
            return;
        }
        if (currentBet > currentBalance) {
            statusLabel.textContent = '⚠️ Недостаточно средств!';
            return;
        }

        updateBalance(-currentBet);
        reduceWager(currentBet);

        isGameActive = true;
        currentStepIndex = -1;
        currentWinnings = 0;
        
        statusLabel.innerHTML = `Попробуй укради`;
        statusLabel.className = 'keno-status-bar';
        
        updateSleepyUI();
        return;
    }

    isStealing = true;
    updateSleepyUI();

    const nextStepIdx = currentStepIndex + 1;
    
    if (nextStepIdx >= DIFFICULTY_STEPS.length) {
        await handleCashout();
        return;
    }

    const stepData = DIFFICULTY_STEPS[nextStepIdx];
    const risk = stepData.risk;

    await new Promise(r => setTimeout(r, 600));

    const random = Math.random();
    
    if (random < risk) {
        await triggerLoss();
    } else {
        currentStepIndex = nextStepIdx;
        currentWinnings = currentBet * stepData.multiplier;
        
        bowlImage.classList.add('bounce');
        setTimeout(() => bowlImage.classList.remove('bounce'), 300);

        isStealing = false;
        updateSleepyUI();
    }
}

async function triggerLoss() {
    catImage.src = 'assets/sleepy_cat_awake.png';
    catImage.classList.add('shake-cat');
    sleepyZzz.classList.add('hidden');
    
    // --- ИЗМЕНЕНО: Табличка красная при проигрыше ---
    statusLabel.innerHTML = `Кот проснулся! Вы потеряли ${currentBet.toFixed(2)} RUB`;
    statusLabel.className = 'keno-status-bar loss'; // Включаем красный стиль
    
    actionButton.classList.add('hidden');
    
    cashoutButton.classList.remove('hidden');
    cashoutButton.disabled = true; 
    cashoutButton.textContent = "ПРОИГРЫШ";
    cashoutButton.classList.add('loss-mode'); 

    currentStepIndex = -1; 
    const items = document.querySelectorAll('#sleepy-multipliers-bar .coin-multiplier-item');
    items.forEach(item => item.classList.remove('active'));

    writeBetToHistory({
        username: currentUser,
        game: 'sleepy',
        result: '😾 WAKE UP',
        betAmount: currentBet,
        amount: -currentBet,
        multiplier: '0.00x'
    });

    isStealing = false;
    isGameActive = false;
    
    await new Promise(r => setTimeout(r, 2000));
    
    statusLabel.innerHTML = `Попробуй укради`;
    statusLabel.className = 'keno-status-bar'; // Сброс на нейтральный
    updateSleepyUI();
}

async function handleCashout() {
    if (!isGameActive || isStealing || currentStepIndex === -1) return;

    const profit = currentWinnings - currentBet;
    const finalMult = DIFFICULTY_STEPS[currentStepIndex].multiplier;

    updateBalance(currentWinnings);
    
    writeBetToHistory({
        username: currentUser,
        game: 'sleepy',
        result: `${finalMult.toFixed(2)}x`,
        betAmount: currentBet,
        amount: profit,
        multiplier: `${finalMult.toFixed(2)}x`
    });

    // --- ИЗМЕНЕНО: Табличка зеленая при победе ---
    statusLabel.innerHTML = `Победа! Выигрыш ${currentWinnings.toFixed(2)} RUB`;
    statusLabel.className = 'keno-status-bar win'; // Включаем зеленый стиль

    isGameActive = false;
    updateSleepyUI();
}


export function initSleepy() {
    catImage = document.getElementById('sleepy-cat-img');
    bowlImage = document.getElementById('sleepy-bowl-img');
    statusLabel = document.getElementById('sleepy-status');
    multipliersBar = document.getElementById('sleepy-multipliers-bar'); 
    actionButton = document.getElementById('sleepy-action-btn');
    cashoutButton = document.getElementById('sleepy-cashout-btn');
    betInput = document.getElementById('sleepy-bet');
    sleepyZzz = document.getElementById('sleepy-zzz');
    riskDisplay = document.getElementById('sleepy-risk-display'); 

    const betHalfBtn = document.querySelector('#sleepy-game .bet-half');
    const betDoubleBtn = document.querySelector('#sleepy-game .bet-double');

    if (!actionButton) return; 

    renderSleepyMultipliers(); 

    actionButton.addEventListener('click', handleAction);
    cashoutButton.addEventListener('click', handleCashout);

    if (betHalfBtn) {
        betHalfBtn.addEventListener('click', () => {
            if (isGameActive) return;
            let val = parseFloat(betInput.value) || 0;
            betInput.value = Math.max(1.00, val / 2).toFixed(2);
        });
    }

    if (betDoubleBtn) {
        betDoubleBtn.addEventListener('click', () => {
            if (isGameActive) return;
            let val = parseFloat(betInput.value) || 0;
            betInput.value = Math.min(currentBalance, val * 2).toFixed(2);
        });
    }

    isGameActive = false;
    currentStepIndex = -1;
    updateSleepyUI();
}
