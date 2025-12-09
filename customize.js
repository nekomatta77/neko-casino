/*
 * customize.js
 * Version 3.1 - Added Card Patterns Support
 */

import { currentUser, patchUser, fetchUser } from './global.js';
// Импортируем функции для проверки разблокированного контента
import { getUnlockedAvatars, getUnlockedPatterns } from './achievements.js'; 

let modalOverlay, closeModalButton, avatarGrid;
let headerAvatars; 
let headerProfileBoxes; 
let colorGrids; 

// --- СПИСОК БАЗОВЫХ АВАТАРОК ---
const DEFAULT_AVATARS = [
    {
        src: 'assets/avatars/orange_cat_ava.png',
        customSrc: 'assets/custom/orange_cat_custom.png',
        alt: 'Orange Cat'
    },
    {
        src: 'assets/avatars/black_cat_ava.png',
        customSrc: 'assets/custom/black_cat_custom.png',
        alt: 'Black Cat'
    },
    {
        src: 'assets/avatars/grey_cat_ava.png',
        customSrc: 'assets/custom/grey_cat_custom.png',
        alt: 'Grey Cat'
    }
];

/**
 * Helper для обновления JSONB данных пользователя
 */
async function updateCustomizationProperty(username, key, value) {
    const userData = await fetchUser(username);
    const currentCustomization = userData?.customization || {};
    
    const newCustomization = {
        ...currentCustomization,
        [key]: value
    };
    
    return await patchUser(username, { customization: newCustomization });
}

async function showCustomizeModal() {
    if (modalOverlay) {
        // 1. Обновляем сетку аватарок
        await renderDynamicAvatarGrid();
        
        // 2. Проверяем разблокированные узоры (снимаем замки)
        await checkUnlockedPatterns();

        // 3. Обновляем визуальное выделение (selected)
        await updateColorGridSelection();
        
        modalOverlay.classList.remove('hidden');
    }
}

function hideCustomizeModal() {
    if (modalOverlay) {
        modalOverlay.classList.add('hidden');
    }
}

// --- ОТРИСОВКА СЕТКИ АВАТАРОВ ---
async function renderDynamicAvatarGrid() {
    if (!avatarGrid) return;

    const unlockedSrcs = await getUnlockedAvatars(); 
    let avatarsDisplayList = [...DEFAULT_AVATARS];

    unlockedSrcs.forEach(src => {
        const isDefault = DEFAULT_AVATARS.some(def => def.src === src);
        if (!isDefault) {
            let customSrc = src.replace('assets/avatars/', 'assets/custom/');
            
            if (customSrc.includes('_ava.png')) {
                customSrc = customSrc.replace('_ava.png', '_custom.png');
            } else if (customSrc.includes('_avatar.png')) {
                customSrc = customSrc.replace('_avatar.png', '_custom.png');
            }

            avatarsDisplayList.push({
                src: src,       
                customSrc: customSrc, 
                alt: 'Unlocked Avatar'
            });
        }
    });

    avatarGrid.innerHTML = '';

    avatarsDisplayList.forEach(ava => {
        const img = document.createElement('img');
        img.src = ava.customSrc; 
        img.alt = ava.alt;
        img.className = 'customize-avatar-choice';
        img.setAttribute('data-avatar-src', ava.src); 
        img.setAttribute('data-custom-src', ava.customSrc); 

        avatarGrid.appendChild(img);
    });
}

// --- ПРОВЕРКА РАЗБЛОКИРОВКИ УЗОРОВ ---
async function checkUnlockedPatterns() {
    // Получаем список ID разблокированных паттернов ['dice', etc...]
    const unlockedIDs = await getUnlockedPatterns();
    
    // Ищем все кнопки паттернов
    const patternBtns = document.querySelectorAll('[data-type="pattern"]');
    
    patternBtns.forEach(btn => {
        const value = btn.getAttribute('data-value');
        
        // Если это базовый (none) или есть в списке разблокированных
        if (value === 'none' || unlockedIDs.includes(value)) {
            btn.classList.remove('locked');
            // Скрываем оверлей замка, если он есть внутри кнопки
            const lock = btn.querySelector('.lock-overlay');
            if (lock) lock.style.display = 'none';
        } else {
            btn.classList.add('locked');
            const lock = btn.querySelector('.lock-overlay');
            if (lock) lock.style.display = 'flex';
        }
    });
}

// --- ПРИМЕНЕНИЕ СТИЛЕЙ К ПРОФИЛЮ В ХЕДЕРЕ ---
function applyStyleToProfileBox(key, value) {
    if (!headerProfileBoxes || headerProfileBoxes.length === 0) {
        headerProfileBoxes = document.querySelectorAll('.profile-balance-box');
    }

    if (key === 'border') {
        headerProfileBoxes.forEach(box => {
            if (value === 'none' || !value) {
                box.style.removeProperty('border');
                box.style.removeProperty('padding');
            } else {
                box.style.setProperty('border', `3px solid ${value}`, 'important');
                box.style.padding = '5px 8px'; 
            }
        });

    } else if (key === 'background') {
        headerProfileBoxes.forEach(box => {
            if (value === 'none' || !value) {
                box.style.removeProperty('background-color');
            } else {
                box.style.setProperty('background-color', value, 'important');
            }
        });
    }
}

// --- НОВОЕ: ПРИМЕНЕНИЕ УЗОРА К КАРТОЧКЕ ---
function applyPatternToCard(patternName) {
    const card = document.querySelector('.user-info-card');
    if (!card) return;

    // Ищем или создаем слой узора
    let patternLayer = card.querySelector('.user-card-pattern');
    if (!patternLayer) {
        patternLayer = document.createElement('div');
        patternLayer.className = 'user-card-pattern';
        // Вставляем в начало, чтобы быть под контентом
        card.prepend(patternLayer); 
    }

    // Сбрасываем классы паттернов
    patternLayer.className = 'user-card-pattern'; 
    
    if (!patternName || patternName === 'none') {
        patternLayer.style.display = 'none';
    } else {
        patternLayer.style.display = 'block';
        // Добавляем класс, который задан в CSS (например, .pattern-dice)
        patternLayer.classList.add(`pattern-${patternName}`);
    }
}

// --- ОБРАБОТЧИКИ СОБЫТИЙ ---

async function handleAvatarSelect(e) {
    const clickedAvatar = e.target.closest('.customize-avatar-choice');
    if (!clickedAvatar) return;

    const newAvatarSrc = clickedAvatar.getAttribute('data-avatar-src');
    if (!newAvatarSrc) return;

    if (currentUser) {
        await updateCustomizationProperty(currentUser, 'avatar', newAvatarSrc);
    }

    const allAvatars = document.querySelectorAll('.header-avatar-img, .profile-large-avatar');
    allAvatars.forEach(img => {
        img.src = newAvatarSrc;
    });

    avatarGrid.querySelectorAll('.customize-avatar-choice').forEach(choice => {
        choice.classList.remove('selected');
    });
    clickedAvatar.classList.add('selected');
}

async function handleColorOrPatternSelect(e) {
    const clickedBtn = e.target.closest('.customize-color-choice');
    if (!clickedBtn) return;

    // Блокировка выбора, если элемент закрыт
    if (clickedBtn.classList.contains('locked')) {
        // Можно добавить тост "Достижение не получено"
        return;
    }

    const type = clickedBtn.getAttribute('data-type'); // border, background, pattern
    let value = clickedBtn.getAttribute('data-value'); 
    
    if (currentUser) {
        await updateCustomizationProperty(currentUser, type, value);
    }

    // Логика применения в реальном времени
    if (type === 'pattern') {
        applyPatternToCard(value);
    } else {
        applyStyleToProfileBox(type, value);
    }

    // Визуальное выделение
    const grid = clickedBtn.closest('.customize-color-grid');
    grid.querySelectorAll('.customize-color-choice').forEach(choice => {
        choice.classList.remove('selected');
    });
    clickedBtn.classList.add('selected');
}

// --- ГЛАВНАЯ ФУНКЦИЯ ПРИМЕНЕНИЯ ВСЕХ НАСТРОЕК ---
export function applyCustomization(customs) {
    const data = customs || {}; 
    
    // 1. Аватар
    const allAvatars = document.querySelectorAll('.header-avatar-img, .profile-large-avatar');
    headerProfileBoxes = document.querySelectorAll('.profile-balance-box');
    
    const savedAvatarSrc = data.avatar;
    const defaultAvatarSrc = 'assets/avatars/orange_cat_ava.png';
    const currentAvatarSrc = savedAvatarSrc || defaultAvatarSrc;
    
    allAvatars.forEach(img => {
        img.src = currentAvatarSrc;
    });

    // 2. Цвета хедера
    const savedBorder = data.border || 'none';
    applyStyleToProfileBox('border', savedBorder);
    
    const savedBackground = data.background || 'none'; 
    applyStyleToProfileBox('background', savedBackground);

    // 3. Узор карточки (НОВОЕ)
    const savedPattern = data.pattern || 'none';
    applyPatternToCard(savedPattern);
}

// --- ОБНОВЛЕНИЕ UI В МОДАЛКЕ ---
async function updateColorGridSelection() {
    let customs = {};
    if (currentUser) {
        const userData = await fetchUser(currentUser);
        customs = userData?.customization || {};
    }
    
    // Аватар
    const currentAvatarSrc = customs.avatar || 'assets/avatars/orange_cat_ava.png';
    avatarGrid.querySelectorAll('.customize-avatar-choice').forEach(choice => {
        choice.classList.remove('selected');
        if (choice.getAttribute('data-avatar-src') === currentAvatarSrc) {
            choice.classList.add('selected');
        }
    });

    // Цвета и Узоры
    colorGrids.forEach(grid => {
        // Определяем тип по кнопкам внутри, так как data-type может быть на гриде
        // Но лучше брать из первого элемента или атрибута грида, если мы его ставим в init
        let type = grid.getAttribute('data-type');
        
        // Если тип не задан явно в HTML, пробуем определить (fallback)
        if (!type) {
            const firstBtn = grid.querySelector('.customize-color-choice');
            if (firstBtn) type = firstBtn.getAttribute('data-type');
        }

        let savedValue;
        if (type === 'border') savedValue = customs.border;
        else if (type === 'background') savedValue = customs.background;
        else if (type === 'pattern') savedValue = customs.pattern;
        
        grid.querySelectorAll('.customize-color-choice').forEach(choice => {
            choice.classList.remove('selected');
            const value = choice.getAttribute('data-value');

            if (value === savedValue || (!savedValue && value === 'none')) {
                choice.classList.add('selected');
            }
        });
    });
}

export function initCustomize() {
    modalOverlay = document.getElementById('customize-modal-overlay');
    closeModalButton = document.getElementById('customize-modal-close');
    avatarGrid = document.querySelector('.customize-avatar-grid');
    
    const profileTriggers = document.querySelectorAll('#profile-avatar-display, #profile-change-avatar-btn');
    headerProfileBoxes = document.querySelectorAll('.profile-balance-box'); 
    colorGrids = document.querySelectorAll('.customize-color-grid');

    // Проставляем типы гридам для удобства
    colorGrids.forEach(grid => {
        // Ищем заголовок перед гридом
        const titleEl = grid.previousElementSibling; 
        if (titleEl && titleEl.classList.contains('customize-section-title')) {
            const titleText = titleEl.textContent;
            if (titleText.includes('Обводка')) grid.setAttribute('data-type', 'border');
            else if (titleText.includes('Фон')) grid.setAttribute('data-type', 'background');
            else if (titleText.includes('Узоры')) grid.setAttribute('data-type', 'pattern');
        }
    });

    if (!modalOverlay) return;
    
    profileTriggers.forEach(el => {
        el.removeEventListener('click', showCustomizeModal);
        el.addEventListener('click', showCustomizeModal);
    });

    if (closeModalButton) {
        closeModalButton.addEventListener('click', hideCustomizeModal);
    }

    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            hideCustomizeModal();
        }
    });

    if (avatarGrid) avatarGrid.addEventListener('click', handleAvatarSelect); 

    colorGrids.forEach(grid => {
        grid.addEventListener('click', handleColorOrPatternSelect);
    });
}