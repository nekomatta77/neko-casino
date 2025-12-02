/*
 * (ИЗМЕНЕНО: ФИКС ФОНА В DARK MODE - ПРИОРИТЕТ СТИЛЕЙ)
 * 1. Удалена логика Firebase paths ('customization/avatar').
 * 2. Реализован паттерн "Fetch -> Merge -> Update Full Object" для корректной работы с JSONB в Supabase.
 * 3. updateColorGridSelection теперь безопасен для null значений.
 * 4. applyStyleToProfileBox теперь использует setProperty(..., 'important'), чтобы пробивать темную тему.
 */

import { currentUser, patchUser, fetchUser } from './global.js';

let modalOverlay, closeModalButton, avatarGrid;
let headerProfileBoxes; 
let headerAvatars; 
let colorGrids; 

/**
 * Вспомогательная функция для безопасного обновления JSONB-поля customization.
 * Получает текущий объект, меняет одно свойство и перезаписывает весь объект.
 */
async function updateCustomizationProperty(username, key, value) {
    // 1. Получаем текущего пользователя
    const userData = await fetchUser(username);
    // 2. Берем текущую кастомизацию или пустой объект
    const currentCustomization = userData?.customization || {};
    
    // 3. Обновляем нужное поле
    const newCustomization = {
        ...currentCustomization,
        [key]: value
    };
    
    // 4. Отправляем ВЕСЬ объект кастомизации обратно
    return await patchUser(username, { customization: newCustomization });
}

async function showCustomizeModal() {
    if (modalOverlay) {
        await updateColorGridSelection();
        modalOverlay.classList.remove('hidden');
    }
}

function hideCustomizeModal() {
    if (modalOverlay) {
        modalOverlay.classList.add('hidden');
    }
}

function applyStyleToProfileBox(key, value) {
    // Обновляем селекторы, если они вдруг потерялись
    if (!headerProfileBoxes || headerProfileBoxes.length === 0) {
        headerProfileBoxes = document.querySelectorAll('.profile-balance-box');
    }

    if (key === 'border') {
        headerProfileBoxes.forEach(box => {
            if (value === 'none' || !value) {
                // Сбрасываем на дефолт (удаляем инлайн стиль)
                // CSS сам подставит дефолтную рамку из style.css/style4.css
                box.style.removeProperty('border');
                box.style.removeProperty('padding'); // Сброс паддинга к дефолту
            } else {
                // Ставим кастомную рамку с приоритетом
                box.style.setProperty('border', `3px solid ${value}`, 'important');
                // Корректируем паддинг для толстой рамки
                box.style.padding = '5px 8px'; 
            }
        });

    } else if (key === 'background') {
        headerProfileBoxes.forEach(box => {
            if (value === 'none' || !value) {
                // СБРОС: Удаляем инлайн-стиль полностью.
                // Это позволит CSS-файлам (darkstyle.css или style.css) применить правильный дефолтный фон.
                box.style.removeProperty('background-color');
            } else {
                // УСТАНОВКА: Используем 'important', чтобы перебить !important в darkstyle.css
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

    // ИЗМЕНЕНО: Безопасное обновление для SQL/JSONB
    if (currentUser) {
        await updateCustomizationProperty(currentUser, 'avatar', newAvatarSrc);
    }

    headerAvatars.forEach(img => {
        img.src = newAvatarSrc;
    });

    avatarGrid.querySelectorAll('.customize-avatar-choice').forEach(choice => {
        choice.classList.remove('selected');
    });
    clickedAvatar.classList.add('selected');
}

async function handleColorSelect(e) {
    const clickedColor = e.target.closest('.customize-color-choice');
    if (!clickedColor) return;

    const type = clickedColor.getAttribute('data-type'); // 'border' или 'background'
    let value = clickedColor.getAttribute('data-value'); // Цвет или 'none'
    
    // ИЗМЕНЕНО: Безопасное обновление для SQL/JSONB
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
    
    if (!headerAvatars || headerAvatars.length === 0) {
        headerAvatars = document.querySelectorAll('.header-avatar-img');
        headerProfileBoxes = document.querySelectorAll('.profile-balance-box');
    }
    
    const savedAvatarSrc = data.avatar;
    const defaultAvatarSrc = 'assets/avatars/orange_cat_ava.png';
    const currentAvatarSrc = savedAvatarSrc || defaultAvatarSrc;
    
    headerAvatars.forEach(img => {
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
    
    const currentAvatarSrc = customs.avatar || 'assets/avatars/orange_cat_ava.png';
    avatarGrid.querySelectorAll('.customize-avatar-choice').forEach(choice => {
        choice.classList.remove('selected');
        if (choice.getAttribute('data-avatar-src') === currentAvatarSrc) {
            choice.classList.add('selected');
        }
    });

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
    
    headerAvatars = document.querySelectorAll('.header-avatar-img'); 
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

    if (!modalOverlay || headerAvatars.length === 0) {
        return;
    }
    
    headerAvatars.forEach(avatar => {
        avatar.addEventListener('click', showCustomizeModal);
    });

    if (closeModalButton) {
        closeModalButton.addEventListener('click', hideCustomizeModal);
    }

    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            hideCustomizeModal();
        }
    });

    avatarGrid.addEventListener('click', handleAvatarSelect); 

    colorGrids.forEach(grid => {
        grid.addEventListener('click', handleColorSelect);
    });
}
