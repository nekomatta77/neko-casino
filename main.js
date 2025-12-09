/*
 * main.js - FINAL PUBLIC PROFILE FIX
 * 1. Matches Real User Customization (Patterns, Borders)
 * 2. Hides Admin Rank -> Shows 'King'
 * 3. Indigo Colors for Text
 */

import { showSection, currentUser, fetchUser, fetchUserStats } from './global.js';
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
import { renderAchievementsPage } from './achievements.js';

// ... (applySavedTheme, getRankIndex, updateRanksDisplay - без изменений) ...
function applySavedTheme() {
    const themeStyle = document.getElementById('theme-style');
    const currentTheme = localStorage.getItem('cashcat_theme'); 
    if (themeStyle) {
        if (currentTheme === 'dark') themeStyle.disabled = false;
        else themeStyle.disabled = true; 
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
        if (index < targetIndex) card.classList.add('achieved'); 
        else if (index === targetIndex) card.classList.add('current'); 
        else card.classList.add('locked'); 
    });
}

// Активные игры
const ACTIVE_GAMES_CONFIG = {
    'dice': { name: 'Dice', icon: 'assets/dice_icon.png' },
    'mines': { name: 'Mines', icon: 'assets/mine_icon.png' },
    'keno': { name: 'Keno', icon: 'assets/keno_icon.png' },
    'crash': { name: 'Crash', icon: 'assets/crash_icon.png' },
    'coin': { name: 'Coinflip', icon: 'assets/coin_icon.png' },
    'sleepy': { name: 'Sleepy Cat', icon: 'assets/sleepy_icon.png' }
};

// --- ЛОГИКА ПУБЛИЧНОГО ПРОФИЛЯ ---
async function openPublicProfile(username) {
    if (!username) return;

    const usernameEl = document.getElementById('pp-page-username');
    if(usernameEl) usernameEl.innerText = username;

    try {
        const userData = await fetchUser(username);
        
        // --- 1. РАНГ (Скрытие Admin -> King) ---
        let userRank = userData?.rank || 'None Rang';
        
        // Если Админ или Владелец -> Показываем "Король"
        if (userRank === 'admin' || userRank === 'Владелец') {
            userRank = 'King';
        }

        const rankNameMap = {
            'None Rang': 'Без ранга', 'Kitten': 'Котенок', 'Newfag': 'Кот новичок',
            'Old Cat': 'Бывалый', 'Street Cat': 'Уличный', 'Horse': 'Победоносец', 
            'King': 'Король'
        };
        const rankImgMap = {
            'None Rang': 'assets/ranks/rank_kitten.png', 'Kitten': 'assets/ranks/rank_kitten.png',
            'Newfag': 'assets/ranks/rank_newfag.png', 'Old Cat': 'assets/ranks/rank_old.png',
            'Street Cat': 'assets/ranks/rank_street.png', 'Horse': 'assets/ranks/rank_horse.png',
            'King': 'assets/ranks/rank_king.png'
        };

        const rankNameEl = document.getElementById('pp-page-rank-name');
        if(rankNameEl) rankNameEl.innerText = rankNameMap[userRank] || userRank;

        const rankImgEl = document.getElementById('pp-page-rank-img');
        if(rankImgEl) rankImgEl.src = rankImgMap[userRank] || 'assets/ranks/rank_kitten.png';

        // --- 2. КАСТОМИЗАЦИЯ (Аватар, Узоры, Рамки) ---
        const avatarEl = document.getElementById('pp-page-avatar');
        
        // Аватар
        if(userData?.avatar) {
            avatarEl.src = userData.avatar;
        } else {
            let seed = 0;
            for (let i = 0; i < username.length; i++) seed += username.charCodeAt(i);
            const avatars = ['assets/avatars/orange_cat_ava.png', 'assets/avatars/black_cat_ava.png', 'assets/avatars/grey_cat_ava.png'];
            avatarEl.src = avatars[seed % avatars.length];
        }

        // Применение стилей кастомизации к карточке
        const cardEl = document.querySelector('.user-info-card.public-mode');
        const custom = userData?.customization || {};

        // 2.1 Рамка
        if (custom.borderColor && custom.borderColor !== 'none') {
            cardEl.style.borderColor = custom.borderColor;
            // Добавляем свечение цветом рамки
            cardEl.style.boxShadow = `0 0 20px ${custom.borderColor}40`; // 40 = ~25% alpha
        } else {
            cardEl.style.borderColor = '#4F46E5'; // Default Indigo
            cardEl.style.boxShadow = 'none';
        }

        // 2.2 Фон
        if (custom.background && custom.background !== 'none') {
            cardEl.style.background = custom.background;
        } else {
            // Default Indigo Gradient
            cardEl.style.background = 'linear-gradient(145deg, #23214A, #1E1B4B)';
        }

        // 2.3 Узор (Pattern)
        // Удаляем старый узор если есть
        const oldPattern = cardEl.querySelector('.user-card-pattern');
        if(oldPattern) oldPattern.remove();

        if (custom.pattern && custom.pattern !== 'none') {
            const patternDiv = document.createElement('div');
            patternDiv.className = `user-card-pattern pattern-${custom.pattern}`;
            
            // Если это dice (как в style2.css), добавляем стили вручную или через класс
            if (custom.pattern === 'dice') {
                patternDiv.style.backgroundImage = "url('assets/bg/dice_bg1.svg')";
                patternDiv.style.backgroundSize = "60px 60px";
            }
            // Добавляем в начало карточки, чтобы z-index (0) сработал правильно
            cardEl.insertBefore(patternDiv, cardEl.firstChild);
        }

        // --- 3. ДАТА РЕГИСТРАЦИИ (Точная) ---
        const dateEl = document.getElementById('pp-page-date');
        if(userData?.created_at) {
            // Преобразуем ISO дату в красивый формат (ДД.ММ.ГГГГ)
            const dateObj = new Date(userData.created_at);
            const day = String(dateObj.getDate()).padStart(2, '0');
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const year = dateObj.getFullYear();
            dateEl.innerText = `В игре с ${day}.${month}.${year}`;
        } else {
            // Фолбек
            dateEl.innerText = `В игре с 01.2024`;
        }

        // --- 4. СТАТИСТИКА ---
        const stats = await fetchUserStats(username);
        let totalGames = 0;
        let bestWin = 0;
        let favoriteGameKey = null;
        let maxPlays = -1;

        if (stats) {
            for (const [gameType, data] of Object.entries(stats)) {
                if (data.plays) totalGames += data.plays;
                if (data.max_win && data.max_win > bestWin) bestWin = data.max_win;
                if (ACTIVE_GAMES_CONFIG[gameType]) {
                    if (data.plays > maxPlays) {
                        maxPlays = data.plays;
                        favoriteGameKey = gameType;
                    }
                }
            }
        }

        document.getElementById('pp-page-total-games').innerText = totalGames;
        document.getElementById('pp-page-best-win').innerText = `${bestWin.toFixed(2)} ₽`;

        // Скрываем Wager
        const wagerBox = document.querySelector('.pp-stat-box.full');
        if (wagerBox) wagerBox.style.display = 'none';

        // --- 5. ЛЮБИМАЯ ИГРА ---
        const favNameEl = document.getElementById('pp-page-fav-name');
        const favIconEl = document.getElementById('pp-page-fav-icon');

        if (favoriteGameKey && ACTIVE_GAMES_CONFIG[favoriteGameKey]) {
            favNameEl.innerText = ACTIVE_GAMES_CONFIG[favoriteGameKey].name;
            favIconEl.src = ACTIVE_GAMES_CONFIG[favoriteGameKey].icon;
        } else {
            favNameEl.innerText = "Dice";
            favIconEl.src = "assets/dice_icon.png";
        }

        showSection('public-profile-page');

    } catch (error) {
        console.error("Error loading public profile:", error);
    }
}

// ... (Остальной код: Listeners, Init, и т.д. - без изменений) ...
let currentVisualHistoryUser = null;

function openVisualHistoryModal(username, amount, gameType = 'unknown') {
    const modal = document.getElementById('visual-history-modal-overlay');
    currentVisualHistoryUser = username;
    document.getElementById('vh-username').innerText = username;
    document.getElementById('vh-profit').innerText = amount; 
    const randomBet = (parseFloat(amount) / (Math.random() * 5 + 1.1)).toFixed(2);
    document.getElementById('vh-bet').innerText = randomBet + ' RUB';
    document.getElementById('vh-extra-value').innerText = `Game: ${gameType}`;
    const gridContainer = document.getElementById('visual-history-grid-container');
    gridContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#fff;">Визуализация игры...</div>';
    modal.classList.remove('hidden');
}

document.addEventListener('DOMContentLoaded', async () => {
    applySavedTheme(); 
    const paths = document.querySelectorAll('.cat-lines line, .cat-lines polyline');
    paths.forEach(path => {
        let length = 100;
        if (path.getTotalLength) length = path.getTotalLength();
        path.style.transition = path.style.WebkitTransition = 'none';
        path.style.strokeDasharray = length + ' ' + length;
        path.style.strokeDashoffset = length;
        path.getBoundingClientRect(); 
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
                    if (target === 'achievements-page') renderAchievementsPage(); 
                    
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

        const backBtn = document.getElementById('pp-back-button');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                showSection('lobby');
            });
        }

        const vhProfileBtn = document.getElementById('vh-open-profile-btn');
        const visualHistoryModal = document.getElementById('visual-history-modal-overlay');
        const visualHistoryClose = document.getElementById('visual-history-close');

        if (vhProfileBtn) {
            vhProfileBtn.addEventListener('click', () => {
                if (currentVisualHistoryUser && currentVisualHistoryUser !== '...') {
                    visualHistoryModal.classList.add('hidden');
                    openPublicProfile(currentVisualHistoryUser);
                }
            });
        }

        if (visualHistoryClose) {
            visualHistoryClose.addEventListener('click', () => {
                visualHistoryModal.classList.add('hidden');
            });
        }
        if (visualHistoryModal) {
            visualHistoryModal.addEventListener('click', (e) => {
                if (e.target === visualHistoryModal) visualHistoryModal.classList.add('hidden');
            });
        }

        const historyLists = document.querySelectorAll('#bet-history-list, .per-game-history-list');
        historyLists.forEach(list => {
            list.addEventListener('click', (e) => {
                const winCard = e.target.closest('.high-win-card');
                if (winCard) {
                    const usernameEl = winCard.querySelector('.history-user');
                    const amountEl = winCard.querySelector('.history-amount');
                    if (usernameEl && amountEl) {
                        const username = usernameEl.textContent.trim();
                        const amount = amountEl.textContent.trim();
                        openVisualHistoryModal(username, amount, 'High Win');
                    }
                    return;
                }
                const historyItem = e.target.closest('.game-history-item');
                if (historyItem) {
                    const usernameEl = historyItem.querySelector('.history-cell.user');
                    const payoutEl = historyItem.querySelector('.history-cell.payout');
                    if (usernameEl && payoutEl) {
                        const username = usernameEl.textContent.trim();
                        const amount = payoutEl.textContent.trim();
                        openVisualHistoryModal(username, amount, 'History');
                    }
                }
            });
        });

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
        setTimeout(() => {
            if (loaderOverlay) {
                loaderOverlay.style.opacity = '0';
                loaderOverlay.style.pointerEvents = 'none';
                setTimeout(() => {
                    loaderOverlay.style.display = 'none';
                }, 500); 
            }
        }, 3000);
    }
});