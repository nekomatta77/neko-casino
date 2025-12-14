/*
 * GLOBAL.JS - VERSION 7.1 (STABLE PKCE FIX)
 */

// --- 1. Инициализация Firebase (CDN) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, collection, getDocs, getDoc, addDoc, setDoc, 
    updateDoc, doc, query, where, orderBy, limit, runTransaction, deleteDoc,
    serverTimestamp, increment 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- КОНФИГ FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyCtHq6ELr7-EpwGD9B91MLPuEwR3BOsqwI",
  authDomain: "neko-casino-52954.firebaseapp.com",
  projectId: "neko-casino-52954",
  storageBucket: "neko-casino-52954.firebasestorage.app",
  messagingSenderId: "793769920582",
  appId: "1:793769920582:web:ff8baf0f561cb9308b2247",
  measurementId: "G-MC70DY0W34"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- Глобальные переменные ---
export let currentUser = null;
export let currentBalance = 0.00;
export let currentRank = 'None Rang'; 
let localWagerBalance = 0.00; 

export const MINES_GRID_SIZE = 25; 

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
        
        try {
            const betsRef = collection(db, "bets");
            const q = query(betsRef, orderBy("created_at", "desc"), limit(50));
            const querySnapshot = await getDocs(q);
            
            let totalBet = 0;
            let totalWon = 0;
            
            querySnapshot.forEach((doc) => {
                const b = doc.data();
                totalBet += b.bet_amount || 0;
                if (b.profit_amount > 0) totalWon += b.profit_amount;
            });
            
            if (totalBet === 0) {
                this.stats.totalIn = 5000; 
                this.stats.totalOut = 1000;
            } else {
                this.stats.totalIn = totalBet;
                this.stats.totalOut = totalWon;
            }
        } catch (e) {
            console.error("AntiMinus init warning:", e);
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
// 2. CRUD ОПЕРАЦИИ (Firestore)
// ==========================================

async function getUserDocRef(username) {
    const q = query(collection(db, "users"), where("username", "==", username));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        return querySnapshot.docs[0].ref;
    }
    return null;
}

export async function updateAchievementProgress(username, achievementId, targetVal) {
    if (!username) return;
    
    try {
        const userRef = await getUserDocRef(username);
        if (!userRef) return;

        const updateKey = `achievements_data.${achievementId}.current`;
        await updateDoc(userRef, {
            [updateKey]: increment(1)
        });

        const snap = await getDoc(userRef);
        const data = snap.data();
        
        const currentVal = data.achievements_data?.[achievementId]?.current || 0;
        const isUnlocked = data.achievements_data?.[achievementId]?.unlocked || false;

        if (currentVal >= targetVal && !isUnlocked) {
            const unlockKey = `achievements_data.${achievementId}.unlocked`;
            await updateDoc(userRef, {
                [unlockKey]: true
            });
            return { success: true, justUnlocked: true };
        }
        
        return { success: true, justUnlocked: false };
    } catch (e) {
        console.error("Achievement update error:", e);
        return { success: false, justUnlocked: false };
    }
}

export async function fetchUser(username, updateGlobal = false) {
    try {
        const q = query(collection(db, "users"), where("username", "==", username));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) return null;

        const userDoc = querySnapshot.docs[0];
        const data = userDoc.data();

        if (updateGlobal && data) {
            currentBalance = parseFloat(data.balance || 0);
            currentRank = data.rank || 'None Rang';
            localWagerBalance = Math.max(0, parseFloat(data.wager_balance || 0));
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
    } catch (err) { 
        console.error("Fetch User Error:", err);
        return null; 
    }
}

// --- ВЕРНУЛАСЬ: Поиск по TG ID ---
export async function fetchUserByTelegramId(tgId) {
    try {
        const q = query(collection(db, "users"), where("tg_id", "==", String(tgId)));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) return null;
        return querySnapshot.docs[0].data();
    } catch (err) { 
        console.error("Fetch User By TG Error:", err);
        return null; 
    }
}

export async function fetchUserStats(username) {
    try {
        const docRef = doc(db, "user_stats", username);
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? docSnap.data() : null;
    } catch (error) {
        console.error("Error fetching user stats:", error);
        return null;
    }
}

export async function updateUserGameStats(username, gameType, winAmount) {
    if (!username) return;
    const statRef = doc(db, "user_stats", username);
    try {
        const snap = await getDoc(statRef);
        let data = snap.exists() ? snap.data() : {};
        let gameData = data[gameType] || { plays: 0, max_win: 0 };
        gameData.plays = (gameData.plays || 0) + 1;
        if (winAmount > (gameData.max_win || 0)) {
            gameData.max_win = winAmount;
        }
        await setDoc(statRef, { [gameType]: gameData }, { merge: true });
    } catch (error) {
        console.error("Error updating game stats:", error);
    }
}

export async function fetchAllUsers() {
    try {
        const q = query(collection(db, "users"), orderBy("created_at", "desc"), limit(50));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => doc.data());
    } catch (e) { return []; }
}

export async function updateUser(username, userData) {
    try {
        await addDoc(collection(db, "users"), {
            username,
            ...userData,
            created_at: new Date().toISOString()
        });
        return true;
    } catch (e) { return false; }
}

export async function patchUser(username, partialData) {
    try {
        const userRef = await getUserDocRef(username);
        if (userRef) {
            await updateDoc(userRef, partialData);
            return true;
        }
        return false;
    } catch (e) { return false; }
}

export async function changeUsername(currentUsername, newUsername, newFreeChangesVal) {
    try {
        const checkQ = query(collection(db, "users"), where("username", "==", newUsername));
        const checkSnap = await getDocs(checkQ);
        if (!checkSnap.empty) {
            return { success: false, error: { code: '23505', message: 'Username taken' } };
        }

        const userRef = await getUserDocRef(currentUsername);
        if (!userRef) return { success: false, error: { message: 'User not found' } };

        const updateData = { username: newUsername };
        if (newFreeChangesVal !== null && newFreeChangesVal !== undefined) {
            updateData.free_username_changes = newFreeChangesVal;
        }

        await updateDoc(userRef, updateData);
        return { success: true };
    } catch (error) {
        return { success: false, error };
    }
}

export async function deleteUser(username) {
    try {
        const userRef = await getUserDocRef(username);
        if (userRef) {
            await deleteDoc(userRef);
            return true;
        }
        return false;
    } catch (e) { return false; }
}

// ==========================================
// 3. УПРАВЛЕНИЕ ПРОМОКОДАМИ
// ==========================================

export async function fetchAllPromocodes() {
    try {
        const q = query(collection(db, "promocodes"), orderBy("created_at", "desc"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) { return []; }
}

export async function deletePromocodeById(id) {
    try {
        await deleteDoc(doc(db, "promocodes", id));
        return true;
    } catch (e) { return false; }
}

export async function bulkDeletePromocodes(period) {
    try {
        let q = collection(db, "promocodes");
        const now = new Date();
        let dateLimit = new Date();
        let queryConstraints = [];

        if (period === '24h') dateLimit.setHours(now.getHours() - 24);
        else if (period === 'week') dateLimit.setDate(now.getDate() - 7);
        
        if (period !== 'all') queryConstraints.push(where("created_at", ">=", dateLimit.toISOString()));

        const finalQuery = query(q, ...queryConstraints);
        const snapshot = await getDocs(finalQuery);
        
        const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
        await Promise.all(deletePromises);
        
        return true;
    } catch (e) { return false; }
}

export async function createPromocode(code, data) {
    try {
        await addDoc(collection(db, "promocodes"), {
            code: code.toUpperCase(),
            amount: data.amount,
            activations_left: data.activations,
            wager_multiplier: data.wager,
            created_at: new Date().toISOString()
        });
        return true;
    } catch (e) { return false; }
}

export async function activatePromocode(code) {
    if (!currentUser) return { success: false, message: "Войдите в аккаунт" };
    const normalizedCode = code.trim().toUpperCase();

    try {
        const result = await runTransaction(db, async (transaction) => {
            const promoQ = query(collection(db, "promocodes"), where("code", "==", normalizedCode));
            const promoSnap = await getDocs(promoQ);
            if (promoSnap.empty) throw "Промокод не найден";
            const promoDocRef = promoSnap.docs[0].ref;
            
            const userQ = query(collection(db, "users"), where("username", "==", currentUser));
            const userSnap = await getDocs(userQ);
            if (userSnap.empty) throw "Пользователь не найден";
            const userRef = userSnap.docs[0].ref;

            const activationId = `${currentUser}_${normalizedCode}`;
            const activationRef = doc(db, "promo_activations", activationId);
            
            const pDoc = await transaction.get(promoDocRef);
            const uDoc = await transaction.get(userRef);
            const aDoc = await transaction.get(activationRef);
            
            if (!pDoc.exists()) throw "Промокод не найден";
            if (!uDoc.exists()) throw "Пользователь не найден";
            if (aDoc.exists()) throw "Вы уже активировали этот промокод";
            
            const promoData = pDoc.data();
            if (promoData.activations_left <= 0) throw "Промокод закончился";

            transaction.update(promoDocRef, { activations_left: promoData.activations_left - 1 });
            
            const bonusAmount = promoData.amount;
            const wagerAdd = bonusAmount * (promoData.wager_multiplier || 0);
            const userData = uDoc.data();
            const newBalance = (userData.balance || 0) + bonusAmount;
            const newWager = (userData.wager_balance || 0) + wagerAdd;
            
            transaction.update(userRef, { balance: newBalance, wager_balance: newWager });
            
            transaction.set(activationRef, {
                username: currentUser,
                code: normalizedCode,
                amount: bonusAmount,
                activated_at: new Date().toISOString()
            });

            return { success: true, amount: bonusAmount, wager_added: wagerAdd };
        });

        if (result.success) await fetchUser(currentUser, true); 
        return result;

    } catch (e) {
        const msg = typeof e === 'string' ? e : "Ошибка сервера: " + (e.message || "Unknown");
        console.error("Promo Activate Error:", e);
        return { success: false, message: msg };
    }
}

// ==========================================
// 4. УПРАВЛЕНИЕ БАЛАНСОМ И ВЕЙДЖЕРОМ
// ==========================================

export async function updateBalance(amount, wagerToAdd = 0) {
    if (!currentUser) return;
    
    currentBalance += amount;
    localWagerBalance = Math.max(0, localWagerBalance + wagerToAdd);
    
    updateUI(); 
    setLocalWager(localWagerBalance);

    try {
        const userRef = await getUserDocRef(currentUser);
        if (!userRef) return;

        await updateDoc(userRef, {
            balance: increment(amount),
            wager_balance: increment(wagerToAdd)
        });
        
    } catch (err) { 
        console.error("Balance update failed: ", err); 
    }
}

export async function reduceWager(betAmount) {
    if (!currentUser) return;
    
    let amountToSubtract = Math.min(localWagerBalance, betAmount);
    if (amountToSubtract <= 0) return;

    await updateBalance(0, -amountToSubtract);
}

export function setLocalWager(amount) {
    const safeAmount = Math.max(0, amount);
    const profileWagerEl = document.getElementById('profile-wager-amount');
    
    if (profileWagerEl) {
        profileWagerEl.textContent = safeAmount.toFixed(2);
    }
}

// ==========================================
// 5. ИСТОРИЯ ИГР И СТАТИСТИКА
// ==========================================

document.addEventListener('click', (e) => {
    const card = e.target.closest('.high-win-card');
    if (card) handleHistoryItemClick(card);
});

export async function writeBetToHistory(betData) {
    AntiMinus.registerGame(betData.betAmount, betData.amount);
    
    try {
        await addDoc(collection(db, "bets"), {
            username: betData.username,
            game: betData.game,
            result: betData.result,
            bet_amount: betData.betAmount,
            profit_amount: betData.amount, 
            multiplier: betData.multiplier,
            created_at: new Date().toISOString()
        });

        // 2. Обновление общей статистики для Рейкбека (FIX)
        const userRef = await getUserDocRef(betData.username);
        if (userRef) {
            await updateDoc(userRef, {
                stats_total_wager: increment(betData.betAmount)
            });
        }

        fetchAndRenderHistory();
    } catch (e) { console.error("Error writing bet", e); }
}

export async function fetchAndRenderHistory() {
    try {
        const qRecent = query(collection(db, "bets"), orderBy("created_at", "desc"), limit(50));
        const recentSnap = await getDocs(qRecent);
        const recentBets = recentSnap.docs.map(d => d.data());
        renderHistoryList(recentBets, 'recent');

        const highWins = recentBets.filter(bet => {
            const multValue = parseFloat((bet.multiplier || "").replace('x', '')) || 0;
            return multValue >= 5.0 && bet.profit_amount >= 1000;
        }).slice(0, 10);
        
        renderHistoryList(highWins, 'highwins');
    } catch (e) { console.error("Fetch History Error", e); }
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
    try {
        const q = query(collection(db, "bets"));
        const snapshot = await getDocs(q);
        const promises = snapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(promises);
        return true;
    } catch (e) { return false; }
}

export async function fetchUserDepositHistory(username) { return []; }
export async function fetchUserWithdrawalHistory(username) { return []; }
export function startDepositHistoryPoller() {}
export function stopDepositHistoryPoller() {}
export function startWithdrawalHistoryPoller() {}
export function stopWithdrawalHistoryPoller() {}

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

// ===============================================
// VK AUTH LISTENER (AUTO HANDLE REDIRECT)
// ===============================================
window.addEventListener('load', async () => {
    // 1. Проверяем наличие параметра ?code= от VK
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');

    // Если есть код
    if (code) {
        // Убираем код из строки браузера
        window.history.replaceState({}, document.title, window.location.pathname);

        // 2. Достаем сохраненные параметры PKCE
        const codeVerifier = localStorage.getItem('vk_code_verifier');
        const deviceId = localStorage.getItem('vk_device_id');
        
        console.log("VK Auth Debug:", { code: code.substring(0, 10) + "...", verifier: codeVerifier ? "Found" : "MISSING", device: deviceId });

        // Если верификатора нет, это ошибка (или старый код). Не пытаемся отправить запрос.
        if (!codeVerifier) {
            console.warn("VK Auth: Code exists but verifier missing (stale reload). Skipping auth.");
            return;
        }

        // 3. Запускаем интервал ожидания сессии пользователя
        const checkUserInterval = setInterval(async () => {
            // Если сессии нет вообще, прекращаем
            if (!localStorage.getItem('nekoUserSession')) {
                clearInterval(checkUserInterval);
                return;
            }

            // Ждем пока загрузится currentUser
            if (currentUser) {
                clearInterval(checkUserInterval);
                
                if (typeof window.addAppNotification === 'function') {
                    window.addAppNotification('🔄 VK', 'Завершаем привязку...');
                }

                try {
                    // Формируем URL с обязательными параметрами
                    let apiUrl = `/api/vk-auth?code=${code}`;
                    if (codeVerifier) apiUrl += `&code_verifier=${codeVerifier}`;
                    if (deviceId) apiUrl += `&device_id=${deviceId}`;

                    console.log("Sending request to:", apiUrl);

                    const response = await fetch(apiUrl);
                    const result = await response.json();

                    if (!response.ok) {
                        throw new Error(result.error || 'Ошибка сервера привязки');
                    }

                    if (result.vk_id) {
                        const success = await patchUser(currentUser, { 
                            vk_linked: true,
                            vk_id: result.vk_id 
                        });
                        
                        if (success) {
                            // ОЧИЩАЕМ КЛЮЧИ ТОЛЬКО ПОСЛЕ УСПЕХА
                            localStorage.removeItem('vk_code_verifier');
                            localStorage.removeItem('vk_device_id');
                            localStorage.removeItem('vk_state');
                            
                            alert('✅ ВКонтакте успешно привязан!');
                            window.location.reload();
                        } else {
                            alert('Ошибка сохранения данных в базу.');
                        }
                    } else {
                        alert('❌ Ошибка привязки VK: ' + (result.error || 'Неизвестная ошибка'));
                    }
                } catch (e) {
                    console.error(e);
                    alert('Ошибка: ' + e.message);
                    
                    // Если ошибка "Code invalid", можно очистить ключи, чтобы не спамить
                    if (e.message.includes("invalid") || e.message.includes("expired")) {
                        localStorage.removeItem('vk_code_verifier');
                    }
                }
            }
        }, 500); 
    }
});