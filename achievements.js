/*
 * ACHIEVEMENTS.JS
 * Система достижений: Группировка, Этапы, Награды, Модальные окна
 */

import { currentUser, fetchUser, updateAchievementProgress } from './global.js';

// --- КОНФИГУРАЦИЯ ГРУПП И ДОСТИЖЕНИЙ ---

export const ACHIEVEMENT_GROUPS = [
    {
        id: 'gift',
        title: 'ЕЖЕДНЕВНЫЕ БОНУСЫ',
        items: [
            {
                id: 'gift_lover',
                title: 'Любитель подарков I',
                desc: 'Забрать ежедневный бонус 5 дней подряд',
                target: 5,
                minBet: 0,
                icon: 'assets/achievements/gift-classic.svg',
                reward: null 
            },
            {
                id: 'gift_lover_gold',
                title: 'Любитель подарков II',
                desc: 'Забрать ежедневный бонус 10 дней подряд',
                target: 10,
                minBet: 0,
                icon: 'assets/achievements/gift-gold.svg',
                reward: null
            },
            {
                id: 'gift_lover_diamond',
                title: 'Любитель подарков III',
                desc: 'Забрать ежедневный бонус 30 дней подряд',
                target: 30,
                minBet: 0,
                icon: 'assets/achievements/gift-diamond.svg',
                reward: null
            }
        ]
    },
    {
        id: 'mines',
        title: 'MINES',
        items: [
            {
                id: 'mines_sapper',
                title: 'Сапер I',
                desc: '10 игр в Mines (ставка от 100₽)',
                target: 10,
                minBet: 100,
                icon: 'assets/achievements/mines-classic.svg',
                reward: null
            },
            {
                id: 'mines_sapper_gold',
                title: 'Сапер II',
                desc: '200 игр в Mines (ставка от 500₽)',
                target: 200,
                minBet: 500,
                icon: 'assets/achievements/mines-gold.svg',
                reward: null
            },
            {
                id: 'mines_sapper_diamond',
                title: 'Сапер III',
                desc: '500 игр в Mines (ставка от 1000₽)',
                target: 500,
                minBet: 1000,
                icon: 'assets/achievements/mines-diamond.svg',
                reward: null
            }
        ]
    },
    {
        id: 'dice',
        title: 'DICE',
        items: [
            {
                id: 'dice_backgammon',
                title: 'Игрок в кости I',
                desc: '10 игр в Dice (ставка от 100₽)',
                target: 10,
                minBet: 100,
                icon: 'assets/achievements/dice-classic.svg',
                // --- НАГРАДА ---
                reward: {
                    type: 'avatar',
                    src: 'assets/avatars/dice_red_avatar.png',
                    name: 'Красный Кубик (Аватар)'
                }
            },
            {
                id: 'dice_backgammon_gold',
                title: 'Игрок в кости II',
                desc: '200 игр в Dice (ставка от 500₽)',
                target: 200,
                minBet: 500,
                icon: 'assets/achievements/dice-gold.svg',
                reward: null
            },
            {
                id: 'dice_backgammon_diamond',
                title: 'Игрок в кости III',
                desc: '500 игр в Dice (ставка от 1000₽)',
                target: 500,
                minBet: 1000,
                icon: 'assets/achievements/dice-diamond.svg',
                reward: null
            }
        ]
    },
    {
        id: 'keno',
        title: 'KENO',
        items: [
            {
                id: 'keno_cinema',
                title: 'Мастер Кено I',
                desc: '10 игр в Keno (ставка от 100₽)',
                target: 10,
                minBet: 100,
                icon: 'assets/achievements/keno-classic.svg',
                reward: null
            },
            {
                id: 'keno_cinema_gold',
                title: 'Мастер Кено II',
                desc: '200 игр в Keno (ставка от 500₽)',
                target: 200,
                minBet: 500,
                icon: 'assets/achievements/keno-gold.svg',
                reward: null
            },
            {
                id: 'keno_cinema_diamond',
                title: 'Мастер Кено III',
                desc: '500 игр в Keno (ставка от 1000₽)',
                target: 500,
                minBet: 1000,
                icon: 'assets/achievements/keno-diamond.svg',
                reward: null
            }
        ]
    }
];

// Плоский список для быстрого доступа
export const ACHIEVEMENTS_LIST = {};
ACHIEVEMENT_GROUPS.forEach(group => {
    group.items.forEach(item => {
        ACHIEVEMENTS_LIST[item.id] = item;
    });
});

// --- КЕШИРОВАНИЕ ---
let cachedAchievementsData = null;
let lastFetchTime = 0;
const CACHE_TTL = 30000;

// --- ИНИЦИАЛИЗАЦИЯ СТИЛЕЙ МОДАЛЬНОГО ОКНА ---
function injectModalStyles() {
    if (document.getElementById('ach-modal-styles')) return;

    const style = document.createElement('style');
    style.id = 'ach-modal-styles';
    style.innerHTML = `
        .ach-modal-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.75);
            backdrop-filter: blur(8px);
            z-index: 10000;
            display: flex; align-items: center; justify-content: center;
            opacity: 0; pointer-events: none;
            transition: opacity 0.3s ease;
        }
        .ach-modal-overlay.active {
            opacity: 1; pointer-events: auto;
        }
        .ach-modal-content {
            /* ФОН КАК В ПРОФИЛЕ (Темный) */
            background: #151515; 
            /* ОБВОДКА ИНДИГО */
            border: 2px solid indigo;
            box-shadow: 0 0 30px rgba(75, 0, 130, 0.3);
            border-radius: 20px;
            width: 90%; max-width: 400px;
            padding: 30px;
            text-align: center;
            transform: scale(0.9);
            transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            position: relative;
            color: #fff;
        }
        .ach-modal-overlay.active .ach-modal-content {
            transform: scale(1);
        }
        .ach-modal-close {
            position: absolute; top: 15px; right: 15px;
            background: none; border: none; color: #666; font-size: 24px;
            cursor: pointer; transition: color 0.2s;
        }
        .ach-modal-close:hover { color: #fff; }
        
        .ach-modal-icon {
            width: 80px; height: 80px; margin: 0 auto 20px;
            filter: drop-shadow(0 0 10px rgba(255,255,255,0.3));
        }
        .ach-modal-icon img { width: 100%; height: 100%; object-fit: contain; }
        
        .ach-modal-title {
            font-size: 1.4rem; font-weight: 800; margin-bottom: 10px;
            color: #fff; text-transform: uppercase; letter-spacing: 1px;
        }
        .ach-modal-desc {
            font-size: 0.95rem; color: #aaa; margin-bottom: 25px; line-height: 1.4;
        }
        
        .ach-reward-box {
            background: rgba(255, 255, 255, 0.05);
            border: 1px dashed rgba(255, 255, 255, 0.2);
            border-radius: 12px; padding: 15px;
            margin-bottom: 20px;
        }
        .ach-reward-label {
            font-size: 0.8rem; text-transform: uppercase; color: #888; margin-bottom: 10px; display: block;
        }
        .ach-reward-item {
            display: flex; align-items: center; justify-content: center; gap: 15px;
        }
        .ach-reward-img {
            width: 50px; height: 50px; border-radius: 8px; border: 2px solid indigo;
            background: #000; object-fit: cover;
        }
        .ach-reward-name {
            font-weight: bold; color: #d4d4ff; font-size: 1rem;
        }
        
        .ach-status-badge {
            display: inline-block; padding: 8px 20px; border-radius: 20px;
            font-size: 0.85rem; font-weight: bold; text-transform: uppercase;
        }
        .ach-status-badge.locked { background: #333; color: #777; }
        .ach-status-badge.completed { 
            background: linear-gradient(90deg, #4b6cb7, #182848); 
            color: #fff; box-shadow: 0 0 10px rgba(75, 108, 183, 0.5);
        }
    `;
    document.head.appendChild(style);

    if (!document.getElementById('achievement-modal')) {
        const modalHTML = `
            <div id="achievement-modal" class="ach-modal-overlay">
                <div class="ach-modal-content">
                    <button class="ach-modal-close" onclick="window.closeAchievementModal()">&times;</button>
                    <div id="ach-modal-body"></div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
}

// --- ФУНКЦИИ МОДАЛЬНОГО ОКНА ---

window.closeAchievementModal = function() {
    const modal = document.getElementById('achievement-modal');
    if (modal) modal.classList.remove('active');
}

window.openAchievementModal = async function(achId) {
    const modal = document.getElementById('achievement-modal');
    const body = document.getElementById('ach-modal-body');
    const config = ACHIEVEMENTS_LIST[achId];
    
    if (!modal || !body || !config) return;

    // Получаем актуальный прогресс
    const data = await getUserAchievementsData();
    const userState = data[achId] || { current: 0, unlocked: false };
    const isCompleted = userState.current >= config.target;

    // Формируем HTML награды
    let rewardHtml = '';
    if (config.reward) {
        rewardHtml = `
            <div class="ach-reward-box">
                <span class="ach-reward-label">Награда за получение</span>
                <div class="ach-reward-item">
                    <img src="${config.reward.src}" class="ach-reward-img" alt="Reward">
                    <span class="ach-reward-name">${config.reward.name}</span>
                </div>
            </div>
        `;
    } else {
        rewardHtml = `
            <div class="ach-reward-box" style="opacity: 0.5">
                <span class="ach-reward-label">Награда</span>
                <span style="color:#666; font-size:0.9rem;">Нет награды</span>
            </div>
        `;
    }

    const statusHtml = isCompleted 
        ? `<div class="ach-status-badge completed">Получено</div>`
        : `<div class="ach-status-badge locked">Прогресс: ${userState.current} / ${config.target}</div>`;

    body.innerHTML = `
        <div class="ach-modal-icon">
            <img src="${config.icon}" alt="${config.title}">
        </div>
        <div class="ach-modal-title">${config.title}</div>
        <div class="ach-modal-desc">${config.desc}</div>
        ${rewardHtml}
        ${statusHtml}
    `;

    modal.classList.add('active');
}

// --- ЛОГИКА ДАННЫХ ---

async function getUserAchievementsData(force = false) {
    const now = Date.now();
    if (!force && cachedAchievementsData && (now - lastFetchTime < CACHE_TTL)) {
        return cachedAchievementsData;
    }
    const user = await fetchUser(currentUser);
    const data = user?.achievements_data || {};
    cachedAchievementsData = data;
    lastFetchTime = now;
    return data;
}

/**
 * НОВАЯ ФУНКЦИЯ: Возвращает массив путей (src) к разблокированным аватаркам.
 * Используйте это в customize.js
 */
export async function getUnlockedAvatars() {
    const data = await getUserAchievementsData();
    const unlocked = [];

    Object.values(ACHIEVEMENTS_LIST).forEach(ach => {
        if (ach.reward && ach.reward.type === 'avatar') {
            const userState = data[ach.id];
            // Проверяем, выполнено ли достижение
            if (userState && (userState.unlocked || userState.current >= ach.target)) {
                unlocked.push(ach.reward.src);
            }
        }
    });
    return unlocked;
}

export async function checkBetAchievement(triggerId, betAmount) {
    if (!currentUser) return;
    const group = ACHIEVEMENT_GROUPS.find(g => g.items.some(item => item.id === triggerId));
    if (!group) return;

    for (const ach of group.items) {
        if (betAmount >= ach.minBet) {
            const result = await updateAchievementProgress(currentUser, ach.id, ach.target);
            if (result.justUnlocked) {
                showAchievementNotification(ach.title, ach.icon);
            }
            if (result.success) cachedAchievementsData = null;
        }
    }
}

export async function checkDailyStreak() {
    if (!currentUser) return;
    const data = await getUserAchievementsData(true); 
    const baseId = 'gift_lover'; 
    let currentStreak = (data[baseId] && data[baseId].current) || 0;
    const lastClaim = (data[baseId] && data[baseId].last_claim) || null;

    const now = new Date();
    const todayStr = now.toDateString();
    if (lastClaim === todayStr) return;

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    if (lastClaim === yesterdayStr) currentStreak += 1;
    else currentStreak = 1; 

    const giftGroup = ACHIEVEMENT_GROUPS.find(g => g.id === 'gift');
    if (giftGroup) {
        const updates = {};
        let notificationQueue = [];

        giftGroup.items.forEach(ach => {
            const userState = data[ach.id] || { unlocked: false };
            if (!userState.unlocked) {
                const newProgress = {
                    current: currentStreak,
                    unlocked: false,
                    last_claim: todayStr
                };
                if (currentStreak >= ach.target) {
                    newProgress.current = ach.target;
                    newProgress.unlocked = true;
                    notificationQueue.push(ach); 
                }
                updates[`achievements_data.${ach.id}`] = newProgress;
            }
        });

        if (Object.keys(updates).length > 0) {
            import('./global.js').then(module => {
                module.patchUser(currentUser, updates);
                cachedAchievementsData = null;
                notificationQueue.forEach((ach, index) => {
                    setTimeout(() => showAchievementNotification(ach.title, ach.icon), index * 2000);
                });
            });
        }
    }
}

function showAchievementNotification(title, icon) {
    const notif = document.createElement('div');
    notif.className = 'achievement-toast';
    notif.innerHTML = `
        <div class="ach-toast-icon" style="width: 50px; height: 50px; min-width: 50px; margin-right: 12px; display: flex; align-items: center; justify-content: center;">
            <img src="${icon}" alt="icon" style="width: 100%; height: 100%; object-fit: contain;">
        </div>
        <div class="ach-toast-text">
            <div class="ach-toast-header">Достижение разблокировано!</div>
            <div class="ach-toast-title">${title}</div>
        </div>
    `;
    document.body.appendChild(notif);
    setTimeout(() => {
        notif.classList.add('fade-out');
        setTimeout(() => notif.remove(), 500);
    }, 4000);
}

// --- РЕНДЕР ---

export async function renderAchievementsPage() {
    const container = document.getElementById('achievements-list');
    if (!container) return;

    injectModalStyles();

    if (!currentUser) {
        container.innerHTML = '<div class="ref-list-placeholder">Войдите в аккаунт, чтобы видеть достижения</div>';
        return;
    }

    if (cachedAchievementsData) {
        renderHTML(container, cachedAchievementsData);
    } else {
        container.innerHTML = '<div class="loader-text" style="width:100%;text-align:center;">Загрузка...</div>';
    }

    const userProgress = await getUserAchievementsData();
    renderHTML(container, userProgress);
}

function renderHTML(container, userProgress) {
    let fullHtml = '';

    ACHIEVEMENT_GROUPS.forEach(group => {
        fullHtml += `
            <div class="ach-category-header" style="
                text-align: center; font-size: 1.1rem; font-weight: 800; color: indigo;
                text-transform: uppercase; letter-spacing: 2px; margin: 35px 0 20px;
                text-shadow: 0 0 15px rgba(110, 80, 255, 0.6);
                display: flex; align-items: center; justify-content: center; gap: 15px;
            ">
                <span style="height: 1px; width: 40px; background: linear-gradient(90deg, transparent, rgba(75, 0, 130, 0.5));"></span>
                ${group.title}
                <span style="height: 1px; width: 40px; background: linear-gradient(270deg, transparent, rgba(75, 0, 130, 0.5));"></span>
            </div>
            <div class="ach-group-container">
        `;

        group.items.forEach(ach => {
            const userState = userProgress[ach.id] || { current: 0, unlocked: false };
            const isCompleted = userState.current >= ach.target; 
            const percent = Math.min(100, (userState.current / ach.target) * 100);
            const isUnlockedClass = isCompleted ? 'unlocked' : '';
            const btnText = isCompleted ? 'ВЫПОЛНЕНО' : `${userState.current} / ${ach.target}`;

            fullHtml += `
                <div class="achievement-card ${isUnlockedClass}" onclick="window.openAchievementModal('${ach.id}')" style="cursor: pointer;">
                    <div class="ach-icon-wrapper">
                        <img src="${ach.icon}" alt="${ach.title}">
                    </div>
                    <div class="ach-content">
                        <div class="ach-header">
                            <span class="ach-title">${ach.title}</span>
                            ${isCompleted ? '<span class="ach-badge">✓</span>' : ''}
                        </div>
                        <p class="ach-desc">${ach.desc}</p>
                        <div class="ach-progress-container">
                            <div class="ach-progress-bar" style="width: ${percent}%"></div>
                        </div>
                    </div>
                    <div class="ach-status">
                        ${btnText}
                    </div>
                </div>
            `;
        });
        fullHtml += `</div>`;
    });
    container.innerHTML = fullHtml;
}