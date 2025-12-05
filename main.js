/*
 * main.js
 * Default theme is now Light
 */

import { showSection, currentUser, fetchUser } from './global.js'; 
import { initMines } from './mines.js';
import { initDice } from './dice.js';
import { initCrash } from './crash.js'; 
import { initCoin } from './coin.js'; 
import { initAuth, checkLoginState } from './auth.js'; 
import { initBonus, updateBonusPage } from './bonus.js'; 
import { initFAQ } from './faq.js'; 
import { initReferral, updateReferralData } from './referral.js'; 
import { initProfile, updateProfileData } from './profile.js'; 
import { initCustomize } from './customize.js';
import { initKeno } from './keno.js';
import { initAdmin, handleSearchUsers as updateAdminData } from './admin.js';
import { initSleepy } from './sleepy.js';
import { initWheel } from './wheel.js'; 

/**
 * Вспомогательная функция для применения темы до полной загрузки JS.
 * Default: Light Mode (style4 disabled).
 */
function applySavedTheme() {
    const themeStyle = document.getElementById('theme-style');
    const currentTheme = localStorage.getItem('cashcat_theme'); // Может быть null
    
    if (themeStyle) {
        if (currentTheme === 'dark') {
            themeStyle.disabled = false; // Включаем темный
        } else {
            // Если 'light' или null (первый вход) -> отключаем темный (Light default)
            themeStyle.disabled = true; 
        }
    }
}

function getRankIndex(dbRank) {
    switch (dbRank) {
        case 'admin': return 5; 
        case 'King': return 5; 
        case 'Horse': return 4; 
        case 'Street Cat': return 3; 
        case 'Old Cat': return 2; 
        case 'Newfag': return 1; 
        case 'Kitten': return 0; 
        case 'None Rang': return 0; 
        default: return 0; 
    }
}

async function updateRanksDisplay() {
    let targetIndex = 0; 
    if (currentUser) {
        try {
            const userData = await fetchUser(currentUser);
            const dbRank = userData?.rank || 'None Rang';
            targetIndex = getRankIndex(dbRank);
        } catch (error) {
            console.error("Rank load error:", error);
            targetIndex = 0; 
        }
    }
    const rankCards = document.querySelectorAll('#ranks-page .rank-card-wrapper');
    if (rankCards.length === 0) return;
    rankCards.forEach((card, index) => {
        card.classList.remove('current', 'achieved', 'locked');
        if (index < targetIndex) {
            card.classList.add('achieved'); 
        } else if (index === targetIndex) {
            card.classList.add('current'); 
        } else {
            card.classList.add('locked'); 
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    
    applySavedTheme(); // Apply theme ASAP

    // --- ЛОГИКА АНИМАЦИИ ЗАГРУЗЧИКА (SVG КОТ) ---
    const paths = document.querySelectorAll('.cat-lines line, .cat-lines polyline');
    paths.forEach(path => {
        let length = 100;
        // Вычисляем длину для анимации рисования
        if (path.getTotalLength) {
            length = path.getTotalLength();
        }
        // Сбрасываем стили и запускаем анимацию
        path.style.transition = path.style.WebkitTransition = 'none';
        path.style.strokeDasharray = length + ' ' + length;
        path.style.strokeDashoffset = length;
        path.getBoundingClientRect(); // Trigger layout
        path.style.animation = "drawLine 3s ease-in-out forwards";
    });

    const loaderOverlay = document.getElementById('loader-overlay');
    
    try {
        try { initMines(); } catch(e){ console.error("Mines init failed", e); }
        try { initDice(); } catch(e){ console.error("Dice init failed", e); }
        try { initCrash(); } catch(e){ console.error("Crash init failed", e); }
        try { initCoin(); } catch(e){ console.error("Coin init failed", e); }
        try { initAuth(); } catch(e){ console.error("Auth init failed", e); }
        try { initBonus(); } catch(e){ console.error("Bonus init failed", e); }
        try { initFAQ(); } catch(e){ console.error("FAQ init failed", e); }
        try { initReferral(); } catch(e){ console.error("Ref init failed", e); }
        try { initProfile(); } catch(e){ console.error("Profile init failed", e); }
        try { initCustomize(); } catch(e){ console.error("Custom init failed", e); }
        try { initKeno(); } catch(e){ console.error("Keno init failed", e); }
        try { initAdmin(); } catch(e){ console.error("Admin init failed", e); }
        try { initSleepy(); } catch(e){ console.error("Sleepy init failed", e); }
        try { initWheel(); } catch(e){ console.error("Wheel init failed", e); } 
        
        const openSidebarButton = document.getElementById('open-sidebar-button');
        const openSidebarButtonText = document.getElementById('open-sidebar-button-text');
        const sidebarNav = document.getElementById('sidebar-nav');
        const sidebarOverlay = document.getElementById('sidebar-overlay');

        const toggleSidebar = () => {
            if (sidebarNav && sidebarOverlay) {
                sidebarNav.classList.toggle('active');
                sidebarOverlay.classList.toggle('active'); 
            }
        };

        if (openSidebarButton) openSidebarButton.addEventListener('click', toggleSidebar);
        if (openSidebarButtonText) openSidebarButtonText.addEventListener('click', toggleSidebar);
        if (sidebarOverlay) sidebarOverlay.addEventListener('click', toggleSidebar);

        const sidebarLinks = document.querySelectorAll('.sidebar-nav .sidebar-links a');
        sidebarLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const target = e.currentTarget.getAttribute('data-target');
                if (target) {
                    if (target === 'ref-page') updateReferralData();
                    if (target === 'profile-page') updateProfileData();
                    if (target === 'admin-page') updateAdminData();
                    if (target === 'ranks-page') updateRanksDisplay();
                    if (target === 'bonus-page') updateBonusPage();
                    showSection(target);
                    toggleSidebar(); 
                }
            });
        });
        
        const bottomNavItems = document.querySelectorAll('.bottom-nav-item');
        bottomNavItems.forEach(item => {
            item.addEventListener('click', (event) => {
                const currentItem = event.currentTarget;
                const target = currentItem.getAttribute('data-target');
                if (target) { 
                    if (target === 'bonus-page') updateBonusPage();
                    if (target === 'ref-page') updateReferralData();
                    if (target === 'ranks-page') updateRanksDisplay();
                    showSection(target);
                }
            });
        });
        
        // --- ЛОГИКА УВЕДОМЛЕНИЙ ---
        const notifBtn = document.getElementById('notif-toggle-btn');
        const notifDropdown = document.getElementById('notif-dropdown');
        
        if (notifBtn && notifDropdown) {
            notifBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                notifDropdown.classList.toggle('hidden');
            });
            
            document.addEventListener('click', (e) => {
                if (!notifDropdown.classList.contains('hidden')) {
                    if (!notifDropdown.contains(e.target) && !notifBtn.contains(e.target)) {
                        notifDropdown.classList.add('hidden');
                    }
                }
            });
        }

        function navigateToGame(gameType) {
            if (gameType === 'mines') showSection('mines-game');
            else if (gameType === 'dice') showSection('dice-game'); 
            else if (gameType === 'crash') showSection('crash-game');
            else if (gameType === 'coin') showSection('coin-game');
            else if (gameType === 'keno') showSection('keno-game');
            else if (gameType === 'sleepy') showSection('sleepy-game');
            else if (gameType === 'wheel') showSection('wheel-game'); 
        }

        const lobbyGameWrappers = document.querySelectorAll('.lobby-game-wrapper');
        lobbyGameWrappers.forEach(wrapper => {
            wrapper.addEventListener('click', (e) => {
                e.preventDefault();
                if (wrapper.classList.contains('locked-game')) return; 
                const gameType = e.currentTarget.getAttribute('data-game-type'); 
                if (gameType) navigateToGame(gameType);
            });
        });
        
        const logoElements = document.querySelectorAll('.logo');
        logoElements.forEach(logo => {
            logo.addEventListener('click', (e) => {
                e.preventDefault();
                showSection('lobby');
            });
        });
        
        const miniGamesNavItems = document.querySelectorAll('.mini-games-nav-item');
        miniGamesNavItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault(); 
                const target = e.currentTarget.getAttribute('data-target');
                if (target) showSection(target);
            });
        });

        await checkLoginState(); 

    } catch (error) {
        console.error("INIT ERROR:", error);
    } finally {
        // Убираем лоадер через 3 секунды (время анимации кота)
        setTimeout(() => {
            if (loaderOverlay) {
                // 1. Делаем прозрачным
                loaderOverlay.style.opacity = '0';
                // 2. Отключаем клики сразу, чтобы кнопки стали доступны
                loaderOverlay.style.pointerEvents = 'none';
                
                // 3. Полностью удаляем из верстки через полсекунды (после fade out)
                setTimeout(() => {
                    loaderOverlay.style.display = 'none';
                }, 500); 
            }
        }, 3000);
    }
});