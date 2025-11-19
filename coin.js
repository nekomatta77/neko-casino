/*
 * (ЗАДАЧА 6): Добавлен импорт и вызов `reduceWager` при ставке.
 */
import { currentBalance, updateBalance, writeBetToHistory, currentUser, reduceWager } from './global.js';

// --- ЛОКАЛЬНЫЕ ПЕРЕМЕННЫЕ COINFLIP ---
let isGameActive = false;
let currentBet = 10.00;
let currentLevel = 0; // Текущий уровень (количество угаданных подряд)
let currentPayout = 0.00; // Текущий возможный выигрыш
let isFlipping = false; // Блокировка на время анимации

// Множители, как на скриншоте (Level 1, Level 2, ...)
// Индекс 0 = Уровень 1
// ИЗМЕНЕНО: (ЗАДАНИЕ 3) Расширен до 50
const MULTIPLIERS = [
    1.8, 3.6, 5.4, 7.2, 9.0, 10.8, 12.6, 14.4, 16.2, 18.0, // 1-10
    19.8, 21.6, 23.4, 25.2, 27.0, 28.8, 30.6, 32.4, 34.2, 36.0, // 11-20
    37.8, 39.6, 41.4, 43.2, 45.0, 46.8, 48.6, 50.4, 52.2, 54.0, // 21-30
    55.8, 57.6, 59.4, 61.2, 63.0, 64.8, 66.6, 68.4, 70.2, 72.0, // 31-40
    73.8, 75.6, 77.4, 79.2, 81.0, 82.8, 84.6, 86.4, 88.2, 90.0  // 41-50
];

// --- ЭЛЕМЕНТЫ DOM ---
let betInput, choiceOrelBtn, choiceReshkaBtn, cashoutBtn, betControls, choiceControls, statusElement, coinFlipper, startButton;

/**
 * Обновляет UI, блокируя/разблокируя контролы
 */
function updateControlsUI() {
    if (isGameActive) {
        // Игра активна (после нажатия Орел/Решка)
        betControls.classList.add('hidden');
        startButton.classList.add('hidden');
        choiceControls.classList.remove('hidden'); // Показываем Орел/Решка
        
        // Показываем "Забрать", если есть что забирать (уровень > 0)
        if (currentLevel > 0) {
            cashoutBtn.classList.remove('hidden');
            cashoutBtn.disabled = false;
            // Обновляем текст кнопки "Забрать"
            cashoutBtn.textContent = `Забрать ${currentPayout.toFixed(2)} RUB`;
        } else {
            cashoutBtn.classList.add('hidden'); // Скрываем "Забрать" на 0 уровне
        }
        
        choiceControls.style.pointerEvents = 'auto';
        choiceControls.style.opacity = 1;
        
    } else {
        // Игра неактивна (до начала)
        betControls.classList.remove('hidden'); // Показываем ставку
        startButton.classList.remove('hidden'); // Показываем "Начать игру"
        choiceControls.classList.add('hidden'); // Прячем Орел/Решка
        cashoutBtn.classList.add('hidden'); // Прячем "Забрать"
        
        choiceControls.style.pointerEvents = 'auto'; // Выбор всегда доступен для старта
        choiceControls.style.opacity = 1;
        
        currentLevel = 0;
        currentPayout = 0.00;
        updateMultiplierHighlight();
    }
    
    // Блокировка кнопок во время анимации
    if (isFlipping) {
        choiceControls.style.pointerEvents = 'none';
        choiceControls.style.opacity = 0.5;
        cashoutBtn.disabled = true;
    }
}

/**
 * Подсвечивает текущий активный множитель
 */
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

/**
 * ДОБАВЛЕНО: (ЗАДАНИЕ 1) Обрабатывает нажатие на "Начать игру"
 */
function handleStartGame() {
    if (isFlipping) return;

    // 1. Проверяем ставку
    currentBet = parseFloat(betInput.value);
    
    if (currentBet <= 0 || isNaN(currentBet)) {
        statusElement.textContent = '⚠️ Неверная ставка!';
        statusElement.classList.add('loss'); // Показываем как ошибку
        return;
    }
    if (currentBet > currentBalance) {
        statusElement.textContent = '⚠️ Недостаточно средств!';
        statusElement.classList.add('loss'); // Показываем как ошибку
        return;
    }

    // 2. Снимаем ставку
    // (Перенесено в handleChoice, чтобы не снимать до выбора)
    
    // 3. Переключаем UI
    // (Перенесено в handleChoice)
    // isGameActive = true; 
    
    // 4. Сбрасываем статус
    statusElement.textContent = '';
    statusElement.classList.remove('win', 'loss');
    
    // 5. Обновляем UI (показываем Орел/Решка, прячем Старт)
    // ИЗМЕНЕНО: Мы не делаем isGameActive = true,
    // а просто меняем кнопки. isGameActive станет true при первом выборе.
    betControls.classList.add('hidden');
    startButton.classList.add('hidden');
    choiceControls.classList.remove('hidden');
}


/**
 * Обрабатывает выбор игрока (Орел/Решка)
 * @param {Event} e 
 */
async function handleChoice(e) {
    if (isFlipping) return; // Нельзя кликать во время анимации

    const choice = e.currentTarget.getAttribute('data-choice'); // 'orel' или 'reshka'
    
    // --- СТАРТ ИГРЫ (если она неактивна) ---
    if (!isGameActive) {
        // Ставка уже проверена в handleStartGame, но проверим баланс еще раз
        currentBet = parseFloat(betInput.value);
        
        if (currentBet > currentBalance) {
            statusElement.textContent = '⚠️ Недостаточно средств!';
            statusElement.classList.add('loss');
            // Возвращаем UI в исходное состояние, так как игра не может начаться
            updateControlsUI(); // isGameActive все еще false
            return;
        }
        
        // Снимаем ставку
        try {
            await updateBalance(-currentBet);
            // (ЗАДАЧА 6) Уменьшаем вейджер
            await reduceWager(currentBet);
        } catch (error) {
            statusElement.textContent = '⚠️ Ошибка при снятии ставки.';
            statusElement.classList.add('loss');
            return;
        }
        
        isGameActive = true;
        currentLevel = 0;
        statusElement.textContent = '...'; // Убираем .win/.loss, если они были
        statusElement.classList.remove('win', 'loss');
    }

    // --- ЛОГИКА БРОСКА ---
    isFlipping = true;
    updateControlsUI(); // Блокируем кнопки
    
    const result = Math.random() < 0.5 ? 'orel' : 'reshka';
    
    // --- Анимация ---
    playFlipAnimation(result, async () => {
        // --- Обработка результата (после анимации) ---
        if (result === choice) {
            // ВЫИГРЫШ
            currentLevel++;
            
            // Проверка, есть ли еще множители
            if (currentLevel > MULTIPLIERS.length) {
                // ИЗМЕНЕНО: (ЗАДАНИЕ 2)
                statusElement.textContent = `Максимальный выигрыш!`;
                statusElement.classList.add('win');
                await handleCashout(); // Авто-кэшаут на макс. уровне
                return;
            }
            
            const currentMultiplier = MULTIPLIERS[currentLevel - 1];
            currentPayout = currentBet * currentMultiplier;
            
            // ИЗМЕНЕНО: (ЗАДАНИЕ 2)
            statusElement.textContent = `Вы угадали! (x${currentMultiplier.toFixed(2)})`;
            statusElement.classList.remove('win', 'loss'); // Сбрасываем, если был
            
        } else {
            // ПРОИГРЫШ
            // ИЗМЕНЕНО: (ЗАДАНИЕ 4) Добавлена "RUB"
            statusElement.textContent = `Проигрыш ${currentBet.toFixed(2)} RUB`; 
            statusElement.classList.add('loss');
            statusElement.classList.remove('win');
            
            // Запись в историю
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
        updateControlsUI(); // Разблокируем кнопки
        updateMultiplierHighlight();
    });
}

/**
 * Обрабатывает нажатие на кнопку "Забрать"
 */
async function handleCashout() {
    if (isFlipping || !isGameActive) return;

    const finalMultiplier = MULTIPLIERS[currentLevel - 1];
    const netProfit = currentPayout - currentBet;

    // 1. Зачисляем выигрыш
    try {
        await updateBalance(currentPayout);
    } catch (error) {
        statusElement.textContent = '⚠️ Ошибка при зачислении выигрыша.';
        statusElement.classList.add('loss');
        return;
    }
    
    // 2. Запись в историю
    writeBetToHistory({
        username: currentUser,
        game: 'coin',
        result: `${finalMultiplier.toFixed(2)}x`,
        betAmount: currentBet,
        amount: netProfit,
        multiplier: `${finalMultiplier.toFixed(2)}x`
    });
    
    // 3. Сброс
    // ИЗМЕНЕНО: (ЗАДАНИЕ 4) Добавлена "RUB"
    statusElement.textContent = `Выигрыш ${currentPayout.toFixed(2)} RUB`;
    statusElement.classList.add('win');
    statusElement.classList.remove('loss');
    
    isGameActive = false;
    isFlipping = false;
    updateControlsUI();
}

/**
 * Запускает анимацию подбрасывания монеты
 * @param {string} result - 'orel' или 'reshka'
 * @param {Function} onComplete - Колбэк после завершения анимации
 */
function playFlipAnimation(result, onComplete) {
    if (!coinFlipper) return;
    
    // Убираем старые классы анимации
    coinFlipper.classList.remove('flip-orel', 'flip-reshka');
    
    // Принудительный reflow, чтобы анимация сбросилась
    void coinFlipper.offsetWidth; 

    // Добавляем класс, соответствующий результату
    if (result === 'orel') {
        coinFlipper.classList.add('flip-orel'); // 3 полных оборота
    } else {
        coinFlipper.classList.add('flip-reshka'); // 3.5 оборота
    }

    // Ждем окончания анимации (1.5с)
    setTimeout(onComplete, 1500);
}

/**
 * Инициализирует игру Coinflip
 */
export function initCoin() {
    // --- Поиск элементов ---
    betInput = document.getElementById('coin-bet');
    choiceOrelBtn = document.getElementById('coin-choice-orel');
    choiceReshkaBtn = document.getElementById('coin-choice-reshka');
    cashoutBtn = document.getElementById('coin-cashout-button');
    betControls = document.getElementById('coin-bet-controls');
    choiceControls = document.getElementById('coin-choice-buttons');
    statusElement = document.getElementById('coin-status');
    coinFlipper = document.getElementById('coin-flipper');
    startButton = document.getElementById('coin-start-button'); // ИЗМЕНЕНО: (ЗАДАНИЕ 1)
    
    const betHalfButton = document.querySelector('#coin-bet-controls .bet-half');
    const betDoubleButton = document.querySelector('#coin-bet-controls .bet-double');
    const betMinButton = document.querySelector('#coin-bet-controls .bet-min');
    const betMaxButton = document.querySelector('#coin-bet-controls .bet-max');

    if (!betInput || !choiceOrelBtn || !choiceReshkaBtn || !cashoutBtn || !startButton) {
        return; // Если мы не на странице, ничего не делаем
    }
    
    // --- ИЗМЕНЕНО: (ЗАДАНИЕ 1) Слушатель кнопки "Начать игру" ---
    startButton.addEventListener('click', handleStartGame);
    
    // --- Слушатели кнопок выбора ---
    choiceOrelBtn.addEventListener('click', handleChoice);
    choiceReshkaBtn.addEventListener('click', handleChoice);
    
    // --- Слушатель кнопки "Забрать" ---
    cashoutBtn.addEventListener('click', handleCashout);

    // --- Слушатели кнопок ставок ---
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
    
    // --- Первичная настройка ---
    updateControlsUI();
}
