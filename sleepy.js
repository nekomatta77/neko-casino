/*
 * SLEEPY.JS - Новая игра "Sleepy Cat" (Press Your Luck)
 * Механика: Таскаем еду, пока кот спит. Риск растет с каждым шагом.
 */

import { currentBalance, updateBalance, writeBetToHistory, currentUser, reduceWager } from './global.js';

// --- КОНФИГУРАЦИЯ РИСКА И МНОЖИТЕЛЕЙ ---
// Уровни: [Множитель, Шанс проигрыша (0.05 = 5%)]
const DIFFICULTY_STEPS = [
    { multiplier: 1.40, risk: 0.05 }, // Шаг 1: 5% риск
    { multiplier: 1.80, risk: 0.09 }, // Шаг 2: 9% риск
    { multiplier: 2.40, risk: 0.13 }, // Шаг 3: 13% риск
    { multiplier: 3.10, risk: 0.17 }, // Шаг 4: 17% риск
    { multiplier: 4.00, risk: 0.21 }, // Шаг 5: 21% риск
    { multiplier: 5.20, risk: 0.25 }, 
    { multiplier: 6.90, risk: 0.30 },
    { multiplier: 9.50, risk: 0.35 },
    { multiplier: 15.00, risk: 0.45 },
    { multiplier: 30.00, risk: 0.60 } // Шаг 10: Хардкор
];

// --- ЛОКАЛЬНЫЕ ПЕРЕМЕННЫЕ ---
let isGameActive = false;
let currentBet = 10.00;
let currentStepIndex = -1; // -1 значит игра не началась или только старт
let currentWinnings = 0.00;
let isStealing = false; // Блокировка нажатий во время анимации

// --- ЭЛЕМЕНТЫ DOM ---
let catImage, bowlImage, statusLabel;
let actionButton, cashoutButton; 
let betInput;
let sleepyZzz; // Элемент анимации Zzz
let multipliersBar; // Контейнер для множителей

// --- UI ФУНКЦИИ ---

// Рендерит множители как в Coinflip
function renderSleepyMultipliers() {
    if (!multipliersBar) return;
    multipliersBar.innerHTML = '';

    DIFFICULTY_STEPS.forEach((step, index) => {
        const item = document.createElement('div');
        item.classList.add('coin-multiplier-item'); // Используем класс Coinflip
        item.setAttribute('data-step', index);

        item.innerHTML = `
            <span class="coin-step-label">ШАГ ${index + 1}</span>
            <span class="value">${step.multiplier.toFixed(2)}x</span>
        `;
        multipliersBar.appendChild(item);
    });
}

function updateSleepyUI() {
    const betInputRow = document.querySelector('#sleepy-game .keno-bet-input-row');
    
    // Сброс кнопки проигрыша (если была)
    if (cashoutButton) {
        cashoutButton.classList.remove('loss-mode');
    }

    // Обновляем скролл-бар множителей
    const items = document.querySelectorAll('#sleepy-multipliers-bar .coin-multiplier-item');
    items.forEach(item => item.classList.remove('active'));

    if (currentStepIndex >= 0) {
        const activeItem = items[currentStepIndex];
        if (activeItem) {
            activeItem.classList.add('active');
            activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }

    if (isGameActive) {
        // Игра идет
        if (betInputRow) {
            betInputRow.style.pointerEvents = 'none';
            betInputRow.style.opacity = '0.5';
        }

        // Показываем кнопки действий
        actionButton.textContent = "УКРАСТЬ ЛАКОМСТВО";
        actionButton.classList.remove('hidden');
        
        // Если мы сделали хотя бы 1 шаг, можно забрать деньги
        if (currentStepIndex >= 0) {
            cashoutButton.classList.remove('hidden');
            cashoutButton.disabled = false;
            cashoutButton.innerHTML = `ЗАБРАТЬ<br><span style="font-size: 0.9em;">${currentWinnings.toFixed(2)} RUB</span>`;
        } else {
            cashoutButton.classList.add('hidden');
        }

    } else {
        // Игра не идет (Старт)
        actionButton.textContent = "НАЧАТЬ ИГРУ";
        actionButton.classList.remove('hidden');
        cashoutButton.classList.add('hidden');
        
        if (betInputRow) {
            betInputRow.style.pointerEvents = 'auto';
            betInputRow.style.opacity = '1';
        }
        
        // Сброс визуалов
        catImage.src = 'assets/sleepy_cat_sleep.png';
        catImage.classList.remove('shake-cat');
        sleepyZzz.classList.remove('hidden');
        statusLabel.textContent = 'Попробуй украсть еду!';
        statusLabel.classList.remove('win', 'loss');
    }

    // Блокировка при анимации
    if (isStealing) {
        actionButton.disabled = true;
        cashoutButton.disabled = true;
    } else {
        actionButton.disabled = false;
        // cashoutButton управляется выше
    }
}

// --- ЛОГИКА ИГРЫ ---

async function handleAction() {
    if (isStealing) return;

    if (!isGameActive) {
        // СТАРТ ИГРЫ
        currentBet = parseFloat(betInput.value);
        
        if (currentBet <= 0 || isNaN(currentBet)) {
            statusLabel.textContent = '⚠️ Неверная ставка!';
            statusLabel.classList.add('loss');
            return;
        }
        if (currentBet > currentBalance) {
            statusLabel.textContent = '⚠️ Недостаточно средств!';
            statusLabel.classList.add('loss');
            return;
        }

        updateBalance(-currentBet);
        reduceWager(currentBet);

        isGameActive = true;
        currentStepIndex = -1;
        currentWinnings = 0;
        
        updateSleepyUI();
        return;
    }

    // ПОПЫТКА УКРАСТЬ (СЛЕДУЮЩИЙ ШАГ)
    isStealing = true;
    updateSleepyUI();

    // Определяем следующий шаг
    const nextStepIdx = currentStepIndex + 1;
    
    // Проверка на конец игры (если шаги кончились)
    if (nextStepIdx >= DIFFICULTY_STEPS.length) {
        await handleCashout();
        return;
    }

    const stepData = DIFFICULTY_STEPS[nextStepIdx];
    const risk = stepData.risk;

    // Анимация "руки" или просто задержка
    statusLabel.textContent = "Крадемся...";
    await new Promise(r => setTimeout(r, 600)); // Саспенс

    // RNG
    const random = Math.random(); // 0.0 to 1.0
    
    if (random < risk) {
        // ПРОИГРЫШ (Кот проснулся)
        await triggerLoss();
    } else {
        // УСПЕХ
        currentStepIndex = nextStepIdx;
        currentWinnings = currentBet * stepData.multiplier;
        
        // Визуал успеха
        statusLabel.textContent = `Успех! Множитель x${stepData.multiplier.toFixed(2)}`;
        statusLabel.classList.add('win');
        
        // Анимация миски (опционально)
        bowlImage.classList.add('bounce');
        setTimeout(() => bowlImage.classList.remove('bounce'), 300);

        isStealing = false;
        updateSleepyUI();
    }
}

async function triggerLoss() {
    // Визуал проигрыша
    catImage.src = 'assets/sleepy_cat_awake.png';
    catImage.classList.add('shake-cat');
    sleepyZzz.classList.add('hidden'); // Zzz пропадают
    
    statusLabel.textContent = `Кот проснулся! Вы потеряли ${currentBet.toFixed(2)} RUB`;
    statusLabel.classList.remove('win');
    statusLabel.classList.add('loss');
    
    // --- ЗАДАЧА 2: Кнопка "Забрать" превращается в "Проигрыш" ---
    cashoutButton.classList.remove('hidden');
    cashoutButton.disabled = true; // Кнопка неактивна
    cashoutButton.textContent = "ПРОИГРЫШ";
    cashoutButton.classList.add('loss-mode'); // Добавляем красный стиль

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
    
    // Небольшая задержка перед тем, как интерфейс вернется в "Старт", чтобы игрок осознал боль
    await new Promise(r => setTimeout(r, 2000));
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

    statusLabel.textContent = `Выигрыш ${currentWinnings.toFixed(2)} RUB!`;
    statusLabel.classList.add('win');
    statusLabel.classList.remove('loss');

    isGameActive = false;
    updateSleepyUI();
}


export function initSleepy() {
    // Инициализация элементов
    catImage = document.getElementById('sleepy-cat-img');
    bowlImage = document.getElementById('sleepy-bowl-img');
    statusLabel = document.getElementById('sleepy-status');
    multipliersBar = document.getElementById('sleepy-multipliers-bar'); // Новый элемент
    actionButton = document.getElementById('sleepy-action-btn');
    cashoutButton = document.getElementById('sleepy-cashout-btn');
    betInput = document.getElementById('sleepy-bet');
    sleepyZzz = document.getElementById('sleepy-zzz');

    // Кнопки ставок
    const betHalfBtn = document.querySelector('#sleepy-game .bet-half');
    const betDoubleBtn = document.querySelector('#sleepy-game .bet-double');

    if (!actionButton) return; // Если мы не на той странице или разметка сломана

    renderSleepyMultipliers(); // Рендерим полоску множителей

    // Слушатели
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

    // Сброс UI при загрузке
    isGameActive = false;
    currentStepIndex = -1;
    updateSleepyUI();
}
