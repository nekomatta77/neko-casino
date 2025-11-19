/*
 * Краткое описание апгрейда:
 * 1. **Новый импорт**: Добавлены `initProfile` и `updateProfileData` из нового файла `profile.js`.
 * 2. **Удален импорт**: `showUserModal` больше не импортируется из `auth.js`.
 * 3. **Инициализация**: `initProfile()` теперь вызывается при загрузке DOM.
 * 4. **Обновление сайдбара**: Логика слушателя `sidebarLinks` обновлена. Теперь при клике на ссылку с `data-target="profile-page"` вызывается `updateProfileData()`, чтобы загрузить актуальные данные (ранг, сумму отыгрыша) на страницу профиля.
 * 5. **Удален** мертвый код: Блок слушателя для `sidebar-settings-button`, который вызывал удаленную `showUserModal()`, убран.
 * 6. **ДОБАВЛЕН** импорт и вызов `initCustomize` из `customize.js`.
 * 7. **ИСПРАВЛЕНО (ПРОБЛЕМА "СЕРОГО ЭКРАНА")**: `updateAdminData` импортируется
 * с использованием псевдонима для `handleSearchUsers`.
 * 8. **(НОВАЯ ЗАДАЧА)**: Добавлены `currentUser`, `fetchUser` и новая функция
 * `updateRanksDisplay()` для синхронизации рангов на странице "Lvl котика".
 * 9. **(НОВАЯ ЗАДАЧА 2)**: `getRankIndex()` обновлен, чтобы
 * включать гипотетические ключи 'Newfag' и 'Horse'.
 * 10. **(НОВАЯ ЗАДАЧА 3)**: `checkBonusAvailability` переименован в `updateBonusPage`.
 */
// ИЗМЕНЕНО: Добавлены currentUser и fetchUser
import { updateBalanceDisplay, showSection, currentUser, fetchUser } from './global.js';
import { initMines } from './mines.js';
import { initDice } from './dice.js';
import { initCrash } from './crash.js'; 
import { initCoin } from './coin.js'; // ДОБАВЛЕНО: Импорт Coinflip
// ИЗМЕНЕНО: showUserModal удален
import { initAuth, checkLoginState } from './auth.js'; 
// ИЗМЕНЕНО: (НОВАЯ ЗАДАЧА 3) `checkBonusAvailability` -> `updateBonusPage`
import { initBonus, updateBonusPage } from './bonus.js'; 
// ДОБАВЛЕНО: (Задание) Импорт функций FAQ
import { initFAQ } from './faq.js'; 
// ДОБАВЛЕНО: (Задание) Импорт функций Рефералов
import { initReferral, updateReferralData } from './referral.js'; 
// ДОБАВЛЕНО: (Задание) Импорт функций Профиля
import { initProfile, updateProfileData } from './profile.js'; 
// ДОБАВЛЕНО: (НОВОЕ ЗАДАНИЕ) Импорт функций Кастомизации
import { initCustomize } from './customize.js';
// ДОБАВЛЕНО: (НОВОЕ ЗАДАНИЕ) Импорт Keno
import { initKeno } from './keno.js';
// ДОБАВЛЕНО: (НОВОЕ ЗАДАНИЕ) Импорт Админ-панели
// ИСПРАВЛЕНО: Используем 'handleSearchUsers as updateAdminData'
import { initAdmin, handleSearchUsers as updateAdminData } from './admin.js';

// --- (НОВАЯ ФУНКЦИЯ) Обновление страницы Рангов ---

/**
 * (ИЗМЕНЕНО) Получает индекс ранга (0-5) на основе ранга из БД.
 * @param {string} dbRank - Ранг из БД ('None Rang', 'Kitten', 'Old Cat', 'Street Cat', 'King', 'admin')
 * @returns {number} Индекс карточки (0-5)
 */
function getRankIndex(dbRank) {
    switch (dbRank) {
        case 'admin':
            return 5; // Правило: admin видит "Король" (Карточка 6)
        case 'King':
            return 5; // "Король" (Карточка 6)
        case 'Horse': // (Гипотетический ключ)
            return 4; // "Победоносец" (Карточка 5)
        case 'Street Cat':
            return 3; // "Уличный боец" (Карточка 4)
        case 'Old Cat':
            return 2; // "Бывалый кот" (Карточка 3)
        case 'Newfag': // (Гипотетический ключ)
            return 1; // "Кот новичок" (Карточка 2)
        case 'Kitten':
            return 0; // "Котенок" (Карточка 1)
        case 'None Rang':
            return 0; // "Котенок" (Карточка 1)
        default:
            return 0; // По умолчанию
    }
}

/**
 * Асинхронно обновляет классы карточек на странице "Lvl котика".
 */
async function updateRanksDisplay() {
    let targetIndex = 0; // Ранг гостя (Котенок)

    if (currentUser) {
        try {
            const userData = await fetchUser(currentUser);
            const dbRank = userData?.rank || 'None Rang';
            targetIndex = getRankIndex(dbRank);
        } catch (error) {
            console.error("Ошибка при загрузке ранга:", error);
            targetIndex = 0; // В случае ошибки
        }
    }

    const rankCards = document.querySelectorAll('#ranks-page .rank-card-wrapper');
    if (rankCards.length === 0) return;

    rankCards.forEach((card, index) => {
        // Сбрасываем все классы состояний
        card.classList.remove('current', 'achieved', 'locked');

        if (index < targetIndex) {
            card.classList.add('achieved'); // Прошлые ранги
        } else if (index === targetIndex) {
            card.classList.add('current'); // Текущий ранг
        } else {
            card.classList.add('locked'); // Будущие ранги
        }
    });
}


// --- ИНИЦИАЛИЗАЦИЯ ---
// ИЗМЕНЕНО: (ЗАПРОС 3) Сделали listener асинхронным
document.addEventListener('DOMContentLoaded', async () => {
    
    // --- ДОБАВЛЕНО: (ЗАПРОС 3) Логика экрана загрузки ---
    const loaderOverlay = document.getElementById('loader-overlay');
    const loaderBar = document.getElementById('loader-bar');

    // Показываем начальный прогресс
    if (loaderBar) loaderBar.style.width = '20%';
    // ---
    
    // updateBalanceDisplay(); // Больше не нужно, вызывается в checkLoginState
    initMines();
    initDice(); 
    initCrash(); 
    initCoin(); // ДОБАВЛЕНО: Инициализация Coinflip
    initAuth(); // ДОБАВЛЕНО: Инициализация логики входа/регистрации
    initBonus(); // ДОБАВЛЕНО: Инициализация логики бонуса
    initFAQ(); // ДОБАВЛЕНО: (Задание) Инициализация FAQ
    initReferral(); // ДОБАВЛЕНО: (Задание) Инициализация Рефералов
    initProfile(); // ДОБАВЛЕНО: (Задание) Инициализация Профиля
    initCustomize(); // ДОБАВЛЕНО: (НОВОЕ ЗАДАНИЕ) Инициализация Кастомизации
    initKeno(); // ДОБАВЛЕНО: (НОВОЕ ЗАДАНИЕ) Инициализация Keno
    initAdmin(); // ДОБАВЛЕНО: (НОВОЕ ЗАДАНИЕ) Инициализация Админ-панели
    
    // --- ДОБАВЛЕНО: (ЗАПРОС 3) Прогресс после инициализации ---
    if (loaderBar) loaderBar.style.width = '60%';
    // ---
    
    // --- ДОБАВЛЕНО: (Задание 2) Логика боковой панели (Сайдбара) ---
    const openSidebarButton = document.getElementById('open-sidebar-button');
    // ИЗМЕНЕНО: (Задание 1) Добавляем слушатель и для текстовой кнопки
    const openSidebarButtonText = document.getElementById('open-sidebar-button-text');
    const sidebarNav = document.getElementById('sidebar-nav');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    // Функция для открытия/закрытия сайдбара
    const toggleSidebar = () => {
        if (sidebarNav && sidebarOverlay) {
            sidebarNav.classList.toggle('active');
            sidebarOverlay.classList.toggle('active'); 
        }
    };

    if (openSidebarButton) {
        openSidebarButton.addEventListener('click', toggleSidebar);
    }
    // ИЗМЕНЕНО: (Задание 1)
    if (openSidebarButtonText) {
        openSidebarButtonText.addEventListener('click', toggleSidebar);
    }
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', toggleSidebar);
    }

    // Слушатели для ссылок ВНУТРИ сайдбара
    const sidebarLinks = document.querySelectorAll('.sidebar-nav .sidebar-links a');
    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            // ИЗМЕНЕНО: Блок `sidebar-settings-button` УДАЛЕН
            
            e.preventDefault();
            const target = e.currentTarget.getAttribute('data-target');
            if (target) {
                // ДОБАВЛЕНО: (Задание) Обновление данных реф. страницы при клике
                if (target === 'ref-page') {
                    updateReferralData();
                }
                // ДОБАВЛЕНО: (Задание) Обновление данных профиля при клике
                if (target === 'profile-page') {
                    updateProfileData();
                }
                // ДОБАВЛЕНО: (НОВОЕ ЗАДАНИЕ) Обновление данных админки при клике
                if (target === 'admin-page') {
                    updateAdminData();
                }
                // ДОБАВЛЕНО: (НОВАЯ ЗАДАЧА) Обновление данных рангов при клике
                if (target === 'ranks-page') {
                    updateRanksDisplay();
                }
                // ИЗМЕНЕНО: (НОВАЯ ЗАДАЧА 3) Обновление бонусов
                if (target === 'bonus-page') {
                    updateBonusPage();
                }
                
                showSection(target);
                toggleSidebar(); // Закрываем меню при переходе
            }
        });
    });
    // --- КОНЕЦ Логики сайдбара ---
    
    // --- ИЗМЕНЕНО: (Задание 2) Слушатель для "Настройки" УДАЛЕН ---
    // (Теперь обрабатывается общим слушателем `sidebarLinks` выше)
    // ---
    
    // --- ИЗМЕНЕНО: (Запрос 2) НОВАЯ ЛОГИКА НИЖНЕЙ НАВИГАЦИИ ---
    // ИЗМЕНЕНО: (Задание 1) Этот селектор теперь находит 10 элементов
    const bottomNavItems = document.querySelectorAll('.bottom-nav-item');
    bottomNavItems.forEach(item => {
        item.addEventListener('click', (event) => {
            const currentItem = event.currentTarget;
            const target = currentItem.getAttribute('data-target');
            
            // ИЗМЕНЕНО: (Задание 2) Кнопки без 'data-target' (как "Меню" или "Кошелек")
            // теперь не будут вызывать showSection(null), что является ошибкой.
            if (target) { 
                
                // ИЗМЕНЕНО: (НОВАЯ ЗАДАЧА 3) Обновление бонусов
                if (target === 'bonus-page') {
                    updateBonusPage();
                }
                
                // ДОБАВЛЕНО: (Задание) Обновление данных реф. страницы при клике
                if (target === 'ref-page') {
                    updateReferralData();
                }

                // ДОБАВЛЕНО: (НОВАЯ ЗАДАЧА) Обновление данных рангов при клике
                if (target === 'ranks-page') {
                    updateRanksDisplay();
                }
                
                // ИЗМЕНЕНО: (Задание) Страница профиля НЕ обновляется здесь,
                // так как в нижнем меню нет кнопки "Профиль".
                
                showSection(target);
            }
            // Кнопка "Кошелек" (id="bottom-nav-profile-button" / "bottom-nav-profile-button-text") 
            // и "Меню" (id="open-sidebar-button" / "open-sidebar-button-text") 
            // обрабатываются их собственными слушателями (в auth.js и здесь)
        });
    });

    // --- ИЗМЕНЕНО: (Запрос v2.0) ЛОГИКА МЕНЮ МИНИ-ИГР ---
    // (ЛОГИКА КЛИКА ПЕРЕНЕСЕНА НИЖЕ, В НОВЫЙ БЛОК СВАЙПА)
    // const miniGamesNavItems = document.querySelectorAll('.mini-games-nav-item');
    /* * Старая логика клика (e.g. miniGamesNavItems.forEach(...))
     * теперь будет управляться новым механизмом свайпа,
     * чтобы корректно обрабатывать `isDragging`.
     */

    // --- УДАЛЕНО: Старая логика мобильного меню (hamburger) ---
    // --- УДАЛЕНО: Старые обработчики .nav-item-mobile ---
    // --- УДАЛЕНО: Старые обработчики .nav-item (desktop) ---
    
    // --- УДАЛЕНО: ЛОГИКА МОДАЛЬНОГО ОКНА ВЫХОДА ---
    // (Этот блок был перемещен в auth.js для лучшей организации)


    // --- ИЗМЕНЕНО: (ЗАПРОС) Логика кликов в лобби ---
    
    /**
     * Хелпер-функция для навигации по играм
     * @param {string | null} gameType - ('dice', 'mines', 'crash', 'coin')
     */
    function navigateToGame(gameType) {
        if (gameType === 'mines') {
            showSection('mines-game');
        } else if (gameType === 'dice') {
            showSection('dice-game'); 
        } else if (gameType === 'crash') {
            showSection('crash-game');
        } else if (gameType === 'coin') {
            showSection('coin-game');
        } else if (gameType === 'keno') {
            // === ДОБАВЛЕНО: KENO ===
            showSection('keno-game');
        }
    }

    // ИЗМЕНЕНО: Слушатель теперь на .lobby-game-wrapper, а не на .play-button
    const lobbyGameWrappers = document.querySelectorAll('.lobby-game-wrapper');
    lobbyGameWrappers.forEach(wrapper => {
        wrapper.addEventListener('click', (e) => {
            e.preventDefault();
            // Атрибут data-game-type теперь на самом wrapper'е (e.currentTarget)
            const gameType = e.currentTarget.getAttribute('data-game-type'); 
            if (gameType) {
                navigateToGame(gameType);
            }
        });
    });
    
    // --- КОНЕЦ ИЗМЕНЕНИЙ (ЗАПРОС) ---
    
    
    // 3. Обработка форм (УДАЛЕНО)
    // Вся эта логика (loginForm, registerForm, showRegisterLink, showLoginLink)
    // теперь находится внутри initAuth() в файле auth.js
    
    // ДОБАВЛЕНО: (Задание 3) Обработчики клика по логотипу (десктоп и мобильный)
    const logoElements = document.querySelectorAll('.logo');
    logoElements.forEach(logo => {
        logo.addEventListener('click', (e) => {
            e.preventDefault(); // Предотвращаем стандартное поведение
            showSection('lobby');
        });
    });
    
    // --- ИЗМЕНЕНО: (ЗАПРОС 3) Ожидаем загрузки профиля ---
    // Показываем лобби или страницу входа при старте
    await checkLoginState(); // <-- ДОБАВЛЕНО: await
    
    // --- ДОБАВЛЕНО: (ЗАПРОС 3) Скрываем загрузчик ---
    if (loaderBar) loaderBar.style.width = '100%';
    
    // Ждем 0.5с (длительность transition) и скрываем
    setTimeout(() => {
        if (loaderOverlay) {
            loaderOverlay.style.opacity = '0';
            loaderOverlay.style.pointerEvents = 'none';
        }
    }, 500);
    // ---

    // --- ИЗМЕНЕНО: ЛОГИКА СВАЙПА УДАЛЕНА И ЗАМЕНЕНА НА ЛОГИКУ КНОПОК ---
    
    // --- НОВАЯ ЛОГИКА: Навигация по мини-играм (Клик + Кнопки) ---
            
    // 1. Восстанавливаем простой клик по иконкам
    const miniGamesNavItems = document.querySelectorAll('.mini-games-nav-item');
    miniGamesNavItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault(); // Предотвращаем любое поведение по умолчанию
            const target = e.currentTarget.getAttribute('data-target');
            if (target) {
                showSection(target);
            }
        });
    });

    // 2. Логика кнопок прокрутки (УДАЛЕНА)
    // ...
    // --- КОНЕЦ НОВОЙ ЛОГИКИ ---

});
