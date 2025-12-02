/*
 * WHEEL.JS - ИСПРАВЛЕННАЯ ВЕРСИЯ (Фикс черного поля + Точное вращение)
 */
import { currentBalance, updateBalance, writeBetToHistory, currentUser, reduceWager, AntiMinus } from './global.js';

const SEGMENTS_COUNT = 54; // Ровно 54 сегмента
const SPIN_DURATION = 4000; // ms

// Конфигурация цветов
const COLORS = {
    BLACK: { id: 'black', multiplier: 2, color: '#2E3035', label: 'x2' },
    RED:   { id: 'red',   multiplier: 3, color: '#FF5555', label: 'x3' },
    GREEN: { id: 'green', multiplier: 5, color: '#00A878', label: 'x5' },
    GOLD:  { id: 'gold',  multiplier: 30, color: '#F5A623', label: 'x30' }
};

/* * МАССИВ СЕГМЕНТОВ (РОВНО 54 ШТУКИ)
 * 1 Gold, 10 Green, 17 Red, 26 Black = 54
 * Порядок важен для css gradient и логики выпадения
 */
const SEGMENTS = [
    COLORS.GOLD,  // 0
    COLORS.BLACK, COLORS.RED, COLORS.BLACK, COLORS.GREEN, COLORS.BLACK, COLORS.RED, COLORS.BLACK, COLORS.RED,
    COLORS.BLACK, COLORS.GREEN, COLORS.BLACK, COLORS.RED, COLORS.BLACK, COLORS.RED, COLORS.BLACK, COLORS.GREEN,
    COLORS.BLACK, COLORS.RED, COLORS.BLACK, COLORS.RED, COLORS.BLACK, COLORS.GREEN, COLORS.BLACK, COLORS.RED,
    COLORS.BLACK, COLORS.RED, COLORS.BLACK, COLORS.GREEN, COLORS.BLACK, COLORS.RED, COLORS.BLACK, COLORS.RED,
    COLORS.BLACK, COLORS.GREEN, COLORS.BLACK, COLORS.RED, COLORS.BLACK, COLORS.RED, COLORS.BLACK, COLORS.GREEN,
    COLORS.BLACK, COLORS.RED, COLORS.BLACK, COLORS.RED, COLORS.BLACK, COLORS.GREEN, COLORS.BLACK, COLORS.RED,
    COLORS.BLACK, COLORS.GREEN, COLORS.BLACK, COLORS.RED, COLORS.BLACK 
];

let currentRotation = 0;
let isSpinning = false;
let activeBets = { black: 0, red: 0, green: 0, gold: 0 };
let betInput, spinButton;

function updateWheelUI() {
    // Обновляем отображение ставок на кнопках
    const blackVal = document.getElementById('bet-val-black');
    const redVal = document.getElementById('bet-val-red');
    const greenVal = document.getElementById('bet-val-green');
    const goldVal = document.getElementById('bet-val-gold');

    if(blackVal) blackVal.textContent = activeBets.black > 0 ? activeBets.black.toFixed(2) : '0';
    if(redVal) redVal.textContent = activeBets.red > 0 ? activeBets.red.toFixed(2) : '0';
    if(greenVal) greenVal.textContent = activeBets.green > 0 ? activeBets.green.toFixed(2) : '0';
    if(goldVal) goldVal.textContent = activeBets.gold > 0 ? activeBets.gold.toFixed(2) : '0';

    // Активность кнопок (подсветка, если есть ставка)
    document.querySelectorAll('.wheel-bet-btn').forEach(btn => {
        const color = btn.getAttribute('data-color');
        if (activeBets[color] > 0) btn.classList.add('active');
        else btn.classList.remove('active');
        
        btn.disabled = isSpinning;
    });

    const totalBet = Object.values(activeBets).reduce((a, b) => a + b, 0);
    
    if(spinButton) spinButton.disabled = isSpinning || totalBet === 0;
    
    const clearBtn = document.getElementById('wheel-clear-bets');
    if(clearBtn) clearBtn.disabled = isSpinning || totalBet === 0;
    
    if(betInput) betInput.disabled = isSpinning;
}

function handleBetClick(e) {
    if (isSpinning) return;
    const btn = e.currentTarget;
    const color = btn.getAttribute('data-color');
    const amount = parseFloat(betInput.value);

    if (amount <= 0 || isNaN(amount)) return;
    if (currentBalance < amount) {
        alert("Недостаточно средств");
        return;
    }

    // Снимаем деньги сразу
    updateBalance(-amount);
    activeBets[color] += amount;
    
    // Анимация нажатия
    btn.classList.add('pulse');
    setTimeout(() => btn.classList.remove('pulse'), 200);
    
    updateWheelUI();
}

function handleClearBets() {
    if (isSpinning) return;
    let refund = 0;
    Object.keys(activeBets).forEach(c => refund += activeBets[c]);
    if (refund > 0) {
        updateBalance(refund);
        activeBets = { black: 0, red: 0, green: 0, gold: 0 };
        updateWheelUI();
    }
}

async function spinWheel() {
    const totalBet = Object.values(activeBets).reduce((a, b) => a + b, 0);
    if (totalBet === 0) return;

    isSpinning = true;
    updateWheelUI();
    reduceWager(totalBet); 

    // 1. Выбираем честный сегмент
    let randomIndex = Math.floor(Math.random() * SEGMENTS_COUNT);
    let winningSegment = SEGMENTS[randomIndex];

    // --- ANTI-MINUS LOGIC ---
    let totalWin = 0;
    if (activeBets[winningSegment.id] > 0) {
        totalWin = activeBets[winningSegment.id] * winningSegment.multiplier;
    }
    const profit = totalWin - totalBet;

    // Спрашиваем AntiMinus
    if (!AntiMinus.canUserWin(profit, totalBet)) {
        console.warn(`Wheel: Anti-Minus blocked ${winningSegment.id} (Profit: ${profit})`);
        
        let minLossIndex = randomIndex;
        let minProfit = profit;
        
        // Ищем исход, где выигрыш минимален (или игрок проигрывает)
        for(let i=0; i<SEGMENTS_COUNT; i++) {
            const seg = SEGMENTS[i];
            const potentialWin = (activeBets[seg.id] > 0) ? activeBets[seg.id] * seg.multiplier : 0;
            const p = potentialWin - totalBet;
            
            if (p < minProfit) {
                minProfit = p;
                minLossIndex = i;
            }
        }
        randomIndex = minLossIndex;
        winningSegment = SEGMENTS[randomIndex];
    }
    // ------------------------

    // 2. Рассчитываем вращение (ИСПРАВЛЕНО)
    // Один сегмент занимает угол:
    const degreesPerSegment = 360 / SEGMENTS_COUNT; // ~6.666 градусов
    
    // В conic-gradient 0 градусов - это 12 часов (Верх). Градиент идет по часовой.
    // Значит Index 0 занимает [0 ... 6.66] градусов.
    // Index 1 занимает [6.66 ... 13.33] градусов.
    // Чтобы элемент с Index X оказался под стрелкой (которая тоже на 12 часов),
    // нам нужно повернуть колесо ПРОТИВ часовой стрелки (отрицательный угол).
    
    // Центр нужного сегмента относительно начала градиента:
    const segmentCenterDeg = (randomIndex * degreesPerSegment) + (degreesPerSegment / 2);
    
    // Добавляем случайный разброс внутри сегмента (+/- 40% от ширины сегмента), чтобы было реалистично
    // и стрелка не всегда била ровно в центр
    const randomOffset = (Math.random() - 0.5) * (degreesPerSegment * 0.8);
    
    // Целевой угол поворота (отрицательный, чтобы подтянуть сегмент к верху)
    // + Добавляем 5 полных оборотов (5 * 360)
    const extraSpins = 360 * 5;
    
    // Важно: Мы должны добавить это к ТЕКУЩЕМУ вращению, чтобы колесо не дергалось назад
    // Округляем текущее вращение до 360, чтобы начать "чисто"
    const currentBase = Math.ceil(Math.abs(currentRotation) / 360) * 360; 
    
    // Финальная формула:
    // База (чтобы крутиться дальше) + 5 оборотов + Угол до центра сегмента (инвертированный) + рандом
    const finalRotation = -(currentBase + extraSpins + segmentCenterDeg + randomOffset);

    // Запуск CSS анимации
    const spinner = document.getElementById('wheel-spinner');
    if(spinner) {
        spinner.style.transition = `transform ${SPIN_DURATION}ms cubic-bezier(0.15, 0.90, 0.30, 1.0)`;
        spinner.style.transform = `rotate(${finalRotation}deg)`;
    }
    
    currentRotation = finalRotation; // Сохраняем

    await new Promise(r => setTimeout(r, SPIN_DURATION));

    // 3. Результат
    const userWinAmount = activeBets[winningSegment.id] ? activeBets[winningSegment.id] * winningSegment.multiplier : 0;
    const netProfit = userWinAmount - totalBet;
    
    const statusEl = document.getElementById('wheel-status');

    if (userWinAmount > 0) {
        updateBalance(userWinAmount);
        if(statusEl) {
            statusEl.textContent = `Выигрыш ${userWinAmount.toFixed(2)} RUB (${winningSegment.label})`;
            statusEl.className = 'keno-status-bar win';
            statusEl.style.display = 'block';
        }
    } else {
        if(statusEl) {
            statusEl.textContent = `Выпало ${winningSegment.label}`;
            statusEl.className = 'keno-status-bar loss';
            statusEl.style.display = 'block';
        }
    }

    // История
    writeBetToHistory({
        username: currentUser,
        game: 'wheel',
        result: winningSegment.label,
        betAmount: totalBet,
        amount: netProfit,
        multiplier: winningSegment.label
    });
    
    addToHistoryBar(winningSegment);

    // Сброс
    activeBets = { black: 0, red: 0, green: 0, gold: 0 };
    isSpinning = false;
    updateWheelUI();
}

function addToHistoryBar(segment) {
    const bar = document.getElementById('wheel-history-bar');
    if(!bar) return;
    
    const item = document.createElement('div');
    item.className = `wheel-hist-item ${segment.id}`;
    item.style.animation = 'popIn 0.3s ease';
    
    // Вставляем в начало
    bar.prepend(item);
    // Храним последние 20
    if (bar.children.length > 20) bar.lastChild.remove();
}

export function initWheel() {
    betInput = document.getElementById('wheel-bet-amount');
    spinButton = document.getElementById('wheel-spin-button');
    
    // Генерируем градиент колеса
    const spinner = document.getElementById('wheel-spinner');
    if (spinner) {
        let gradientStr = 'conic-gradient(';
        const degPerSeg = 360 / SEGMENTS_COUNT; // ~6.666deg
        
        SEGMENTS.forEach((seg, i) => {
            const start = i * degPerSeg;
            const end = (i + 1) * degPerSeg;
            // +0.1deg к end чтобы перекрыть швы рендеринга (anti-aliasing fix)
            gradientStr += `${seg.color} ${start}deg ${end + 0.1}deg, `;
        });
        gradientStr = gradientStr.slice(0, -2) + ')'; // Удалить последнюю запятую
        spinner.style.background = gradientStr;
    }

    if (spinButton) spinButton.addEventListener('click', spinWheel);
    
    document.querySelectorAll('.wheel-bet-btn').forEach(btn => {
        btn.addEventListener('click', handleBetClick);
    });
    
    const clearBtn = document.getElementById('wheel-clear-bets');
    if (clearBtn) clearBtn.addEventListener('click', handleClearBets);
    
    const betHalfBtn = document.querySelector('#wheel-game .bet-half');
    const betDoubleBtn = document.querySelector('#wheel-game .bet-double');
    
    if (betHalfBtn) betHalfBtn.addEventListener('click', () => { 
        if(!isSpinning && betInput) betInput.value = Math.max(1.00, (parseFloat(betInput.value)||0)/2).toFixed(2); 
    });
    if (betDoubleBtn) betDoubleBtn.addEventListener('click', () => { 
        if(!isSpinning && betInput) betInput.value = Math.min(currentBalance, (parseFloat(betInput.value)||0)*2).toFixed(2); 
    });

    updateWheelUI();
}
