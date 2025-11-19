/*
 * (ИЗМЕНЕНО: МИГРАЦИЯ SUPABASE)
 * 1. Удалена логика Firebase paths ('customization/avatar').
 * 2. Реализован паттерн "Fetch -> Merge -> Update Full Object" для корректной работы с JSONB в Supabase.
 * 3. updateColorGridSelection теперь безопасен для null значений.
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
    // (В global.js функция patchUser должна делать: update({ customization: newCustomization }))
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
    if (key === 'border') {
        const borderStyle = (value === 'none') 
            ? 'none' 
            : `3px solid ${value}`; 
        
        headerProfileBoxes.forEach(box => {
            box.style.border = borderStyle;
            if (value !== 'none') {
                 box.style.padding = '5px 8px';
            } else {
                 box.style.padding = '6px 12px';
            }
        });

    } else if (key === 'background') {
        const bgStyle = (value === 'none') ? '' : value;
            
        headerProfileBoxes.forEach(box => {
            if (value === 'none') {
                box.style.backgroundColor = 'var(--balance-info-bg)';
            } else {
                box.style.backgroundColor = bgStyle;
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
    
    if (!headerAvatars) {
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
