/*
 * customize.js
 * Version 2.1 - Strict Profile-Only Trigger
 */

import { currentUser, patchUser, fetchUser } from './global.js';

let modalOverlay, closeModalButton, avatarGrid;
let headerAvatars; // All avatar images (header + profile)
let headerProfileBoxes; 
let colorGrids; 

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

    // Update all avatars in DOM
    const allAvatars = document.querySelectorAll('.header-avatar-img, .profile-large-avatar');
    allAvatars.forEach(img => {
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
    
    // CHANGED: Only target elements inside the profile page
    // This removes the listener from the header avatar
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
    
    // Attach listener only to profile triggers
    profileTriggers.forEach(el => {
        el.removeEventListener('click', showCustomizeModal); // clean old
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