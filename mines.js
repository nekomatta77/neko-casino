/*
 * Краткое описание апгрейда:
 * 1. **(ЗАДАНИЕ 1)**: Смайлик "💣" заменен на изображение `assets/mines_mine.png` (с классом `.mine-cell-icon`) в функциях `handleCellClick` (при проигрыше) и `showAllMines` (при отображении всех мин).
 * 2. **(ЗАДАНИЕ 2)**: Обновлена логика `handleCellClick` (проигрыш) и `cashoutGame` (выигрыш),
 * чтобы использовать `statusElement.textContent` и классы `.win` / `.loss` для
 * отображения прямоугольника статуса, как в Dice.
 * 3. **(ЗАДАНИЕ 2)**: В `startGame` добавлен сброс текста и классов у `statusElement`.
 * 4. **(ЗАДАНИЕ 3)**: Добавлена приписка "RUB" в статус-бар.
 * 5. **(НОВЫЙ АПДЕЙТ)**: Добавлен импорт и вызов `reduceWager` при ставке.
 */
import { currentBalance, updateBalance, MINES_GRID_SIZE, writeBetToHistory, currentUser, reduceWager } from './global.js';

// --- ЛОКАЛЬНЫЕ ПЕРЕМЕННЫЕ MINES ---
let isGameActive = false;
let currentMines = 3;
let currentBet = 10.00;
let safeCells = []; 
let revealedCount = 0;
let currentPayout = 0.00; // Добавлено для отслеживания суммы кэшаута

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ МНОЖИТЕЛЕЙ ---

/**
 * Рассчитывает полный кумулятивный множитель для заданного числа безопасных ячеек.
 * @param {number} safeCount - Количество открытых безопасных ячеек.
 * @param {number} totalMines - Общее количество мин.
 * @returns {number} Общий множитель для кэшаута.
 */
function getMultiplierForSafeCells(safeCount, totalMines) {
    const total = MINES_GRID_SIZE; // 25
    const safe = total - totalMines; 

    if (safeCount === 0) return 1.00;
    if (safeCount > safe) return 0;

    let cumulativeMultiplier = 1.00;
    
    for (let i = 0; i < safeCount; i++) {
        const probability = (safe - i) / (total - i);
        // Multiplier step: (1 / probability) * 0.99 (RTP)
        const stepMultiplier = 0.99 / probability;
        cumulativeMultiplier *= stepMultiplier;
    }

    return parseFloat(cumulativeMultiplier.toFixed(2));
}

/**
 * Рассчитывает множитель, который будет применен к текущему выигрышу при следующем безопасном клике.
 * @param {number} cellsFound - Количество открытых безопасных ячеек.
 * @param {number} totalMines - Общее количество мин.
 * @returns {number} Множитель для следующего шага.
 */
function getNextMultiplierStep(cellsFound, totalMines) {
    const total = MINES_GRID_SIZE; // 25
    const safe = total - totalMines; 
    const i = cellsFound; // Индекс ячейки, которую мы пытаемся открыть

    // Если все безопасные ячейки уже найдены, возвращаем 0
    if (i >= safe) return 0.00; 

    // Вероятность следующей безопасной ячейки
    const probability = (safe - i) / (total - i);
    
    // Множитель шага (с учетом 1% комиссии)
    const stepMultiplier = (1 / probability) * 0.99;
    
    return parseFloat(stepMultiplier.toFixed(4));
}


// --- ОСНОВНАЯ ЛОГИКА ---

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

async function startGame() {
    // ИЗМЕНЕНО: currentBet уже должен быть обновлен из-за слушателей
    // currentBet = parseFloat(document.getElementById('mines-bet').value);
    
    // ИЗМЕНЕНО: Считываем из нового input
    currentMines = parseInt(document.getElementById('mines-count-input').value); 

    if (currentBet <= 0 || isNaN(currentBet) || currentMines < 1 || currentMines > 24 || isNaN(currentMines)) {
        document.getElementById('mines-status').textContent = '⚠️ Проверьте ставку и количество мин (от 1 до 24)!';
        return;
    }
    
    if (currentBet > currentBalance) {
        // ИЗМЕНЕНО: (ЗАДАЧА 2)
        const statusElement = document.getElementById('mines-status');
        statusElement.textContent = '⚠️ Недостаточно средств!';
        statusElement.classList.add('loss');
        return;
    }
    
    // Инициализация игры
    isGameActive = true;
    revealedCount = 0;
    currentPayout = 0.00;
    
    // Снимаем ставку с баланса
    await updateBalance(-currentBet);
    
    // (ДОБАВЛЕНО) Уменьшаем вейджер
    await reduceWager(currentBet);
    
    createMinesGrid(); // Создаем новое поле
    placeMines(currentMines); // Расставляем мины (см. ниже)
    
    // ИЗМЕНЕНО: (ЗАДАНИЕ 2)
    const statusElement = document.getElementById('mines-status');
    statusElement.textContent = ''; // Убираем текст 'Игра активна...'
    statusElement.classList.remove('win', 'loss'); // Сбрасываем классы
    
    // Обновляем UI после старта
    updateMinesUI(); 
    
    // Добавляем обработчики кликов только на активные ячейки
    document.querySelectorAll('.mine-cell.closed').forEach(cell => {
        cell.addEventListener('click', handleCellClick, { once: true });
    });
}

/**
 * Обновляет панель статистики и состояние кнопок.
 */
function updateMinesUI() {
    const multiplierDisplay = document.getElementById('mines-multiplier');
    const payoutDisplay = document.getElementById('mines-payout');
    const startButton = document.getElementById('mines-start-button');
    const cashoutButton = document.getElementById('mines-cashout-button');
    
    // Управление доступностью элементов управления
    const controls = document.querySelector('.mines-controls');
    controls.style.opacity = isGameActive ? 0.5 : 1;
    controls.style.pointerEvents = isGameActive ? 'none' : 'auto';
    
    // Рассчитываем множитель для текущего или первого клика
    const currentTotalMultiplier = getMultiplierForSafeCells(revealedCount, currentMines);
    
    // ИЗМЕНЕНО: Используем 'currentBet' вместо чтения из DOM
    const betAmount = currentBet; 
    
    if (isGameActive) {
        // --- Логика для активной игры ---
        
        // 1. Рассчитываем множитель, который будет применен к текущему ВЫИГРЫШУ при СЛЕДУЮЩЕМ клике
        const nextStepMultiplier = getNextMultiplierStep(revealedCount, currentMines); 
        
        // 2. Текущий потенциальный выигрыш (сумма кэшаута)
        currentPayout = betAmount * currentTotalMultiplier;
        
        // 3. СЛЕДУЮЩИЙ общий множитель, если следующий клик безопасный
        const nextTotalMultiplier = nextStepMultiplier * currentTotalMultiplier;
        
        // Обновление UI
        multiplierDisplay.textContent = `${nextTotalMultiplier.toFixed(2)}x`; // СЛЕДУЮЩИЙ множитель
        payoutDisplay.textContent = `${currentPayout.toFixed(2)} RUB`; // Текущий выигрыш
        
        // Обновление кнопки Кэшаут (Пункт 6: меняем на "Забрать")
        cashoutButton.textContent = `Забрать (${currentPayout.toFixed(2)} RUB)`;
        cashoutButton.classList.remove('hidden');
        startButton.classList.add('hidden');
        
    } else {
        // --- Логика для неактивной игры (до/после) ---
        
        // Множитель для первого клика
        const firstClickMultiplier = getNextMultiplierStep(0, currentMines);
        const firstClickPayout = betAmount * firstClickMultiplier;
        
        multiplierDisplay.textContent = `${firstClickMultiplier.toFixed(2)}x`; // Множитель для первого клика
        payoutDisplay.textContent = `${firstClickPayout.toFixed(2)} RUB`; // Потенциальный выигрыш за первый клик
        
        cashoutButton.classList.add('hidden');
        startButton.classList.remove('hidden');
        cashoutButton.textContent = `Забрать`; // Сброс текста кнопки (Пункт 6)
    }
}


function placeMines(count) {
    const grid = document.getElementById('mines-grid');
    if (!grid) return;

    safeCells = Array(MINES_GRID_SIZE).fill(false);
    const mineIndices = new Set();
    
    while (mineIndices.size < count) {
        const randomIndex = Math.floor(Math.random() * MINES_GRID_SIZE);
        mineIndices.add(randomIndex);
    }

    mineIndices.forEach(index => {
        safeCells[index] = true; // true = Mine
    });
}

function showAllMines(didWin) {
    const cells = document.querySelectorAll('.mine-cell');
    cells.forEach((cell, index) => {
        cell.removeEventListener('click', handleCellClick);
        if (cell.classList.contains('closed')) {
            cell.classList.remove('closed');
            if (safeCells[index]) {
                cell.classList.add('bomb');
                // ИЗМЕНЕНО: (Задача 1)
                cell.innerHTML = `<img src="assets/mines_mine.png" alt="Mine" class="mine-cell-icon">`;
            } else {
                cell.classList.add('safe');
                // ИЗМЕНЕНО: (Задание 1) Заменяем звездочку на картинку
                cell.innerHTML = `<img src="assets/mines_fish.png" alt="Fish" class="mine-cell-icon">`;
            }
        }
    });
}

function handleCellClick(e) {
    if (!isGameActive) return;

    const cell = e.currentTarget;
    const index = parseInt(cell.getAttribute('data-index'));

    if (safeCells[index]) {
        // БАБАХ!
        cell.classList.remove('closed');
        cell.classList.add('bomb');
        // ИЗМЕНЕНО: (Задача 1)
        cell.innerHTML = `<img src="assets/mines_mine.png" alt="Mine" class="mine-cell-icon">`;
        
        showAllMines(false);
        
        // ИЗМЕНЕНО: (ЗАДАНИЕ 3) Добавлена "RUB"
        const statusElement = document.getElementById('mines-status');
        statusElement.textContent = `Проигрыш ${currentBet.toFixed(2)} RUB`;
        statusElement.classList.add('loss');
        
        // ДОБАВЛЕНО: (Задание) Отправляем проигрыш в историю
        const betData = {
            username: currentUser,
            game: 'mines',
            result: '💣 BOMB',
            betAmount: currentBet, // ИЗМЕНЕНО: (Задание 2) Добавляем сумму ставки
            amount: -currentBet, // Сумма чистого проигрыша
            multiplier: '0.00x' // ИЗМЕНЕНО: (Запрос 1)
        };
        writeBetToHistory(betData);
        
        endGame(false);
        
    } else {
        // Безопасно
        cell.classList.remove('closed');
        cell.classList.add('safe');
        // ИЗМЕНЕНО: (Задание 1) Заменяем звездочку на картинку
        cell.innerHTML = `<img src="assets/mines_fish.png" alt="Fish" class="mine-cell-icon">`;
        revealedCount++;
        
        // Проверяем, если все безопасные ячейки найдены
        if (revealedCount === MINES_GRID_SIZE - currentMines) {
            cashoutGame(); // Автоматический кэшаут
        }
        
        updateMinesUI();
    }
}

async function cashoutGame() {
    if (!isGameActive) return;
    
    // Рассчитываем финальную сумму выигрыша
    const finalMultiplier = getMultiplierForSafeCells(revealedCount, currentMines);
    const totalWinnings = currentBet * finalMultiplier;
    
    // ДОБАВЛЕНО: (Задание) Отправляем выигрыш в историю
    const netProfit = totalWinnings - currentBet;
    const betData = {
        username: currentUser,
        game: 'mines',
        result: `${finalMultiplier.toFixed(2)}x`,
        betAmount: currentBet, // ИЗМЕНЕНО: (Задание 2) Добавляем сумму ставки
        amount: netProfit, // Сумма чистого выигрыша
        multiplier: `${finalMultiplier.toFixed(2)}x` // ИЗМЕНЕНО: (Запрос 1)
    };
    writeBetToHistory(betData);

    // Зачисляем выигрыш (текущая ставка была снята в startGame)
    // totalWinnings - это общая сумма, которую игрок получает обратно.
    await updateBalance(totalWinnings); 
    
    showAllMines(true); 
    
    // ИЗМЕНЕНО: (ЗАДАНИЕ 3) Добавлена "RUB"
    const statusElement = document.getElementById('mines-status');
    statusElement.textContent = `Выигрыш ${totalWinnings.toFixed(2)} RUB`;
    statusElement.classList.add('win');
    
    endGame(true);
}

function endGame(didWin) {
    isGameActive = false;
    currentPayout = 0.00; 
    
    // Перезагрузка UI в пред-игровое состояние
    updateMinesUI(); 
    
    // ИЗМЕНЕНО: (ЗАДАНИЕ 2) Логика очистки статуса удалена,
    // так как сброс теперь происходит в `startGame`.
    
    // Сброс счетчиков
    revealedCount = 0;
}

document.addEventListener('DOMContentLoaded', () => {
    
    const startButton = document.getElementById('mines-start-button');
    if (startButton) {
        startButton.addEventListener('click', startGame);
    }
    
    const cashoutButton = document.getElementById('mines-cashout-button');
    if (cashoutButton) {
        cashoutButton.addEventListener('click', cashoutGame);
    }
    
    // Инициализация при изменении ставки/мин
    const betInput = document.getElementById('mines-bet');
    
    // ИЗМЕНЕНО: (Task 4) Обновляем currentBet при вводе
    if (betInput) {
        betInput.addEventListener('input', () => {
            let newVal = parseFloat(betInput.value);
            if (isNaN(newVal)) newVal = 0; // 0, чтобы можно было стереть
            currentBet = newVal; 
            updateMinesUI();
        });
        // Дополнительно форматируем при потере фокуса
        betInput.addEventListener('blur', () => {
            if (isNaN(currentBet) || currentBet < 1.00) {
                currentBet = 1.00;
            }
            betInput.value = currentBet.toFixed(2);
            updateMinesUI();
        });
    }
    
    // ИЗМЕНЕНО: Старый слушатель ползунка удален
});


export function initMines() {
    // 1. ИЗМЕНЕНО: Инициализация кнопок и инпута выбора мин
    const minesCountInput = document.getElementById('mines-count-input');
    const minesCountButtons = document.querySelectorAll('.mines-count-btn');

    if (minesCountInput && minesCountButtons) {
        
        // Вспомогательная функция для обновления активной кнопки
        const updateActiveButton = (count) => {
            let countAsInt = parseInt(count);
            minesCountButtons.forEach(btn => {
                if (btn.getAttribute('data-count') == countAsInt) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
            // Если число не из кнопок, сбрасываем все
            if (![5, 10, 15, 24].includes(countAsInt)) {
                minesCountButtons.forEach(btn => btn.classList.remove('active'));
            }
        };

        // Устанавливаем значение по умолчанию (currentMines = 3)
        minesCountInput.value = currentMines;
        updateActiveButton(currentMines);

        // Слушатели для кнопок
        minesCountButtons.forEach(button => {
            button.addEventListener('click', () => {
                const count = parseInt(button.getAttribute('data-count'));
                currentMines = count;
                minesCountInput.value = count;
                updateActiveButton(count);
                if (!isGameActive) { 
                    updateMinesUI();
                }
            });
        });

        // Слушатели для инпута
        minesCountInput.addEventListener('input', () => {
            let val = parseInt(minesCountInput.value);
            // Не даем вводить 0 или > 24
            if (val > 24) val = 24;
            
            if (isNaN(val) || val < 1) {
                currentMines = 1; // Не устанавливаем 1 в поле, даем стереть
            } else {
                currentMines = val;
            }
            
            updateActiveButton(currentMines);
            if (!isGameActive) {
                updateMinesUI();
            }
        });
        
        minesCountInput.addEventListener('blur', () => {
            // Окончательная проверка при потере фокуса
            if (isNaN(currentMines) || currentMines < 1) {
                currentMines = 1;
            } else if (currentMines > 24) {
                currentMines = 24;
            }
            minesCountInput.value = currentMines; // Форматируем поле
            updateActiveButton(currentMines);
            if (!isGameActive) {
                updateMinesUI();
            }
        });
    }
    // --- КОНЕЦ ИЗМЕНЕНИЙ ---

    // 2. Кнопки ½ и x2
    const betInput = document.getElementById('mines-bet');
    const betHalfButton = document.querySelector('.mines-controls .bet-half');
    const betDoubleButton = document.querySelector('.mines-controls .bet-double');

    if (betHalfButton) {
        betHalfButton.addEventListener('click', () => {
            let currentVal = parseFloat(betInput.value);
            if (isNaN(currentVal)) currentVal = 0;
            
            let newVal = Math.max(1.00, currentVal / 2); 
            betInput.value = newVal.toFixed(2);
            currentBet = newVal; // ИЗМЕНЕНО: (Task 4)
            updateMinesUI();
        });
    }

    if (betDoubleButton) {
        betDoubleButton.addEventListener('click', () => {
            let currentVal = parseFloat(betInput.value);
            if (isNaN(currentVal)) currentVal = 0;
            
            let newVal = Math.min(currentBalance, currentVal * 2);
            betInput.value = newVal.toFixed(2);
            currentBet = newVal; // ИЗМЕНЕНО: (Task 4)
            updateMinesUI();
        });
    }
    
    // ИЗМЕНЕНО: (Задание 3) Исправлены селекторы
    const betMinButton = document.querySelector('.mines-controls .bet-min');
    const betMaxButton = document.querySelector('.mines-controls .bet-max');
    
    if (betMinButton) {
        betMinButton.addEventListener('click', () => {
            let newVal = 1.00; // Мин. ставка
            betInput.value = newVal.toFixed(2);
            currentBet = newVal; 
            updateMinesUI(); 
        });
    }
    
    if (betMaxButton) {
        betMaxButton.addEventListener('click', () => {
            // Используем currentBalance, который импортирован из global.js
            let newVal = currentBalance; 
            betInput.value = newVal.toFixed(2);
            currentBet = newVal; 
            updateMinesUI(); 
        });
    }
    
    // Инициализируем UI при старте
    updateMinesUI();
    createMinesGrid(); 
}
