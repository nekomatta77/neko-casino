/*
 * profile.js
 * Обновлено: Добавлена логика падающего снега
 */

import { showSection, setCurrentUser, currentUser, fetchUser, updateUser, patchUser } from './global.js';

// --- Элементы DOM ---
let wagerAmountEl, rankEl, wagerRulesLink;
let passwordForm, oldPassInput, newPassInput, passwordStatusEl;
let vkLinkBtn, tgLinkBtn, logoutBtn;
let themeToggleBtn; 
let snowToggleInput; // Новый тумблер

// --- ЛОГИКА ТЕМЫ И СНЕГА ---

function initTheme() {
    const currentTheme = localStorage.getItem('cashcat_theme') || 'light'; 
    
    if (currentTheme === 'dark') {
        document.body.classList.add('dark-theme');
        if (themeToggleBtn) themeToggleBtn.textContent = "☀️ Включить светлую тему";
    } else {
        document.body.classList.remove('dark-theme');
        if (themeToggleBtn) themeToggleBtn.textContent = "🌙 Включить темную тему";
    }
}

async function handleThemeToggle() {
    const isDarkNow = document.body.classList.toggle('dark-theme');
    const newTheme = isDarkNow ? 'dark' : 'light';

    if (themeToggleBtn) {
        themeToggleBtn.textContent = isDarkNow ? "☀️ Включить светлую тему" : "🌙 Включить темную тему";
    }
    
    localStorage.setItem('cashcat_theme', newTheme);
    
    if (currentUser) {
        const userData = await fetchUser(currentUser);
        const currentCustomization = userData?.customization || {};
        await patchUser(currentUser, { customization: { ...currentCustomization, theme: newTheme } });
    }
}

// --- ЛОГИКА ПАДАЮЩЕГО СНЕГА ---

function initSnow() {
    const snowContainer = document.getElementById('falling-snow-container');
    if (!snowContainer) return;

    // Читаем настройку (по умолчанию true)
    const isSnowEnabled = localStorage.getItem('cashcat_snow') !== 'false';
    
    if (snowToggleInput) {
        snowToggleInput.checked = isSnowEnabled;
        snowToggleInput.addEventListener('change', handleSnowToggle);
    }

    if (isSnowEnabled) {
        startSnow(snowContainer);
    } else {
        stopSnow(snowContainer);
    }
}

function handleSnowToggle(e) {
    const enabled = e.target.checked;
    localStorage.setItem('cashcat_snow', enabled);
    
    const snowContainer = document.getElementById('falling-snow-container');
    if (enabled) startSnow(snowContainer);
    else stopSnow(snowContainer);
}

function startSnow(container) {
    if (!container) return;
    container.innerHTML = ''; // Очистка
    container.style.display = 'block';
    
    // Создаем 30 снежинок (чтобы не нагружать)
    for (let i = 0; i < 30; i++) {
        const flake = document.createElement('div');
        flake.classList.add('snowflake');
        flake.textContent = '❄'; // Или '•'
        
        // Рандомные свойства
        const size = Math.random() * 1.5 + 0.5 + 'em';
        const left = Math.random() * 100 + 'vw';
        const duration = Math.random() * 5 + 5 + 's'; // 5-10s
        const delay = Math.random() * -10 + 's'; // Отрицательная задержка чтобы сразу падали
        
        flake.style.fontSize = size;
        flake.style.left = left;
        flake.style.animationDuration = duration;
        flake.style.animationDelay = delay;
        
        container.appendChild(flake);
    }
}

function stopSnow(container) {
    if (!container) return;
    container.innerHTML = '';
    container.style.display = 'none';
}


// --- СТАНДАРТНАЯ ЛОГИКА ---

async function handleLogout() {
    await setCurrentUser(null); 
    location.reload(); 
}

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

export async function updateProfileData() {
    if (wagerAmountEl) wagerAmountEl.textContent = '...';
    if (rankEl) rankEl.textContent = '...';

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
    
    // Тема и Снег
    themeToggleBtn = document.getElementById('theme-toggle-btn');
    snowToggleInput = document.getElementById('snow-toggle-input'); // Получаем элемент

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', handleThemeToggle);
    }
    
    // Инициализация
    initTheme();
    initSnow(); // Запускаем снег

    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    if (wagerRulesLink) wagerRulesLink.addEventListener('click', handleShowWagerRules);
    if (passwordForm) passwordForm.addEventListener('submit', handleChangePassword);
    
    if (vkLinkBtn) vkLinkBtn.addEventListener('click', () => alert('В разработке'));
    if (tgLinkBtn) tgLinkBtn.addEventListener('click', () => alert('В разработке'));
}