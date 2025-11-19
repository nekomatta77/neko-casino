/*
 * (ВОССТАНОВЛЕНО И ОБНОВЛЕНО)
 * 1. Файл восстановлен до полной версии.
 * 2. Добавлен импорт и вызов `reduceWager` (ЗАДАЧА 6)
 */
import { currentBalance, updateBalance, writeBetToHistory, currentUser, reduceWager } from './global.js';

// --- ЛОКАЛЬНЫЕ ПЕРЕМЕННЫЕ CRASH ---
let crashBet = 10.00;
let isGameRunning = false;
let isBetPlaced = false; // Отслеживает, сделал ли игрок ставку в *текущем* раунде
let currentMultiplier = 1.00;
let crashPoint = 0; // Множитель, на котором игра "крашнется"
let startTime = 0;
let animationFrameId = null;

// --- ДОБАВЛЕНО: Переменные для Авто-вывода ---
let isAutoCashoutEnabled = false;
let autoCashoutTarget = 2.00;
// ---

// --- НОВЫЕ ПЕРЕМЕННЫЕ ДЛЯ ГРАФИКА ---
let graphMaxTime = 10000; // (ms) - Динамический
let graphMaxMultiplier = 5.0; // (x) - Динамический
let isCrashed = false; // Отслеживает, рисуем ли мы состояние "после краша"
let didPlayerWin = false; // Флаг для отслеживания кэшаута
let cashoutMultiplierValue = 0.00; // Для хранения зафиксированного значения

// --- ЭЛЕМЕНТЫ DOM ---
let betInput, startButton, cashoutButton, multiplierDisplay, canvas, ctx, statusElement;
let savedMultiplierDisplay; // Элемент для отображения забранного множителя
// --- ДОБАВЛЕНО: Элементы Авто-вывода ---
let autoCashoutToggle, autoCashoutInput, autoCashoutWrapper;
// ---

// --- КОНСТАНТЫ ДЛЯ СЕТКИ ---
const NUM_GRID_LINES_X = 5; // 5 вертикальных линий для времени
const NUM_GRID_LINES_Y = 5; // 5 горизонтальных линий для множителя

/**
 * Генерирует точку "краша".
 */
function generateCrashPoint() {
    // Math.random() дает [0, 1). 1 - Math.random() дает (0, 1].
    // 1 / (1 - Math.random()) дает [1, Infinity), с сильным смещением к 1.
    let point = 1 / (1 - Math.random());
    
    // Ограничиваем максимальный множитель 500x и минимальный 1.01x
    point = Math.min(point, 500);
    point = Math.max(point, 1.01);
    
    return parseFloat(point.toFixed(2));
}

// --- НОВЫЕ ХЕЛПЕРЫ ДЛЯ РИСОВАНИЯ ГРАФИКА ---

/** * Преобразует время (ms) в координату X на канвасе */
function mapTimeToX(elapsed) {
    return (elapsed / graphMaxTime) * canvas.width;
}

/** * Преобразует множитель (x) в координату Y на канвасе */
function mapMultiplierToY(multiplier) {
    const baseMultiplier = 1.0;
    const minYRange = 1.0; // Минимальный диапазон (1.0x до 2.0x)
    
    const yRange = Math.max(minYRange, graphMaxMultiplier - baseMultiplier);
    return canvas.height - ((multiplier - baseMultiplier) / yRange) * canvas.height;
}

/** * Преобразует координату X на канвасе обратно во время (ms) */
function mapXToTime(pixelX) {
    return (pixelX / canvas.width) * graphMaxTime;
}

/**
 * Рассчитывает множитель на основе прошедшего времени.
 * @param {number} elapsed - Время в миллисекундах.
 */
function calculateMultiplier(elapsed) {
    // Экспоненциальный рост. 
    const multiplier = Math.pow(1.0115, elapsed / 100); 
    return multiplier;
}

/**
 * Обновляет текст кнопки "Забрать" с текущей суммой выигрыша.
 * @param {number} multiplier - Текущий множитель.
 */
function updateCashoutButtonUI(multiplier) {
    if (cashoutButton && isBetPlaced && isGameRunning) {
        // Вычисляем сумму выигрыша
        const bet = crashBet;
        // Расчет выигрыша: Ставка * Множитель (округляем до двух знаков)
        const payout = (bet * multiplier).toFixed(2);
        
        // Динамически меняем текст: Забрать <<сумма>>
        cashoutButton.textContent = `Забрать ${payout} RUB`;
        // Добавляем класс, чтобы кнопка выглядела активно (синий цвет)
        cashoutButton.classList.add('blue-button');
    }
}

/**
 * Основной игровой цикл, вызываемый через requestAnimationFrame.
 */
function gameLoop() {
    const elapsed = performance.now() - startTime;
    let rawMultiplier = calculateMultiplier(elapsed);
    
    // Динамическое масштабирование
    if (elapsed > graphMaxTime) {
        graphMaxTime = elapsed * 1.2;
    }
    if (rawMultiplier > graphMaxMultiplier) {
        graphMaxMultiplier = rawMultiplier * 1.2;
    }
    
    // Проверяем, достигнут ли краш
    if (rawMultiplier >= crashPoint) {
        // Достигли точки краша, завершаем игру
        currentMultiplier = crashPoint;
        endGame(didPlayerWin); // Передаем флаг, чтобы знать, кто выиграл/проиграл
        return;
    }
    
    // Обновляем текущий множитель
    currentMultiplier = rawMultiplier;

    // --- ОБНОВЛЕНО: Рисуем график ---
    drawGraph(elapsed, currentMultiplier, false);
    // ---
    
    // Если isGameRunning = true, мы в фазе активной игры.
    if (isGameRunning) {
        // --- ДОБАВЛЕНО: Проверка Авто-вывода ---
        if (isAutoCashoutEnabled && isBetPlaced && currentMultiplier >= autoCashoutTarget) {
            cashout();
            // cashout() изменит isGameRunning на false,
            // поэтому мы сразу перейдем к 'simulating'
        } else {
            updateMultiplierDisplay(currentMultiplier, 'running');
            updateCashoutButtonUI(currentMultiplier); // <-- НОВЫЙ ВЫЗОВ
        }
        // ---
        
        animationFrameId = requestAnimationFrame(gameLoop);

    } else {
        // Если isGameRunning = false, но игра еще не крашнулась, 
        // значит, игрок забрал. Главный множитель продолжает расти по центру.
        updateMultiplierDisplay(currentMultiplier, 'simulating'); // <-- НОВОЕ СОСТОЯНИЕ
        animationFrameId = requestAnimationFrame(gameLoop);
    }
}

/**
 * Обновляет текстовый дисплей множителя и его цвет.
 */
function updateMultiplierDisplay(multiplier, state = 'running', finalCrashPoint = null) {
    if (!multiplierDisplay) return;

    if (state === 'running') {
        // Центр (растет, игра активна)
        multiplierDisplay.textContent = `${multiplier.toFixed(2)}x`;
        multiplierDisplay.style.color = 'var(--color-orange)'; // Желтый/Оранжевый
        multiplierDisplay.classList.remove('win', 'loss', 'hidden');
        if (savedMultiplierDisplay) savedMultiplierDisplay.classList.add('hidden'); // Скрываем маленький
    
    } else if (state === 'simulating') {
        // Центр (растет после кэшаута)
        multiplierDisplay.textContent = `${multiplier.toFixed(2)}x`;
        multiplierDisplay.style.color = 'var(--color-orange)'; // Желтый/Оранжевый
        multiplierDisplay.classList.remove('win', 'loss', 'hidden');
        if (savedMultiplierDisplay) savedMultiplierDisplay.classList.remove('hidden'); // Показываем маленький
        
    } else if (state === 'win') {
        // Маленький слева (фиксированный выигрыш)
        if (savedMultiplierDisplay) {
            savedMultiplierDisplay.textContent = `${multiplier.toFixed(2)}x`; 
            savedMultiplierDisplay.classList.remove('hidden');
        }
        
    } else if (state === 'loss') {
        // Центр (финальный краш)
        multiplierDisplay.textContent = `${finalCrashPoint.toFixed(2)}x`; 
        multiplierDisplay.classList.add('loss');
        multiplierDisplay.classList.remove('win', 'hidden');
        multiplierDisplay.style.color = ''; // Красный берется из CSS .loss
        // Если игрок проиграл, скрываем маленький множитель, иначе оставляем видимым
        if (!didPlayerWin && savedMultiplierDisplay) savedMultiplierDisplay.classList.add('hidden'); 
        
    } else if (state === 'idle') {
        // Центр (ожидание)
        multiplierDisplay.textContent = '1.00x';
        multiplierDisplay.classList.remove('win', 'loss', 'hidden');
        multiplierDisplay.style.color = 'var(--color-text)';
        if (savedMultiplierDisplay) savedMultiplierDisplay.classList.add('hidden'); // Скрываем маленький
    }
}

/**
 * Рисует сетку и метки осей на канвасе.
 * (Улучшенная версия с динамическим отображением множителей)
 */
function drawGraphGrid() {
    if (!canvas || !ctx) return;

    // Настройки для сетки
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'; // Полупрозрачный белый цвет для сетки
    ctx.lineWidth = 1;
    ctx.font = '14px Arial';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'; // Светлый текст для меток
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 1. ВЕРТИКАЛЬНЫЕ ЛИНИИ (Время)
    for (let i = 0; i <= NUM_GRID_LINES_X; i++) {
        // Используем mapTimeToX для корректного размещения на динамически масштабируемой оси
        const x = mapTimeToX((i / NUM_GRID_LINES_X) * graphMaxTime); 
        
        ctx.beginPath();
        // Рисуем линию
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();

        // Метка времени (кроме линии X=0)
        if (i > 0) { 
            const timeLabel = `${((i / NUM_GRID_LINES_X) * graphMaxTime / 1000).toFixed(1)}s`;
            // Метки времени размещаем внизу
            ctx.fillText(timeLabel, x, canvas.height - 10);
        }
    }

    // 2. ГОРИЗОНТАЛЬНЫЕ ЛИНИИ (Множитель)
    // Учитываем, что 1.0x находится внизу
    const yRange = Math.max(1.0, graphMaxMultiplier - 1.0); // Диапазон от 1.0x

    for (let i = 0; i <= NUM_GRID_LINES_Y; i++) {
        // Рассчитываем множитель для текущей линии
        // i=0 -> TOP (graphMaxMultiplier-ish)
        // i=NUM_GRID_LINES_Y -> BOTTOM (1.0x)
        const multiplierValue = 1.0 + (yRange * (NUM_GRID_LINES_Y - i) / NUM_GRID_LINES_Y);
        // Координата Y для этого множителя
        const y = mapMultiplierToY(multiplierValue);
        
        ctx.beginPath();
        // Рисуем линию
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();

        // Метка множителя (кроме линии Y=canvas.height, которая является 1.0x)
        if (i < NUM_GRID_LINES_Y) { 
            const multLabel = `${multiplierValue.toFixed(1)}x`;
            // Метки множителя размещаем слева
            ctx.textAlign = 'left';
            ctx.fillText(multLabel, 10, y);
            ctx.textAlign = 'center'; // Сброс
        }
    }
}


/**
 * ДОБАВЛЕНО: Функция рисования кривой графика
 */
function drawGraph(elapsed, multiplier, crashed) {
    
    // 1. Очистка и сетка (с новыми метками)
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGraphGrid();

    // 2. Настройка линии
    const colorOrange = '#f7b733'; // --color-orange
    const colorRed = '#ff477e'; // --color-primary
    
    ctx.strokeStyle = crashed ? colorRed : colorOrange;
    ctx.lineWidth = 3;
    ctx.shadowColor = crashed ? colorRed : colorOrange;
    ctx.shadowBlur = 10;
    
    // 3. Рисование пути
    ctx.beginPath();
    ctx.moveTo(mapTimeToX(0), mapMultiplierToY(1.0)); // Старт
    
    // Используем время, соответствующее множителю
    let finalTime = elapsed;
    if (crashed) {
        // Если краш, используем время, соответствующее crashPoint
        finalTime = 100 * Math.log(crashPoint) / Math.log(1.0115);
    }
    
    const currentPixelX = mapTimeToX(finalTime);
    
    // Рисуем попиксельно для плавной кривой
    for (let px = 1; px <= currentPixelX; px++) {
        let timeAtPixel = mapXToTime(px);
        
        // Ограничиваем время
        if (timeAtPixel > finalTime) timeAtPixel = finalTime;
        
        let multAtPixel = calculateMultiplier(timeAtPixel);
        
        // Ограничиваем множитель (на случай краша)
        if (multAtPixel > multiplier) multAtPixel = multiplier;
        
        let y = mapMultiplierToY(multAtPixel);
        ctx.lineTo(px, y);
    }
    
    ctx.stroke();
    
    // 4. Сброс теней
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
}


/**
 * Начинает игровой раунд.
 */
async function startGame() {
    // Сброс обработчика кнопки
    cashoutButton.removeEventListener('click', skipToEnd);
    cashoutButton.addEventListener('click', cashout);

    // 1. ИСПРАВЛЕНИЕ: Округляем ставку до 2 знаков после запятой
    crashBet = parseFloat(parseFloat(betInput.value).toFixed(2));
    
    if (crashBet <= 0 || isNaN(crashBet)) {
        statusElement.textContent = '⚠️ Неверная ставка!';
        return;
    }
    // 2. ИСПРАВЛЕНИЕ: Безопасная проверка баланса (учет ошибки float)
    if (crashBet - currentBalance > 0.000001) { 
        statusElement.textContent = '⚠️ Недостаточно средств!';
        statusElement.classList.add('loss'); // ДОБАВЛЕНО: (ЗАДАЧА 2)
        return;
    }
    
    // Снимаем ставку
    await updateBalance(-crashBet);
    
    // (ДОБАВЛЕНО) Уменьшаем вейджер
    await reduceWager(crashBet);
    
    isGameRunning = true;
    isBetPlaced = true;
    isCrashed = false; 
    didPlayerWin = false; // Сброс
    cashoutMultiplierValue = 0.00; // Сброс
    
    // Сброс масштабирования
    graphMaxTime = 10000;
    graphMaxMultiplier = 5.0; 
    
    crashPoint = generateCrashPoint();
    startTime = performance.now();
    
    // ИЗМЕНЕНО: (ЗАДАНИЕ) Сброс статуса
    statusElement.textContent = ''; 
    statusElement.classList.remove('win', 'loss');
    
    // Обновляем UI кнопок
    startButton.classList.add('hidden');
    cashoutButton.classList.remove('hidden');
    // Начальный текст будет установлен в gameLoop через updateCashoutButtonUI
    cashoutButton.textContent = 'Забрать'; 
    cashoutButton.disabled = false;
    // Убираем классы синей кнопки
    cashoutButton.classList.remove('blue-button');
    
    // Блокируем ввод ставки
    document.querySelector('.crash-controls .bet-input-group').classList.add('disabled');
    // ДОБАВЛЕНО: Блокируем авто-вывод
    if (autoCashoutWrapper) autoCashoutWrapper.classList.add('disabled');
    

    // Запускаем игровой цикл
    animationFrameId = requestAnimationFrame(gameLoop);
}

/**
 * Игрок забирает выигрыш.
 */
async function cashout() {
    // isGameRunning = true пока игра не крашнулась.
    if (!isGameRunning || !isBetPlaced) return;

    // 1. Фиксируем выигрыш
    const cashoutMultiplier = currentMultiplier; // Запоминаем множитель кэшаута
    cashoutMultiplierValue = cashoutMultiplier; // Сохраняем для отображения
    const winnings = crashBet * cashoutMultiplier;
    
    // ДОБАВЛЕНО: (Задание) Отправляем выигрыш в историю
    const betData = {
        username: currentUser,
        game: 'crash',
        result: `${cashoutMultiplier.toFixed(2)}x`,
        betAmount: crashBet, // ИЗМЕНЕНО: (Задание 2) Добавляем сумму ставки
        amount: winnings - crashBet, // Чистый выигрыш
        multiplier: `${cashoutMultiplier.toFixed(2)}x` // ИЗМЕНЕНО: (Запрос 1)
    };
    writeBetToHistory(betData);
    
    // 2. Возвращаем выигрыш на баланс
    await updateBalance(winnings);
    
    // 3. Обновляем флаги
    isBetPlaced = false; 
    isGameRunning = false; // Отключает updateMultiplierDisplay:running, включает :simulating
    didPlayerWin = true; 
    
    // 4. Обновляем UI
    // ИЗМЕНЕНО: (ЗАДАНИЕ) Сбрасываем текст, будем использовать .win/.loss
    statusElement.textContent = ''; 
    updateMultiplierDisplay(cashoutMultiplier, 'win'); // Фиксируем маленький множитель
    
    // 5. ИЗМЕНЕНИЕ: Синяя кнопка "Пропустить"
    cashoutButton.textContent = 'Пропустить';
    cashoutButton.disabled = false;
    cashoutButton.classList.add('blue-button'); 
    
    // 6. Заменяем обработчик на "Пропустить"
    cashoutButton.removeEventListener('click', cashout);
    cashoutButton.addEventListener('click', skipToEnd);
    
    // 7. Симуляция gameLoop продолжится
}

/**
 * ДОБАВЛЕНО: Немедленно завершает раунд (переходит к crashPoint).
 */
function skipToEnd() {
    if (isCrashed) return; // Уже завершено

    // Находим время, которое соответствует crashPoint, для рисования
    // Вызываем endGame, чтобы завершить анимацию и обновить UI
    currentMultiplier = crashPoint; 
    endGame(didPlayerWin); 
}


/**
 * Завершает игровой раунд (победа или краш).
 * @param {boolean} didWin - true, если игрок забрал выигрыш.
 */
function endGame(didWin) {
    cancelAnimationFrame(animationFrameId);
    isGameRunning = false;
    isCrashed = true; 

    // Находим время, в которое произошел краш
    const crashTime = 100 * Math.log(crashPoint) / Math.log(1.0115);

    // Масштабируем, чтобы краш был виден
    if (crashTime > graphMaxTime) graphMaxTime = crashTime * 1.1;
    if (crashPoint > graphMaxMultiplier) graphMaxMultiplier = crashPoint * 1.1;
    
    // Рисуем финальную красную линию, используя crashPoint
    drawGraph(crashTime, crashPoint, true); 

    // --- ЛОГИКА ДИСПЛЕЯ ---
    if (didWin) {
        // Игрок забрал. Обновляем статус и показываем finalCrashPoint в центре.
        // ИЗМЕНЕНО: (ЗАДАНИЕ 4) Добавлена "RUB"
        const winnings = crashBet * cashoutMultiplierValue;
        statusElement.textContent = `Выигрыш ${winnings.toFixed(2)} RUB`;
        statusElement.classList.add('win');
        
        updateMultiplierDisplay(null, 'loss', crashPoint); // Центр: финальный краш
        // Маленький множитель остается видимым
    } else {
        // Игрок не успел забрать (проиграл)
        if (isBetPlaced) {
            // ИЗМЕНЕНО: (ЗАДАНИЕ 4) Добавлена "RUB"
            statusElement.textContent = `Проигрыш ${crashBet.toFixed(2)} RUB`;
            statusElement.classList.add('loss');
            
            // ДОБАВЛЕНО: (Задание) Отправляем проигрыш в историю
            const betData = {
                username: currentUser,
                game: 'crash',
                result: '💥 CRASH',
                betAmount: crashBet, // ИЗМЕНЕНО: (Задание 2) Добавляем сумму ставки
                amount: -crashBet, // Проигрыш
                multiplier: '0.00x' // ИЗМЕНЕНО: (Запрос 1)
            };
            writeBetToHistory(betData);
            
        } else {
            // ИЗМЕНЕНО: (ЗАДАНИЕ)
            statusElement.textContent = `Краш на ${crashPoint.toFixed(2)}x`;
            statusElement.classList.add('loss');
        }
        updateMultiplierDisplay(null, 'loss', crashPoint); // Центр: финальный краш
    }
    // ---
    
    // 6. Обновляем UI и готовим к следующему раунду
    // Кнопка кэшаута становится неактивной и сбрасывается.
    cashoutButton.classList.remove('blue-button'); // <-- Сброс синего цвета

    isBetPlaced = false;
    cashoutButton.disabled = true;

    // Сброс UI через 2 секунды. ЭТО ПАУЗА, ВО ВРЕМЯ КОТОРОЙ КОЭФФИЦИЕНТЫ ВИДНЫ.
    setTimeout(() => {
        // ИЗМЕНЕНО: (ЗАДАНИЕ)
        statusElement.textContent = '';
        statusElement.classList.remove('win', 'loss');
        
        updateMultiplierDisplay(1.00, 'idle');
        
        // --- Сбрасываем канвас ---
        isCrashed = false;
        didPlayerWin = false; 
        cashoutMultiplierValue = 0.00;
        graphMaxTime = 10000;
        graphMaxMultiplier = 5.0;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGraphGrid(); // Перерисовываем чистую сетку
        // ---
        
        startButton.classList.remove('hidden');
        cashoutButton.classList.add('hidden');
        
        // Восстанавливаем обработчик для следующего раунда
        cashoutButton.removeEventListener('click', skipToEnd);
        cashoutButton.addEventListener('click', cashout);

        // Разблокируем ввод ставки
        document.querySelector('.crash-controls .bet-input-group').classList.remove('disabled');
        // ДОБАВЛЕНО: Разблокируем авто-вывод
        if (autoCashoutWrapper) autoCashoutWrapper.classList.remove('disabled');
        
    }, 2000);
}

// --- ИЗМЕНЕНО: (ЗАДАНИЕ 3) Обработчики для Авто-вывода ---
function handleAutoCashoutToggleChange() {
    isAutoCashoutEnabled = autoCashoutToggle.checked;
    // ИЗМЕНЕНО: (ЗАПРОС 3) Убрали блокировку поля ввода
    // autoCashoutInput.disabled = !isAutoCashoutEnabled;
}

/**
 * (ЗАДАНИЕ 3) Вызывается на 'input' - только обновляет переменную
 */
function handleAutoCashoutInput() {
    let val = parseFloat(autoCashoutInput.value);
    if (!isNaN(val)) {
        autoCashoutTarget = val;
    }
}

/**
 * (ЗАДАНИЕ 3) Вызывается на 'blur' - форматирует поле
 */
function formatAutoCashoutInput() {
    let val = parseFloat(autoCashoutInput.value);
    if (isNaN(val) || val < 1.01) {
        val = 1.01;
    }
    autoCashoutInput.value = val.toFixed(2);
    autoCashoutTarget = val;
}
// ---

export function initCrash() {
    // --- ПОИСК ЭЛЕМЕНТОВ ---
    betInput = document.getElementById('crash-bet');
    startButton = document.getElementById('crash-start-button');
    cashoutButton = document.getElementById('crash-cashout-button');
    multiplierDisplay = document.getElementById('crash-multiplier-display');
    canvas = document.getElementById('crash-canvas');
    statusElement = document.getElementById('crash-status');
    
    // ДОБАВЛЕНО: Элементы Авто-вывода
    autoCashoutToggle = document.getElementById('crash-auto-cashout-toggle');
    autoCashoutInput = document.getElementById('crash-auto-cashout-input');
    autoCashoutWrapper = document.querySelector('.auto-cashout-input-wrapper');
    // ---
    
    // Ищем/Создаем элемент для забранного множителя
    const graphWrapper = document.querySelector('.crash-graph-wrapper');
    if (graphWrapper) {
        savedMultiplierDisplay = document.getElementById('crash-saved-multiplier');
        if (!savedMultiplierDisplay) {
            savedMultiplierDisplay = document.createElement('div');
            savedMultiplierDisplay.id = 'crash-saved-multiplier';
            savedMultiplierDisplay.className = 'crash-multiplier-saved hidden';
            graphWrapper.appendChild(savedMultiplierDisplay);
        }
    }
    
    const betHalfButton = document.querySelector('#crash-game .bet-half');
    const betDoubleButton = document.querySelector('#crash-game .bet-double');
    // ДОБАВЛЕНО (Задача 1)
    const betMinButton = document.querySelector('#crash-game .bet-min');
    const betMaxButton = document.querySelector('#crash-game .bet-max');

    if (!canvas) {
        return; 
    }
    
    ctx = canvas.getContext('2d');
    
    // Адаптация канваса под размер
    function resizeCanvas() {
        const wrapper = document.querySelector('.crash-graph-wrapper');
        if (wrapper) {
            canvas.width = wrapper.clientWidth;
            canvas.height = wrapper.clientHeight;
            
            if (isCrashed) {
                const crashTime = 100 * Math.log(crashPoint) / Math.log(1.0115);
                drawGraph(crashTime, crashPoint, true);
            } else if (currentMultiplier > 1.00) {
                const elapsed = performance.now() - startTime;
                const multiplier = calculateMultiplier(elapsed);
                drawGraph(elapsed, multiplier, false);
            } else {
                drawGraphGrid(); 
            }
        }
    }
    window.addEventListener('resize', resizeCanvas);
    
    // --- Обработчики событий ---
    
    if (startButton) {
        startButton.addEventListener('click', startGame);
    }
    
    // Изначальный обработчик - cashout, будет заменен на skipToEnd в cashout()
    if (cashoutButton) {
        cashoutButton.addEventListener('click', cashout);
    }
    
    if (betHalfButton && betInput) {
        betHalfButton.addEventListener('click', () => {
            let currentVal = parseFloat(betInput.value);
            if (isNaN(currentVal)) currentVal = 0;
            
            let newVal = Math.max(1.00, currentVal / 2); 
            betInput.value = newVal.toFixed(2);
            crashBet = newVal;
        });
    }

    if (betDoubleButton && betInput) {
        betDoubleButton.addEventListener('click', () => {
            let currentVal = parseFloat(betInput.value);
            if (isNaN(currentVal)) currentVal = 0;
            
            let newVal = Math.min(currentBalance, currentVal * 2);
            betInput.value = newVal.toFixed(2);
            crashBet = newVal;
        });
    }
    
    // ДОБАВЛЕНО: (Задача 1) Слушатели Мин/Макс
    if (betMinButton) {
        betMinButton.addEventListener('click', () => {
            let newVal = 1.00;
            betInput.value = newVal.toFixed(2);
            crashBet = newVal;
        });
    }
    
    if (betMaxButton) {
        betMaxButton.addEventListener('click', () => {
            // Используем currentBalance, который импортирован из global.js
            let newVal = currentBalance; 
            betInput.value = newVal.toFixed(2);
            crashBet = newVal; 
        });
    }
    // КОНЕЦ ДОБАВЛЕНИЯ
    
    // ИЗМЕНЕНО: (ЗАДАНИЕ 3) Слушатели Авто-вывода
    if (autoCashoutToggle) {
        autoCashoutToggle.addEventListener('change', handleAutoCashoutToggleChange);
    }
    if (autoCashoutInput) {
        autoCashoutInput.addEventListener('input', handleAutoCashoutInput);
        autoCashoutInput.addEventListener('blur', formatAutoCashoutInput);
    }
    // ---

    // --- Первичная настройка ---
    
    function waitForCanvasSizeAndResize() {
        const wrapper = document.querySelector('.crash-graph-wrapper');

        if (wrapper && wrapper.clientWidth > 0 && wrapper.clientHeight > 0) {
            resizeCanvas();
            updateMultiplierDisplay(1.00, 'idle');
            // ИЗМЕНЕНО: (ЗАДАНИЕ 3) Инициализация авто-вывода
            handleAutoCashoutToggleChange();
            formatAutoCashoutInput();
        } else {
            // (ВОССТАНОВЛЕНО) Рекурсивный вызов, если канвас еще не готов
            requestAnimationFrame(waitForCanvasSizeAndResize);
        }
    }
    
    waitForCanvasSizeAndResize();
}
