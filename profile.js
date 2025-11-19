/*
 * Краткое описание апгрейда:
 * 1. **(НОВЫЙ ЗАПРОС)**: `updateProfileData()` стала асинхронной.
 * 2. **(НОВЫЙ ЗАПРОС)**: Добавлен импорт `fetchUser` и `currentUser`.
 * 3. **(НОВЫЙ ЗАПРОС)**: `updateProfileData()` теперь загружает ранг из БД
 * и переводит его на русский язык (включая "Владелец" для "admin").
 * 4. (ИЗМЕНЕНО) `updateProfileData()` теперь загружает `wager_balance` из БД.
 * 5. **(НОВАЯ ЗАДАЧА)**: `switch (dbRank)` обновлен для соответствия
 * 6 новым рангам со страницы "Lvl котика".
 */

import { showSection, setCurrentUser, currentUser, fetchUser, updateUser } from './global.js';

// --- Элементы DOM ---
let wagerAmountEl, rankEl, wagerRulesLink;
let passwordForm, oldPassInput, newPassInput, passwordStatusEl;
let vkLinkBtn, tgLinkBtn, logoutBtn;

/**
 * Обрабатывает выход пользователя
 */
async function handleLogout() {
    await setCurrentUser(null); // Очищает сессию, обнуляет баланс и блокирует UI
    location.reload(); // Перезагружаем страницу, чтобы сбросить состояние игр
}

/**
 * Обрабатывает нажатие на ссылку "Правила отыгрыша"
 */
function handleShowWagerRules(e) {
    e.preventDefault();
    
    // 1. Переходим на страницу FAQ
    showSection('faq-page');
    
    // 2. Находим нужный элемент аккордеона
    // (Мы ожидаем, что data-key="q3_wager_play" - это "Отыгрыш вагерного баланса")
    const faqItem = document.querySelector('.faq-item[data-key="q3_wager_play"]');
    
    if (faqItem) {
        // 3. Имитируем клик по нему, чтобы он открылся
        // (Логика в faq.js сама загрузит контент, если нужно)
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

    // 1. Получаем текущие данные пользователя
    const userData = await fetchUser(currentUser);
    if (!userData) {
        passwordStatusEl.textContent = 'Ошибка: Пользователь не найден.';
        return;
    }

    // 2. Проверяем старый пароль
    if (userData.password !== oldPass) {
        passwordStatusEl.textContent = 'Неверный установленный пароль.';
        return;
    }

    // 3. Пароль верный, обновляем
    // (Мы перезаписываем весь объект, но только с новым паролем)
    const success = await updateUser(currentUser, {
        ...userData,
        password: newPass
    });

    if (success) {
        passwordStatusEl.textContent = 'Пароль успешно изменен!';
        passwordForm.reset(); // Очищаем форму
    } else {
        passwordStatusEl.textContent = 'Ошибка при сохранении. Попробуйте снова.';
    }
}

/**
 * (ИЗМЕНЕНО) Обновляет данные на странице (вызывается из main.js)
 * Стала асинхронной для загрузки данных из БД.
 */
export async function updateProfileData() {
    
    // 1. Устанавливаем плейсхолдеры
    if (wagerAmountEl) {
        wagerAmountEl.textContent = '...'; // (ИЗМЕНЕНО)
    }
    if (rankEl) {
        rankEl.textContent = '...';
    }

    // 2. Загружаем данные пользователя
    if (currentUser && rankEl && wagerAmountEl) {
        const userData = await fetchUser(currentUser);
        
        // --- Ранг ---
        const dbRank = userData?.rank || 'None Rang'; // Ранг из БД
        // ИЗМЕНЕНО: По умолчанию "Котенок", а не "Без ранга"
        let displayRank = 'Котенок'; 

        // 3. Переводим ранг из БД в отображаемый (СИНХРОНИЗИРОВАНО С LVL КОТИКА)
        switch (dbRank) {
            case 'None Rang':
                displayRank = 'Котенок'; // (Ранг 1)
                break;
            case 'Kitten':
                displayRank = 'Котенок'; // (Ранг 1)
                break;
            case 'Newfag': // (Гипотетический ключ для Ранга 2)
                displayRank = 'Кот новичок';
                break;
            case 'Old Cat':
                displayRank = 'Бывалый кот'; // (Ранг 3)
                break;
            case 'Street Cat':
                displayRank = 'Уличный боец'; // (Ранг 4)
                break;
            case 'Horse': // (Гипотетический ключ для Ранга 5)
                displayRank = 'Победоносец';
                break;
            case 'King':
                displayRank = 'Король'; // (Ранг 6)
                break;
            case 'admin':
                displayRank = 'Владелец'; // <-- Особый ранг (остается)
                break;
            default:
                displayRank = 'Котенок';
        }
        rankEl.textContent = displayRank;
        
        // --- Вейджер ---
        const dbWager = userData?.wager_balance || 0;
        wagerAmountEl.textContent = dbWager.toFixed(2);
        
    } else {
        // Для гостя
        // ИЗМЕНЕНО: По умолчанию "Котенок"
        if (rankEl) rankEl.textContent = 'Котенок';
        if (wagerAmountEl) wagerAmountEl.textContent = '0.00';
    }
    
    // TODO: Здесь также нужно будет проверять,
    // привязаны ли VK/TG и менять текст кнопок
    if (vkLinkBtn) {
        // console.log('VK button text update needed');
    }
}

/**
 * Инициализирует страницу профиля
 */
export function initProfile() {
    // Поиск основных элементов
    wagerAmountEl = document.getElementById('profile-wager-amount');
    rankEl = document.getElementById('profile-rank');
    wagerRulesLink = document.getElementById('profile-wager-rules-link');
    
    // Поиск элементов формы
    passwordForm = document.getElementById('profile-password-form');
    oldPassInput = document.getElementById('profile-old-pass');
    newPassInput = document.getElementById('profile-new-pass');
    passwordStatusEl = document.getElementById('profile-password-status');
    
    // Поиск кнопок
    vkLinkBtn = document.getElementById('profile-link-vk');
    tgLinkBtn = document.getElementById('profile-link-tg');
    logoutBtn = document.getElementById('profile-logout-button');

    // Назначение слушателей
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    if (wagerRulesLink) {
        wagerRulesLink.addEventListener('click', handleShowWagerRules);
    }
    
    if (passwordForm) {
        passwordForm.addEventListener('submit', handleChangePassword);
    }
    
    if (vkLinkBtn) {
        vkLinkBtn.addEventListener('click', () => {
            // TODO: Добавить логику привязки VK
            alert('Логика привязки Вконтакте (в разработке)');
        });
    }
    
    if (tgLinkBtn) {
        tgLinkBtn.addEventListener('click', () => {
            // TODO: Добавить логику привязки TG
            alert('Логика привязки Telegram (в разработке)');
        });
    }
}
