/*
 * BONUS.JS - LOCALHOST FIX & REAL API CHECK
 */
import { updateBalance, currentUser, showSection, activatePromocode, fetchUser, fetchUserStats, patchUser } from './global.js';
import { checkDailyStreak } from './achievements.js'; 

const DAILY_BONUS_WAGER_MULTIPLIER = 10; 
const COOLDOWN_MS = 24 * 60 * 60 * 1000; 

const REWARD_TOTAL_TG = 30.00; 

let dailyBonusInterval = null;

// ... (Функции генерации бонуса и модалки остаются без изменений) ...
function generateDailyBonusAmount() {
    const chance = Math.random() * 100;
    let amount = 0;
    if (chance < 90) amount = Math.random() * (10 - 1) + 1;
    else if (chance < 99) amount = Math.random() * (30 - 10) + 10;
    else amount = Math.random() * (100 - 30) + 30;
    return parseFloat(amount.toFixed(2));
}

function showRewardModal(title, amount, description, imageSrc) {
    const overlay = document.getElementById('daily-bonus-modal-overlay');
    const amountEl = document.getElementById('daily-bonus-modal-amount');
    const titleEl = document.getElementById('reward-modal-title');
    const imgEl = document.getElementById('reward-modal-img');
    const descEl = document.getElementById('reward-modal-desc');
    
    if (overlay && amountEl) {
        amountEl.textContent = amount.toFixed(2);
        if (titleEl) titleEl.textContent = title;
        if (descEl) descEl.textContent = description;
        if (imgEl && imageSrc) imgEl.src = imageSrc;
        overlay.classList.remove('hidden');
    } else {
        alert(`${title}: Вы получили ${amount.toFixed(2)} RUB. ${description}`);
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

function isSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
}

// === UI КВЕСТОВ ===

function updateQuestStatusUI(userData) {
    const questBoxes = document.querySelectorAll('.quest-box');
    if (questBoxes.length < 2) return;

    const tgBox = questBoxes[1]; 
    const circles = tgBox.querySelectorAll('.quest-status-icon');
    const tgBtn = document.getElementById('quest-tg');
    
    const circleSub = circles[0];
    const circleLink = circles[1];

    const isLinked = !!userData.tg_linked;
    const isSubDone = !!userData.quest_tg_sub_done; 
    const isClaimed = !!userData.quest_tg_full_claimed; 

    if (isLinked) markCircleSuccess(circleLink);
    else markCirclePending(circleLink);

    if (isSubDone) markCircleSuccess(circleSub);
    else markCirclePending(circleSub);

    if (tgBtn) {
        if (isClaimed) {
            tgBtn.textContent = "Получено";
            tgBtn.disabled = true;
            tgBtn.classList.add('activated');
        } else if (!isLinked) {
            tgBtn.textContent = "Привяжите TG";
            tgBtn.disabled = true; 
        } else {
            tgBtn.textContent = "Проверить подписку";
            tgBtn.disabled = false;
            tgBtn.classList.remove('activated');
        }
    }
}

function markCircleSuccess(el) {
    if (!el) return;
    el.textContent = '●';
    el.style.color = '#00D699';
    el.classList.add('status-success');
    el.classList.remove('status-pending');
}

function markCirclePending(el) {
    if (!el) return;
    el.textContent = '○';
    el.style.color = 'var(--color-text-light)';
    el.classList.add('status-pending');
    el.classList.remove('status-success');
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

    const userData = await fetchUser(currentUser); 
    updateQuestStatusUI(userData);

    const bonusButton = document.getElementById('claim-bonus-button');
    const bonusStatus = document.getElementById('bonus-status');
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

    // === ЛОГИКА КЭШБЕКА И РЕЙКБЕКА ===
    const cashbackBtn = document.getElementById('claim-cashback-button');
    const rakebackBtn = document.getElementById('claim-rakeback-button');
    const cashbackAmount = document.getElementById('cashback-amount');
    const rakebackAmount = document.getElementById('rakeback-amount');

    if (!cashbackBtn) return;

    const statsOld = (await fetchUserStats(currentUser)) || {};
    const dbRank = userData?.rank || 'None Rang';
    const { cashbackPercent, rakebackPercent } = getRankStats(dbRank);

    const totalDeposits = statsOld.totalDeposits || 0;
    const totalWithdrawals = statsOld.totalWithdrawals || 0;
    const netLoss = totalDeposits - totalWithdrawals;
    
    const wagerNew = userData.stats_total_wager || 0;
    const wagerOld = statsOld.totalWager || 0;
    const totalWager = wagerNew > 0 ? wagerNew : wagerOld;

    const cashbackValue = netLoss > 0 ? netLoss * cashbackPercent : 0;
    const rakebackValue = totalWager * rakebackPercent;

    cashbackAmount.textContent = cashbackValue.toFixed(2) + ' RUB';
    rakebackAmount.textContent = rakebackValue.toFixed(2) + ' RUB';

    cashbackBtn.dataset.amount = cashbackValue.toFixed(2);
    rakebackBtn.dataset.amount = rakebackValue.toFixed(2);

    const today = new Date().getDay();
    const now = new Date();
    const lastCashbackISO = userData?.last_cashback_claim;
    const lastRakebackISO = userData?.last_rakeback_claim;

    const isCashbackClaimedToday = lastCashbackISO && isSameDay(new Date(lastCashbackISO), now);
    const isRakebackClaimedToday = lastRakebackISO && isSameDay(new Date(lastRakebackISO), now);

    if (today === 1) { 
        if (isCashbackClaimedToday) {
            cashbackBtn.disabled = true;
            cashbackBtn.textContent = 'Получено';
        } else if (cashbackValue > 0) {
            cashbackBtn.disabled = false;
            cashbackBtn.textContent = 'Забрать';
        } else {
            cashbackBtn.disabled = true;
            cashbackBtn.textContent = 'Нет доступных средств';
        }
    } else {
        cashbackBtn.disabled = true;
        cashbackBtn.textContent = 'Доступно в ПН';
    }

    if (today === 2) { 
        if (isRakebackClaimedToday) {
            rakebackBtn.disabled = true;
            rakebackBtn.textContent = 'Получено';
        } else if (rakebackValue > 0) {
            rakebackBtn.disabled = false;
            rakebackBtn.textContent = 'Забрать';
        } else {
            rakebackBtn.disabled = true;
            rakebackBtn.textContent = 'Нет доступных средств';
        }
    } else {
        rakebackBtn.disabled = true;
        rakebackBtn.textContent = 'Доступно во ВТ';
    }
}

// === УМНАЯ ПРОВЕРКА ПОДПИСКИ (Localhost Safe) ===

async function handleTgQuestClaim() {
    if (!currentUser) return alert('Сначала войдите в аккаунт!');
    
    const btn = document.getElementById('quest-tg');
    btn.disabled = true;
    btn.textContent = "Проверка...";

    const userData = await fetchUser(currentUser);
    
    if (!userData.tg_linked) {
        alert("Сначала привяжите Telegram в настройках!");
        updateBonusPage(); 
        return;
    }

    let isSubscribed = false;
    
    // --- ПРОВЕРКА: Если мы на Localhost, эмулируем успех ---
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (isLocalhost) {
        console.warn("Вы на Localhost. API проверки недоступен. Эмулируем успех подписки.");
        await new Promise(r => setTimeout(r, 1000)); // Имитация задержки
        isSubscribed = true;
    } else {
        // --- РЕАЛЬНАЯ ПРОВЕРКА (Только на Vercel) ---
        if (userData.tg_id) {
            try {
                const response = await fetch(`/api/check-sub?tg_id=${userData.tg_id}`);
                
                if (!response.ok) {
                    if (response.status === 404) {
                        throw new Error("Файл API не найден! Убедитесь, что вы создали api/check-sub.js и загрузили проект на Vercel.");
                    }
                    const errJson = await response.json().catch(() => ({}));
                    throw new Error(errJson.error || `Ошибка сервера: ${response.status}`);
                }

                const json = await response.json();
                isSubscribed = json.is_member;

            } catch(e) {
                console.error('Check Sub Error:', e);
                alert(`Не удалось проверить подписку:\n${e.message}`);
                updateBonusPage();
                return;
            }
        }
    }

    if (!isSubscribed) {
        alert("Бот не видит вашу подписку на канал! Подпишитесь и попробуйте снова.\n(Убедитесь, что бот - администратор канала)");
        updateBonusPage();
        return;
    }

    try {
        await updateBalance(REWARD_TOTAL_TG, 0); 
        await patchUser(currentUser, {
            quest_tg_sub_done: true,   
            quest_tg_full_claimed: true 
        });
        showRewardModal("Бонус Telegram", REWARD_TOTAL_TG, "Все условия выполнены!", "assets/tg.png");
        if(typeof window.addAppNotification === 'function') {
            window.addAppNotification('🚀 Бонус', 'Вы получили награду за Telegram!');
        }
        updateBonusPage(); 
    } catch (e) {
        console.error("Reward Error", e);
        alert("Ошибка сети при выдаче награды.");
        updateBonusPage();
    }
}

// ... ОСТАЛЬНЫЕ ХЕНДЛЕРЫ ...

async function handleVkQuestClaim() {
     if (!currentUser) return alert('Сначала войдите в аккаунт!');
     alert("Функция проверки ВК в разработке.");
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
        const amount = generateDailyBonusAmount(); 
        const wager = amount * DAILY_BONUS_WAGER_MULTIPLIER;
        
        updateBalance(amount, wager);
        
        const success = await patchUser(currentUser, { 
            last_daily_bonus: new Date().toISOString() 
        });

        if (success) {
            if(bonusStatus) bonusStatus.textContent = `Получено ${amount.toFixed(2)} RUB!`;
            showRewardModal("Ежедневный Бонус", amount, "Заходите завтра!", "assets/gift_cat.png");
            if(typeof window.addAppNotification === 'function') {
                window.addAppNotification('🎁 Ежедневный бонус', 'Бонус успешно получен!');
            }
            checkDailyStreak(); 
            updateBonusPage();
        } else {
            throw new Error("DB Error");
        }
    } catch (error) {
        console.error(error);
        bonusButton.disabled = false;
        bonusButton.textContent = "Получить";
    }
}

async function handleClaimCashback(e) {
    const btn = e.currentTarget;
    if (!currentUser || btn.disabled) return;
    const amount = parseFloat(btn.dataset.amount || 0);
    if (amount <= 0) return alert("Сумма бонуса равна 0!");
    try {
        btn.disabled = true;
        btn.textContent = "...";
        await patchUser(currentUser, { last_cashback_claim: new Date().toISOString() });
        updateBalance(amount, 0);
        showRewardModal("Еженедельный Кешбек", amount, "Cashback", "assets/gift_cat.png");
        await updateBonusPage();
    } catch (err) {
        console.error(err);
        await updateBonusPage();
    }
}

async function handleClaimRakeback(e) {
    const btn = e.currentTarget;
    if (!currentUser || btn.disabled) return;
    const amount = parseFloat(btn.dataset.amount || 0);
    if (amount <= 0) return alert("Сумма бонуса равна 0!");
    try {
        btn.disabled = true;
        btn.textContent = "...";
        await patchUser(currentUser, { last_rakeback_claim: new Date().toISOString() });
        updateBalance(amount, 0);
        showRewardModal("Рейкбек", amount, "Rakeback", "assets/gift_cat.png");
        await updateBonusPage();
    } catch (err) {
        console.error(err);
        await updateBonusPage();
    }
}

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
         statusEl.innerHTML = `<span style="color:#00D699">Успешно! +${result.amount} RUB</span>`;
         input.value = "";
    } else {
         statusEl.innerHTML = `<span style="color:#ff4d4d">${result.message}</span>`;
    }
    button.textContent = "Активировать";
    button.disabled = false;
}

export function initBonus() {
    const bonusButton = document.getElementById('claim-bonus-button');
    if (bonusButton) bonusButton.addEventListener('click', handleClaimBonus);

    const promoButton = document.getElementById('claim-promo-button');
    if (promoButton) promoButton.addEventListener('click', handlePromoActivate);
    
    const questTgBtn = document.getElementById('quest-tg');
    if (questTgBtn) {
        questTgBtn.classList.remove('activated');
        questTgBtn.addEventListener('click', handleTgQuestClaim);
    }

    const questVkBtn = document.getElementById('quest-vk');
    if (questVkBtn) questVkBtn.addEventListener('click', handleVkQuestClaim);

    const dailyBonusOverlay = document.getElementById('daily-bonus-modal-overlay');
    const dailyBonusClose = document.getElementById('daily-bonus-modal-close');
    const dailyBonusOkBtn = document.getElementById('daily-bonus-ok-btn');
    
    const closeDailyModal = () => { if(dailyBonusOverlay) dailyBonusOverlay.classList.add('hidden'); };
    if(dailyBonusOverlay) dailyBonusOverlay.addEventListener('click', (e) => { if(e.target === dailyBonusOverlay) closeDailyModal(); });
    if(dailyBonusClose) dailyBonusClose.addEventListener('click', closeDailyModal);
    if(dailyBonusOkBtn) dailyBonusOkBtn.addEventListener('click', closeDailyModal);
    
    const linkVK = document.getElementById('bonus-link-profile-vk');
    if (linkVK) linkVK.addEventListener('click', (e) => { e.preventDefault(); showSection('profile-page'); });
    
    const linkTG = document.getElementById('bonus-link-profile-tg');
    if (linkTG) linkTG.addEventListener('click', (e) => { e.preventDefault(); showSection('profile-page'); });

    const cashbackBtn = document.getElementById('claim-cashback-button');
    const rakebackBtn = document.getElementById('claim-rakeback-button');
    if (cashbackBtn) cashbackBtn.addEventListener('click', handleClaimCashback);
    if (rakebackBtn) rakebackBtn.addEventListener('click', handleClaimRakeback);
}