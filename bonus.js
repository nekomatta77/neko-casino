/*
 * BONUS.JS - RANDOM BONUS & NEW UI
 */
import { updateBalance, currentUser, showSection, activatePromocode, fetchUser, fetchUserStats, patchUser } from './global.js';
import { checkDailyStreak } from './achievements.js'; // ИМПОРТ

// Удаляем фиксированную константу, теперь сумма динамическая
const DAILY_BONUS_WAGER_MULTIPLIER = 10; 
const COOLDOWN_MS = 24 * 60 * 60 * 1000; 

let dailyBonusInterval = null;

// --- ГЕНЕРАТОР СЛУЧАЙНОЙ СУММЫ ---
function generateDailyBonusAmount() {
    const chance = Math.random() * 100; // 0 - 100
    
    let amount = 0;

    if (chance < 90) {
        // 90% шанс: от 1 до 10 руб
        amount = Math.random() * (10 - 1) + 1;
    } else if (chance < 99) {
        // 9% шанс: от 10 до 30 руб
        amount = Math.random() * (30 - 10) + 10;
    } else {
        // 1% шанс: от 30 до 100 руб
        amount = Math.random() * (100 - 30) + 30;
    }

    return parseFloat(amount.toFixed(2));
}

// --- ОТОБРАЖЕНИЕ КРАСИВОГО ОКНА ---
function showDailyBonusModal(amount) {
    const overlay = document.getElementById('daily-bonus-modal-overlay');
    const amountEl = document.getElementById('daily-bonus-modal-amount');
    
    if (overlay && amountEl) {
        amountEl.textContent = amount.toFixed(2);
        overlay.classList.remove('hidden');
        
        // Анимация конфетти или лучей (через CSS класс)
        overlay.querySelector('.daily-bonus-card').classList.add('pop-in');
    } else {
        alert(`Поздравляем! Вы получили ${amount.toFixed(2)} RUB`);
    }
}

function getRankStats(dbRank) {
    switch (dbRank) {
        case 'None Rang': case 'Kitten': return { cashbackPercent: 0.05, rakebackPercent: 0.0005 }; 
        case 'Newfag': return { cashbackPercent: 0.06, rakebackPercent: 0.0006 }; 
        case 'Old Cat': return { cashbackPercent: 0.07, rakebackPercent: 0.0007 }; 
        case 'Street Cat': return { cashbackPercent: 0.08, rakebackPercent: 0.0008 }; 
        case 'Horse': return { cashbackPercent: 0.09, rakebackPercent: 0.0009 }; 
        case 'King': case 'admin': return { cashbackPercent: 0.10, rakebackPercent: 0.0010 }; 
        default: return { cashbackPercent: 0.05, rakebackPercent: 0.0005 };
    }
}

function formatTime(ms) {
    const h = Math.floor(ms / (1000 * 60 * 60));
    const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((ms % (1000 * 60)) / 1000);
    return `${h}ч ${m}м ${s}с`;
}

export async function updateBonusPage() {
    if (!currentUser) {
        const bonusButton = document.getElementById('claim-bonus-button');
        if(bonusButton) {
            bonusButton.disabled = true;
            bonusButton.textContent = "Войдите";
            bonusButton.style.backgroundColor = "var(--color-border-dark)";
        }
        return;
    }

    const bonusButton = document.getElementById('claim-bonus-button');
    const bonusStatus = document.getElementById('bonus-status');
    const userData = await fetchUser(currentUser); 
    const lastClaimISO = userData?.last_daily_bonus;
    
    if (dailyBonusInterval) clearInterval(dailyBonusInterval);

    const checkBonusAvailability = () => {
        const now = new Date().getTime();
        const lastTime = lastClaimISO ? new Date(lastClaimISO).getTime() : 0;
        const diff = now - lastTime;

        if (diff >= COOLDOWN_MS) {
            bonusButton.disabled = false;
            bonusButton.textContent = "Получить";
            bonusButton.style.backgroundColor = "var(--color-secondary)"; 
            if(bonusStatus) bonusStatus.textContent = "Бонус доступен!";
            if (dailyBonusInterval) clearInterval(dailyBonusInterval);
        } else {
            bonusButton.disabled = true;
            bonusButton.style.backgroundColor = "var(--color-border-dark)"; 
            const remaining = COOLDOWN_MS - diff;
            bonusButton.textContent = formatTime(remaining);
            if(bonusStatus) bonusStatus.textContent = `До следующего бонуса: ${formatTime(remaining)}`;
        }
    };

    checkBonusAvailability();
    dailyBonusInterval = setInterval(checkBonusAvailability, 1000);

    const cashbackBtn = document.getElementById('claim-cashback-button');
    const rakebackBtn = document.getElementById('claim-rakeback-button');
    const cashbackAmount = document.getElementById('cashback-amount');
    const rakebackAmount = document.getElementById('rakeback-amount');

    if (!cashbackBtn) return;

    const stats = await fetchUserStats(currentUser);
    const dbRank = userData?.rank || 'None Rang';
    const { cashbackPercent, rakebackPercent } = getRankStats(dbRank);

    const netLoss = stats.totalDeposits - stats.totalWithdrawals;
    const cashbackValue = netLoss > 0 ? netLoss * cashbackPercent : 0;
    const rakebackValue = stats.totalWager * rakebackPercent;

    cashbackAmount.textContent = cashbackValue.toFixed(2) + ' RUB';
    rakebackAmount.textContent = rakebackValue.toFixed(2) + ' RUB';

    const today = new Date().getDay();
    
    if (today === 1 && cashbackValue > 0) {
        cashbackBtn.disabled = false;
        cashbackBtn.classList.add('active-claim');
        cashbackBtn.textContent = 'Забрать';
    } else {
        cashbackBtn.disabled = true;
        cashbackBtn.classList.remove('active-claim');
        cashbackBtn.textContent = 'Доступно в ПН';
    }

    if (today === 2 && rakebackValue > 0) {
        rakebackBtn.disabled = false;
        rakebackBtn.classList.add('active-claim');
        rakebackBtn.textContent = 'Забрать';
    } else {
        rakebackBtn.disabled = true;
        rakebackBtn.classList.remove('active-claim');
        rakebackBtn.textContent = 'Доступно во ВТ';
    }
}

async function handleClaimBonus(e) {
    if (!currentUser) return;
    const bonusButton = e.currentTarget;
    const bonusStatus = document.getElementById('bonus-status');

    bonusButton.disabled = true;
    bonusButton.textContent = "...";

    const userData = await fetchUser(currentUser);
    const lastClaimISO = userData?.last_daily_bonus;
    const now = new Date().getTime();
    const lastTime = lastClaimISO ? new Date(lastClaimISO).getTime() : 0;
    
    if ((now - lastTime) < COOLDOWN_MS) {
        alert("Бонус еще недоступен! Подождите таймер.");
        updateBonusPage();
        return;
    }

    try {
        // Генерируем случайную сумму
        const amount = generateDailyBonusAmount(); 
        const wager = amount * DAILY_BONUS_WAGER_MULTIPLIER;
        
        // Обновляем баланс
        updateBalance(amount, wager);
        
        const success = await patchUser(currentUser, { 
            last_daily_bonus: new Date().toISOString() 
        });

        if (success) {
            if(bonusStatus) bonusStatus.textContent = `Получено ${amount.toFixed(2)} RUB!`;
            
            // Показываем красивое окно вместо алерта
            showDailyBonusModal(amount);
            
            // --- ПРОВЕРКА ДОСТИЖЕНИЯ ---
            checkDailyStreak(); 
            // ---------------------------
            
            updateBonusPage();
        } else {
            throw new Error("Не удалось сохранить дату бонуса в БД.");
        }

    } catch (error) {
        console.error("Bonus claim error:", error);
        alert("Ошибка при получении бонуса:\n" + error.message);
        if(bonusStatus) bonusStatus.textContent = "Ошибка.";
        bonusButton.disabled = false;
        bonusButton.textContent = "Получить";
    }
}

// --- ЛОГИКА АКТИВАЦИИ ПРОМОКОДА ---
async function handlePromoActivate(e) {
    e.preventDefault();
    const input = document.getElementById('promo-input');
    const button = e.currentTarget;
    const statusEl = document.getElementById('promo-status');
    const code = input.value.trim();

    if (!currentUser) return alert("Войдите в аккаунт");
    if (code === "") return;
    
    button.textContent = "...";
    button.disabled = true;
    
    const result = await activatePromocode(code);

    if (result.success) {
        const amount = result.amount !== undefined ? result.amount : "---";
        const wager = result.wager_added !== undefined ? result.wager_added : "---";

        const cardHTML = `
            <div class="bonus-promo-result-card">
                <div class="bonus-promo-title">
                    Промокод активирован
                </div>
                <div class="bonus-promo-amount">
                    +${amount} RUB
                </div>
                <div class="bonus-promo-wager-box">
                    <span class="bonus-promo-wager-text">Отыгрыш: ${wager} RUB</span>
                </div>
            </div>
        `;
        
        statusEl.innerHTML = cardHTML;
        statusEl.className = 'profile-status'; 
        input.value = ""; 
    } else {
        statusEl.textContent = `${result.message}`;
        statusEl.classList.add('loss');
        statusEl.classList.remove('success'); 
    }

    button.textContent = "Активировать";
    button.disabled = false;
}

function initQuestButtons() {
    const questButtons = document.querySelectorAll('.quest-claim-button');
    questButtons.forEach(button => {
        if (localStorage.getItem(`quest_${button.id}`) === 'true') {
            button.textContent = 'Бонус активирован';
            button.disabled = true;
            button.classList.add('activated');
        }
        button.addEventListener('click', () => {
            console.log("Квест выполнен:", button.id);
            button.textContent = 'Бонус активирован';
            button.disabled = true;
            button.classList.add('activated');
            localStorage.setItem(`quest_${button.id}`, 'true');
        });
    });
}

function handleClaimCashback(e) {
    e.currentTarget.textContent = "Получено";
    e.currentTarget.disabled = true;
    alert("Кешбек получен! (Симуляция)");
}

function handleClaimRakeback(e) {
    e.currentTarget.textContent = "Получено";
    e.currentTarget.disabled = true;
    alert("Рейкбек получен! (Симуляция)");
}

export function initBonus() {
    const bonusButton = document.getElementById('claim-bonus-button');
    if (bonusButton) {
        bonusButton.addEventListener('click', handleClaimBonus);
    }

    const promoButton = document.getElementById('claim-promo-button');
    if (promoButton) {
        promoButton.addEventListener('click', handlePromoActivate);
    }
    
    // Инициализация кнопки закрытия модалки бонуса
    const dailyBonusOverlay = document.getElementById('daily-bonus-modal-overlay');
    const dailyBonusClose = document.getElementById('daily-bonus-modal-close');
    const dailyBonusOkBtn = document.getElementById('daily-bonus-ok-btn');
    
    const closeDailyModal = () => {
        if(dailyBonusOverlay) dailyBonusOverlay.classList.add('hidden');
    };

    if(dailyBonusOverlay) dailyBonusOverlay.addEventListener('click', (e) => {
        if(e.target === dailyBonusOverlay) closeDailyModal();
    });
    if(dailyBonusClose) dailyBonusClose.addEventListener('click', closeDailyModal);
    if(dailyBonusOkBtn) dailyBonusOkBtn.addEventListener('click', closeDailyModal);
    
    initQuestButtons();
    
    const linkVK = document.getElementById('bonus-link-profile-vk');
    if (linkVK) linkVK.addEventListener('click', (e) => { e.preventDefault(); showSection('profile-page'); });
    
    const linkTG = document.getElementById('bonus-link-profile-tg');
    if (linkTG) linkTG.addEventListener('click', (e) => { e.preventDefault(); showSection('profile-page'); });

    const cashbackBtn = document.getElementById('claim-cashback-button');
    const rakebackBtn = document.getElementById('claim-rakeback-button');
    
    if (cashbackBtn) cashbackBtn.addEventListener('click', handleClaimCashback);
    if (rakebackBtn) rakebackBtn.addEventListener('click', handleClaimRakeback);
}