/*
 * profile.js
 * Версия 4.1 - VK Scope Fix
 */

import { showSection, setCurrentUser, currentUser, fetchUser, patchUser, updateBalance, currentBalance, changeUsername } from './global.js';
import { initCustomize } from './customize.js'; 

// ================= КОНФИГУРАЦИЯ VK =================
const VK_CONFIG = {
    APP_ID: 'YOUR_VK_APP_ID', // !!! ВСТАВЬТЕ СЮДА ID ВАШЕГО ПРИЛОЖЕНИЯ ИЗ VK DEV !!!
    REDIRECT_URI: 'https://neko-casino.vercel.app/', // Важно: в точности как в настройках VK (со слешем в конце)
    VERSION: '5.131'
};

// ================= КОНФИГУРАЦИЯ TELEGRAM =================
const TG_CONFIG = {
    BOT_USERNAME: 'CashCatOfficial_Bot', // Твой бот
    REDIRECT_URL: 'https://neko-casino.vercel.app/' // Адрес твоего сайта
};
// =========================================================

let wagerAmountEl, rankEl, wagerRulesLink;
let passwordForm, oldPassInput, newPassInput, passwordStatusEl;
let vkLinkBtn, tgLinkBtn, logoutBtn;
let themeToggleBtn; 
let snowToggleInput;

let profileUsernameDisplay, profileChangeNameInfo, profileChangeNameBtn;

// Флаги для предотвращения "мигания" старыми данными
let justLinkedTg = false;

// --- Стандартные функции темы и снега ---
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
    if (themeToggleBtn) themeToggleBtn.textContent = isDarkNow ? "☀️ Включить светлую тему" : "🌙 Включить темную тему";
    localStorage.setItem('cashcat_theme', newTheme);
    if (currentUser) {
        const userData = await fetchUser(currentUser);
        const currentCustomization = userData?.customization || {};
        await patchUser(currentUser, { customization: { ...currentCustomization, theme: newTheme } });
    }
}

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

async function handleLogout() {
    await setCurrentUser(null); 
    // Полная перезагрузка страницы для очистки URL от токенов VK/TG
    location.href = window.location.pathname; 
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

// --- Смена пароля ---
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

// --- Смена никнейма ---
async function handleChangeUsername() {
    if (!currentUser) return;
    const userData = await fetchUser(currentUser);
    if (!userData) return;
    const freeChanges = userData.free_username_changes || 0;
    const COST = 250.00;

    if (freeChanges > 0) {
        const newName = prompt(`У вас есть ${freeChanges} бесплатных смен.\nВведите новый никнейм:`);
        if (newName && newName.trim() !== "") {
            if (newName.length < 3) return alert("Никнейм слишком короткий!");
            const result = await changeUsername(currentUser, newName, freeChanges - 1);
            if (result.success) {
                alert("Никнейм успешно изменен! Пожалуйста, войдите снова.");
                await handleLogout(); 
            } else {
                if (result.error.code === '23505' || result.error.status === 409) {
                     alert("Ошибка: Этот никнейм уже занят!");
                } else {
                     alert("Произошла ошибка при смене ника: " + (result.error.message || "Unknown"));
                }
            }
        }
    } else {
        if (confirm(`Смена ника стоит ${COST} RUB. С вашего баланса будет списано ${COST} RUB. Продолжить?`)) {
            if (currentBalance < COST) return alert("Недостаточно средств на балансе!");
            const newName = prompt("Введите новый никнейм:");
            if (newName && newName.trim() !== "") {
                 if (newName.length < 3) return alert("Никнейм слишком короткий!");
                 const result = await changeUsername(currentUser, newName, null);
                 if (result.success) {
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

// ================= ЛОГИКА ВКОНТАКТЕ (UPDATED) =================

function handleVKAuth() {
    if (!currentUser) return alert('Сначала войдите в аккаунт!');
    // УБРАН ПАРАМЕТР &scope=offline, который вызывал ошибку
    const url = `https://oauth.vk.com/authorize?client_id=${VK_CONFIG.APP_ID}&display=page&redirect_uri=${VK_CONFIG.REDIRECT_URI}&response_type=code&v=${VK_CONFIG.VERSION}`;
    window.location.href = url;
}

// При возврате мы больше не ловим хеш здесь, это делает global.js

// ================= ЛОГИКА TELEGRAM =================

// 1. Активация виджета
function handleTGAuth() {
    if (!currentUser) return alert('Сначала войдите в аккаунт!');
    
    const btnContainer = document.getElementById('profile-link-tg');
    if (document.getElementById('telegram-login-widget')) return;

    btnContainer.innerHTML = 'Загрузка Telegram...';
    
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', TG_CONFIG.BOT_USERNAME);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '10');
    script.setAttribute('data-auth-url', TG_CONFIG.REDIRECT_URL);
    script.setAttribute('data-request-access', 'write');
    script.id = 'telegram-login-widget'; 
    
    btnContainer.innerHTML = ''; 
    btnContainer.appendChild(script);
}

// 2. Проверка возврата (GET параметры)
async function checkTelegramReturn() {
    const params = new URLSearchParams(window.location.search);
    
    // Проверка Telegram Login Widget (возвращает id, hash, etc)
    if (params.has('id') && params.has('hash') && !params.has('code') && currentUser) { 
        const tgId = params.get('id');
        const tgFirstName = params.get('first_name');
        const tgUsername = params.get('username'); 
        
        const displayName = tgUsername ? `@${tgUsername}` : tgFirstName;

        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);

        const success = await patchUser(currentUser, {
            tg_linked: true,
            tg_name: displayName,
            tg_username: tgUsername || "",
            tg_id: tgId
        });

        if (success) {
            if(typeof window.addAppNotification === 'function') {
                window.addAppNotification('✈️ Telegram', `Успешно привязано: ${displayName}`);
            }
            
            justLinkedTg = true; // Ставим флаг
            
            if (tgLinkBtn) {
                tgLinkBtn.innerHTML = `<img src="assets/tg.png" alt="TG"> <span style="color:white; font-weight: bold;">${displayName}</span>`;
                tgLinkBtn.classList.add('linked-social-btn'); 
                tgLinkBtn.style.opacity = '1';
                tgLinkBtn.style.background = 'rgba(42, 171, 238, 0.2)';
                tgLinkBtn.style.cursor = 'default';
                tgLinkBtn.style.border = '1px solid rgba(42, 171, 238, 0.5)';
                
                tgLinkBtn.onclick = (e) => {
                    e.preventDefault();
                    return false;
                };
                
                const existingScript = tgLinkBtn.querySelector('script');
                if (existingScript) existingScript.remove();
            }
            
            showSection('profile-page');
        } else {
             alert('Ошибка сохранения данных Telegram.');
        }
    }
}

// ====================================================

export async function updateProfileData() {
    if (wagerAmountEl) wagerAmountEl.textContent = '...';
    if (rankEl) rankEl.textContent = '...';

    if (currentUser) {
        await checkTelegramReturn();
    }

    initCustomize();
    initTheme();

    if (currentUser) {
        const userData = await fetchUser(currentUser);
        if (!userData) return;

        // --- VK LINK UI ---
        // Данные обновятся после перезагрузки страницы, которую вызовет global.js
        if (vkLinkBtn) {
            if (userData.vk_linked) { 
                const vkLabel = userData.vk_name || 'VK Привязан';
                vkLinkBtn.innerHTML = `<img src="assets/vk.png" alt="VK"> <span style="color:white;">${vkLabel}</span>`;
                vkLinkBtn.classList.add('linked-social-btn'); 
                vkLinkBtn.onclick = null; 
                vkLinkBtn.style.cursor = 'default';
                vkLinkBtn.style.opacity = '1';
                vkLinkBtn.style.background = 'rgba(0, 119, 255, 0.2)';
            } else {
                vkLinkBtn.innerHTML = `<img src="assets/vk.png" alt="VK"> <span id="profile-vk-text">Привязать Вконтакте</span>`;
                vkLinkBtn.style.background = '';
                vkLinkBtn.style.cursor = 'pointer';
            }
        }
        
        // --- TG LINK UI ---
        if (tgLinkBtn && !justLinkedTg) {
            if (userData.tg_linked) {
                const buttonText = userData.tg_name || 'Telegram привязан';
                
                tgLinkBtn.innerHTML = `<img src="assets/tg.png" alt="TG"> <span style="color:white; font-weight: bold;">${buttonText}</span>`;
                tgLinkBtn.classList.add('linked-social-btn'); 
                tgLinkBtn.style.opacity = '1';
                tgLinkBtn.style.background = 'rgba(42, 171, 238, 0.2)'; 
                tgLinkBtn.style.cursor = 'default'; 
                tgLinkBtn.style.border = '1px solid rgba(42, 171, 238, 0.5)';
                
                tgLinkBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                };
                
                if (tgLinkBtn.querySelector('script')) {
                    tgLinkBtn.querySelector('script').remove();
                }

            } else {
                if (!document.getElementById('telegram-login-widget')) {
                    tgLinkBtn.innerHTML = `<img src="assets/tg.png" alt="TG"> <span id="profile-tg-text">Привязать Telegram</span>`;
                    tgLinkBtn.style.background = '';
                    tgLinkBtn.style.cursor = 'pointer';
                    tgLinkBtn.style.border = '';
                    tgLinkBtn.onclick = handleTGAuth;
                }
            }
        }

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
        // Логика для гостя
        if (rankEl) rankEl.textContent = 'Котенок';
        if (wagerAmountEl) wagerAmountEl.textContent = '0.00';
        if (profileUsernameDisplay) profileUsernameDisplay.textContent = 'Гость';
        if (vkLinkBtn) {
             vkLinkBtn.innerHTML = `<img src="assets/vk.png" alt="VK"> <span id="profile-vk-text">Привязать Вконтакте</span>`;
             vkLinkBtn.onclick = () => alert('Сначала войдите в аккаунт!');
        }
        if (tgLinkBtn) {
             tgLinkBtn.innerHTML = `<img src="assets/tg.png" alt="TG"> <span id="profile-tg-text">Привязать Telegram</span>`;
             tgLinkBtn.onclick = () => alert('Сначала войдите в аккаунт!');
        }
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

    if (themeToggleBtn) themeToggleBtn.addEventListener('click', handleThemeToggle);
    
    initTheme();
    initSnow(); 
    
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    if (wagerRulesLink) wagerRulesLink.addEventListener('click', handleShowWagerRules);
    if (passwordForm) passwordForm.addEventListener('submit', handleChangePassword);
    
    if (profileChangeNameBtn) {
        profileChangeNameBtn.addEventListener('click', handleChangeUsername);
    }
    
    if (vkLinkBtn) {
        const newVkBtn = vkLinkBtn.cloneNode(true);
        vkLinkBtn.parentNode.replaceChild(newVkBtn, vkLinkBtn);
        vkLinkBtn = newVkBtn; // Обновляем ссылку
        vkLinkBtn.addEventListener('click', handleVKAuth);
    }
}