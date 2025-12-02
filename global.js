/*
 * GLOBAL.JS - SUPABASE EDITION + SMART ANTI-MINUS SYSTEM
 */

// Инициализация Supabase
const SUPABASE_URL = 'https://jqkaqluzauhsdfhvhowb.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impxa2FxbHV6YXVoc2RmaHZob3diIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0OTczNzMsImV4cCI6MjA3OTA3MzM3M30.tXqrCLyRZWNfgoeSxNpE1RiEQyh8Vlh3dVU_-Le-vVk';

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

let supabase = null;
try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
} catch (e) {
    console.error("Supabase init error:", e);
}

// --- Глобальные переменные ---
export let currentUser = null;
export let currentBalance = 0.00;
export let currentRank = 'None Rang'; 
let localWagerBalance = 0.00; 

export const MINES_GRID_SIZE = 25; 

let depositPoller = null;
let withdrawalPoller = null;

// ==========================================
// 0. ANTI-MINUS SYSTEM (THE BRAIN)
// ==========================================

export const AntiMinus = {
    settings: {
        targetRTP: 70, // % который возвращается игрокам
        minBankReserve: 1000, // Минимальный резерв
        adminWinMode: false, 
        active: true 
    },
    
    stats: {
        totalIn: 0, 
        totalOut: 0 
    },

    async init() {
        const savedSettings = localStorage.getItem('cashcat_antiminus_settings');
        if (savedSettings) {
            this.settings = JSON.parse(savedSettings);
        }
        
        if (supabase) {
            const { data: bets } = await supabase.from('bets').select('bet_amount, profit_amount');
            if (bets) {
                let totalBet = 0;
                let totalWon = 0;
                bets.forEach(b => {
                    totalBet += b.bet_amount;
                    if (b.profit_amount > 0) totalWon += b.profit_amount;
                });
                this.stats.totalIn = totalBet;
                this.stats.totalOut = totalWon;
            }
        }
    },

    saveSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        localStorage.setItem('cashcat_antiminus_settings', JSON.stringify(this.settings));
        console.log("Anti-Minus Updated:", this.settings);
    },

    canUserWin(potentialWinAmount, betAmount) {
        if (!this.settings.active) return true; 
        const estimatedBank = 50000 + (this.stats.totalIn - this.stats.totalOut); 
        
        if ((estimatedBank - potentialWinAmount) < this.settings.minBankReserve) {
            console.warn("Anti-Minus: Bank protection triggered!");
            return false; 
        }

        const currentTotalBets = this.stats.totalIn + betAmount;
        const currentTotalWins = this.stats.totalOut + potentialWinAmount;
        const projectedRTP = (currentTotalWins / currentTotalBets) * 100;

        console.log(`[Anti-Minus] Projected RTP: ${projectedRTP.toFixed(2)}% | Target: ${this.settings.targetRTP}%`);

        if (projectedRTP > this.settings.targetRTP) {
            const multiplier = potentialWinAmount / betAmount;
            if (multiplier < 2.0 && Math.random() > 0.7) return true; 
            console.warn("Anti-Minus: RTP Limit triggered. Forcing Loss.");
            return false;
        }

        return true; 
    },

    registerGame(bet, profit) {
        this.stats.totalIn += bet;
        if (profit > 0) {
            this.stats.totalOut += profit;
        }
    }
};

AntiMinus.init();

// ==========================================
// 1. УПРАВЛЕНИЕ СЕССИЕЙ
// ==========================================

export function getSessionUser() {
    try { return localStorage.getItem('nekoUserSession'); } catch (e) { return null; }
}

export async function setCurrentUser(username) {
    try {
        if (username) {
            localStorage.setItem('nekoUserSession', username);
            currentUser = username;
            await fetchUser(username, true); 
        } else {
            localStorage.removeItem('nekoUserSession');
            currentUser = null;
            currentBalance = 0.00;
            currentRank = 'None Rang';
            localWagerBalance = 0.00;
        }
    } catch (e) {
         console.error("Session storage error", e);
    }
    updateUI();
}

// ==========================================
// 2. CRUD ОПЕРАЦИИ
// ==========================================

export async function fetchUser(username, updateGlobal = false) {
    if (!supabase) return null;
    try {
        const { data, error } = await supabase.from('users').select('*').eq('username', username).single();
        if (error) return null;

        if (updateGlobal && data) {
            currentBalance = parseFloat(data.balance || 0);
            currentRank = data.rank || 'None Rang';
            localWagerBalance = parseFloat(data.wager_balance || 0);
            updateUI();
            setLocalWager(localWagerBalance);
            
            if (data.customization) {
                import('./customize.js').then(module => {
                    module.applyCustomization(data.customization);
                }).catch(err => console.log("Customize load err", err));
                
                const themeStyle = document.getElementById('theme-style');
                if (themeStyle && data.customization.theme) {
                    const dbTheme = data.customization.theme;
                    if (dbTheme === 'light') themeStyle.disabled = true;
                    else themeStyle.disabled = false;
                    localStorage.setItem('cashcat_theme', dbTheme);
                }
            }
        }
        return data;
    } catch (err) { return null; }
}

export async function fetchUserStats(username) {
    if (!supabase) return { totalDeposits: 0, totalWithdrawals: 0, totalWager: 0 };
    const { data: deposits } = await supabase.from('deposits').select('amount').eq('username', username).eq('status', 'Success'); 
    const totalDeposits = deposits ? deposits.reduce((sum, item) => sum + (item.amount || 0), 0) : 0;
    const { data: withdrawals } = await supabase.from('withdrawals').select('amount').eq('username', username).eq('status', 'Success');
    const totalWithdrawals = withdrawals ? withdrawals.reduce((sum, item) => sum + (item.amount || 0), 0) : 0;
    const { data: bets } = await supabase.from('bets').select('bet_amount').eq('username', username);
    const totalWager = bets ? bets.reduce((sum, item) => sum + (item.bet_amount || 0), 0) : 0;
    return { totalDeposits, totalWithdrawals, totalWager };
}

export async function fetchAllUsers() {
    if (!supabase) return [];
    const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    return error ? [] : data;
}

export async function updateUser(username, userData) {
    if (!supabase) return false;
    const dataToInsert = { username, ...userData, created_at: new Date().toISOString() };
    const { error } = await supabase.from('users').insert([dataToInsert]);
    return !error;
}

export async function patchUser(username, partialData) {
    if (!supabase) return false;
    const { error } = await supabase.from('users').update(partialData).eq('username', username);
    return !error;
}

export async function deleteUser(username) {
    if (!supabase) return false;
    const { error } = await supabase.from('users').delete().eq('username', username);
    return !error;
}

// ==========================================
// 3. УПРАВЛЕНИЕ БАЛАНСОМ
// ==========================================

export async function updateBalance(amount, wagerToAdd = 0) {
    if (!currentUser || !supabase) return;
    currentBalance += amount;
    localWagerBalance = Math.max(0, localWagerBalance + wagerToAdd);
    updateUI(); 
    setLocalWager(localWagerBalance);
    try {
        await supabase.rpc('update_balance_atomic', { p_username: currentUser, p_amount_change: amount, p_wager_change: wagerToAdd });
    } catch (err) { console.error("RPC call failed", err); }
}

export async function reduceWager(betAmount) {
    if (!currentUser) return;
    await updateBalance(0, -betAmount);
}

export function setLocalWager(amount) {
    const wagerEl = document.getElementById('wallet-wager-status');
    const profileWagerEl = document.getElementById('profile-wager-amount');
    if (wagerEl) {
        if (amount > 0) {
            wagerEl.textContent = `Вейджер: ${amount.toFixed(2)} RUB`;
            wagerEl.classList.remove('hidden');
        } else wagerEl.classList.add('hidden');
    }
    if (profileWagerEl) profileWagerEl.textContent = amount.toFixed(2);
}

// ==========================================
// 4. ИСТОРИЯ ИГР (ОБНОВЛЕННАЯ ЛОГИКА КЛИКОВ)
// ==========================================

// Глобальный слушатель кликов (делегирование)
document.addEventListener('click', (e) => {
    const card = e.target.closest('.high-win-card');
    if (card) {
        handleHistoryItemClick(card);
    }
});


export async function writeBetToHistory(betData) {
    AntiMinus.registerGame(betData.betAmount, betData.amount);
    if (!supabase) return;
    const { error } = await supabase.from('bets').insert([{
        username: betData.username,
        game: betData.game,
        result: betData.result,
        bet_amount: betData.betAmount,
        profit_amount: betData.amount, 
        multiplier: betData.multiplier,
        created_at: new Date().toISOString()
    }]);
    if (!error) fetchAndRenderHistory();
}

export async function fetchAndRenderHistory() {
    if (!supabase) return;
    const { data: recentBets } = await supabase.from('bets').select('*').order('created_at', { ascending: false }).limit(50);
    if (recentBets) renderHistoryList(recentBets, 'recent');
    const { data: highWinsCandidates } = await supabase.from('bets').select('*').gt('profit_amount', 0).order('profit_amount', { ascending: false }).limit(50);
    if (highWinsCandidates) {
        const highWins = highWinsCandidates.filter(bet => {
            const multValue = parseFloat(bet.multiplier.replace('x', '')) || 0;
            return multValue >= 5.0 && bet.profit_amount >= 1000;
        }).slice(0, 10);
        highWins.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        renderHistoryList(highWins, 'highwins');
    }
}

function renderHistoryList(bets, type) {
    let targets = [];
    if (type === 'highwins') {
        const lobbyList = document.getElementById('bet-history-list');
        if (lobbyList) targets.push(lobbyList);
    } else {
        targets = [
            document.getElementById('dice-history-list'),
            document.getElementById('mines-history-list'),
            document.getElementById('crash-history-list'),
            document.getElementById('coin-history-list'),
            document.getElementById('keno-history-list'),
            document.getElementById('sleepy-history-list'),
            document.getElementById('wheel-history-list')
        ].filter(el => el !== null);
    }
    
    const listGameMap = {
        'dice-history-list': 'dice', 'mines-history-list': 'mines', 'crash-history-list': 'crash',
        'coin-history-list': 'coin', 'keno-history-list': 'keno', 'sleepy-history-list': 'sleepy',
        'wheel-history-list': 'wheel'
    };

    targets.forEach(list => {
        let betsToRender = bets;
        if (type !== 'highwins') {
            const requiredGame = listGameMap[list.id];
            if (requiredGame) betsToRender = bets.filter(b => b.game === requiredGame);
        }
        
        const html = betsToRender.map(bet => {
            const isWin = bet.profit_amount >= 0;
            const winClass = isWin ? 'win' : 'loss';
            const totalWin = bet.bet_amount + bet.profit_amount;
            const displayAmountVal = isWin ? `+${totalWin.toFixed(2)}` : `0.00`;
            
            let gameIconSrc = 'assets/dice_icon.png';
            if (bet.game === 'mines') gameIconSrc = 'assets/mine_icon.png';
            else if (bet.game === 'crash') gameIconSrc = 'assets/crash_icon.png';
            else if (bet.game === 'coin') gameIconSrc = 'assets/coin_icon.png';
            else if (bet.game === 'keno') gameIconSrc = 'assets/keno_icon.png';
            else if (bet.game === 'sleepy') gameIconSrc = 'assets/sleepy_icon.png'; 
            else if (bet.game === 'wheel') gameIconSrc = 'assets/wheel_icon.png';

            // Добавляем data-атрибуты для клика
            const dataAttrs = `data-game="${bet.game}" data-username="${bet.username}" data-bet="${bet.bet_amount}" data-result="${bet.result}" data-profit="${totalWin}"`;

            if (type === 'highwins') {
                return `
                    <li class="high-win-card" ${dataAttrs} style="cursor: pointer;">
                        <div class="history-item-content">
                            <img src="${gameIconSrc}" class="history-game-img-icon" alt="${bet.game}">
                            <div class="high-win-info">
                                <span class="history-user">${bet.username}</span>
                                <span class="history-multiplier-tag">${bet.multiplier}</span>
                            </div>
                            <span class="history-amount win">
                                ${displayAmountVal}
                                <span class="high-win-currency">RUB</span>
                            </span>
                        </div>
                    </li>
                `;
            } else {
                return `
                    <li class="game-history-item ${winClass}">
                         <span class="history-cell user">${bet.username}</span>
                         <span class="history-cell bet">${bet.bet_amount.toFixed(2)}</span>
                         <span class="history-cell multiplier">${bet.multiplier || '-'}</span>
                         <span class="history-cell payout">${displayAmountVal} RUB</span>
                    </li>
                `;
            }
        }).join('');

        if (html.length === 0) list.innerHTML = '<div class="ref-list-placeholder">Нет записей</div>';
        else {
            list.innerHTML = html;
        }
    });
}

// --- ЛОГИКА КЛИКА ПО ИСТОРИИ ---
function handleHistoryItemClick(card) {
    const game = card.getAttribute('data-game');
    const username = card.getAttribute('data-username');
    const bet = parseFloat(card.getAttribute('data-bet'));
    const result = card.getAttribute('data-result');
    const profit = parseFloat(card.getAttribute('data-profit'));

    if (game === 'dice') {
        // 1. Dice: Открыть Hash Modal (Check Game), но с ником в заголовке
        const hashModal = document.getElementById('hash-modal-overlay');
        if (hashModal) {
            document.getElementById('hash-modal-game-id').textContent = username; // Замена ID на Ник
            // Заполняем фейковыми/частичными данными, так как хеша нет в БД
            document.getElementById('hash-modal-bet').textContent = `${bet.toFixed(2)} RUB`;
            document.getElementById('hash-modal-result').textContent = profit > 0 ? 'Выигрыш' : 'Проигрыш';
            // Скрываем технические поля, которых нет
            document.getElementById('hash-modal-combined').textContent = "Hidden (Archive)";
            document.getElementById('hash-modal-hash').textContent = "Hidden (Archive)";
            hashModal.classList.remove('hidden');
        }

    } else if (game === 'mines') {
        // 2. Mines: Визуализация мин
        openVisualHistoryModal('mines', { username, bet, result, profit });

    } else if (game === 'keno') {
        // 3. Keno: Визуализация кено
        openVisualHistoryModal('keno', { username, bet, result, profit });
    }
}

// --- ГЕНЕРАТОР ВИЗУАЛЬНОЙ ИСТОРИИ ---
function openVisualHistoryModal(game, data) {
    const modal = document.getElementById('visual-history-modal-overlay');
    const container = document.getElementById('visual-history-grid-container');
    if (!modal || !container) return;

    // Заполняем футер
    document.getElementById('vh-username').textContent = data.username;
    document.getElementById('vh-bet').textContent = `${data.bet.toFixed(2)} RUB`;
    document.getElementById('vh-profit').textContent = `${data.profit.toFixed(2)} RUB`;

    container.innerHTML = ''; // Очистка

    if (game === 'mines') {
        // Парсим результат: "(3 Mines) 2.45x" -> mines=3
        let minesCount = 3; // Default
        const match = data.result.match(/\((\d+)\s*Mines\)/);
        if (match) minesCount = parseInt(match[1]);

        document.getElementById('vh-extra-label').textContent = 'Кол-во мин:';
        document.getElementById('vh-extra-value').textContent = minesCount;

        // Генерируем сетку 5x5
        generateMinesVisual(container, minesCount);

    } else if (game === 'keno') {
        // Парсим: "Easy | 4/10"
        let risk = 'Classic';
        let hits = 0;
        let total = 10;
        
        const parts = data.result.split('|');
        if (parts.length > 0) risk = parts[0].trim();
        if (parts.length > 1) {
            const score = parts[1].trim().split('/');
            if (score.length === 2) {
                hits = parseInt(score[0]);
                total = parseInt(score[1]);
            }
        }

        document.getElementById('vh-extra-label').textContent = 'Сложность / Совпадения:';
        document.getElementById('vh-extra-value').textContent = `${risk} (${hits}/${total})`;

        // Генерируем сетку 8x5
        generateKenoVisual(container, hits, total);
    }

    modal.classList.remove('hidden');
    
    // Закрытие
    const closeBtn = document.getElementById('visual-history-close');
    if(closeBtn) {
        closeBtn.onclick = () => modal.classList.add('hidden');
    }
    modal.onclick = (e) => {
        if (e.target === modal) modal.classList.add('hidden');
    }
}

function generateMinesVisual(container, minesCount) {
    container.className = 'visual-grid-container mines-visual'; // Для CSS
    const totalCells = 25;
    
    // Создаем случайное поле: где мины, где звезды
    let cells = Array(totalCells).fill('safe');
    
    // Расставляем мины случайно
    let placed = 0;
    while(placed < minesCount) {
        const idx = Math.floor(Math.random() * totalCells);
        if(cells[idx] === 'safe') {
            cells[idx] = 'mine';
            placed++;
        }
    }

    // Рисуем
    cells.forEach(type => {
        const div = document.createElement('div');
        div.className = 'visual-cell mine-cell';
        if (type === 'safe') {
            div.classList.add('safe');
            div.innerHTML = `<img src="assets/mines_fish.png" class="mine-cell-icon">`;
        } else {
            // В выигрышной истории мы обычно показываем, где были мины (серые/прозрачные), 
            // либо если игрок проиграл - взрыв.
            // Для красоты покажем просто иконки мин.
            div.classList.add('revealed-mine'); 
            div.innerHTML = `<img src="assets/mines_mine.png" class="mine-cell-icon" style="opacity:0.5">`;
        }
        container.appendChild(div);
    });
}

function generateKenoVisual(container, hits, totalPicks) {
    container.className = 'visual-grid-container keno-visual';
    const totalCells = 40;
    
    // 1. Выбираем случайные числа, которые выбрал игрок (totalPicks)
    let playerPicks = new Set();
    while(playerPicks.size < totalPicks) {
        playerPicks.add(Math.floor(Math.random() * totalCells) + 1);
    }
    
    // 2. Из них выбираем 'hits' выигрышных
    let hitNumbers = new Set();
    const picksArray = Array.from(playerPicks);
    // Перемешиваем
    for (let i = picksArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [picksArray[i], picksArray[j]] = [picksArray[j], picksArray[i]];
    }
    // Берем первые N как совпадения
    for(let i=0; i<hits; i++) hitNumbers.add(picksArray[i]);

    // Рисуем 1..40
    for(let i=1; i<=totalCells; i++) {
        const div = document.createElement('div');
        div.className = 'visual-cell keno-cell';
        div.textContent = i;
        
        if (playerPicks.has(i)) {
            if (hitNumbers.has(i)) {
                div.classList.add('hit'); // Зеленый (совпало)
                div.innerHTML = `<img src="assets/keno_paw.png" class="keno-cell-icon">`;
            } else {
                div.classList.add('miss'); // Желтый/Серый (мимо)
            }
        }
        container.appendChild(div);
    }
}


export async function clearBetHistory() {
    if (!supabase) return false;
    const { error } = await supabase.from('bets').delete().neq('id', 0); 
    return !error;
}
export async function fetchUserDepositHistory(username) { return []; }
export async function fetchUserWithdrawalHistory(username) { return []; }
export function startDepositHistoryPoller() {}
export function stopDepositHistoryPoller() {}
export function startWithdrawalHistoryPoller() {}
export function stopWithdrawalHistoryPoller() {}
export async function createPromocode(code, data) { return true; }
export async function activatePromocode(code) { return {success:true}; }

export function showSection(sectionId) {
    const allSections = document.querySelectorAll('.page-section');
    allSections.forEach(el => {
        if (el.id === sectionId) {
            el.classList.remove('hidden');
            el.classList.add('active');
        } else {
            el.classList.add('hidden');
            el.classList.remove('active');
        }
    });

    const navItems = document.querySelectorAll('.bottom-nav-item');
    navItems.forEach(el => {
        el.classList.remove('active');
        if(el.getAttribute('data-target') === sectionId) el.classList.add('active');
    });
    
    const gameNav = document.getElementById('top-game-nav');
    if (gameNav) {
        if (sectionId.endsWith('-game')) {
            gameNav.classList.remove('hidden');
        } else {
            gameNav.classList.add('hidden');
        }
    }

    setTimeout(() => {
        if (sectionId === 'lobby' || sectionId.endsWith('-game')) {
            fetchAndRenderHistory();
        }
    }, 0);
}

function updateUI() {
    const balanceElements = document.querySelectorAll('#balance-amount, #mobile-profile-balance, #profile-balance-amount');
    const usernameElements = document.querySelectorAll('#username-display, #mobile-profile-name, #profile-username');
    const profileBox = document.getElementById('header-profile-box');
    const notifBox = document.getElementById('header-notif-box'); 
    const guestBox = document.getElementById('header-guest-box');
    const adminSidebarLink = document.getElementById('admin-sidebar-link');

    if (currentUser) {
        balanceElements.forEach(el => el.textContent = currentBalance.toFixed(2) + ' RUB');
        usernameElements.forEach(el => el.textContent = currentUser);
        document.body.classList.add('logged-in');
        document.body.classList.remove('logged-out');
        if (profileBox) profileBox.classList.remove('hidden');
        if (notifBox) notifBox.classList.remove('hidden'); 
        if (guestBox) guestBox.classList.add('hidden');
        
        if (currentRank === 'admin' || currentRank === 'Владелец') {
            if (adminSidebarLink) adminSidebarLink.classList.remove('hidden');
        } else {
            if (adminSidebarLink) adminSidebarLink.classList.add('hidden');
        }
    } else {
        balanceElements.forEach(el => el.textContent = '0.00');
        usernameElements.forEach(el => el.textContent = 'Гость');
        document.body.classList.add('logged-out');
        document.body.classList.remove('logged-in');
        if (profileBox) profileBox.classList.add('hidden');
        if (notifBox) notifBox.classList.add('hidden'); 
        if (guestBox) guestBox.classList.remove('hidden');
        if (adminSidebarLink) adminSidebarLink.classList.add('hidden');
    }
}