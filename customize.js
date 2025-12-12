/*
 * customize.js
 * Version 3.5 - Optimistic UI & Static Background for Profile Card (re-integrated)
 */

import { currentUser, patchUser, fetchUser } from './global.js';
import { getUnlockedAvatars, getUnlockedPatterns } from './achievements.js'; 

let modalOverlay, closeModalButton, avatarGrid;
let headerAvatars; 
let headerProfileBoxes; 
let colorGrids; 

// --- СПИСОК БАЗОВЫХ АВАТАРОК ---
const DEFAULT_AVATARS = [
    { src: 'assets/avatars/orange_cat_ava.png', customSrc: 'assets/custom/orange_cat_custom.png', alt: 'Orange Cat' },
    { src: 'assets/avatars/black_cat_ava.png', customSrc: 'assets/custom/black_cat_custom.png', alt: 'Black Cat' },
    { src: 'assets/avatars/grey_cat_ava.png', customSrc: 'assets/custom/grey_cat_custom.png', alt: 'Grey Cat' }
];

// --- КРАСИВЫЕ ГРАДИЕНТЫ (для фиксированного фона карточки и для справки) ---
const CARD_GRADIENTS = {
    '#F5A623': 'linear-gradient(135deg, rgba(245, 166, 35, 0.95) 0%, rgba(212, 136, 6, 0.9) 100%)',   
    '#00A878': 'linear-gradient(135deg, rgba(0, 168, 120, 0.95) 0%, rgba(0, 117, 80, 0.9) 100%)',    
    '#4A90E2': 'linear-gradient(135deg, rgba(74, 144, 226, 0.95) 0%, rgba(44, 107, 179, 0.9) 100%)', 
    'none': 'linear-gradient(135deg, rgba(30, 27, 75, 0.95) 0%, rgba(49, 46, 129, 0.9) 100%)'        // Default Dark Blue (КЛАССИКА)
};

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
        await renderDynamicAvatarGrid();
        await checkUnlockedPatterns();
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

            avatarsDisplayList.push({ src: src, customSrc: customSrc, alt: 'Unlocked Avatar' });
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
    const unlockedIDs = await getUnlockedPatterns();
    const patternBtns = document.querySelectorAll('[data-type="pattern"]');
    
    patternBtns.forEach(btn => {
        const value = btn.getAttribute('data-value');
        
        if (value === 'none' || unlockedIDs.includes(value)) {
            btn.classList.remove('locked');
            const lock = btn.querySelector('.lock-overlay');
            if (lock) lock.style.display = 'none';
        } else {
            btn.classList.add('locked');
            const lock = btn.querySelector('.lock-overlay');
            if (lock) lock.style.display = 'flex';
        }
    });
}

// --- ПРИМЕНЕНИЕ СТИЛЕЙ К ПРОФИЛЮ В ХЕДЕРЕ (Баланс) ---
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
                // Фон баланса должен меняться
                box.style.setProperty('background-color', value, 'important');
            }
        });
    }
}

// --- ПРИМЕНЕНИЕ СТИЛЕЙ К ЛИЧНОЙ КАРТОЧКЕ (Только рамка, Фон всегда классика) ---
function applyStyleToPersonalCard(key, value) {
    const card = document.querySelector('#profile-page .user-info-card');
    if (!card) return;

    if (key === 'border') {
        if (value === 'none' || !value) {
            // Возвращаем дефолт (Индиго стиль)
            card.style.setProperty('border', '1px solid rgba(255, 255, 255, 0.15)', 'important');
            card.style.setProperty('box-shadow', '0 15px 35px rgba(30, 27, 75, 0.25)', 'important');
        } else {
            // Применяем цвет
            card.style.setProperty('border', `3px solid ${value}`, 'important');
            card.style.setProperty('box-shadow', `0 0 20px ${value}`, 'important');
        }
    } else if (key === 'background') {
        // Фон ВСЕГДА ставим классический градиент, игнорируя 'value'
        const classicGradient = CARD_GRADIENTS['none'];
        card.style.setProperty('background', classicGradient, 'important');
    }
}

// --- ПРИМЕНЕНИЕ УЗОРА К КАРТОЧКЕ ---
function applyPatternToCard(patternName) {
    const card = document.querySelector('.user-info-card'); // Используем общий селектор, так как вызывается в профиле
    if (!card) return;

    let patternLayer = card.querySelector('.user-card-pattern');
    if (!patternLayer) {
        patternLayer = document.createElement('div');
        patternLayer.className = 'user-card-pattern';
        card.prepend(patternLayer); 
    }

    patternLayer.className = 'user-card-pattern'; 
    
    if (!patternName || patternName === 'none') {
        patternLayer.style.display = 'none';
    } else {
        patternLayer.style.display = 'block';
        patternLayer.classList.add(`pattern-${patternName}`);

        // Добавляем ручную установку для dice (для стабильности)
        if (patternName === 'dice') {
            patternLayer.style.backgroundImage = "url('assets/bg/dice_bg1.svg')";
            patternLayer.style.backgroundSize = "60px 60px";
        }
    }
}

// --- ОБРАБОТЧИКИ СОБЫТИЙ (ОПТИМИСТИЧНЫЕ) ---

async function handleAvatarSelect(e) {
    const clickedAvatar = e.target.closest('.customize-avatar-choice');
    if (!clickedAvatar) return;

    const newAvatarSrc = clickedAvatar.getAttribute('data-avatar-src');
    if (!newAvatarSrc) return;
    
    // 1. Моментальное локальное обновление UI
    const allAvatars = document.querySelectorAll('.header-avatar-img, .profile-large-avatar');
    allAvatars.forEach(img => {
        img.src = newAvatarSrc;
    });

    avatarGrid.querySelectorAll('.customize-avatar-choice').forEach(choice => {
        choice.classList.remove('selected');
    });
    clickedAvatar.classList.add('selected');

    // 2. Асинхронное сохранение в базу данных (не ждем)
    if (currentUser) {
        updateCustomizationProperty(currentUser, 'avatar', newAvatarSrc)
            .catch(error => {
                console.error("Failed to save avatar customization:", error);
            });
    }
}

async function handleColorOrPatternSelect(e) {
    const clickedBtn = e.target.closest('.customize-color-choice');
    if (!clickedBtn) return;

    if (clickedBtn.classList.contains('locked')) return;

    const type = clickedBtn.getAttribute('data-type'); 
    let value = clickedBtn.getAttribute('data-value'); 
    
    // 1. Моментальное локальное обновление UI
    if (type === 'pattern') {
        applyPatternToCard(value);
    } else {
        // Баланс (меняет и фон, и рамку)
        applyStyleToProfileBox(type, value);
        // Карточка (меняет ТОЛЬКО рамку, фон фиксирован)
        applyStyleToPersonalCard(type, value);
    }

    // Визуальное выделение
    const grid = clickedBtn.closest('.customize-color-grid');
    grid.querySelectorAll('.customize-color-choice').forEach(choice => {
        choice.classList.remove('selected');
    });
    clickedBtn.classList.add('selected');

    // 2. Асинхронное сохранение в базу данных (не ждем)
    if (currentUser) {
        updateCustomizationProperty(currentUser, type, value)
            .catch(error => {
                console.error(`Failed to save ${type} customization:`, error);
            });
    }
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

    // 2. Цвета
    const savedBorder = data.border || 'none';
    applyStyleToProfileBox('border', savedBorder);
    applyStyleToPersonalCard('border', savedBorder); // Применяем рамку к карточке
    
    const savedBackground = data.background || 'none'; 
    applyStyleToProfileBox('background', savedBackground);
    applyStyleToPersonalCard('background', savedBackground); // Применяем фиксированный фон к карточке

    // 3. Узор карточки
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
        let type = grid.getAttribute('data-type');
        
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