/*
 * (НОВЫЙ ФАЙЛ)
 * Управляет логикой игры Keno.
 * (Версия 2.2 - Обновлены таблицы выплат)
 *
 * (ИЗМЕНЕНО):
 * 1. (ЗАДАЧА 2) Добавлена функция sleep() и REVEAL_SPEED_MS.
 * 2. (ЗАДАЧА 2) animateReveal() переписана для последовательного
 * показа 8 "выпавших" шаров с анимацией и
 * пошаговым обновлением шкалы выплат.
 * 3. (ЗАДАЧА 2 - НОВЫЙ ЗАПРОС) animateReveal() больше не убирает
 * класс .selected, чтобы подсветка выбора игрока оставалась.
 * 4. (ЗАДАЧА 1 из нового) updatePayoutScaleFill() теперь закрашивает все лапки по порядку.
 * 5. (ЗАДАЧА 2 из нового) animateReveal() больше не ставит '●' в синие ячейки.
 * 6. (ЗАДАЧА 1 из 2-го) updatePayoutTableUI() изменена для отображения множителей ПОД лапками.
 * 7. (НОВЫЙ ЗАПРОС) Добавлен Турбо-режим (isTurboMode)
 * 8. (НОВЫЙ ЗАПРОС 2) Переименован thunder.off.png в thunder_off.png
 * 9. **(ЗАДАЧА 6)**: Добавлен импорт и вызов `reduceWager` при ставке.
 */
import { currentBalance, updateBalance, writeBetToHistory, currentUser, reduceWager } from './global.js';

// --- КОНФИГУРАЦИЯ ИГРЫ ---
const KENO_GRID_SIZE = 40;
const KENO_DRAW_SIZE = 10; // Как в твоем коде
const MAX_SELECTION = 10;
// ИЗМЕНЕНО: (Задача 2) Добавлена скорость анимации
const REVEAL_SPEED_MS = 150; 

// --- ТАБЛИЦЫ ВЫПЛАТ ---
// (ИЗМЕНЕНО: ЗАДАЧИ 2, 3, 4)
const PAYOUT_TABLES = {
    // === ЛЕГКИЙ ===
    easy: {
        1: { 1: 3.96 },
        2: { 1: 2, 2: 3.8 },
        3: { 1: 1, 2: 2.2, 3: 20 },
        4: { 1: 0, 2: 2, 3: 8.4, 4: 100 },
        5: { 1: 0, 2: 1.5, 3: 3.6, 4: 20, 5: 250 },
        6: { 1: 0, 2: 1, 3: 2, 4: 7.5, 5: 100, 6: 700 },
        7: { 1: 0, 2: 1.2, 3: 1.6, 4: 3.5, 5: 15, 6: 225, 7: 700 },
        8: { 1: 0, 2: 1.1, 3: 1.5, 4: 2, 5: 3.5, 6: 39, 7: 100, 8: 800 },
        9: { 1: 0, 2: 1.2, 3: 1.3, 4: 1.7, 5: 2.5, 6: 7.5, 7: 50, 8: 250, 9: 1000 },
        10: { 1: 0, 2: 1.1, 3: 1.2, 4: 1.3, 5: 1.8, 6: 3.5, 7: 13, 8: 50, 9: 250, 10: 1000 }
    },
    // === СРЕДНИЙ ===
    medium: {
        1: { 1: 3.96 },
        2: { 1: 1.8, 2: 5.1 },
        3: { 1: 0, 2: 2.8, 3: 50 },
        4: { 1: 0, 2: 1.1, 3: 13.3, 4: 100 },
        5: { 1: 0, 2: 1, 3: 3, 4: 35, 5: 350 },
        6: { 1: 0, 2: 0, 3: 3, 4: 9, 5: 180, 6: 710 },
        7: { 1: 0, 2: 0, 3: 2, 4: 7, 5: 30, 6: 400, 7: 800 },
        8: { 1: 0, 2: 0, 3: 2, 4: 4, 5: 11, 6: 67, 7: 400, 8: 900 },
        9: { 1: 0, 2: 0, 3: 2, 4: 2.5, 5: 5, 6: 15, 7: 100, 8: 500, 9: 1000 },
        10: { 1: 0, 2: 0, 3: 1.6, 4: 2, 5: 4, 6: 7, 7: 25, 8: 100, 9: 500, 10: 1000 }
    },
    // === СЛОЖНЫЙ ===
    high: {
        1: { 1: 3.96 },
        2: { 1: 0, 2: 17.1 },
        3: { 1: 0, 2: 0, 3: 81.5 },
        4: { 1: 0, 2: 0, 3: 10, 4: 259 },
        5: { 1: 0, 2: 0, 3: 4.5, 4: 48, 5: 450 },
        6: { 1: 0, 2: 0, 3: 0, 4: 11, 5: 350, 6: 710 },
        7: { 1: 0, 2: 0, 3: 0, 4: 7, 5: 90, 6: 400, 7: 800 },
        8: { 1: 0, 2: 0, 3: 0, 4: 5, 5: 20, 6: 270, 7: 600, 8: 900 },
        9: { 1: 0, 2: 0, 3: 0, 4: 4, 5: 11, 6: 56, 7: 500, 8: 800, 9: 1000 },
        10: { 1: 0, 2: 0, 3: 0, 4: 3.5, 5: 8, 6: 13, 7: 64, 8: 500, 9: 800, 10: 1000 }
    }
};

// --- ЛОКАЛЬНЫЕ ПЕРЕМЕННЫЕ ---
let isGameActive = false;
let currentBet = 10.00;
let currentRisk = 'easy'; // (ИЗМЕНЕНО: по умолчанию 'easy' как в UI)
let selectedNumbers = []; // Номера, которые выбрал игрок
let drawnNumbers = []; // Номера, которые "выпали"
let isTurboMode = false; // ДОБАВЛЕНО: (Турбо-режим)

// --- ЭЛЕМЕНТЫ DOM (Новый UI) ---
let grid, betInput, riskSelector, playButton, clearButton, autoPickButton, payoutBar, statusElement;
let betHalfButton, betDoubleButton, betMinButton, betMaxButton;
// ИЗМЕНЕНО: (Задача 3) Добавлены элементы оверлея
let kenoResultOverlay, kenoResultMultiplier, kenoResultWinnings;
// ДОБАВЛЕНО: (Турбо-режим)
let turboButton, turboIcon;


/**
 * Создает сетку Keno 4x10
 */
function createGrid() {
    grid.innerHTML = '';
    for (let i = 1; i <= KENO_GRID_SIZE; i++) {
        const cell = document.createElement('button');
        cell.classList.add('keno-cell');
        cell.textContent = i;
        cell.setAttribute('data-number', i);
        cell.addEventListener('click', handleCellClick);
        grid.appendChild(cell);
    }
}

/**
 * (ПЕРЕРАБОТАНО) Обновляет горизонтальную шкалу выплат
 */
function updatePayoutTableUI() {
    payoutBar.innerHTML = '';
    const picks = selectedNumbers.length;
    
    // Если ничего не выбрано, показываем плейсхолдер
    if (picks === 0) {
        payoutBar.innerHTML = `<span class="keno-payout-placeholder">Выберите от 1 до 10 ячеек</span>`;
        return;
    }

    const table = PAYOUT_TABLES[currentRisk][picks];
    const maxHits = MAX_SELECTION; // Идем до 10

    for (let hits = 0; hits <= maxHits; hits++) {
        const multiplier = table[hits] || 0;
        
        // Показываем, только если есть в таблице
        if (table.hasOwnProperty(hits)) {
            const item = document.createElement('div');
            item.classList.add('keno-payout-item');
            if (multiplier === 0) {
                item.classList.add('zero');
            }
            item.setAttribute('data-hit-count', hits);
            
            // ИЗМЕНЕНО: (ЗАДАЧА 1 из 2-го) Новая структура с оберткой для лапок
            item.innerHTML = `
                <div class="keno-paw-wrapper">
                    <img src="assets/grey_paw.png" alt="Payout" class="payout-paw-grey">
                    <img src="assets/keno_paw.png" alt="Hit" class="payout-paw-keno">
                </div>
                <span class="mult">${multiplier}x</span>
                <span class="hits">${hits}</span>
            `;
            payoutBar.appendChild(item);
        }
    }
}

/**
 * (НОВАЯ ФУНКЦИЯ) Анимирует заполнение шкалы выплат
 * @param {number} hitCount - Текущее количество попаданий
 */
function updatePayoutScaleFill(hitCount) {
    const items = payoutBar.querySelectorAll('.keno-payout-item');
    let found = false;

    // ИЗМЕНЕНО: (ЗАДАЧА 1) Логика sequential fill
    items.forEach(item => {
        const itemHits = parseInt(item.getAttribute('data-hit-count'));
        
        // Пропускаем 0, если у нас есть хиты
        if (itemHits === 0 && hitCount > 0) {
             item.classList.remove('filled', 'active');
             return; // Пропускаем 0, если есть >0 хитов
        }

        // Если лапка <= кол-ву хитов, "активируем" ее
        if (itemHits <= hitCount) {
            item.classList.add('filled', 'active'); // Применяем оба класса
            if (itemHits === hitCount) {
                found = true; // Для обработки 0
            }
        } else {
            item.classList.remove('filled', 'active'); // Сбрасываем для тех, что больше
        }
    });

    // Обработка случая 0 хитов
    if (hitCount === 0 && !found) {
        const zeroItem = payoutBar.querySelector('[data-hit-count="0"]');
        if (zeroItem && !zeroItem.classList.contains('zero')) {
            zeroItem.classList.add('filled', 'active');
        }
    }
}


/**
 * Обновляет состояние кнопок (Играть, Авто-выбор, Очистить)
 */
function updateControlsUI() {
    const selectionCount = selectedNumbers.length;
    
    // Кнопка "Играть"
    playButton.disabled = (selectionCount === 0) || isGameActive;
    
    // Кнопка "Авто-выбор"
    // ИЗМЕНЕНО: (ЗАДАНИЕ 1) Убрана блокировка при 10 ячейках
    autoPickButton.disabled = isGameActive;
    
    // Кнопка "Очистить"
    clearButton.disabled = (selectionCount === 0) || isGameActive;
    
    // ДОБАВЛЕНО: (Турбо-режим)
    if (turboButton) turboButton.disabled = isGameActive;

    // Кнопки ставок
    [betHalfButton, betDoubleButton, betMinButton, betMaxButton, betInput].forEach(el => {
        if (el) el.disabled = isGameActive;
    });

    // Блокировка контролов во время игры
    if (isGameActive) {
        riskSelector.querySelectorAll('button').forEach(btn => btn.disabled = true);
        grid.classList.add('disabled');
    } else {
        riskSelector.querySelectorAll('button').forEach(btn => btn.disabled = false);
        grid.classList.remove('disabled');
    }
}

/**
 * ИЗМЕНЕНО: (Задача 3) Сбрасывает поле
 * @param {boolean} clearSelection - Если true, сбрасывает и выбор игрока.
 */
function resetGame(clearSelection = true) {
    isGameActive = false;
    drawnNumbers = [];

    // (Задача 3) Скрываем оверлей
    if (kenoResultOverlay) {
        kenoResultOverlay.classList.add('hidden');
    }
    
    // Сбрасываем стили ячеек
    grid.querySelectorAll('.keno-cell').forEach(cell => {
        cell.classList.remove('hit', 'miss', 'drawn', 'idle');
        cell.innerHTML = cell.getAttribute('data-number'); // Восстанавливаем номер
        cell.disabled = false;
        
        if (clearSelection) {
            cell.classList.remove('selected');
        }
    });
    
    statusElement.textContent = '';
    statusElement.classList.remove('win', 'loss');
    
    if (clearSelection) {
        selectedNumbers = [];
    }
    
    // (Задача 3) Обновляем шкалу, только если сбросили выбор
    if (clearSelection) {
        updatePayoutTableUI();
    }
    
    updateControlsUI();
}


/**
 * Обрабатывает клик по ячейке
 * @param {Event} e 
 */
function handleCellClick(e) {
    if (isGameActive) return;

    const cell = e.currentTarget;
    const number = parseInt(cell.getAttribute('data-number'));
    
    const index = selectedNumbers.indexOf(number);

    if (index > -1) {
        // Убираем
        selectedNumbers.splice(index, 1);
        cell.classList.remove('selected');
        
        // ИЗМЕНЕНО: (ЗАДАНИЕ 2) Сбрасываем стили (hit/drawn/miss) при снятии выбора
        cell.classList.remove('hit', 'miss', 'drawn', 'idle');
        cell.innerHTML = cell.getAttribute('data-number');
        
    } else {
        // Добавляем, если не достигнут лимит
        if (selectedNumbers.length < MAX_SELECTION) {
            selectedNumbers.push(number);
            cell.classList.add('selected');
        }
    }
    
    updatePayoutTableUI();
    updateControlsUI();
}

/**
 * Обрабатывает смену режима риска
 * @param {Event} e 
 */
function handleRiskChange(e) {
    const clickedButton = e.target.closest('.keno-risk-btn');
    if (!clickedButton || isGameActive) return;
    
    currentRisk = clickedButton.getAttribute('data-risk');
    
    // Обновляем UI кнопок
    riskSelector.querySelectorAll('.keno-risk-btn').forEach(btn => {
        btn.classList.toggle('active', btn === clickedButton);
    });
    
    updatePayoutTableUI();
}

/**
 * Очищает выбор (вызывает полный сброс)
 */
function handleClear() {
    if (isGameActive) return;
    resetGame(true); // ИЗМЕНЕНО: (Задача 3)
}

/**
 * Автоматический выбор ячеек
 */
function handleAutoPick() {
    // ИЗМЕНЕНО: (ЗАДАНИЕ 1) Убрана проверка selectedNumbers.length === MAX_SELECTION
    if (isGameActive) return;
    
    // Очищаем старый выбор перед авто-выбором
    handleClear();

    let availableNumbers = [];
    for (let i = 1; i <= KENO_GRID_SIZE; i++) {
        availableNumbers.push(i);
    }

    // Выбираем 10 случайных
    for (let i = 0; i < MAX_SELECTION; i++) {
        if (availableNumbers.length === 0) break;
        
        const randomIndex = Math.floor(Math.random() * availableNumbers.length);
        const number = availableNumbers.splice(randomIndex, 1)[0];
        
        selectedNumbers.push(number);
        
        // Обновляем UI
        const cell = grid.querySelector(`.keno-cell[data-number="${number}"]`);
        if (cell) {
            cell.classList.add('selected');
        }
    }
    
    updatePayoutTableUI();
    updateControlsUI();
}

/**
 * ДОБАВЛЕНО: (Турбо-режим) Переключает режим турбо
 */
function handleTurboToggle() {
    isTurboMode = !isTurboMode;
    
    if (isTurboMode) {
        if (turboIcon) turboIcon.src = 'assets/thunder_on.png';
        if (turboButton) turboButton.classList.add('active'); // Для стилей, если понадобятся
    } else {
        // ИЗМЕНЕНО: (Новый запрос 2) Используем thunder_off.png
        if (turboIcon) turboIcon.src = 'assets/thunder_off.png';
        if (turboButton) turboButton.classList.remove('active');
    }
}

/**
 * Запускает игру
 */
async function handlePlayKeno() {
    currentBet = parseFloat(betInput.value);
    
    if (isGameActive) return;
    if (selectedNumbers.length === 0) {
        statusElement.textContent = '⚠️ Выберите хотя бы 1 ячейку!';
        statusElement.classList.add('loss');
        return;
    }
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

    // --- Начинаем игру ---
    // ИЗМЕНЕНО: (Задача 3) Сбрасываем старые результаты, но сохраняем выбор
    resetGame(false); 
    
    isGameActive = true;
    updateControlsUI(); // Блокируем кнопки
    
    // ИЗМЕНЕНО: Убираем "Розыгрыш...", т.к. он мгновенный
    // statusElement.textContent = 'Розыгрыш...'; 
    statusElement.classList.remove('win', 'loss');
    
    // Снимаем ставку
    try {
        await updateBalance(-currentBet);
    } catch (error) {
        statusElement.textContent = '⚠️ Ошибка при снятии ставки.';
        statusElement.classList.add('loss');
        isGameActive = false;
        updateControlsUI();
        return;
    }
    
    // (ЗАДАЧА 6) Уменьшаем вейджер
    await reduceWager(currentBet);

    // --- Генерируем выигрышные номера ---
    drawnNumbers = [];
    const numberPool = Array.from({ length: KENO_GRID_SIZE }, (_, i) => i + 1);
    
    for (let i = 0; i < KENO_DRAW_SIZE; i++) {
        const randomIndex = Math.floor(Math.random() * numberPool.length);
        drawnNumbers.push(numberPool.splice(randomIndex, 1)[0]);
    }

    // --- ИЗМЕНЕНО: (Турбо-режим) ---
    let hitsCount = 0;

    if (isTurboMode) {
        // ТУРБО-РЕЖИМ: Мгновенный результат
        hitsCount = calculateHits(drawnNumbers, selectedNumbers);
        instantReveal(drawnNumbers, selectedNumbers, hitsCount);
    } else {
        // ОБЫЧНЫЙ РЕЖИМ: Анимация
        hitsCount = await animateReveal(drawnNumbers, selectedNumbers);
    }
    // --- КОНЕЦ ИЗМЕНЕНИЯ ---

    // --- Расчет выигрыша ---
    const picksCount = selectedNumbers.length;
    
    const multiplier = PAYOUT_TABLES[currentRisk][picksCount][hitsCount] || 0;
    const winnings = currentBet * multiplier;
    
    if (winnings > 0) {
        await updateBalance(winnings);
        // ИЗМЕНЕНО: (Задача 3) Статус-бар больше не нужен, используем оверлей
        // statusElement.textContent = `Выигрыш ${winnings.toFixed(2)} RUB (x${multiplier})`;
        // statusElement.classList.add('win');
    } else {
        // ИЗМЕНЕНО: (Задача 3)
        // statusElement.textContent = `Проигрыш ${currentBet.toFixed(2)} RUB`;
        // statusElement.classList.add('loss');
    }

    // Запись в историю
    writeBetToHistory({
        username: currentUser,
        game: 'keno',
        result: `${hitsCount}/${picksCount} (${multiplier.toFixed(2)}x)`,
        betAmount: currentBet,
        amount: winnings - currentBet,
        multiplier: `${multiplier.toFixed(2)}x`
    });
    
    // ИЗМЕНЕНО: (Задача 3) Показываем оверлей вместо setTimeout
    if (kenoResultOverlay && kenoResultMultiplier && kenoResultWinnings) {
        kenoResultMultiplier.textContent = `${multiplier.toFixed(2)}x`;
        kenoResultWinnings.textContent = `${winnings.toFixed(2)} RUB`;
        
        // (Задача 3) Убираем/добавляем классы win/loss для цвета
        kenoResultOverlay.classList.remove('win', 'loss');
        if (winnings > 0) {
            kenoResultOverlay.classList.add('win');
        } else {
            kenoResultOverlay.classList.add('loss');
        }
        
        kenoResultOverlay.classList.remove('hidden');
    }
    
    // (Задача 3) Сбрасываем isGameActive, чтобы можно было играть снова
    isGameActive = false;
    updateControlsUI();
}

// --- Функции Анимации (НОВЫЕ) ---

// ИЗМЕНЕНО: (ЗАДАЧА 2) Добавлена функция sleep
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * (ИЗМЕНЕНО: ЗАДАЧА 2) Анимация открытия ячеек (ПОСЛЕДОВАТЕЛЬНАЯ)
 * @param {Array<number>} drawnNumbers - Массив выпавших номеров
 * @param {Array<number>} selectedNumbers - Массив номеров игрока
 * @returns {Promise<number>} Количество попаданий (hits)
 */
async function animateReveal(drawnNumbers, selectedNumbers) {
    let currentHits = 0;
    
    // 1. Поочередно открываем ВЫПАВШИЕ 8 номеров
    for (const number of drawnNumbers) {
        // Ждем перед показом
        await sleep(REVEAL_SPEED_MS);
        
        const cell = grid.querySelector(`.keno-cell[data-number="${number}"]`);
        if (!cell) continue;

        const isSelected = selectedNumbers.includes(number);

        if (isSelected) {
            // Попадание
            // ИЗМЕНЕНО: (ЗАДАЧА 2) НЕ убираем .selected
            // cell.classList.remove('selected'); 
            cell.classList.add('hit'); // Добавляем зеленый
            cell.innerHTML = `<img src="assets/keno_paw.png" alt="Hit" class="keno-cell-icon">`;
            currentHits++;
        } else {
            // Выпало, но не выбрано
            cell.classList.add('drawn');
            // ИЗМЕНЕНО: (ЗАДАЧА 2) Убираем точку
            cell.innerHTML = ''; 
        }
        
        // Обновляем шкалу ПОСЛЕ каждого шара
        updatePayoutScaleFill(currentHits);
    }
    
    // 2. Небольшая пауза
    await sleep(REVEAL_SPEED_MS * 3);
    
    // 3. Мгновенно показываем "промахи" (miss) и "пустые" (idle)
    for (let i = 1; i <= KENO_GRID_SIZE; i++) {
        const isDrawn = drawnNumbers.includes(i);
        // Если номер уже "выпал" (hit или drawn), пропускаем
        if (isDrawn) continue; 
        
        const cell = grid.querySelector(`.keno-cell[data-number="${i}"]`);
        if (!cell) continue;
        
        const isSelected = selectedNumbers.includes(i);

        if (isSelected) {
            // Выбрано, но не выпало = Промах
            // ИЗМЕНЕНО: (ЗАДАЧА 2) НЕ убираем .selected
            // cell.classList.remove('selected');
            cell.classList.add('miss');
        } else {
            // Не выбрано и не выпало = Пустая
            cell.classList.add('idle');
        }
    }
    
    return currentHits; // Возвращаем итоговое число
}


/**
 * ДОБАВЛЕНО: (Турбо-режим) Мгновенный подсчет
 */
function calculateHits(drawn, selected) {
    let hits = 0;
    for (const number of drawn) {
        if (selected.includes(number)) {
            hits++;
        }
    }
    return hits;
}

/**
 * ДОБАВЛЕНО: (Турбо-режим) Мгновенное отображение результата
 */
function instantReveal(drawnNumbers, selectedNumbers, hitsCount) {
    // Мгновенно показываем "промахи" (miss), "попадания" (hit) и "выпавшие" (drawn)
    for (let i = 1; i <= KENO_GRID_SIZE; i++) {
        const cell = grid.querySelector(`.keno-cell[data-number="${i}"]`);
        if (!cell) continue;
        
        const isSelected = selectedNumbers.includes(i);
        const isDrawn = drawnNumbers.includes(i);

        if (isSelected && isDrawn) {
            // Попадание
            cell.classList.add('hit');
            cell.innerHTML = `<img src="assets/keno_paw.png" alt="Hit" class="keno-cell-icon">`;
        } else if (isSelected && !isDrawn) {
            // Выбрано, но не выпало = Промах
            cell.classList.add('miss');
        } else if (!isSelected && isDrawn) {
            // Выпало, но не выбрано
            cell.classList.add('drawn');
            cell.innerHTML = '';
        } else {
            // Не выбрано и не выпало = Пустая
            cell.classList.add('idle');
        }
    }
    
    // Мгновенно обновляем шкалу
    updatePayoutScaleFill(hitsCount);
}


/**
 * Инициализация Keno
 */
export function initKeno() {
    // Поиск элементов (Новый UI)
    grid = document.getElementById('keno-grid');
    betInput = document.getElementById('keno-bet');
    riskSelector = document.getElementById('keno-risk-selector');
    playButton = document.getElementById('keno-play-button');
    clearButton = document.getElementById('keno-clear-button');
    autoPickButton = document.getElementById('keno-autopick-button');
    payoutBar = document.getElementById('keno-payout-bar');
    statusElement = document.getElementById('keno-status');
    
    // Кнопки ставок
    betHalfButton = document.querySelector('#keno-game .bet-half');
    betDoubleButton = document.querySelector('#keno-game .bet-double');
    betMinButton = document.querySelector('#keno-game .bet-min');
    betMaxButton = document.querySelector('#keno-game .bet-max');

    // ИЗМЕНЕНО: (Задача 3) Ищем элементы оверлея
    kenoResultOverlay = document.getElementById('keno-result-overlay');
    kenoResultMultiplier = document.getElementById('keno-result-multiplier');
    kenoResultWinnings = document.getElementById('keno-result-winnings');
    
    // ДОБАВЛЕНО: (Турбо-режим)
    turboButton = document.getElementById('keno-turbo-button');
    if (turboButton) {
        turboIcon = turboButton.querySelector('img');
    }

    if (!grid) return; // Мы не на странице Keno

    // --- Слушатели ---
    riskSelector.addEventListener('click', handleRiskChange);
    playButton.addEventListener('click', handlePlayKeno);
    clearButton.addEventListener('click', handleClear);
    autoPickButton.addEventListener('click', handleAutoPick);
    
    // ДОБАВЛЕНО: (Турбо-режим)
    if (turboButton) {
        turboButton.addEventListener('click', handleTurboToggle);
    }
    
    // ИЗМЕНЕНО: (ЗАДАНИЕ 1) Добавляем слушатель на оверлей для закрытия
    if (kenoResultOverlay) {
        kenoResultOverlay.addEventListener('click', () => {
            kenoResultOverlay.classList.add('hidden');
        });
    }

    // Слушатели кнопок ставок
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
    createGrid();
    resetGame(true); // ИЗМЕНЕНО: (Задача 3)
}
