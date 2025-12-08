/*
 * profile.js
 * Версия 2.2 - Fix Negative Display
 */

import { showSection, setCurrentUser, currentUser, fetchUser, updateUser, patchUser, updateBalance, currentBalance, changeUsername } from './global.js';
import { initCustomize } from './customize.js'; 

// --- Элементы DOM ---
let wagerAmountEl, rankEl, wagerRulesLink;
let passwordForm, oldPassInput, newPassInput, passwordStatusEl;
let vkLinkBtn, tgLinkBtn, logoutBtn;
let themeToggleBtn; 
let snowToggleInput;

// Новые элементы профиля
let profileUsernameDisplay, profileChangeNameInfo, profileChangeNameBtn;

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

    const isSnowEnabled = localStorage.getItem('cashcat_snow') !== 'false';
    
    if (snowToggleInput) {
        snowToggleInput.checked = isSnowEnabled;
        snowToggleInput.addEventListener('change', handleSnowToggle);
    }

    if (isSnowEnabled) startSnow(snowContainer);
    else stopSnow(snowContainer);
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
    container.innerHTML = ''; 
    container.style.display = 'block';
    
    for (let i = 0; i < 30; i++) {
        const flake = document.createElement('div');
        flake.classList.add('snowflake');
        flake.textContent = '❄'; 
        
        const size = Math.random() * 1.5 + 0.5 + 'em';
        const left = Math.random() * 100 + 'vw';
        const duration = Math.random() * 5 + 5 + 's'; 
        const delay = Math.random() * -10 + 's'; 
        
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

    const success = await patchUser(currentUser, { password: newPass });

    if (success) {
        passwordStatusEl.textContent = 'Пароль успешно изменен!';
        passwordForm.reset(); 
    } else {
        passwordStatusEl.textContent = 'Ошибка при сохранении.';
    }
}

// --- СМЕНА НИКА (ИСПРАВЛЕННАЯ ЛОГИКА 409) ---

async function handleChangeUsername() {
    if (!currentUser) return;

    const userData = await fetchUser(currentUser);
    if (!userData) return;

    const freeChanges = userData.free_username_changes || 0;
    const COST = 250.00;

    // 1. Бесплатная смена
    if (freeChanges > 0) {
        const newName = prompt(`У вас есть ${freeChanges} бесплатных смен.\nВведите новый никнейм:`);
        if (newName && newName.trim() !== "") {
            if (newName.length < 3) return alert("Никнейм слишком короткий!");
            
            // Используем новую функцию для безопасного обновления
            const result = await changeUsername(currentUser, newName, freeChanges - 1);

            if (result.success) {
                alert("Никнейм успешно изменен! Пожалуйста, войдите снова.");
                await handleLogout(); 
            } else {
                // Проверяем код ошибки
                if (result.error.code === '23505' || result.error.status === 409) {
                     alert("Ошибка: Этот никнейм уже занят!");
                } else {
                     alert("Произошла ошибка при смене ника: " + (result.error.message || "Unknown"));
                }
            }
        }
    } 
    // 2. Платная смена
    else {
        if (confirm(`Смена ника стоит ${COST} RUB. С вашего баланса будет списано ${COST} RUB. Продолжить?`)) {
            if (currentBalance < COST) {
                return alert("Недостаточно средств на балансе!");
            }
            
            const newName = prompt("Введите новый никнейм:");
            if (newName && newName.trim() !== "") {
                 if (newName.length < 3) return alert("Никнейм слишком короткий!");
                 
                 // Сначала меняем ник (бесплатно пока, но без списания смен)
                 // Передаем null в freeChanges, чтобы не менять счетчик (он уже 0)
                 const result = await changeUsername(currentUser, newName, null);
                 
                 if (result.success) {
                    // Если удалось занять ник, списываем деньги
                    await updateBalance(-COST);
                    alert("Оплата прошла успешно. Никнейм изменен! Пожалуйста, войдите снова.");
                    await handleLogout();
                 } else {
                     if (result.error.code === '23505' || result.error.status === 409) {
                         alert("Ошибка: Этот никнейм уже занят. Средства не списаны.");
                     } else {
                         alert("Ошибка: " + (result.error.message || "Unknown"));
                     }
                 }
            }
        }
    }
}


export async function updateProfileData() {
    if (wagerAmountEl) wagerAmountEl.textContent = '...';
    if (rankEl) rankEl.textContent = '...';

    initCustomize();
    initTheme();

    if (currentUser) {
        const userData = await fetchUser(currentUser);
        if (!userData) return;

        const dbRank = userData.rank || 'None Rang';
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
        }
        if (rankEl) rankEl.textContent = displayRank;
        
        const dbWager = userData.wager_balance || 0;
        // Исправлено: не показывать отрицательные значения
        if (wagerAmountEl) wagerAmountEl.textContent = Math.max(0, dbWager).toFixed(2);

        if (profileUsernameDisplay) profileUsernameDisplay.textContent = currentUser;
        
        const freeChanges = userData.free_username_changes !== undefined ? userData.free_username_changes : 1; 
        
        if (profileChangeNameInfo && profileChangeNameBtn) {
            if (freeChanges > 0) {
                profileChangeNameInfo.textContent = `Бесплатная смена имени пользователя: ${freeChanges}`;
                profileChangeNameBtn.textContent = "Сменить";
                profileChangeNameBtn.classList.remove('green-button'); 
            } else {
                profileChangeNameInfo.textContent = `Стоимость смены имени пользователя: 250₽`;
                profileChangeNameBtn.textContent = "Оплатить";
                profileChangeNameBtn.classList.add('green-button'); 
            }
        }
        
    } else {
        if (rankEl) rankEl.textContent = 'Котенок';
        if (wagerAmountEl) wagerAmountEl.textContent = '0.00';
        if (profileUsernameDisplay) profileUsernameDisplay.textContent = 'Гость';
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
    
    profileUsernameDisplay = document.getElementById('profile-username-display');
    profileChangeNameInfo = document.getElementById('profile-change-name-info');
    profileChangeNameBtn = document.getElementById('profile-change-name-btn');

    themeToggleBtn = document.getElementById('theme-toggle-btn');
    snowToggleInput = document.getElementById('snow-toggle-input'); 

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', handleThemeToggle);
    }
    
    initTheme();
    initSnow(); 

    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    if (wagerRulesLink) wagerRulesLink.addEventListener('click', handleShowWagerRules);
    if (passwordForm) passwordForm.addEventListener('submit', handleChangePassword);
    
    if (profileChangeNameBtn) {
        profileChangeNameBtn.addEventListener('click', handleChangeUsername);
    }

    if (vkLinkBtn) vkLinkBtn.addEventListener('click', () => alert('В разработке'));
    if (tgLinkBtn) tgLinkBtn.addEventListener('click', () => alert('В разработке'));
}