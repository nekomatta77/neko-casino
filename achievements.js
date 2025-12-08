/*
 * ACHIEVEMENTS.JS
 * Система достижений (С кешированием и атомарным обновлением)
 */

import { currentUser, fetchUser, updateAchievementProgress } from './global.js';

// Конфигурация достижений
export const ACHIEVEMENTS_LIST = {
    gift_lover: {
        id: 'gift_lover',
        title: 'Любитель подарков',
        desc: 'Забрать ежедневный бонус 5 дней подряд',
        target: 5,
        icon: 'assets/gift.png' 
    },
    mines_sapper: {
        id: 'mines_sapper',
        title: 'Начинающий сапер',
        desc: 'Сделать 10 ставок по 100₽+ в Mines',
        target: 10,
        icon: 'assets/mine_icon.png'
    },
    dice_backgammon: {
        id: 'dice_backgammon',
        title: 'Может лучше в нарды?',
        desc: 'Сделать 10 ставок по 100₽+ в Dice',
        target: 10,
        icon: 'assets/dice_icon.png'
    },
    keno_cinema: {
        id: 'keno_cinema',
        title: 'Кено или Кино?',
        desc: 'Сделать 10 ставок по 100₽+ в Keno',
        target: 10,
        icon: 'assets/keno_icon.png'
    }
};

// --- КЕШИРОВАНИЕ ---
let cachedAchievementsData = null;
let lastFetchTime = 0;
const CACHE_TTL = 30000; // Кеш живет 30 секунд

/**
 * Получить данные достижений (с кешем)
 */
async function getUserAchievementsData(force = false) {
    const now = Date.now();
    // Если есть свежий кеш, отдаем его сразу
    if (!force && cachedAchievementsData && (now - lastFetchTime < CACHE_TTL)) {
        return cachedAchievementsData;
    }

    // Иначе грузим с сервера
    const user = await fetchUser(currentUser);
    const data = user?.achievements_data || {};
    
    cachedAchievementsData = data;
    lastFetchTime = now;
    return data;
}

/**
 * Прогресс достижения типа "Счетчик" (Ставки)
 */
export async function checkBetAchievement(achievementId, betAmount) {
    if (!currentUser || betAmount < 100) return;

    const config = ACHIEVEMENTS_LIST[achievementId];
    
    // Используем безопасное атомарное обновление
    const result = await updateAchievementProgress(currentUser, achievementId, config.target);
    
    // Если только что открыли достижение - показываем тост
    if (result.justUnlocked) {
        showAchievementNotification(config.title);
    }

    // Сбрасываем кеш, чтобы при следующем открытии вкладки данные были свежими
    if (result.success) {
        cachedAchievementsData = null;
    }
}

/**
 * Прогресс достижения типа "Ежедневный стрик"
 */
export async function checkDailyStreak() {
    if (!currentUser) return;

    // Читаем с сервера, так как важна дата
    const data = await getUserAchievementsData(true); 
    const achievementId = 'gift_lover';
    const currentProgress = data[achievementId] || { current: 0, unlocked: false, last_claim: null };

    if (currentProgress.unlocked) return;

    const now = new Date();
    const todayStr = now.toDateString();
    
    if (currentProgress.last_claim === todayStr) return;

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    if (currentProgress.last_claim === yesterdayStr) {
        currentProgress.current += 1;
    } else {
        currentProgress.current = 1;
    }

    currentProgress.last_claim = todayStr;

    const config = ACHIEVEMENTS_LIST[achievementId];
    let justUnlocked = false;

    if (currentProgress.current >= config.target) {
        currentProgress.current = config.target;
        currentProgress.unlocked = true;
        justUnlocked = true;
    }

    // Сохраняем (здесь можно без атомарности, так как раз в сутки)
    import('./global.js').then(module => {
        module.patchUser(currentUser, { 
            [`achievements_data.${achievementId}`]: currentProgress 
        });
        cachedAchievementsData = null; // Сброс кеша
        if (justUnlocked) showAchievementNotification(config.title);
    });
}

function showAchievementNotification(title) {
    const notif = document.createElement('div');
    notif.className = 'achievement-toast';
    notif.innerHTML = `
        <div class="ach-toast-icon">🏆</div>
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

/**
 * Рендер страницы (МГНОВЕННЫЙ БЛАГОДАРЯ КЕШУ)
 */
export async function renderAchievementsPage() {
    const container = document.getElementById('achievements-list');
    if (!container) return;

    if (!currentUser) {
        container.innerHTML = '<div class="ref-list-placeholder">Войдите в аккаунт, чтобы видеть достижения</div>';
        return;
    }

    // 1. Показываем кеш мгновенно (если есть)
    if (cachedAchievementsData) {
        renderHTML(container, cachedAchievementsData);
    } else {
        container.innerHTML = '<div class="loader-text" style="width:100%;text-align:center;">Загрузка...</div>';
    }

    // 2. Фоново обновляем данные с сервера
    const userProgress = await getUserAchievementsData();
    renderHTML(container, userProgress);
}

function renderHTML(container, userProgress) {
    let html = '';
    Object.values(ACHIEVEMENTS_LIST).forEach(ach => {
        const userState = userProgress[ach.id] || { current: 0, unlocked: false };
        
        // --- ИСПРАВЛЕНИЕ ЗДЕСЬ: Визуально считаем выполненным, если счетчик >= цели ---
        const isCompleted = userState.current >= ach.target; 
        
        const percent = Math.min(100, (userState.current / ach.target) * 100);
        
        // --- ИСПРАВЛЕНИЕ ЗДЕСЬ: Класс .unlocked ставится по факту заполнения ---
        const isUnlockedClass = isCompleted ? 'unlocked' : '';
        const btnText = isCompleted ? 'ВЫПОЛНЕНО' : `${userState.current} / ${ach.target}`;

        html += `
            <div class="achievement-card ${isUnlockedClass}">
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
    container.innerHTML = html;
}