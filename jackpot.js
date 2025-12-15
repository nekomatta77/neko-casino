/*
 * jackpot.js - FINAL (AGGREGATED BETS & STYLISH)
 */
import { 
    getFirestore, doc, onSnapshot, runTransaction, 
    setDoc, arrayUnion, increment, query, where, getDocs, collection 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { currentUser, currentBalance, updateBalance, fetchUser } from './global.js';

const db = getFirestore();

const ROOMS = {
    'low': { min: 1, max: 100 },
    'medium': { min: 100, max: 1000 },
    'high': { min: 1000, max: 5000 }
};

let activeRoom = 'low';
let unsubscribeRoom = null;
let currentRoundData = null;
let countdownInterval = null;

// Элементы UI
const els = {
    potAmount: document.getElementById('jackpot-pot-amount'),
    timerCircle: document.querySelector('.timer-circle'),
    timerText: document.getElementById('jackpot-timer'),
    statusText: document.getElementById('jackpot-status-text'),
    tapeTrack: document.getElementById('jackpot-tape'),
    betInput: document.getElementById('jackpot-bet-input'),
    btnPlaceBet: document.getElementById('jackpot-place-bet'),
    playersList: document.getElementById('jackpot-players-ul'),
    chanceDisplay: document.getElementById('jackpot-chance-display'),
    winnerDisplay: document.getElementById('jackpot-winner-display'),
    roomBtns: document.querySelectorAll('.room-btn'),
    quickBtns: document.querySelectorAll('.jackpot-quick-amounts button'),
    totalPlayers: document.getElementById('jackpot-total-players') // Новый элемент
};

export function initJackpot() {
    // 1. Комнаты
    if (els.roomBtns) {
        els.roomBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const room = btn.dataset.room;
                switchRoom(room);
            });
        });
    }

    // 2. Ставка
    if (els.btnPlaceBet) {
        els.btnPlaceBet.addEventListener('click', placeBet);
    }

    // 3. Быстрые кнопки
    if (els.quickBtns) {
        els.quickBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const val = btn.dataset.amt;
                if(val === 'max') {
                    if (els.betInput) els.betInput.value = currentBalance;
                } else {
                    if (els.betInput) els.betInput.value = val;
                }
            });
        });
    }

    switchRoom('low');
}

function switchRoom(roomName) {
    if (unsubscribeRoom) unsubscribeRoom();
    
    activeRoom = roomName;
    
    // UI Кнопок комнат
    if (els.roomBtns) {
        els.roomBtns.forEach(btn => {
            if(btn.dataset.room === roomName) btn.classList.add('active');
            else btn.classList.remove('active');
        });
    }

    resetUI();

    const roomRef = doc(db, 'jackpot_rooms', roomName);
    unsubscribeRoom = onSnapshot(roomRef, (docSnap) => {
        if (docSnap.exists()) {
            handleRoundUpdate(docSnap.data());
        } else {
            createRoom(roomName);
        }
    });
}

function resetUI() {
    if (els.tapeTrack) {
        els.tapeTrack.innerHTML = '';
        els.tapeTrack.style.transition = 'none';
        els.tapeTrack.style.transform = 'translateX(0)';
        els.tapeTrack.classList.remove('spinning');
    }
    if (els.winnerDisplay) els.winnerDisplay.classList.add('hidden');
    if (els.statusText) els.statusText.textContent = "Ожидание...";
    if (els.timerText) els.timerText.textContent = "20";
    if (els.playersList) els.playersList.innerHTML = '';
    if (els.potAmount) els.potAmount.innerHTML = '0.00';
    if (els.timerCircle) els.timerCircle.style.borderColor = "#F5A623";
}

function handleRoundUpdate(data) {
    currentRoundData = data;
    
    // 1. Банк
    if (els.potAmount) els.potAmount.innerHTML = `${data.pot.toFixed(2)}`;
    
    // 2. Игроки
    renderPlayers(data.players || [], data.pot);

    // 3. Статус
    if (data.status === 'waiting') {
        if (els.statusText) els.statusText.textContent = "Ждем игроков...";
        if (els.timerText) els.timerText.textContent = "20";
        if (els.timerCircle) els.timerCircle.style.borderColor = "#F5A623"; // Оранжевый
        if(countdownInterval) clearInterval(countdownInterval);
    
    } else if (data.status === 'countdown') {
        if (els.statusText) els.statusText.textContent = "Старт через:";
        if (els.timerCircle) els.timerCircle.style.borderColor = "#00D26A"; // Зеленый
        startLocalTimer(data.endTime);
        
    } else if (data.status === 'rolling') {
        if (els.statusText) els.statusText.textContent = "Розыгрыш!";
        if (els.timerText) els.timerText.textContent = "0";
        if (!data.winner) {
            tryResolveWinner(data);
        } else {
            if (els.tapeTrack && !els.tapeTrack.classList.contains('spinning')) {
                spinTape(data.winner, data.players);
            }
        }
    }
}

function renderPlayers(players, totalPot) {
    if (!els.playersList) return;
    els.playersList.innerHTML = '';
    
    let myBet = 0;
    
    // Обновляем счетчик
    if(els.totalPlayers) els.totalPlayers.textContent = players.length;

    // Сортировка: Самый "богатый" сверху
    const sorted = [...players].sort((a,b) => b.amount - a.amount);

    sorted.forEach(p => {
        if(p.username === currentUser) myBet += p.amount;
        
        const chance = totalPot > 0 ? (p.amount / totalPot) * 100 : 0;
        const ava = p.avatar || 'assets/avatars/orange_cat_ava.png';
        const isMe = p.username === currentUser ? 'is-me' : '';
        
        // Красивая верстка строки игрока
        const li = document.createElement('li');
        li.className = `jp-player-row ${isMe}`;
        li.innerHTML = `
            <div class="jp-row-left">
                <div class="jp-avatar-wrap">
                    <img src="${ava}" class="jp-player-ava">
                    <span class="jp-percent-badge">${chance.toFixed(1)}%</span>
                </div>
                <span class="jp-name">${p.username}</span>
            </div>
            <div class="jp-row-right">
                <span class="jp-bet">${p.amount.toFixed(2)} ₽</span>
            </div>
        `;
        els.playersList.appendChild(li);
    });

    const myChance = totalPot > 0 ? (myBet / totalPot) * 100 : 0;
    if (els.chanceDisplay) els.chanceDisplay.textContent = `Ваш шанс: ${myChance.toFixed(2)}%`;
}

function startLocalTimer(endTime) {
    if(countdownInterval) clearInterval(countdownInterval);
    
    const update = () => {
        if (!endTime) return;
        const now = Date.now();
        const endMs = endTime.toMillis ? endTime.toMillis() : endTime; 
        const left = Math.ceil((endMs - now) / 1000);
        
        if (left <= 0) {
            if (els.timerText) els.timerText.textContent = "0";
            clearInterval(countdownInterval);
            tryToTransitionToRolling();
        } else {
            if (els.timerText) els.timerText.textContent = left;
        }
    };
    update();
    countdownInterval = setInterval(update, 1000);
}

// --- СТАВКА (ИСПРАВЛЕНО: СУММИРОВАНИЕ) ---
async function placeBet() {
    if (!currentUser) return alert("Войдите в аккаунт");
    if (!els.betInput) return;
    
    const amount = parseFloat(els.betInput.value);
    const limits = ROOMS[activeRoom];

    if (isNaN(amount) || amount < 1) return alert("Некорректная сумма");
    
    // Проверка лимитов для ПЕРВОЙ ставки
    // (Для доп. ставок можно разрешить меньше, но сумма должна быть в пределах. Пока упростим)
    if (amount > currentBalance) return alert("Недостаточно средств");

    // Ищем настоящий ID документа
    const userQ = query(collection(db, "users"), where("username", "==", currentUser));
    const userSnap = await getDocs(userQ);
    
    if (userSnap.empty) return alert("Пользователь не найден");
    
    const userRef = userSnap.docs[0].ref; 
    const userData = userSnap.docs[0].data();
    const avatar = userData.customization?.avatar || 'assets/avatars/orange_cat_ava.png';

    // Оптимистичное списание
    await updateBalance(-amount);

    try {
        const roomRef = doc(db, 'jackpot_rooms', activeRoom);

        await runTransaction(db, async (transaction) => {
            const roomDoc = await transaction.get(roomRef);
            if (!roomDoc.exists()) throw "Комната не найдена";
            
            const rData = roomDoc.data();
            if (rData.status === 'rolling') throw "Раунд уже идет, подождите";

            // --- ЛОГИКА СУММИРОВАНИЯ ---
            let players = rData.players || [];
            let playerIndex = players.findIndex(p => p.username === currentUser);
            
            // Проверка лимитов комнаты на ОБЩУЮ сумму
            let newTotalBet = amount;
            if (playerIndex !== -1) {
                newTotalBet += players[playerIndex].amount;
            }
            
            // Валидация (если нужно строго следовать лимитам комнаты)
            // if (newTotalBet > limits.max) throw `Максимальная ставка в комнате ${limits.max} RUB`;

            if (playerIndex !== -1) {
                // Игрок уже есть - обновляем сумму и аватар (на случай если сменил)
                players[playerIndex].amount = newTotalBet;
                players[playerIndex].avatar = avatar; // Обновляем аватарку
            } else {
                // Новый игрок
                if (amount < limits.min) throw `Минимальная ставка ${limits.min} RUB`;
                players.push({
                    username: currentUser,
                    amount: amount,
                    avatar: avatar
                });
            }

            const newPot = (rData.pot || 0) + amount;
            
            let updates = {
                pot: newPot,
                players: players // Перезаписываем весь массив
            };

            // Проверка таймера (если игроков >= 2)
            if (players.length >= 2 && rData.status === 'waiting') {
                updates.status = 'countdown';
                const future = new Date();
                future.setSeconds(future.getSeconds() + 20); 
                updates.endTime = future; 
            }

            transaction.update(roomRef, updates);
            transaction.update(userRef, { balance: increment(-amount) }); 
        });

    } catch (e) {
        console.error(e);
        await updateBalance(amount); // Возврат
        const msg = typeof e === 'string' ? e : (e.message || "Ошибка");
        if(msg !== "Раунд уже идет, подождите") alert(msg);
    }
}

async function tryToTransitionToRolling() {
    try {
        const roomRef = doc(db, 'jackpot_rooms', activeRoom);
        await runTransaction(db, async (transaction) => {
            const docSnap = await transaction.get(roomRef);
            if(!docSnap.exists()) return;
            if (docSnap.data().status === 'countdown') {
                transaction.update(roomRef, { status: 'rolling' });
            }
        });
    } catch(e) {}
}

async function tryResolveWinner(data) {
    try {
        const roomRef = doc(db, 'jackpot_rooms', activeRoom);
        await runTransaction(db, async (transaction) => {
            const docSnap = await transaction.get(roomRef);
            const rData = docSnap.data();
            if (rData.status !== 'rolling' || rData.winner) return;

            const totalPot = rData.pot;
            const commission = totalPot * 0.10;
            const winAmount = totalPot - commission;

            // Генерация билетов на основе ОБЩИХ ставок
            let tickets = [];
            let currentTicket = 0;
            
            // Важно: порядок игроков должен быть детерминированным для всех клиентов
            // Сортируем игроков по имени или ставке для консистентности, 
            // хотя транзакция выполняется на сервере, так что порядок в массиве БД - истина.
            rData.players.forEach(p => {
                tickets.push({ 
                    username: p.username, 
                    start: currentTicket, 
                    end: currentTicket + p.amount,
                    avatar: p.avatar 
                });
                currentTicket += p.amount;
            });

            const luckyNumber = Math.random() * totalPot;
            let winnerObj = tickets.find(t => luckyNumber >= t.start && luckyNumber < t.end);
            if (!winnerObj) winnerObj = tickets[0];

            transaction.update(roomRef, {
                winner: {
                    username: winnerObj.username,
                    avatar: winnerObj.avatar,
                    winAmount: winAmount,
                    chance: ((winnerObj.end - winnerObj.start) / totalPot) * 100
                }
            });
            
            // Начисление (упрощенно по username, в идеале по ID)
            // Но т.к. мы ищем по username в placeBet, тут тоже можно найти через query
            // Но внутри транзакции сложнее. Оставим начисление клиенту-победителю в spinTape
            // или отдельным процессом.
        });
    } catch(e) {}
}

function spinTape(winner, players) {
    const tape = els.tapeTrack;
    if (!tape) return;
    
    tape.classList.add('spinning');
    tape.innerHTML = '';

    const WIN_INDEX = 80;
    const TOTAL_CARDS = 105;
    const CARD_WIDTH = 90; 

    // Создаем взвешенный массив для ленты (чтобы чаще мелькали те, кто больше поставил)
    let displayPool = [];
    players.forEach(p => {
        // Добавляем игрока в пул пропорционально ставке (минимум 1 раз)
        // Например, на каждые 100р + 1 раз
        let count = Math.ceil(p.amount / (currentRoundData.pot / 50)); 
        if (count < 1) count = 1;
        if (count > 20) count = 20; // Ограничитель
        for(let k=0; k<count; k++) displayPool.push(p);
    });

    for (let i = 0; i < TOTAL_CARDS; i++) {
        let player;
        if (i === WIN_INDEX) {
            player = { avatar: winner.avatar, username: winner.username }; 
        } else {
            player = displayPool[Math.floor(Math.random() * displayPool.length)];
        }
        
        const div = document.createElement('div');
        div.className = 'tape-card';
        // Если это победитель - золотая рамка
        if (player.username === winner.username) div.classList.add('rare-3'); // Зеленая
        else div.classList.add('rare-1');
        
        div.innerHTML = `<img src="${player.avatar || 'assets/avatars/orange_cat_ava.png'}">`;
        tape.appendChild(div);
    }

    const randomOffset = Math.floor(Math.random() * 60) - 30; 
    const parentWidth = els.tapeTrack.parentElement ? els.tapeTrack.parentElement.offsetWidth : 600;
    const targetX = (WIN_INDEX * CARD_WIDTH) - (parentWidth / 2) + (CARD_WIDTH / 2) + randomOffset;

    tape.style.transition = 'none';
    tape.style.transform = 'translateX(0px)';
    tape.offsetHeight; 

    tape.style.transition = 'transform 6s cubic-bezier(0.15, 0.90, 0.30, 1.0)';
    tape.style.transform = `translateX(-${targetX}px)`;

    setTimeout(async () => {
        showWinnerModal(winner);
        tape.classList.remove('spinning');
        
        if (winner.username === currentUser) {
            try {
                const userQ = query(collection(db, "users"), where("username", "==", currentUser));
                const userSnap = await getDocs(userQ);
                if (!userSnap.empty) {
                    const userRef = userSnap.docs[0].ref;
                    await updateDoc(userRef, { balance: increment(winner.winAmount) });
                    await fetchUser(currentUser, true); 
                }
            } catch(e) {}
        }
        
        setTimeout(() => resetRoundInDB(), 5000);
    }, 6500);
}

function showWinnerModal(winner) {
    if (els.winnerDisplay) {
        els.winnerDisplay.classList.remove('hidden');
        document.getElementById('jp-winner-name').textContent = winner.username;
        document.getElementById('jp-winner-chance').textContent = winner.chance.toFixed(2) + '%';
        document.getElementById('jp-winner-sum').textContent = `+${winner.winAmount.toFixed(2)} RUB`;
    }
}

async function resetRoundInDB() {
    try {
        const roomRef = doc(db, 'jackpot_rooms', activeRoom);
        await runTransaction(db, async (transaction) => {
            const docSnap = await transaction.get(roomRef);
            if (!docSnap.exists()) return;
            if (docSnap.data().status === 'rolling' && docSnap.data().winner) {
                transaction.set(roomRef, {
                    status: 'waiting',
                    players: [],
                    pot: 0,
                    winner: null
                });
            }
        });
    } catch(e) {}
}

async function createRoom(name) {
    try {
        await setDoc(doc(db, 'jackpot_rooms', name), {
            status: 'waiting', players: [], pot: 0, winner: null
        });
    } catch(e) {}
}