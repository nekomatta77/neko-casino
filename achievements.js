/*
 * ACHIEVEMENTS.JS
 * Система достижений и трекинга прогресса
 */

import { currentUser, fetchUser, patchUser } from './global.js';

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

/**
 * Получить данные достижений пользователя (или дефолтные)
 */
async function getUserAchievementsData() {
    const user = await fetchUser(currentUser);
    return user?.achievements_data || {};
}

/**
 * Прогресс достижения типа "Счетчик" (Ставки)
 * @param {string} achievementId - ID достижения
 * @param {number} betAmount - Сумма ставки
 */
export async function checkBetAchievement(achievementId, betAmount) {
    if (!currentUser || betAmount < 100) return;

    const data = await getUserAchievementsData();
    const currentProgress = data[achievementId] || { current: 0, unlocked: false };

    if (currentProgress.unlocked) return; // Уже выполнено

    currentProgress.current = (currentProgress.current || 0) + 1;

    // Проверка на выполнение
    const config = ACHIEVEMENTS_LIST[achievementId];
    if (currentProgress.current >= config.target) {
        currentProgress.current = config.target;
        currentProgress.unlocked = true;
        showAchievementNotification(config.title);
    }

    // Сохраняем
    const newData = { ...data, [achievementId]: currentProgress };
    await patchUser(currentUser, { achievements_data: newData });
}

/**
 * Прогресс достижения типа "Ежедневный стрик"
 */
export async function checkDailyStreak() {
    if (!currentUser) return;

    const data = await getUserAchievementsData();
    const achievementId = 'gift_lover';
    const currentProgress = data[achievementId] || { current: 0, unlocked: false, last_claim: null };

    if (currentProgress.unlocked) return;

    const now = new Date();
    const todayStr = now.toDateString(); // "Fri Dec 06 2025"
    
    // Если уже забирали сегодня - выходим
    if (currentProgress.last_claim === todayStr) return;

    // Проверяем, был ли прошлый клейм вчера
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    if (currentProgress.last_claim === yesterdayStr) {
        // Стрик продолжается
        currentProgress.current += 1;
    } else {
        // Стрик прервался или первый раз
        currentProgress.current = 1;
    }

    currentProgress.last_claim = todayStr;

    // Проверка на выполнение
    const config = ACHIEVEMENTS_LIST[achievementId];
    if (currentProgress.current >= config.target) {
        currentProgress.current = config.target;
        currentProgress.unlocked = true;
        showAchievementNotification(config.title);
    }

    const newData = { ...data, [achievementId]: currentProgress };
    await patchUser(currentUser, { achievements_data: newData });
}

/**
 * Всплывашка при получении достижения
 */
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

    // Удаляем через 4 секунды
    setTimeout(() => {
        notif.classList.add('fade-out');
        setTimeout(() => notif.remove(), 500);
    }, 4000);
}

/**
 * Рендер страницы достижений
 */
export async function renderAchievementsPage() {
    const container = document.getElementById('achievements-list');
    if (!container) return;

    if (!currentUser) {
        container.innerHTML = '<div class="ref-list-placeholder">Войдите в аккаунт, чтобы видеть достижения</div>';
        return;
    }

    container.innerHTML = '<div class="loader-text" style="width:100%;text-align:center;">Загрузка...</div>';

    const userProgress = await getUserAchievementsData();
    let html = '';

    Object.values(ACHIEVEMENTS_LIST).forEach(ach => {
        const userState = userProgress[ach.id] || { current: 0, unlocked: false };
        const percent = Math.min(100, (userState.current / ach.target) * 100);
        const isUnlockedClass = userState.unlocked ? 'unlocked' : '';
        const btnText = userState.unlocked ? 'ВЫПОЛНЕНО' : `${userState.current} / ${ach.target}`;

        html += `
            <div class="achievement-card ${isUnlockedClass}">
                <div class="ach-icon-wrapper">
                    <img src="${ach.icon}" alt="${ach.title}">
                </div>
                <div class="ach-content">
                    <div class="ach-header">
                        <span class="ach-title">${ach.title}</span>
                        ${userState.unlocked ? '<span class="ach-badge">✓</span>' : ''}
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