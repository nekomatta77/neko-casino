/*
 * profile.js
 * Версия 3.0 - VK Auth Integration
 */

import { showSection, setCurrentUser, currentUser, fetchUser, updateUser, patchUser, updateBalance, currentBalance, changeUsername } from './global.js';
import { initCustomize } from './customize.js'; 

// ================= КОНФИГУРАЦИЯ VK =================
const VK_CONFIG = {
    APP_ID: '54397311', // <--- Только цифры!
    REDIRECT_URI: 'https://neko-casino.vercel.app/',
    VERSION: '5.131'
};
// ===================================================

let wagerAmountEl, rankEl, wagerRulesLink;
let passwordForm, oldPassInput, newPassInput, passwordStatusEl;
let vkLinkBtn, tgLinkBtn, logoutBtn;
let themeToggleBtn; 
let snowToggleInput;

let profileUsernameDisplay, profileChangeNameInfo, profileChangeNameBtn;

// --- Стандартные функции темы и снега (без изменений) ---
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
    location.href = window.location.pathname; // Полная перезагрузка очищает URL от хешей VK
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

// --- Смена ника ---
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

// ================= ЛОГИКА ВКОНТАКТЕ =================

// 1. Функция редиректа на авторизацию
function handleVKAuth() {
    if (!currentUser) return alert('Сначала войдите в аккаунт!');
    if (VK_CONFIG.APP_ID === 'YOUR_VK_APP_ID') return alert('Администратор не настроил App ID в profile.js');

    const url = `https://oauth.vk.com/authorize?client_id=${VK_CONFIG.APP_ID}&display=page&redirect_uri=${VK_CONFIG.REDIRECT_URI}&scope=offline&response_type=token&v=${VK_CONFIG.VERSION}`;
    window.location.href = url;
}

// 2. Функция парсинга URL после возврата от VK
async function checkVKReturn() {
    // Проверяем, вернулся ли пользователь с токеном
    const hash = window.location.hash;
    if (hash.includes('access_token') && hash.includes('user_id')) {
        // Парсим параметры
        const params = new URLSearchParams(hash.substring(1)); // убираем #
        const accessToken = params.get('access_token');
        const userId = params.get('user_id');

        // Очищаем хеш из URL, чтобы было красиво
        history.pushState("", document.title, window.location.pathname + window.location.search);

        if (accessToken && currentUser) {
            await processVKBinding(accessToken, userId);
        }
    }
}

// 3. Получение данных и сохранение (используем JSONP для обхода CORS)
function processVKBinding(token, vkId) {
    // Создаем скрипт для JSONP запроса
    const script = document.createElement('script');
    // Имя функции обратного вызова
    const callbackName = 'vkUserDataCallback';
    
    // Глобальная функция для приема данных
    window[callbackName] = async (result) => {
        if (result.response && result.response[0]) {
            const user = result.response[0];
            const fullName = `${user.first_name} ${user.last_name}`;
            
            // Сохраняем в базу данных пользователя
            const success = await patchUser(currentUser, {
                vk_linked: true,
                vk_name: fullName,
                vk_id: vkId
            });

            if (success) {
                if(typeof window.addAppNotification === 'function') {
                    window.addAppNotification('✅ ВКонтакте', `Успешно привязано: ${fullName}`);
                }
                updateProfileData(); // Обновляем UI
                // Открываем профиль, так как после редиректа мы можем быть на главной
                showSection('profile-page'); 
            }
        } else {
            alert('Ошибка получения данных от VK API');
        }
        // Убираем скрипт и функцию
        document.body.removeChild(script);
        delete window[callbackName];
    };

    script.src = `https://api.vk.com/method/users.get?user_ids=${vkId}&access_token=${token}&v=${VK_CONFIG.VERSION}&callback=${callbackName}`;
    document.body.appendChild(script);
}

// ====================================================


export async function updateProfileData() {
    if (wagerAmountEl) wagerAmountEl.textContent = '...';
    if (rankEl) rankEl.textContent = '...';

    initCustomize();
    initTheme();

    if (currentUser) {
        const userData = await fetchUser(currentUser);
        if (!userData) return;

        // --- VK LINK UPDATE UI ---
        // Проверяем, есть ли привязка в данных пользователя
        if (vkLinkBtn) {
            if (userData.vk_linked && userData.vk_name) {
                // Если привязано - меняем текст и стиль
                vkLinkBtn.innerHTML = `<img src="assets/vk.png" alt="VK"> <span style="color:white;">${userData.vk_name}</span>`;
                vkLinkBtn.classList.add('linked-social-btn'); // Можно добавить этот класс в CSS для зеленой обводки
                // Убираем обработчик клика, чтобы не перепривязывать (или меняем логику на отвязку)
                vkLinkBtn.onclick = null; 
                vkLinkBtn.style.cursor = 'default';
                vkLinkBtn.style.opacity = '1';
                vkLinkBtn.style.background = 'rgba(0, 119, 255, 0.2)';
            } else {
                // Если не привязано - сбрасываем
                vkLinkBtn.innerHTML = `<img src="assets/vk.png" alt="VK"> <span id="profile-vk-text">Привязать Вконтакте</span>`;
                vkLinkBtn.style.background = '';
                vkLinkBtn.onclick = handleVKAuth; // Вешаем обработчик
            }
        }
        // -------------------------

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
        if (rankEl) rankEl.textContent = 'Котенок';
        if (wagerAmountEl) wagerAmountEl.textContent = '0.00';
        if (profileUsernameDisplay) profileUsernameDisplay.textContent = 'Гость';
        // Сброс VK кнопки для гостя
        if (vkLinkBtn) {
             vkLinkBtn.innerHTML = `<img src="assets/vk.png" alt="VK"> <span id="profile-vk-text">Привязать Вконтакте</span>`;
             vkLinkBtn.onclick = () => alert('Сначала войдите в аккаунт!');
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
    
    // ПРОВЕРЯЕМ, ВЕРНУЛИСЬ ЛИ МЫ ОТ ВКОНТАКТЕ
    checkVKReturn();

    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    if (wagerRulesLink) wagerRulesLink.addEventListener('click', handleShowWagerRules);
    if (passwordForm) passwordForm.addEventListener('submit', handleChangePassword);
    
    if (profileChangeNameBtn) {
        profileChangeNameBtn.addEventListener('click', handleChangeUsername);
    }

    // Обработчик VK вешается теперь динамически внутри updateProfileData, 
    // но инициализируем его дефолтное поведение здесь
    if (vkLinkBtn) {
        // Убираем старый listener, который просто показывал уведомление
        // Новый будет назначен при рендере профиля
    }

    if (tgLinkBtn) {
        tgLinkBtn.addEventListener('click', () => {
            if(typeof window.addAppNotification === 'function') {
                window.addAppNotification('✈️ Telegram', 'Временно недоступно. Используйте бота.');
            }
        });
    }
}