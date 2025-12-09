/*
 * customize.js
 * Version 3.0 - Dynamic Avatar Loading based on Achievements
 */

import { currentUser, patchUser, fetchUser } from './global.js';
// Импортируем функцию для получения аватарок из достижений
import { getUnlockedAvatars } from './achievements.js'; 

let modalOverlay, closeModalButton, avatarGrid;
let headerAvatars; 
let headerProfileBoxes; 
let colorGrids; 

// --- СПИСОК БАЗОВЫХ АВАТАРОК (Доступны всем) ---
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
 * Safe JSONB update helper
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
        // 1. Сначала обновляем сетку аватарок (проверяем достижения)
        await renderDynamicAvatarGrid();
        
        // 2. Затем обновляем визуальное выделение текущих настроек
        await updateColorGridSelection();
        
        modalOverlay.classList.remove('hidden');
    }
}

function hideCustomizeModal() {
    if (modalOverlay) {
        modalOverlay.classList.add('hidden');
    }
}

// --- ФУНКЦИЯ ОТРИСОВКИ СЕТКИ АВАТАРОВ ---
async function renderDynamicAvatarGrid() {
    if (!avatarGrid) return;

    // 1. Получаем список SRC разблокированных аватаров из achievements.js
    // Возвращает массив путей, например: ['assets/avatars/dice_red_avatar.png']
    const unlockedSrcs = await getUnlockedAvatars(); 

    // 2. Формируем полный список для отображения
    // Начинаем с базовых
    let avatarsDisplayList = [...DEFAULT_AVATARS];

    // Добавляем разблокированные
    unlockedSrcs.forEach(src => {
        // Проверяем, нет ли дубликатов с базовыми
        const isDefault = DEFAULT_AVATARS.some(def => def.src === src);
        if (!isDefault) {
            // Генерируем путь к картинке для меню (assets/custom/)
            // Логика: заменяем папку и суффикс (_ava/_avatar -> _custom)
            let customSrc = src.replace('assets/avatars/', 'assets/custom/');
            
            // Замена суффиксов для соответствия неймингу в папке custom
            if (customSrc.includes('_ava.png')) {
                customSrc = customSrc.replace('_ava.png', '_custom.png');
            } else if (customSrc.includes('_avatar.png')) {
                customSrc = customSrc.replace('_avatar.png', '_custom.png');
            }

            avatarsDisplayList.push({
                src: src,       // В профиль (из assets/avatars/)
                customSrc: customSrc, // В меню (из assets/custom/)
                alt: 'Unlocked Avatar'
            });
        }
    });

    // 3. Очищаем текущую сетку
    avatarGrid.innerHTML = '';

    // 4. Генерируем HTML
    avatarsDisplayList.forEach(ava => {
        const img = document.createElement('img');
        img.src = ava.customSrc; // Показываем картинку из папки custom в меню
        img.alt = ava.alt;
        img.className = 'customize-avatar-choice';
        
        // Важные атрибуты для логики выбора
        img.setAttribute('data-avatar-src', ava.src); // Путь для профиля
        img.setAttribute('data-custom-src', ava.customSrc); // Путь для меню

        avatarGrid.appendChild(img);
    });
}

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

async function handleAvatarSelect(e) {
    const clickedAvatar = e.target.closest('.customize-avatar-choice');
    if (!clickedAvatar) return;

    const newAvatarSrc = clickedAvatar.getAttribute('data-avatar-src');
    if (!newAvatarSrc) return;

    if (currentUser) {
        await updateCustomizationProperty(currentUser, 'avatar', newAvatarSrc);
    }

    // Update all avatars in DOM (Header + Profile)
    const allAvatars = document.querySelectorAll('.header-avatar-img, .profile-large-avatar');
    allAvatars.forEach(img => {
        img.src = newAvatarSrc; // Sets image from assets/avatars/
    });

    avatarGrid.querySelectorAll('.customize-avatar-choice').forEach(choice => {
        choice.classList.remove('selected');
    });
    clickedAvatar.classList.add('selected');
}

async function handleColorSelect(e) {
    const clickedColor = e.target.closest('.customize-color-choice');
    if (!clickedColor) return;

    const type = clickedColor.getAttribute('data-type'); 
    let value = clickedColor.getAttribute('data-value'); 
    
    if (currentUser) {
        await updateCustomizationProperty(currentUser, type, value);
    }

    applyStyleToProfileBox(type, value);

    const grid = clickedColor.closest('.customize-color-grid');
    grid.querySelectorAll('.customize-color-choice').forEach(choice => {
        choice.classList.remove('selected');
    });
    clickedColor.classList.add('selected');
}

export function applyCustomization(customs) {
    const data = customs || {}; 
    
    const allAvatars = document.querySelectorAll('.header-avatar-img, .profile-large-avatar');
    headerProfileBoxes = document.querySelectorAll('.profile-balance-box');
    
    const savedAvatarSrc = data.avatar;
    const defaultAvatarSrc = 'assets/avatars/orange_cat_ava.png';
    const currentAvatarSrc = savedAvatarSrc || defaultAvatarSrc;
    
    allAvatars.forEach(img => {
        img.src = currentAvatarSrc;
    });

    const savedBorder = data.border || 'none';
    applyStyleToProfileBox('border', savedBorder);
    
    const savedBackground = data.background || 'none'; 
    applyStyleToProfileBox('background', savedBackground);
}

async function updateColorGridSelection() {
    let customs = {};
    if (currentUser) {
        const userData = await fetchUser(currentUser);
        customs = userData?.customization || {};
    }
    
    // Выделяем текущий аватар в только что перерисованной сетке
    const currentAvatarSrc = customs.avatar || 'assets/avatars/orange_cat_ava.png';
    avatarGrid.querySelectorAll('.customize-avatar-choice').forEach(choice => {
        choice.classList.remove('selected');
        if (choice.getAttribute('data-avatar-src') === currentAvatarSrc) {
            choice.classList.add('selected');
        }
    });

    // Выделяем цвета
    colorGrids.forEach(grid => {
        const type = grid.getAttribute('data-type');
        const savedValue = (type === 'border') ? customs.border : customs.background;
        
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
    colorGrids.forEach(grid => {
        const title = grid.parentNode.querySelector('h4').textContent;
        if (title.includes('Обводка')) {
            grid.setAttribute('data-type', 'border');
        } else if (title.includes('Фон')) {
            grid.setAttribute('data-type', 'background');
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
        grid.addEventListener('click', handleColorSelect);
    });
}