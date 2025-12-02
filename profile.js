/*
 * profile.js
 * Добавлена логика переключения темы (Dark/Light Mode) и сохранение в БД
 */

import { showSection, setCurrentUser, currentUser, fetchUser, updateUser, patchUser } from './global.js';

// --- Элементы DOM ---
let wagerAmountEl, rankEl, wagerRulesLink;
let passwordForm, oldPassInput, newPassInput, passwordStatusEl;
let vkLinkBtn, tgLinkBtn, logoutBtn;
let themeToggleBtn; 

// --- ЛОГИКА ТЕМЫ ---

/**
 * Инициализирует состояние кнопки и темы при открытии профиля
 */
function initTheme() {
    const themeStyle = document.getElementById('theme-style'); // Ссылка на style4.css
    const currentTheme = localStorage.getItem('cashcat_theme') || 'light'; // Default light
    
    // Синхронизируем текст кнопки
    if (themeToggleBtn) {
        if (currentTheme === 'dark') {
            themeToggleBtn.textContent = "☀️ Включить светлую тему";
        } else {
            themeToggleBtn.textContent = "🌙 Включить темную тему";
        }
    }

    // Синхронизируем стили
    if (themeStyle) {
        themeStyle.disabled = (currentTheme === 'light');
    }
}

/**
 * Обрабатывает клик по кнопке переключения
 */
async function handleThemeToggle() {
    const themeStyle = document.getElementById('theme-style');
    if (!themeStyle) return;

    // Проверяем текущее состояние
    const isDark = !themeStyle.disabled; 
    let newTheme = 'light';

    if (isDark) {
        // Переключаем на СВЕТЛУЮ
        themeStyle.disabled = true; // Отключаем темные стили
        newTheme = 'light';
        if(themeToggleBtn) themeToggleBtn.textContent = "🌙 Включить темную тему";
    } else {
        // Переключаем на ТЕМНУЮ
        themeStyle.disabled = false; // Включаем темные стили
        newTheme = 'dark';
        if(themeToggleBtn) themeToggleBtn.textContent = "☀️ Включить светлую тему";
    }
    
    // 1. Сохраняем локально (для быстрой загрузки)
    localStorage.setItem('cashcat_theme', newTheme);
    
    // 2. Сохраняем в БД (если пользователь залогинен)
    if (currentUser) {
        // Сначала получаем текущие настройки, чтобы не затереть аватар
        const userData = await fetchUser(currentUser);
        const currentCustomization = userData?.customization || {};
        
        // Обновляем только тему
        const newCustomization = {
            ...currentCustomization,
            theme: newTheme
        };
        
        await patchUser(currentUser, { customization: newCustomization });
    }
}


/**
 * Обрабатывает выход пользователя
 */
async function handleLogout() {
    await setCurrentUser(null); // Очищает сессию
    location.reload(); // Перезагружаем
}

/**
 * Обрабатывает нажатие на ссылку "Правила отыгрыша"
 */
function handleShowWagerRules(e) {
    e.preventDefault();
    showSection('faq-page');
    const faqItem = document.querySelector('.faq-item[data-key="q3_wager_play"]');
    if (faqItem) {
        const questionButton = faqItem.querySelector('.faq-question');
        if (questionButton && !faqItem.classList.contains('active')) {
            questionButton.click();
        }
    }
}

/**
 * Обрабатывает смену пароля
 */
async function handleChangePassword(e) {
    e.preventDefault();
    if (!currentUser) return;

    const oldPass = oldPassInput.value;
    const newPass = newPassInput.value;

    if (!oldPass || !newPass) {
        passwordStatusEl.textContent = 'Заполните оба поля.';
        return;
    }

    passwordStatusEl.textContent = 'Проверка...';

    const userData = await fetchUser(currentUser);
    if (!userData) {
        passwordStatusEl.textContent = 'Ошибка: Пользователь не найден.';
        return;
    }

    if (userData.password !== oldPass) {
        passwordStatusEl.textContent = 'Неверный установленный пароль.';
        return;
    }

    const success = await updateUser(currentUser, {
        ...userData,
        password: newPass
    });

    if (success) {
        passwordStatusEl.textContent = 'Пароль успешно изменен!';
        passwordForm.reset(); 
    } else {
        passwordStatusEl.textContent = 'Ошибка при сохранении.';
    }
}

/**
 * Обновляет данные на странице профиля
 */
export async function updateProfileData() {
    if (wagerAmountEl) wagerAmountEl.textContent = '...';
    if (rankEl) rankEl.textContent = '...';

    // Инициализируем состояние кнопки темы каждый раз при входе в профиль
    initTheme();

    if (currentUser && rankEl && wagerAmountEl) {
        const userData = await fetchUser(currentUser);
        const dbRank = userData?.rank || 'None Rang';
        let displayRank = 'Котенок'; 

        switch (dbRank) {
            case 'None Rang': displayRank = 'Котенок'; break;
            case 'Kitten': displayRank = 'Котенок'; break;
            case 'Newfag': displayRank = 'Кот новичок'; break;
            case 'Old Cat': displayRank = 'Бывалый кот'; break;
            case 'Street Cat': displayRank = 'Уличный боец'; break;
            case 'Horse': displayRank = 'Победоносец'; break;
            case 'King': displayRank = 'Король'; break;
            case 'admin': displayRank = 'Владелец'; break;
            default: displayRank = 'Котенок';
        }
        rankEl.textContent = displayRank;
        
        const dbWager = userData?.wager_balance || 0;
        wagerAmountEl.textContent = dbWager.toFixed(2);
        
    } else {
        if (rankEl) rankEl.textContent = 'Котенок';
        if (wagerAmountEl) wagerAmountEl.textContent = '0.00';
    }
}

/**
 * Инициализирует страницу профиля
 */
export function initProfile() {
    wagerAmountEl = document.getElementById('profile-wager-amount');
    rankEl = document.getElementById('profile-rank');
    wagerRulesLink = document.getElementById('profile-wager-rules-link');
    passwordForm = document.getElementById('profile-password-form');
    oldPassInput = document.getElementById('profile-old-pass');
    newPassInput = document.getElementById('profile-new-pass');
    passwordStatusEl = document.getElementById('profile-password-status');
    vkLinkBtn = document.getElementById('profile-link-vk');
    tgLinkBtn = document.getElementById('profile-link-tg');
    logoutBtn = document.getElementById('profile-logout-button');
    
    // Находим кнопку темы
    themeToggleBtn = document.getElementById('theme-toggle-btn');

    // Слушатели
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', handleThemeToggle);
    }

    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    if (wagerRulesLink) wagerRulesLink.addEventListener('click', handleShowWagerRules);
    if (passwordForm) passwordForm.addEventListener('submit', handleChangePassword);
    
    if (vkLinkBtn) vkLinkBtn.addEventListener('click', () => alert('В разработке'));
    if (tgLinkBtn) tgLinkBtn.addEventListener('click', () => alert('В разработке'));
}
