/*
 * Краткое описание апгрейда:
 * 1. Это новый файл для управления всей логикой страницы "Реферальная программа" (ref-page).
 * 2. Он импортирует `currentUser` для генерации "уникальной" ссылки.
 * 3. `initReferral()` настраивает слушатели для всех новых вкладок (Рефералы/Промокоды, Партнерские/Персональные).
 * 4. `updateReferralData()` - это экспортируемая функция, которую `main.js` будет вызывать
 * каждый раз при открытии вкладки. Она генерирует ссылку и кнопку "Копировать".
 * 5. Логика списков (рефералов, каналов, промокодов) и кнопок (отправить, создать)
 * симулируется плейсхолдерами и выводами в консоль, так как
 * это требует бэкенда, которого нет.
 */

import { currentUser } from './global.js';

// --- ЭЛЕМЕНТЫ DOM ---
let refLinkInput, copyLinkButton, mainTabs, mainTabContents, promoTabs, promoTabContents;
let refListBody, partnerChannelsList, personalPromosList;
let partnerSubmitBtn, personalCreateBtn;

/**
 * Простая хэш-функция для генерации "уникального" ID пользователя из его имени.
 * @param {string} username - Имя пользователя
 * @returns {number} 4-значный ID
 */
function getUserIdHash(username) {
    if (!username) return 1000; // ID по умолчанию для гостя
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        const char = username.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // 32bit integer
    }
    // Генерируем 4-значное число от 1000 до 9999
    return Math.abs(hash % 9000) + 1000; 
}

/**
 * Обрабатывает нажатие на кнопку "Копировать"
 */
function copyReferralLink() {
    if (!refLinkInput) return;

    refLinkInput.select(); // Выделяем текст в поле
    document.execCommand('copy'); // Копируем
    
    // Даем обратную связь
    copyLinkButton.textContent = 'Скопировано!';
    setTimeout(() => {
        if (copyLinkButton) {
            copyLinkButton.textContent = 'Копировать';
        }
    }, 2000);
}

/**
 * Обновляет данные на странице (ссылку)
 * Вызывается из main.js при каждом показе секции
 */
export function updateReferralData() {
    if (refLinkInput && currentUser) {
        const userId = getUserIdHash(currentUser);
        refLinkInput.value = `https://cash-cat.cc/r/${userId}`;
    } else if (refLinkInput) {
        refLinkInput.value = 'https://cash-cat.cc/r/----'; // Плейсхолдер
    }

    // --- СИМУЛЯЦИЯ ЗАГРУЗКИ СПИСКОВ ---
    // В реальном приложении здесь был бы fetch
    
    if (refListBody) {
        refListBody.innerHTML = `
            <tr>
                <td colspan="5" class="ref-list-placeholder">
                    У вас пока нет рефералов.
                </td>
            </tr>
        `;
    }
    if (partnerChannelsList) {
        partnerChannelsList.innerHTML = `
            <li class="ref-list-placeholder">
                У вас нет привязанных каналов.
            </li>
        `;
    }
    if (personalPromosList) {
        personalPromosList.innerHTML = `
            <tr>
                <td colspan="3" class="ref-list-placeholder">
                    Вы ещё не создали ни одного персонального промокода.
                </td>
            </tr>
        `;
    }
    // --- КОНЕЦ СИМУЛЯЦИИ ---
}

/**
 * Инициализирует главные вкладки (Рефералы / Промокоды)
 */
function initMainTabs() {
    mainTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetId = tab.getAttribute('data-target');
            
            // Снимаем .active со всех
            mainTabs.forEach(t => t.classList.remove('active'));
            mainTabContents.forEach(c => c.classList.remove('active'));
            
            // Добавляем .active нужному
            tab.classList.add('active');
            const targetContent = document.getElementById(targetId);
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });
}

/**
 * Инициализирует вложенные вкладки (Партнерские / Персональные)
 */
function initPromocodeTabs() {
    promoTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetId = tab.getAttribute('data-target');
            
            // Снимаем .active со всех
            promoTabs.forEach(t => t.classList.remove('active'));
            promoTabContents.forEach(c => c.classList.remove('active'));
            
            // Добавляем .active нужному
            tab.classList.add('active');
            const targetContent = document.getElementById(targetId);
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });
}

/**
 * Симуляция отправки заявок (вывод в консоль)
 */
function simulateSubmissions() {
    if (partnerSubmitBtn) {
        partnerSubmitBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const link = document.getElementById('ref-partner-link').value;
            const tg = document.getElementById('ref-partner-tg').value;
            console.log('--- Симуляция: Заявка на партнерство ---', { link, tg });
            alert('Ваша заявка отправлена на рассмотрение.');
        });
    }
    
    if (personalCreateBtn) {
        personalCreateBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const amount = document.getElementById('ref-personal-amount').value;
            const limit = document.getElementById('ref-personal-limit').value;
            console.log('--- Симуляция: Создание промокода ---', { amount, limit });
            alert('Промокод (симуляция) создан.');
        });
    }
}

/**
 * Инициализирует всю логику страницы рефералов
 */
export function initReferral() {
    // --- ПОИСК ЭЛЕМЕНТОВ ---
    refLinkInput = document.getElementById('ref-link-input');
    copyLinkButton = document.getElementById('ref-copy-button');
    
    mainTabs = document.querySelectorAll('.ref-tabs .ref-tab');
    mainTabContents = document.querySelectorAll('.ref-tab-content');
    
    promoTabs = document.querySelectorAll('.ref-subtabs .ref-subtab');
    promoTabContents = document.querySelectorAll('.ref-subtab-content');
    
    // Списки (для плейсхолдеров)
    refListBody = document.getElementById('ref-list-body');
    partnerChannelsList = document.getElementById('ref-partner-channels-list');
    personalPromosList = document.getElementById('ref-personal-promos-list');
    
    // Кнопки (для симуляции)
    partnerSubmitBtn = document.getElementById('ref-partner-submit');
    personalCreateBtn = document.getElementById('ref-personal-create');

    if (!refLinkInput) return; // Мы не на той странице

    // --- СЛУШАТЕЛИ ---
    
    // Кнопка "Копировать"
    if (copyLinkButton) {
        copyLinkButton.addEventListener('click', copyReferralLink);
    }
    
    // Вкладки
    initMainTabs();
    initPromocodeTabs();
    
    // Симуляция кнопок
    simulateSubmissions();
    
    // Первичный вызов для заполнения
    updateReferralData();
}
