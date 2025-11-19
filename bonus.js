/*
 * Краткое описание апгрейда:
 * 1. **Изменен импорт**: `showUserModal` (из `auth.js`) заменен на `showSection` (из `global.js`).
 * 2. **Изменена навигация**: Ссылки "Привяжи Вконтакте" и "Привяжи Telegram" (на странице бонусов) теперь не открывают старое модальное окно, а перенаправляют пользователя на новую страницу профиля (`profile-page`), вызывая `showSection('profile-page')`.
 * 3. **(НОВАЯ ЗАДАЧА)**: `handlePromoActivate` переписан для работы с Firebase.
 * 4. **(ЗАДАЧА 6)**: `handleClaimBonus` теперь вызывает `updateBalance` с двумя аргументами,
 * добавляя вейджер X10 к сумме ежедневного бонуса.
 * 5. **(ИСПРАВЛЕНО)**: Убран `await` из `handleClaimBonus` при вызове `updateBalance`,
 * так как `updateBalance` не является async (fire-and-forget).
 * 6. **(НОВАЯ ЗАДАЧА)**: Добавлены `fetchUser` и логика для еженедельных бонусов
 * (Кешбек и Рейкбек) в `updateBonusPage`.
 */
// ИЗМЕНЕНО: Добавлен fetchUser
import { updateBalance, currentUser, showSection, activatePromocode, fetchUser } from './global.js';
// ИЗМЕНЕНО: showUserModal удален

// const BONUS_AMOUNT = 100.00; // --- УДАЛЕНО ---
const COOLDOWN_HOURS = 24;
// ДОБАВЛЕНО: (ЗАДАЧА 6) Вейджер для ежедневного бонуса
const DAILY_BONUS_WAGER = 10; 

/**
 * ДОБАВЛЕНО: Генерирует случайную сумму бонуса.
 * 90% шанс: 1.00 - 25.00
 * 10% шанс: 25.01 - 100.00
 */
function generateBonusAmount() {
    const r = Math.random();
    let amount;

    if (r < 0.9) { 
        // 90% шанс: 1.00 до 25.00
        amount = Math.random() * 24.01 + 1.00;
    } else {
        // 10% шанс: 25.01 до 100.00
        amount = Math.random() * 74.99 + 25.01;
    }
    
    return parseFloat(amount.toFixed(2));
}


/**
 * Рассчитывает, сколько времени осталось до следующего бонуса.
 * @param {string} lastClaim - ISO строка времени последнего получения.
 * @returns {object | null} Объект с часами и минутами, или null, если время вышло.
 */
function getTimeRemaining(lastClaim) {
    const lastClaimTime = new Date(lastClaim).getTime();
    const now = new Date().getTime();
    const cooldownMs = COOLDOWN_HOURS * 60 * 60 * 1000;
    const remaining = (lastClaimTime + cooldownMs) - now;

    if (remaining <= 0) {
        return null; // Время вышло
    }

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    return { hours, minutes };
}

/**
 * Возвращает уникальный ключ для localStorage на основе имени пользователя.
 * @returns {string}
 */
function getStorageKey() {
    // Убедимся, что currentUser не null, чтобы избежать ключа 'nekoBonusClaimed_null'
    return `nekoBonusClaimed_${currentUser || 'guest'}`;
}

/**
 * (НОВАЯ ФУНКЦИЯ) Возвращает проценты кешбека/рейкбека по рангу.
 * @param {string} dbRank - Ранг из БД.
 * @returns {{cashbackPercent: number, rakebackPercent: number}}
 */
function getRankStats(dbRank) {
    // Проценты (5% = 0.05, 0.05% = 0.0005)
    switch (dbRank) {
        case 'None Rang':
        case 'Kitten':
            return { cashbackPercent: 0.05, rakebackPercent: 0.0005 }; // Ранг 1
        case 'Newfag':
            return { cashbackPercent: 0.06, rakebackPercent: 0.0006 }; // Ранг 2
        case 'Old Cat':
            return { cashbackPercent: 0.07, rakebackPercent: 0.0007 }; // Ранг 3
        case 'Street Cat':
            return { cashbackPercent: 0.08, rakebackPercent: 0.0008 }; // Ранг 4
        case 'Horse':
            return { cashbackPercent: 0.09, rakebackPercent: 0.0009 }; // Ранг 5
        case 'King':
        case 'admin':
            return { cashbackPercent: 0.10, rakebackPercent: 0.0010 }; // Ранг 6
        default:
            return { cashbackPercent: 0.05, rakebackPercent: 0.0005 };
    }
}


/**
 * ИЗМЕНЕНО: Проверяет ВСЕ бонусы (Ежедневный + Еженедельный)
 * Вызывается из main.js при каждом открытии вкладки "Бонус".
 */
export async function updateBonusPage() {
    // --- 1. ЕЖЕДНЕВНЫЙ БОНУС ---
    const bonusButton = document.getElementById('claim-bonus-button');
    const bonusStatus = document.getElementById('bonus-status');
    
    if (!bonusButton || !bonusStatus) return; // Элементы еще не загружены

    if (!currentUser) {
        bonusButton.disabled = true;
        bonusStatus.textContent = 'Войдите, чтобы получить бонус.';
    } else {
        const lastClaim = localStorage.getItem(getStorageKey());
        if (!lastClaim) {
            bonusButton.disabled = false;
            bonusStatus.textContent = 'Бонус доступен!';
        } else {
            const remaining = getTimeRemaining(lastClaim);
            if (remaining) {
                bonusButton.disabled = true;
                bonusStatus.textContent = `Следующий бонус через: ${remaining.hours} ч ${remaining.minutes} м`;
            } else {
                bonusButton.disabled = false;
                bonusStatus.textContent = 'Бонус снова доступен!';
            }
        }
    }

    // --- 2. ЕЖЕНЕДЕЛЬНЫЕ БОНУСЫ (Кешбек/Рейкбек) ---
    const cashbackBtn = document.getElementById('claim-cashback-button');
    const rakebackBtn = document.getElementById('claim-rakeback-button');
    const cashbackAmount = document.getElementById('cashback-amount');
    const rakebackAmount = document.getElementById('rakeback-amount');

    if (!cashbackBtn || !rakebackBtn || !cashbackAmount || !rakebackAmount) return;

    // Сброс кнопок по умолчанию
    cashbackBtn.disabled = true;
    rakebackBtn.disabled = true;
    cashbackBtn.classList.remove('active-claim');
    rakebackBtn.classList.remove('active-claim');
    cashbackBtn.textContent = 'Доступно в ПН';
    rakebackBtn.textContent = 'Доступно во ВТ';
    cashbackAmount.textContent = '0.00 RUB';
    rakebackAmount.textContent = '0.00 RUB';

    if (!currentUser) {
        return; // Выходим, если пользователя нет
    }

    // Получаем ранг пользователя
    const userData = await fetchUser(currentUser);
    const dbRank = userData?.rank || 'None Rang';
    const { cashbackPercent, rakebackPercent } = getRankStats(dbRank);

    // --- СИМУЛЯЦИЯ: В реальном приложении эти данные придут с сервера ---
    // (Например, userData.weekly_loss и userData.weekly_wager)
    const weeklyLoss = 500.00; // Симуляция 500р проигрыша
    const weeklyWager = 10000.00; // Симуляция 10000р ставок
    // --- КОНЕЦ СИМУЛЯЦИИ ---

    const cashbackValue = weeklyLoss > 0 ? weeklyLoss * cashbackPercent : 0;
    const rakebackValue = weeklyWager * rakebackPercent;

    cashbackAmount.textContent = cashbackValue.toFixed(2) + ' RUB';
    rakebackAmount.textContent = rakebackValue.toFixed(2) + ' RUB';
    
    // Проверяем день недели (0=Вс, 1=Пн, 2=Вт, ...)
    const today = new Date().getDay();

    // Логика Кешбека (Понедельник = 1)
    if (today === 1 && cashbackValue > 0) {
        // TODO: Добавить проверку, не забирал ли он уже на этой неделе
        cashbackBtn.disabled = false;
        cashbackBtn.classList.add('active-claim');
        cashbackBtn.textContent = 'Забрать';
    }

    // Логика Рейкбека (Вторник = 2)
    if (today === 2 && rakebackValue > 0) {
        // TODO: Добавить проверку, не забирал ли он уже на этой неделе
        rakebackBtn.disabled = false;
        rakebackBtn.classList.add('active-claim');
        rakebackBtn.textContent = 'Забрать';
    }
}

/**
 * ИЗМЕНЕНО: (ЗАДАЧА 6 + ИСПРАВЛЕНИЕ)
 * Обрабатывает нажатие на кнопку "Получить".
 * @param {Event} e - Событие клика.
 */
async function handleClaimBonus(e) {
    const bonusButton = e.currentTarget;
    const bonusStatus = document.getElementById('bonus-status');
    
    if (!currentUser) return; // Должно быть заблокировано, но на всякий случай

    // Повторная проверка, чтобы избежать двойного клика или обхода
    const lastClaim = localStorage.getItem(getStorageKey());
    const remaining = lastClaim ? getTimeRemaining(lastClaim) : null;

    if (remaining) {
        bonusStatus.textContent = 'Вы уже получили бонус.';
        return; // Еще не время
    }

    // Блокируем кнопку на время запроса
    bonusButton.disabled = true;
    bonusStatus.textContent = 'Начисляем...';

    try {
        // ИЗМЕНЕНО: Генерируем случайную сумму
        const claimedAmount = generateBonusAmount();
        
        // (ЗАДАЧА 6) Рассчитываем вейджер
        const wagerToAdd = claimedAmount * DAILY_BONUS_WAGER;
        
        // ИЗМЕНЕНО: (ЗАДАЧА 6) Начисляем баланс И вейджер
        // ИСПРАВЛЕНИЕ: Убран 'await', т.к. updateBalance - fire-and-forget
        updateBalance(claimedAmount, wagerToAdd);

        // Сохраняем время получения в localStorage
        localStorage.setItem(getStorageKey(), new Date().toISOString());

        // Обновляем UI
        // ИЗМЕНЕНО: Показываем фактическую сумму
        bonusStatus.textContent = `🎉 Вы получили ${claimedAmount.toFixed(2)} RUB!`;
        // Снова вызываем проверку, чтобы отключить кнопку и показать таймер
        updateBonusPage(); // ИЗМЕНЕНО: Вызываем новую функцию
        
    } catch (error) {
        console.error("Ошибка при начислении бонуса:", error);
        bonusStatus.textContent = 'Ошибка. Попробуйте снова.';
        // Разблокируем, если была ошибка, чтобы дать шанс
        bonusButton.disabled = false; 
    }
}

/**
 * ИЗМЕНЕНО: Активация промокода (теперь работает с Firebase)
 */
async function handlePromoActivate(e) {
    e.preventDefault();
    const input = document.getElementById('promo-input');
    const button = e.currentTarget;
    const statusEl = document.getElementById('promo-status');
    
    const code = input.value.trim();

    if (!currentUser) {
        alert("Пожалуйста, войдите в аккаунт, чтобы активировать промокод.");
        return;
    }
    if (code === "") {
        alert("Пожалуйста, введите промокод.");
        return;
    }
    
    button.textContent = "Проверка...";
    button.disabled = true;
    statusEl.textContent = '';
    statusEl.classList.remove('win', 'loss');
    
    // Вызываем новую функцию из global.js
    const result = await activatePromocode(code);

    if (result.success) {
        statusEl.textContent = `🎉 ${result.message}`;
        statusEl.classList.add('win');
        input.value = ""; // Очищаем поле
    } else {
        statusEl.textContent = `❌ ${result.message}`;
        statusEl.classList.add('loss');
    }

    button.textContent = "Активировать";
    button.disabled = false;
}

/**
 * ДОБАВЛЕНО: Инициализирует кнопки квестов
 */
function initQuestButtons() {
    const questButtons = document.querySelectorAll('.quest-claim-button');
    
    questButtons.forEach(button => {
        // Проверяем, может кнопка уже была "активирована" ранее (симуляция)
        if (localStorage.getItem(`quest_${button.id}`) === 'true') {
            button.textContent = 'Бонус активирован';
            button.disabled = true;
            button.classList.add('activated');
        }

        button.addEventListener('click', () => {
            // Симуляция получения бонуса
            // (здесь должен быть вызов updateBalance() с суммой и вейджером x10)
            console.log("Квест выполнен:", button.id);
            
            button.textContent = 'Бонус активирован';
            button.disabled = true;
            button.classList.add('activated');
            
            // Сохраняем состояние
            localStorage.setItem(`quest_${button.id}`, 'true');
        });
    });
}

/**
 * (НОВЫЕ СИМУЛЯЦИИ) Обработчики для кешбека и рейкбека.
 */
function handleClaimCashback(e) {
    const statusEl = document.getElementById('weekly-bonus-status');
    // TODO: Реализовать логику получения (await updateBalance(...))
    console.log("Симуляция: Запрос на получение КЕШБЕКА");
    statusEl.textContent = "Кешбек (симуляция) получен!";
    statusEl.classList.add('win');
    e.currentTarget.disabled = true;
    e.currentTarget.classList.remove('active-claim');
}

function handleClaimRakeback(e) {
    const statusEl = document.getElementById('weekly-bonus-status');
    // TODO: Реализовать логику получения (await updateBalance(...))
    console.log("Симуляция: Запрос на получение РЕЙКБЕКА");
    statusEl.textContent = "Рейкбек (симуляция) получен!";
    statusEl.classList.add('win');
    e.currentTarget.disabled = true;
    e.currentTarget.classList.remove('active-claim');
}


/**
 * Инициализирует страницу бонуса, добавляя слушатель к кнопке.
 */
export function initBonus() {
    const bonusButton = document.getElementById('claim-bonus-button');
    if (bonusButton) {
        bonusButton.addEventListener('click', handleClaimBonus);
    }

    // ДОБАВЛЕНО: Слушатель для кнопки промокода
    const promoButton = document.getElementById('claim-promo-button');
    if (promoButton) {
        promoButton.addEventListener('click', handlePromoActivate);
    }
    
    // ДОБАВЛЕНО: Инициализация кнопок квестов
    initQuestButtons();
    
    // ДОБАВЛЕНО: Слушатели для ссылок "Привяжи..."
    const linkVK = document.getElementById('bonus-link-profile-vk');
    if (linkVK) {
        linkVK.addEventListener('click', (e) => {
            e.preventDefault();
            // ИЗМЕНЕНО: Открываем страницу профиля
            showSection('profile-page');
        });
    }
    
    const linkTG = document.getElementById('bonus-link-profile-tg');
    if (linkTG) {
        linkTG.addEventListener('click', (e) => {
            e.preventDefault();
            // ИЗМЕНЕНО: Открываем страницу профиля
            showSection('profile-page');
        });
    }

    // ДОБАВЛЕНО: Слушатели для кнопок Кешбека/Рейкбека
    const cashbackBtn = document.getElementById('claim-cashback-button');
    const rakebackBtn = document.getElementById('claim-rakeback-button');
    
    if (cashbackBtn) {
        cashbackBtn.addEventListener('click', handleClaimCashback);
    }
    if (rakebackBtn) {
        rakebackBtn.addEventListener('click', handleClaimRakeback);
    }
}
