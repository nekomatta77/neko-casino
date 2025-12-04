/*
 * GLOBAL.JS - SUPABASE EDITION + SMART ANTI-MINUS SYSTEM
 * v2.4 - Fix 406 & 409 Errors
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
// 0. ANTI-MINUS SYSTEM
// ==========================================

export const AntiMinus = {
    settings: {
        targetRTP: 70, 
        minBankReserve: 1000, 
        adminWinMode: false, 
        active: true 
    },
    stats: { totalIn: 0, totalOut: 0 },

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
    },

    canUserWin(potentialWinAmount, betAmount) {
        if (!this.settings.active) return true; 
        const estimatedBank = 50000 + (this.stats.totalIn - this.stats.totalOut); 
        
        if ((estimatedBank - potentialWinAmount) < this.settings.minBankReserve) {
            return false; 
        }

        const currentTotalBets = this.stats.totalIn + betAmount;
        const currentTotalWins = this.stats.totalOut + potentialWinAmount;
        const projectedRTP = (currentTotalWins / currentTotalBets) * 100;

        if (projectedRTP > this.settings.targetRTP) {
            const multiplier = potentialWinAmount / betAmount;
            if (multiplier < 2.0 && Math.random() > 0.7) return true; 
            return false;
        }
        return true; 
    },

    registerGame(bet, profit) {
        this.stats.totalIn += bet;
        if (profit > 0) this.stats.totalOut += profit;
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
    } catch (e) { console.error("Session storage error", e); }
    updateUI();
}

// ==========================================
// 2. CRUD ОПЕРАЦИИ
// ==========================================

export async function fetchUser(username, updateGlobal = false) {
    if (!supabase) return null;
    try {
        // ИЗМЕНЕНО: используем maybeSingle(), чтобы не было ошибки 406, если юзер не найден
        const { data, error } = await supabase.from('users').select('*').eq('username', username).maybeSingle();
        
        if (error) {
            // Ошибки соединения и т.д., но не "Row not found"
            return null;
        }

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

// --- НОВАЯ ФУНКЦИЯ: Безопасная смена ника ---
export async function changeUsername(currentUsername, newUsername, newFreeChangesVal) {
    if (!supabase) return { error: { message: 'No connection' } };
    
    const updateData = { username: newUsername };
    if (newFreeChangesVal !== null && newFreeChangesVal !== undefined) {
        updateData.free_username_changes = newFreeChangesVal;
    }

    // Пытаемся обновить. Если ник занят, Supabase вернет ошибку 409 (Conflict)
    const { data, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('username', currentUsername)
        .select();

    if (error) {
        return { success: false, error };
    }
    return { success: true, data };
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
// 4. ИСТОРИЯ ИГР
// ==========================================

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

function handleHistoryItemClick(card) {
    const game = card.getAttribute('data-game');
    const username = card.getAttribute('data-username');
    const bet = parseFloat(card.getAttribute('data-bet'));
    const result = card.getAttribute('data-result');
    const profit = parseFloat(card.getAttribute('data-profit'));

    if (game === 'dice') {
        openVisualHistoryModal('dice', { username, bet, result, profit });
    } else if (game === 'mines') {
        openVisualHistoryModal('mines', { username, bet, result, profit });
    } else if (game === 'keno') {
        openVisualHistoryModal('keno', { username, bet, result, profit });
    }
}

// --- ГЕНЕРАТОР ВИЗУАЛЬНОЙ ИСТОРИИ ---
function openVisualHistoryModal(game, data) {
    const modal = document.getElementById('visual-history-modal-overlay');
    const container = document.getElementById('visual-history-grid-container');
    if (!modal || !container) return;

    container.innerHTML = '';
    container.className = 'visual-grid-container'; 

    document.getElementById('vh-username').textContent = data.username;
    document.getElementById('vh-bet').textContent = `${data.bet.toFixed(2)} RUB`;
    document.getElementById('vh-profit').textContent = `${data.profit.toFixed(2)} RUB`;
    
    const extraLabel = document.getElementById('vh-extra-label');
    const extraValue = document.getElementById('vh-extra-value');
    extraLabel.textContent = '';
    extraValue.textContent = '';

    if (game === 'mines') {
        let minesCount = 3;
        const match = data.result.match(/\((\d+)\s*Mines\)/);
        if (match) minesCount = parseInt(match[1]);

        extraLabel.textContent = 'Кол-во мин:';
        extraValue.textContent = minesCount;

        let realMines = null;
        let realRevealed = null;
        
        if (data.result.includes(':::')) {
            try {
                const parts = data.result.split(':::')[1]; 
                const segments = parts.split(';');
                segments.forEach(seg => {
                    const [key, vals] = seg.split(':');
                    if(key === 'm') realMines = vals ? vals.split(',').map(Number) : [];
                    if(key === 'r') realRevealed = vals ? vals.split(',').map(Number) : [];
                });
            } catch(e) { console.error("Error parsing history", e); }
        }

        generateMinesVisual(container, minesCount, data.profit > 0, realMines, realRevealed);

    } else if (game === 'keno') {
        let risk = 'Classic';
        let hits = 0;
        let total = 10;
        let realSelected = null;
        let realDrawn = null;
        
        const mainParts = data.result.split(':::');
        const infoPart = mainParts[0]; 
        
        if (mainParts.length > 1) {
            try {
                const dataPart = mainParts[1];
                const segments = dataPart.split(';');
                segments.forEach(seg => {
                    const [key, vals] = seg.split(':');
                    if(key.trim() === 's') realSelected = vals ? vals.split(',').map(Number) : [];
                    if(key.trim() === 'd') realDrawn = vals ? vals.split(',').map(Number) : [];
                });
            } catch(e) { console.error("Error parsing Keno history", e); }
        }

        const infoSegments = infoPart.split('|');
        if (infoSegments.length > 0) risk = infoSegments[0].trim();
        if (infoSegments.length > 1) {
            const score = infoSegments[1].trim().split('/');
            if (score.length === 2) {
                hits = parseInt(score[0]);
                total = parseInt(score[1]);
            }
        }
        
        const difficultyMap = {
            'Easy': 'Легкая', 'Medium': 'Средняя', 'High': 'Сложная',
            'easy': 'Легкая', 'medium': 'Средняя', 'high': 'Сложная'
        };
        const ruRisk = difficultyMap[risk] || risk;

        extraLabel.innerHTML = `Сложность:<br>Совпадения:`;
        extraValue.innerHTML = `${ruRisk}<br>${hits} из ${total}`;

        generateKenoVisual(container, hits, total, realSelected, realDrawn);

    } else if (game === 'dice') {
        const parts = data.result.split('|');
        let rolled = parts[0]?.trim() || "???";
        let chance = parts[1]?.trim() || "---%";
        let direction = parts[2]?.trim() || "";
        
        if (direction === '<') direction = "Меньше";
        else if (direction === '>') direction = "Больше";

        generateDiceVisual(container, {
            rolled: rolled,
            chance: chance,
            direction: direction,
            bet: data.bet,
            profit: data.profit
        });
        
        extraLabel.textContent = '';
        extraValue.textContent = '';
    }

    modal.classList.remove('hidden');
    
    const closeBtn = document.getElementById('visual-history-close');
    if(closeBtn) closeBtn.onclick = () => modal.classList.add('hidden');
    modal.onclick = (e) => { if (e.target === modal) modal.classList.add('hidden'); }
}

function generateMinesVisual(container, minesCount, isWin, realMines, realRevealed) {
    container.className = 'visual-grid-container mines-visual';
    const totalCells = 25;
    let cells = Array(totalCells).fill('safe-closed'); 

    if (realMines && realRevealed) {
        for(let i=0; i<totalCells; i++) {
            if (realRevealed.includes(i)) {
                cells[i] = 'safe-opened'; 
            } else if (realMines.includes(i)) {
                cells[i] = 'bomb'; 
            }
        }
    } else {
        let minesPlaced = 0;
        while(minesPlaced < minesCount) {
            const idx = Math.floor(Math.random() * totalCells);
            if(cells[idx] === 'safe-closed') {
                cells[idx] = 'bomb';
                minesPlaced++;
            }
        }
        const safeIndices = cells.map((type, idx) => type === 'safe-closed' ? idx : -1).filter(i => i !== -1);
        let toOpenCount = isWin ? Math.floor(Math.random() * 5) + 3 : Math.floor(Math.random() * 2) + 1;
        toOpenCount = Math.min(toOpenCount, safeIndices.length);
        for(let i=0; i<toOpenCount; i++) {
            if(safeIndices.length === 0) break;
            const randPick = Math.floor(Math.random() * safeIndices.length);
            const cellIdx = safeIndices.splice(randPick, 1)[0];
            cells[cellIdx] = 'safe-opened'; 
        }
    }

    cells.forEach(type => {
        const div = document.createElement('div');
        div.className = `visual-cell mine-cell ${type}`;
        const img = document.createElement('img');
        img.className = 'mine-cell-icon';
        if (type === 'bomb') img.src = 'assets/mines_mine.png';
        else img.src = 'assets/mines_fish.png';
        div.appendChild(img);
        container.appendChild(div);
    });
}

function generateKenoVisual(container, hits, totalPicks, realSelected, realDrawn) {
    container.className = 'visual-grid-container keno-visual';
    const totalCells = 40;
    
    let selectedSet = new Set();
    let drawnSet = new Set();

    if (realSelected && realDrawn) {
        selectedSet = new Set(realSelected);
        drawnSet = new Set(realDrawn);
    } else {
        while(selectedSet.size < totalPicks) selectedSet.add(Math.floor(Math.random() * totalCells) + 1);
        const picksArray = Array.from(selectedSet);
        for (let i = picksArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [picksArray[i], picksArray[j]] = [picksArray[j], picksArray[i]];
        }
        for(let i=0; i<hits; i++) drawnSet.add(picksArray[i]);
        while(drawnSet.size < 10) {
            const r = Math.floor(Math.random() * totalCells) + 1;
            if(!drawnSet.has(r)) drawnSet.add(r);
        }
    }

    for(let i=1; i<=totalCells; i++) {
        const div = document.createElement('div');
        div.className = 'visual-cell keno-cell';
        div.textContent = i;
        
        if (selectedSet.has(i)) {
            if (drawnSet.has(i)) {
                div.classList.add('hit'); 
                div.innerHTML = `<img src="assets/keno_paw.png" class="keno-cell-icon" style="width:80%; height:80%;">`;
            } else {
                div.classList.add('miss');
            }
        } else if (drawnSet.has(i)) {
            div.classList.add('drawn-history');
        }
        container.appendChild(div);
    }
}

function generateDiceVisual(container, data) {
    container.className = 'visual-grid-container dice-visual-box';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '15px';
    container.style.padding = '15px';
    container.style.background = 'transparent'; 
    container.style.boxShadow = 'none';

    const progressBar = document.createElement('div');
    progressBar.className = 'dice-visual-bar-container';
    
    const resultPercent = Math.min(100, Math.max(0, (parseInt(data.rolled) / 1000000) * 100));
    const fillBar = document.createElement('div');
    fillBar.className = 'dice-visual-bar-fill';
    fillBar.style.width = `${resultPercent}%`;
    
    progressBar.appendChild(fillBar);
    
    const statsGrid = document.createElement('div');
    statsGrid.style.display = 'grid';
    statsGrid.style.gridTemplateColumns = '1fr 1fr';
    statsGrid.style.gap = '10px';
    
    const createStatItem = (label, value) => {
        const div = document.createElement('div');
        div.style.background = '#2E3035';
        div.style.padding = '10px';
        div.style.borderRadius = '8px';
        div.style.textAlign = 'center';
        div.innerHTML = `
            <div style="font-size: 0.8em; color: #4F46E5; margin-bottom: 4px; font-weight: bold;">${label}</div>
            <div style="font-size: 1.1em; color: #4F46E5; font-weight: bold;">${value}</div>
        `;
        return div;
    };

    statsGrid.appendChild(createStatItem("Выпало", data.rolled));
    statsGrid.appendChild(createStatItem("Ставка", data.direction));
    statsGrid.appendChild(createStatItem("Шанс", data.chance));
    const winText = data.profit > 0 ? `+${data.profit.toFixed(2)}` : "0.00";
    statsGrid.appendChild(createStatItem("Выигрыш", winText));

    container.appendChild(progressBar);
    container.appendChild(statsGrid);
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