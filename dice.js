/*
 * Краткое описание апгрейда:
 * 1. **(ЗАДАНИЕ 1)** Обновлена логика `rollDice`: теперь при проигрыше в статус-бар выводится "Проигрыш [Сумма]".
 * 2. **(ЗАДАНИЕ 2)** Добавлена приписка "RUB" в статус-бар.
 * 3. **(НОВЫЙ АПДЕЙТ)**: Добавлен импорт и вызов `reduceWager` при ставке.
 */
import { currentBalance, updateBalance, showSection, writeBetToHistory, currentUser, reduceWager } from './global.js';

// --- ЛОКАЛЬНЫЕ ПЕРЕМЕННЫЕ DICE ---\
let diceBet = 10.00;
let diceChance = 49.50; // Шанс выигрыша в процентах
let diceMultiplier = 1.98; // Переменная сохраняется для расчета прибыли
let lastGameData = null; // Хранит данные последней игры для проверки хэша

// --- ДОБАВЛЕНО: Функции для проверки хэша (Provably Fair) ---

/**
 * Генерирует хэш SHA-256 из строки (асинхронно).
 * @param {string} message - Входная строка.
 * @returns {Promise<string>} 
 */
async function sha256(message) {
    try {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    } catch (error) {
        console.error("Ошибка SHA-256:", error);
        return null;
    }
}

/**
 * Генерирует случайную "соль" (salt) указанной длины.
 * @param {number} length - Длина строки.
 * @returns {string} 
 */
function generateSalt(length) {
    try {
        const arr = new Uint8Array(length / 2);
        crypto.getRandomValues(arr);
        return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
        console.error("Ошибка генерации Salt:", error);
        // Fallback для сред, где crypto недоступен
        let result = '';
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return result;
    }
}

// --- КОНЕЦ БЛОКА ХЭША ---


// --- ЛОГИКА DICE ---

function calculateDiceMultiplier(chance) {
    // Формула для множителя: 100 / Chance (без комиссии)
    if (chance <= 0 || chance >= 100) return 0;
    // ИЗМЕНЕНО: 99.00 -> 100.00
    return (100.00 / chance).toFixed(2); 
}

/**
 * [НОВАЯ ФУНКЦИЯ]
 * Обновляет только калькулятор и диапазоны, НЕ трогая поля ввода.
 * Вызывается на 'input', чтобы не сбивать курсор.
 */
function updateDiceCalculations() {
    let currentBetVal = parseFloat(document.getElementById('dice-bet').value);
    let currentChanceVal = parseFloat(document.getElementById('dice-chance').value);

    if (isNaN(currentBetVal)) currentBetVal = 0;
    if (isNaN(currentChanceVal)) currentChanceVal = 0;

    // 1. Используем *потенциально* неформатированные значения для расчета
    // (Ограничения применяются визуально, но не сбрасывают ввод)
    const clampedChance = parseFloat(Math.min(98.00, Math.max(1.00, currentChanceVal)).toFixed(2));
    const clampedBet = parseFloat(Math.max(1.00, currentBetVal).toFixed(2));
    
    const tempMultiplier = calculateDiceMultiplier(clampedChance);
    
    // РАСЧЕТ ВОЗМОЖНОГО ВЫИГРЫША (СУММА СТАВКИ + ЧИСТАЯ ПРИБЫЛЬ)
    const winAmount = clampedBet * parseFloat(tempMultiplier);
    // const profit = Math.max(0, winAmount - clampedBet); // Больше не нужно
    
    // 2. Обновление Калькулятора Выигрыша
    const profitDisplayElement = document.getElementById('dice-profit-display');
    // ИЗМЕНЕНО: (Запрос 1) Показываем общий выигрыш
    profitDisplayElement.textContent = winAmount.toFixed(2); 
    
    if (winAmount <= clampedBet) { // ИЗМЕНЕНО: Проверяем относительно ставки
        profitDisplayElement.classList.add('zero');
    } else {
        profitDisplayElement.classList.remove('zero');
    }
    
    // 3. Обновление диапазонов чисел 0-999999
    const targetUnderNumber = Math.floor(clampedChance * 10000) - 1; 
    document.getElementById('roll-under-value').textContent = targetUnderNumber.toString().padStart(6, '0');
    
    const targetOverNumber = Math.ceil((100.00 - clampedChance) * 10000);
    document.getElementById('roll-over-value').textContent = targetOverNumber.toString().padStart(6, '0');
}


/**
 * [ИЗМЕНЕНО] (Бывшая updateDiceUI)
 * Форматирует значения в полях ввода и синхронизирует все.
 * Вызывается на 'blur' и при нажатии кнопок.
 */
function formatAndSyncDiceUI() {
    // 1. Читаем значения из DOM
    let betVal = parseFloat(document.getElementById('dice-bet').value);
    let chanceVal = parseFloat(document.getElementById('dice-chance').value);

    // 2. Применяем ограничения и сохраняем в глобальные переменные
    diceBet = parseFloat(Math.max(1.00, isNaN(betVal) ? 1.00 : betVal).toFixed(2)); 
    diceChance = parseFloat(Math.min(98.00, Math.max(1.00, isNaN(chanceVal) ? 1.00 : chanceVal)).toFixed(2));
    
    diceMultiplier = calculateDiceMultiplier(diceChance);

    // 3. Обновляем ПОЛЯ ВВОДА (форматируем)
    document.getElementById('dice-bet').value = diceBet.toFixed(2);
    document.getElementById('dice-chance').value = diceChance.toFixed(2);

    // 4. Обновляем калькулятор
    updateDiceCalculations();
}

function handleDiceBetAction(action, inputElement) {
    let currentVal = parseFloat(inputElement.value);
    if (isNaN(currentVal)) currentVal = 1.00; // Используем 1.00 как базу, если NaN

    if (action === 'half') {
        currentVal = Math.max(1.00, currentVal / 2); 
    } else if (action === 'double') {
        currentVal = Math.min(currentBalance, currentVal * 2); 
    } else if (action === 'min') {
        currentVal = 1.00;
    } else if (action === 'max') {
        currentVal = currentBalance;
    }
    
    // 1. Обновляем глобальную переменную
    diceBet = parseFloat(Math.max(1.00, currentVal).toFixed(2));
    // 2. СНАЧАЛА обновляем поле ввода
    inputElement.value = diceBet.toFixed(2);
    // 3. ПОТОМ синхронизируем UI
    formatAndSyncDiceUI();
}

function handleDiceChanceAction(action, inputElement) {
    let currentVal = parseFloat(inputElement.value);
    if (isNaN(currentVal)) currentVal = 1.00;

    if (action === 'half') {
        currentVal = Math.max(1.00, currentVal / 2);
    } else if (action === 'double') {
        currentVal = Math.min(98.00, currentVal * 2); 
    } else if (action === 'min') {
        currentVal = 1.00;
    } else if (action === 'max') {
        currentVal = 98.00;
    }
    
    // 1. Обновляем глобальную переменную
    diceChance = parseFloat(Math.min(98.00, Math.max(1.00, currentVal)).toFixed(2));
    // 2. СНАЧАЛА обновляем поле ввода
    inputElement.value = diceChance.toFixed(2);
    // 3. ПОТОМ синхронизируем UI
    formatAndSyncDiceUI();
}

// ИЗМЕНЕНО: Функция стала асинхронной из-за sha256 и reduceWager
async function rollDice(rollType) {
    // [ИЗМЕНЕНО] Добавляем форматирование ПЕРЕД броском
    // Это гарантирует, что если пользователь ввел "10." и нажал "Roll",
    // ставка будет "10.00", а не "0" или "NaN".
    formatAndSyncDiceUI();

    // 1. Получаем актуальные данные (теперь они 100% отформатированы)
    const bet = diceBet;
    const multiplier = parseFloat(diceMultiplier);
    
    const statusElement = document.getElementById('dice-status');
    const checkLink = document.getElementById('dice-check-game'); // ДОБАВЛЕНО
    
    // ИЗМЕНЕНО: (ЗАДАНИЕ) Дисплей 6-значного числа больше не используется
    // const resultDisplayElement = document.getElementById('dice-result-number');
    
    // ИЗМЕНЕНО: (ЗАДАНИЕ) Сброс стиля статуса (win/loss прямоугольник)
    statusElement.textContent = ''; 
    statusElement.classList.remove('win', 'loss');
    checkLink.classList.add('hidden'); // ДОБАВЛЕНО: Скрываем старую ссылку
    // resultDisplayElement.classList.remove('win', 'loss');
    // resultDisplayElement.textContent = '...'; 

    // --- ДОБАВЛЕНО: (ЗАДАЧА 1) ---
    // Force a reflow. Это заставляет браузер "увидеть", что классы удалены,
    // чтобы CSS-анимация могла сработать повторно при следующем добавлении класса.
    void statusElement.offsetWidth;
    // --- КОНЕЦ ДОБАВЛЕНИЯ ---

    // 2. Проверка баланса
    if (currentBalance < bet) {
        statusElement.textContent = '⚠️ Недостаточно средств!'; // ИЗМЕНЕНО: (ЗАДАЧА 2)
        statusElement.classList.add('loss'); // Показываем как ошибку
        // resultDisplayElement.textContent = '------';
        return;
    }
    
    if (bet < 1.00) {
        statusElement.textContent = '❌ Минимальная ставка 1.00!';
        statusElement.classList.add('loss'); // Показываем как ошибку
        // resultDisplayElement.textContent = '------';
        return;
    }


    // 3. Снимаем ставку
    await updateBalance(-bet);
    
    // 4. (ДОБАВЛЕНО) Уменьшаем вейджер
    await reduceWager(bet);

    // 5. Генерируем случайное число [000000, 999999]
    const rollRaw = Math.floor(Math.random() * 1000000);
    // Форматируем число без точки (XXXXXX)
    const rollDisplay = rollRaw.toString().padStart(6, '0'); 

    let win = false;
    let targetNumber;

    if (rollType === 'under') {
        targetNumber = Math.floor(diceChance * 10000) - 1; 
        if (rollRaw <= targetNumber) {
            win = true;
        }
    } else {
        targetNumber = Math.ceil((100.00 - diceChance) * 10000);
        if (rollRaw >= targetNumber) {
            win = true;
        }
    }

    // 6. Обновляем эстетичное выпавшее число (СКРЫТО)
    // resultDisplayElement.textContent = rollDisplay; 
    
    // ДОБАВЛЕНО: (Задание) Готовим данные для истории
    const betData = {
        username: currentUser,
        game: 'dice',
        result: rollDisplay, // Выпавшее число (будет перезаписано при выигрыше)
        betAmount: bet, // ИЗМЕНЕНО: (Задание 2) Добавляем сумму ставки
        amount: 0
        // (multiplier будет добавлен ниже)
    };

    if (win) {
        const winAmount = bet * multiplier;
        await updateBalance(winAmount); 
        
        // ИЗМЕНЕНО: (ЗАДАНИЕ 2) Добавлена "RUB"
        statusElement.textContent = `Выигрыш ${winAmount.toFixed(2)} RUB`; 
        statusElement.classList.add('win');
        // resultDisplayElement.classList.add('win');

        // ДОБАВЛЕНО: (Задание) Чистый выигрыш
        betData.amount = winAmount - bet;
        // ИЗМЕНЕНИЕ: Записываем множитель в результат для истории
        betData.result = `${multiplier.toFixed(2)}x`;
        // ИЗМЕНЕНО: (Запрос 1) Добавляем множитель
        betData.multiplier = `${multiplier.toFixed(2)}x`;

    } else {
        // ИЗМЕНЕНО: (ЗАДАНИЕ 2) Добавлена "RUB"
        statusElement.textContent = `Проигрыш ${bet.toFixed(2)} RUB`; 
        statusElement.classList.add('loss');
        // resultDisplayElement.classList.add('loss');

        // ДОБАВЛЕНО: (Задание) Проигрыш
        betData.amount = -bet;
        // ИЗМЕНЕНО: (Запрос 1) Добавляем множитель
        betData.multiplier = `${multiplier.toFixed(2)}x`;
        // (Оставляем betData.result = rollDisplay для проигрыша)
    }

    // ДОБАВЛЕНО: (Задание) Отправляем результат в историю
    writeBetToHistory(betData);

    // --- ДОБАВЛЕНО: Логика генерации хэша (симуляция) ---
    const salt1 = generateSalt(16);
    const salt2 = generateSalt(16);
    const number = rollRaw;
    const combined = `${salt1}|${number}|${salt2}`; // Используем разделитель для ясности
    const hash = await sha256(combined); // Ждем хэш
    const gameId = Math.floor(Math.random() * 90000000) + 10000000; // Случайный ID игры

    // Сохраняем все данные для модального окна
    lastGameData = {
        gameId,
        combined,
        hash,
        salt1,
        number: rollDisplay, // rollDisplay - это "475693"
        salt2,
        betAmount: bet,
        chance: diceChance,
        rollType,
        win
    };
    
    checkLink.textContent = `Проверить игру #${gameId}`;
    checkLink.classList.remove('hidden');
    // --- КОНЕЦ ЛОГИКИ ХЭША ---
}

// --- ДОБАВЛЕНО: Функции модального окна хэша ---

/** Показывает модальное окно проверки хэша */
function showHashModal(e) {
    e.preventDefault();
    if (!lastGameData) return;

    // 1. Заполняем данные
    document.getElementById('hash-modal-game-id').textContent = `#${lastGameData.gameId}`;
    document.getElementById('hash-modal-combined').textContent = lastGameData.combined;
    document.getElementById('hash-modal-hash').textContent = lastGameData.hash;
    document.getElementById('hash-modal-salt1').textContent = lastGameData.salt1;
    document.getElementById('hash-modal-number').textContent = lastGameData.number;
    document.getElementById('hash-modal-salt2').textContent = lastGameData.salt2;
    
    document.getElementById('hash-modal-bet').textContent = `${lastGameData.betAmount.toFixed(2)} RUB`;
    document.getElementById('hash-modal-chance').textContent = `${lastGameData.chance.toFixed(2)}% (${lastGameData.rollType === 'under' ? 'Меньше' : 'Больше'})`;
    document.getElementById('hash-modal-result').textContent = lastGameData.win ? 'Выигрыш' : 'Проигрыш';

    // 2. Сбрасываем статус верификации
    const statusEl = document.getElementById('hash-verify-status');
    statusEl.textContent = '';
    statusEl.classList.remove('success', 'error');

    // 3. Показываем окно
    const modalOverlay = document.getElementById('hash-modal-overlay');
    if (modalOverlay) {
        modalOverlay.classList.remove('hidden');
    }
}

/** Скрывает модальное окно проверки хэша */
function hideHashModal() {
    const modalOverlay = document.getElementById('hash-modal-overlay');
    if (modalOverlay) {
        modalOverlay.classList.add('hidden');
    }
}

/**
 * Верифицирует хэш (запускается по кнопке)
 */
async function verifyHash() {
    const statusEl = document.getElementById('hash-verify-status');
    statusEl.textContent = 'Проверка...';
    statusEl.classList.remove('success', 'error');

    // 1. Получаем данные из модального окна
    const salt1 = document.getElementById('hash-modal-salt1').textContent;
    // Убираем '0' в начале, т.к. number был 'rollDisplay', а не 'rollRaw'
    const number = parseInt(document.getElementById('hash-modal-number').textContent, 10); 
    const salt2 = document.getElementById('hash-modal-salt2').textContent;
    const displayedHash = document.getElementById('hash-modal-hash').textContent;
    
    // 2. Воссоздаем строку (важно, чтобы она была идентична)
    const combined = `${salt1}|${number}|${salt2}`;
    
    // 3. Считаем хэш
    const calculatedHash = await sha256(combined);

    // 4. Сравниваем
    if (calculatedHash === displayedHash) {
        statusEl.textContent = '✅ Верификация успешна! Хэши совпадают.';
        statusEl.classList.add('success');
    } else {
        statusEl.textContent = `❌ Ошибка верификации! Хэши не совпадают. (Расчет: ${calculatedHash})`;
        statusEl.classList.add('error');
    }
}

// --- КОНЕЦ ФУНКЦИЙ МОДАЛЬНОГО ОКНА ---


function initDice() {
    const diceBetInput = document.getElementById('dice-bet');
    const diceChanceInput = document.getElementById('dice-chance');
    // ИЗМЕНЕНО: (ЗАДАНИЕ) Слушатель теперь на .dice-game-container
    const diceActionsContainer = document.querySelector('.dice-game-container');
    
    // [ИЗМЕНЕНО] Вызываем новую функцию для инициализации
    formatAndSyncDiceUI(); 

    if (diceActionsContainer) {
        // [ИЗМЕНЕНО] 'input' теперь вызывает только калькулятор
        diceBetInput.addEventListener('input', updateDiceCalculations);
        diceChanceInput.addEventListener('input', updateDiceCalculations);

        // [ИЗМЕНЕНО] 'blur' форматирует значение
        diceBetInput.addEventListener('blur', formatAndSyncDiceUI);
        diceChanceInput.addEventListener('blur', formatAndSyncDiceUI);

        // ИЗМЕНЕНО: (ЗАДАНИЕ) Ищем кнопки в .dice-input-group
        // ИЗМЕНЕНО: (ЗАДАНИЕ 2) Селектор .bet-actions-grid
        diceActionsContainer.querySelectorAll('.dice-input-group .bet-actions-grid button').forEach(button => {
            button.addEventListener('click', (e) => {
                // ИЗМЕНЕНО: (ЗАДАНИЕ) Классы теперь "bet-min", "chance-min" и т.д.
                const actionClass = Array.from(e.currentTarget.classList).find(cls => 
                    ['bet-min', 'bet-double', 'bet-half', 'bet-max', 'chance-min', 'chance-double', 'chance-half', 'chance-max'].includes(cls)
                );
                
                // [ИЗМЕНЕНО] handleDice...Action теперь сами вызывают formatAndSyncDiceUI
                if (actionClass && actionClass.startsWith('bet')) {
                    const action = actionClass.substring(4); // 'min', 'double', 'half', 'max'
                    handleDiceBetAction(action, diceBetInput);
                } else if (actionClass && actionClass.startsWith('chance')) {
                    const action = actionClass.substring(7); // 'min', 'double', 'half', 'max'
                    handleDiceChanceAction(action, diceChanceInput);
                }
            });
        });

        // ИЗМЕНЕНО: (ЗАДАНИЕ) Слушатели кнопок "Меньше" / "Больше"
        const rollUnderBtn = document.getElementById('roll-under');
        const rollOverBtn = document.getElementById('roll-over');
        
        if (rollUnderBtn) {
            rollUnderBtn.addEventListener('click', () => rollDice('under'));
        }
        if (rollOverBtn) {
            rollOverBtn.addEventListener('click', () => rollDice('over'));
        }
    }

    // --- ДОБАВЛЕНО: Слушатели модального окна хэша ---
    const checkLink = document.getElementById('dice-check-game');
    const hashModalOverlay = document.getElementById('hash-modal-overlay');
    const hashModalClose = document.getElementById('hash-modal-close');
    const hashVerifyBtn = document.getElementById('hash-verify-button');

    if (checkLink) {
        checkLink.addEventListener('click', showHashModal);
    }
    if (hashModalOverlay) {
        hashModalOverlay.addEventListener('click', (e) => {
            if (e.target === hashModalOverlay) {
                hideHashModal();
            }
        });
    }
    if (hashModalClose) {
        hashModalClose.addEventListener('click', hideHashModal);
    }
    if (hashVerifyBtn) {
        hashVerifyBtn.addEventListener('click', verifyHash);
    }
    // --- КОНЕЦ ---
}

export { initDice };
