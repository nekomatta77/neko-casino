/*
 * main.js - FINAL VERSION WITH NOTIFICATIONS & BADGE LOGIC
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

// ГРАДИЕНТЫ
const CARD_GRADIENTS = {
    'none': 'linear-gradient(135deg, rgba(30, 27, 75, 0.95) 0%, rgba(49, 46, 129, 0.9) 100%)'
};

/* =========================================
   СИСТЕМА УВЕДОМЛЕНИЙ (GLOBAL)
   ========================================= */

// Функция обновления счетчика уведомлений
function updateBadgeCount(change) {
    const badge = document.querySelector('.notif-badge');
    if (!badge) return;
    
    // Получаем текущее значение (или 0)
    let count = parseInt(badge.innerText) || 0;
    
    // Изменяем значение
    count += change;
    
    // Не даем уйти в минус
    if (count < 0) count = 0;
    
    // Обновляем текст
    badge.innerText = count;
    
    // Логика видимости: Если 0 - скрываем, иначе показываем (flex для центрирования)
    if (count === 0) {
        badge.style.display = 'none';
    } else {
        badge.style.display = 'flex';
        // Анимация "подпрыгивания" при изменении
        badge.style.animation = 'none';
        badge.offsetHeight; /* trigger reflow */
        badge.style.animation = 'popIn 0.3s ease';
    }
}

// Глобальная функция добавления уведомления
window.addAppNotification = function(title, text) {
    const list = document.querySelector('.notif-list');
    const box = document.getElementById('header-notif-box');
    
    if (!list || !box) return;

    // 1. Показываем контейнер уведомлений, если он был скрыт
    box.classList.remove('hidden');

    // 2. Создаем элемент списка
    const li = document.createElement('li');
    li.className = 'notif-item new'; // Класс new делает его непрочитанным (стили в style2.css)
    
    // Время
    const now = new Date();
    const timeString = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

    li.innerHTML = `
        <span class="notif-title">${title}</span>
        <span class="notif-text">${text}</span>
        <span class="notif-time">${timeString}</span>
    `;
    
    // 3. Обработчик клика (Прочтение)
    li.addEventListener('click', function() {
        if (this.classList.contains('new')) {
            this.classList.remove('new'); // Убираем подсветку
            updateBadgeCount(-1); // Уменьшаем счетчик на 1
        }
    });

    // 4. Добавляем в начало списка
    list.prepend(li);
    
    // 5. Увеличиваем счетчик на 1
    updateBadgeCount(1);
    
    // 6. Анимация колокольчика
    const bell = document.querySelector('.bell-icon');
    if(bell) {
        bell.style.transition = 'none';
        bell.style.transform = 'rotate(0deg)';
        let angle = 0;
        let count = 0;
        const shake = setInterval(() => {
            count++;
            angle = (count % 2 === 0) ? 15 : -15;
            bell.style.transform = `rotate(${angle}deg)`;
            if(count > 5) {
                clearInterval(shake);
                bell.style.transform = 'rotate(0deg)';
                bell.style.transition = 'all 0.2s';
            }
        }, 50);
    }
};

/* =========================================
   ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
   ========================================= */

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
    'sleepy': { name: 'Sleepy Cat', icon: 'assets/sleepy_icon.png' },
    'wheel': { name: 'Wheel', icon: 'assets/wheel_icon.png' }
};

const ALLOWED_STATS_GAMES = ['dice', 'mines', 'keno'];

function showStatDetails(title, type, statsData) {
    const modal = document.getElementById('pp-details-modal');
    const titleEl = document.getElementById('pp-details-title');
    const listEl = document.getElementById('pp-details-list');
    
    if (!modal || !listEl) return;

    titleEl.innerText = title;
    listEl.innerHTML = ''; 

    ALLOWED_STATS_GAMES.forEach(gameKey => {
        const config = ACTIVE_GAMES_CONFIG[gameKey];
        if (!config) return; 

        const gameStats = statsData[gameKey] || {};
        let value = 0;
        let displayValue = '';
        let isMoney = false;

        if (type === 'games') {
            value = gameStats.plays || 0;
            displayValue = `${value} игр`;
        } else if (type === 'wins') {
            value = parseFloat(gameStats.max_win || 0);
            displayValue = `${value.toFixed(2)} ₽`;
            isMoney = true;
        }

        const row = document.createElement('div');
        row.className = 'pp-detail-row';
        
        row.innerHTML = `
            <div class="pp-detail-left">
                <img src="${config.icon}" class="pp-detail-icon" alt="${config.name}">
                <span class="pp-detail-name">${config.name}</span>
            </div>
            <div class="pp-detail-value ${isMoney ? 'money' : ''}">${displayValue}</div>
        `;

        listEl.appendChild(row);
    });

    modal.classList.remove('hidden');
}

// --- ПУБЛИЧНЫЙ ПРОФИЛЬ ---
async function openPublicProfile(username) {
    if (!username) return;
    const usernameEl = document.getElementById('pp-page-username');
    if(usernameEl) usernameEl.innerText = username;

    try {
        const userData = await fetchUser(username);
        let userRank = userData?.rank || 'None Rang';
        if (userRank === 'admin' || userRank === 'Владелец') userRank = 'King';

        const rankNameMap = { 'None Rang': 'Без ранга', 'Kitten': 'Котенок', 'Newfag': 'Кот новичок', 'Old Cat': 'Бывалый', 'Street Cat': 'Уличный', 'Horse': 'Победоносец', 'King': 'Король' };
        const rankImgMap = { 'None Rang': 'assets/ranks/rank_kitten.png', 'Kitten': 'assets/ranks/rank_kitten.png', 'Newfag': 'assets/ranks/rank_newfag.png', 'Old Cat': 'assets/ranks/rank_old.png', 'Street Cat': 'assets/ranks/rank_street.png', 'Horse': 'assets/ranks/rank_horse.png', 'King': 'assets/ranks/rank_king.png' };

        document.getElementById('pp-page-rank-name').innerText = rankNameMap[userRank] || userRank;
        document.getElementById('pp-page-rank-img').src = rankImgMap[userRank] || 'assets/ranks/rank_kitten.png';

        const avatarEl = document.getElementById('pp-page-avatar');
        const custom = userData?.customization || {};
        const userAvatarSrc = custom.avatar || userData?.avatar;
        
        if (userAvatarSrc) avatarEl.src = userAvatarSrc;
        else {
            let seed = 0;
            for (let i = 0; i < username.length; i++) seed += username.charCodeAt(i);
            const avatars = ['assets/avatars/orange_cat_ava.png', 'assets/avatars/black_cat_ava.png', 'assets/avatars/grey_cat_ava.png'];
            avatarEl.src = avatars[seed % avatars.length];
        }

        const cardEl = document.querySelector('.user-info-card.public-mode');
        
        if (custom.border && custom.border !== 'none') {
            cardEl.style.setProperty('border', `3px solid ${custom.border}`, 'important');
            cardEl.style.setProperty('box-shadow', `0 0 20px ${custom.border}`, 'important');
        } else {
            cardEl.style.setProperty('border', '1px solid rgba(255, 255, 255, 0.15)', 'important');
            cardEl.style.setProperty('box-shadow', '0 15px 35px rgba(30, 27, 75, 0.25)', 'important');
        }

        const classicGradient = CARD_GRADIENTS['none'];
        cardEl.style.setProperty('background', classicGradient, 'important');

        const oldPattern = cardEl.querySelector('.user-card-pattern');
        if(oldPattern) oldPattern.remove();
        if (custom.pattern && custom.pattern !== 'none') {
            const patternDiv = document.createElement('div');
            patternDiv.className = `user-card-pattern pattern-${custom.pattern}`;
            if (custom.pattern === 'dice') {
                patternDiv.style.backgroundImage = "url('assets/bg/dice_bg1.svg')";
                patternDiv.style.backgroundSize = "60px 60px";
            }
            cardEl.prepend(patternDiv);
        }

        const dateEl = document.getElementById('pp-page-date');
        if(userData?.created_at) {
            const dateObj = new Date(userData.created_at);
            const day = String(dateObj.getDate()).padStart(2, '0');
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const year = dateObj.getFullYear();
            dateEl.innerText = `В игре с ${day}.${month}.${year}`;
        } else {
            dateEl.innerText = `В игре с 01.2024`;
        }

        const stats = await fetchUserStats(username);
        let totalGames = 0;
        let bestWin = 0;
        let favoriteGameKey = null;
        let maxPlays = -1;

        if (stats) {
            for (const [gameType, data] of Object.entries(stats)) {
                if (data.plays) totalGames += data.plays;
                const gameMaxWin = parseFloat(data.max_win || 0);
                if (gameMaxWin > bestWin) bestWin = gameMaxWin;
                if (ACTIVE_GAMES_CONFIG[gameType] && data.plays > maxPlays) {
                    maxPlays = data.plays;
                    favoriteGameKey = gameType;
                }
            }
        }

        const totalGamesEl = document.getElementById('pp-page-total-games');
        totalGamesEl.innerText = totalGames;
        
        const gamesBox = totalGamesEl.closest('.pp-stat-box');
        if(gamesBox) {
            gamesBox.classList.add('clickable');
            gamesBox.onclick = () => showStatDetails('Сыграно игр', 'games', stats || {});
        }

        const bestWinEl = document.getElementById('pp-page-best-win');
        bestWinEl.innerText = `${bestWin.toFixed(2)} ₽`;

        const winBox = bestWinEl.closest('.pp-stat-box');
        if(winBox) {
            winBox.classList.add('clickable');
            winBox.onclick = () => showStatDetails('Максимальный выигрыш', 'wins', stats || {});
        }
        
        const wagerBox = document.querySelector('.pp-stat-box.full');
        if (wagerBox) wagerBox.style.display = 'none';

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
    } catch (error) { console.error("Error loading public profile:", error); }
}

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

/* =========================================
   ИНИЦИАЛИЗАЦИЯ (DOMContentLoaded)
   ========================================= */

document.addEventListener('DOMContentLoaded', async () => {
    applySavedTheme(); 
    
    // Анимация линий кота при загрузке
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
        // Инициализация модулей
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
        
        // --- САЙДБАР ---
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
        
        // --- НИЖНЯЯ ПАНЕЛЬ ---
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
        
        // --- ВЫПАДАЮЩЕЕ ОКНО УВЕДОМЛЕНИЙ ---
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

        // --- ИНИЦИАЛИЗАЦИЯ БЕЙДЖИКА ---
        // Считаем уже существующие непрочитанные уведомления (если есть)
        const unreadCount = document.querySelectorAll('.notif-item.new').length;
        const badge = document.querySelector('.notif-badge');
        if (badge) {
            badge.innerText = unreadCount;
            badge.style.display = unreadCount > 0 ? 'flex' : 'none';
        }

        // Проверка флага входа (для уведомления "Вход выполнен")
        if (sessionStorage.getItem('justLoggedIn')) {
            setTimeout(() => {
                if(typeof window.addAppNotification === 'function') {
                    window.addAppNotification('Вход выполнен', 'Рады видеть вас снова в CashCat!');
                }
                sessionStorage.removeItem('justLoggedIn');
            }, 1000);
        }

        // --- КНОПКИ В ИНТЕРФЕЙСЕ ---
        const backBtn = document.getElementById('pp-back-button');
        if (backBtn) backBtn.addEventListener('click', () => { showSection('lobby'); });

        const vhProfileBtn = document.getElementById('vh-open-profile-btn');
        const visualHistoryModal = document.getElementById('visual-history-modal-overlay');
        const visualHistoryClose = document.getElementById('visual-history-close');
        if (vhProfileBtn) vhProfileBtn.addEventListener('click', () => { if (currentVisualHistoryUser && currentVisualHistoryUser !== '...') { visualHistoryModal.classList.add('hidden'); openPublicProfile(currentVisualHistoryUser); }});
        if (visualHistoryClose) visualHistoryClose.addEventListener('click', () => { visualHistoryModal.classList.add('hidden'); });
        if (visualHistoryModal) visualHistoryModal.addEventListener('click', (e) => { if (e.target === visualHistoryModal) visualHistoryModal.classList.add('hidden'); });

        const detailsModal = document.getElementById('pp-details-modal');
        const detailsClose = document.getElementById('pp-details-close');
        if(detailsClose) detailsClose.addEventListener('click', () => detailsModal.classList.add('hidden'));
        if(detailsModal) detailsModal.addEventListener('click', (e) => { if(e.target === detailsModal) detailsModal.classList.add('hidden') });

        const historyLists = document.querySelectorAll('#bet-history-list, .per-game-history-list');
        historyLists.forEach(list => {
            list.addEventListener('click', (e) => {
                const winCard = e.target.closest('.high-win-card');
                if (winCard) {
                    const usernameEl = winCard.querySelector('.history-user');
                    const amountEl = winCard.querySelector('.history-amount');
                    if (usernameEl && amountEl) openVisualHistoryModal(usernameEl.textContent.trim(), amountEl.textContent.trim(), 'High Win');
                    return;
                }
                const historyItem = e.target.closest('.game-history-item');
                if (historyItem) {
                    const usernameEl = historyItem.querySelector('.history-cell.user');
                    const payoutEl = historyItem.querySelector('.history-cell.payout');
                    if (usernameEl && payoutEl) openVisualHistoryModal(usernameEl.textContent.trim(), payoutEl.textContent.trim(), 'History');
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

    } catch (error) { console.error("INIT ERROR:", error); } finally {
        setTimeout(() => {
            if (loaderOverlay) {
                loaderOverlay.style.opacity = '0';
                loaderOverlay.style.pointerEvents = 'none';
                setTimeout(() => { loaderOverlay.style.display = 'none'; }, 500); 
            }
        }, 3000);
    }
});

/* =========================================
   ЛОГИКА СЛАЙДЕРА (SWIPE & CLICK)
   ========================================= */
document.addEventListener('DOMContentLoaded', () => {
    const sliderContainer = document.getElementById('lobbySlider');
    if (!sliderContainer) return; // Проверка существования слайдера

    const track = document.getElementById('sliderTrack');
    const dots = document.querySelectorAll('.dot');
    const totalSlides = dots.length;
    let currentIndex = 0;
    
    // Переменные для перетаскивания
    let isDragging = false;
    let startPos = 0;
    let currentTranslate = 0;
    let prevTranslate = 0;
    let animationID;
    
    function setPositionByIndex() {
        currentTranslate = currentIndex * -sliderContainer.offsetWidth;
        prevTranslate = currentTranslate;
        setSliderPosition(currentTranslate);
    }

    function setSliderPosition(translate) {
        track.style.transform = `translateX(${translate}px)`;
    }

    function updateDots() {
        dots.forEach(dot => dot.classList.remove('active'));
        if(dots[currentIndex]) dots[currentIndex].classList.add('active');
    }

    window.goToSlide = function(index) {
        currentIndex = index;
        track.style.transition = 'transform 0.4s ease-out';
        setPositionByIndex();
        updateDots();
        setTimeout(() => { track.style.transition = 'none'; }, 400); 
    }

    // --- НОВАЯ ФУНКЦИЯ: Переход к привязке соцсетей при клике ---
    function handleSliderClick() {
        showSection('profile-page');
        if (typeof updateProfileData === 'function') updateProfileData();

        setTimeout(() => {
            const socialSection = document.querySelector('.profile-socials');
            // Ищем заголовок "Соцсети" или сам блок
            const socialHeader = document.querySelector('.profile-subheader.social-header') || 
                                 Array.from(document.querySelectorAll('.profile-subheader')).find(el => el.textContent.includes('Соцсети'));
            
            const target = socialHeader || socialSection;

            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Эффект акцента
                const originalTransform = target.style.transform;
                target.style.transition = 'transform 0.3s ease';
                target.style.transform = 'scale(1.05)';
                setTimeout(() => {
                    target.style.transform = originalTransform || 'scale(1)';
                }, 400);
            }
        }, 150);
    }

    // --- Events ---
    const startDrag = (e) => {
        isDragging = true;
        track.classList.add('dragging');
        startPos = e.type.includes('mouse') ? e.pageX : e.touches[0].clientX;
        track.style.transition = 'none'; 
        cancelAnimationFrame(animationID);
        animationID = requestAnimationFrame(animation);
    }

    const drag = (e) => {
        if (!isDragging) return;
        const currentPosition = e.type.includes('mouse') ? e.pageX : e.touches[0].clientX;
        const diff = currentPosition - startPos;
        currentTranslate = prevTranslate + diff;
        setSliderPosition(currentTranslate);
    }

    const endDrag = (e) => {
        if (!isDragging) return;
        isDragging = false;
        track.classList.remove('dragging');
        cancelAnimationFrame(animationID);
        
        const movedBy = currentTranslate - prevTranslate;
        
        // --- ЛОГИКА КЛИКА ---
        // Если сдвиг меньше 5 пикселей, считаем это кликом
        if (Math.abs(movedBy) < 5) {
            handleSliderClick();
            track.style.transition = 'transform 0.4s ease-out';
            setPositionByIndex();
            return;
        }
        
        // Логика свайпа
        const threshold = sliderContainer.offsetWidth * 0.2; 
        if (movedBy < -threshold && currentIndex < totalSlides - 1) {
            currentIndex++;
        } else if (movedBy > threshold && currentIndex > 0) {
            currentIndex--;
        }
        
        track.style.transition = 'transform 0.4s ease-out';
        setPositionByIndex();
        updateDots();
    }

    setPositionByIndex();
    updateDots();
    
    sliderContainer.addEventListener('touchstart', startDrag, { passive: true });
    sliderContainer.addEventListener('touchend', endDrag);
    sliderContainer.addEventListener('touchmove', drag, { passive: true });
    sliderContainer.addEventListener('mousedown', startDrag);
    sliderContainer.addEventListener('mouseup', endDrag);
    sliderContainer.addEventListener('mouseleave', endDrag);
    sliderContainer.addEventListener('mousemove', drag);
    window.addEventListener('resize', setPositionByIndex);

    function animation() {
        if (isDragging) requestAnimationFrame(animation);
    }
});