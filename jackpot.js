/*
 * jackpot.js - FINAL (Winner Avatar Fixed, Instant Roll, Notifications)
 */
import { 
    getFirestore, doc, onSnapshot, runTransaction, 
    setDoc, increment, query, where, getDocs, collection, updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { currentUser, currentBalance, updateBalance, fetchUser, updateVisualBalance, currentUserData } from './global.js';

const db = getFirestore();

// --- ВРЕМЕННАЯ ФУНКЦИЯ ДЛЯ УВЕДОМЛЕНИЙ (требует базовых стилей в style.css) ---
function showNotification(message, type = 'error') {
    // В реальном проекте эта функция должна быть определена в global.js или в другом общем месте, 
    // а в style.css должны быть классы .notification, .notification--error и т.д.
    
    // Временно добавляем элемент с простыми стилями для демонстрации:
    const notifContainer = document.getElementById('notifications-container') || document.body; 
    
    const notif = document.createElement('div');
    notif.className = `notification notification--${type}`;
    notif.textContent = message;
    
    // Простейшие inline стили для работы
    notif.style.position = 'fixed';
    notif.style.bottom = '20px';
    notif.style.right = '20px';
    notif.style.padding = '10px 20px';
    notif.style.backgroundColor = type === 'error' ? 'rgba(255, 0, 0, 0.8)' : (type === 'warning' ? 'rgba(255, 165, 0, 0.8)' : 'rgba(0, 150, 255, 0.8)');
    notif.style.color = 'white';
    notif.style.borderRadius = '5px';
    notif.style.zIndex = '10000';
    notif.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
    notif.style.opacity = '1';
    notif.style.transform = 'translateY(0)';

    notifContainer.appendChild(notif);
    
    setTimeout(() => {
        notif.style.opacity = '0';
        notif.style.transform = 'translateY(10px)'; // Эффект исчезновения вниз
        setTimeout(() => notif.remove(), 500);
    }, 4000);
}
// -----------------------------------------------------------------------------------------------


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
    multBtns: document.querySelectorAll('.jp-mult-btn'),
    totalPlayers: document.getElementById('jackpot-total-players')
};

export function initJackpot() {
    // 1. Переключение комнат
    if (els.roomBtns) {
        els.roomBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const room = btn.dataset.room;
                switchRoom(room);
            });
        });
    }

    // 2. Кнопка ставки
    if (els.btnPlaceBet) {
        els.btnPlaceBet.addEventListener('click', placeBet);
    }

    // 3. Логика кнопок (1/2, x2)
    if (els.multBtns) {
        els.multBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                handleControlAction(btn.dataset.action);
            });
        });
    }

    // 4. Логика кнопок (Min, Max)
    const quickBtns = document.querySelectorAll('.jp-quick-btn');
    quickBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            handleControlAction(btn.dataset.action);
        });
    });

    // 5. Валидация
    if (els.betInput) {
        els.betInput.addEventListener('blur', validateInputLimits);
        els.betInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') validateInputLimits();
        });
    }

    switchRoom('low');
}

function validateInputLimits() {
    if (!els.betInput) return;
    let val = parseFloat(els.betInput.value);
    if (isNaN(val)) val = 0;
    const limits = ROOMS[activeRoom];
    if (val < limits.min) val = limits.min;
    else if (val > limits.max) val = limits.max;
    els.betInput.value = val.toFixed(2);
}

function handleControlAction(action) {
    if (!els.betInput) return;
    let currentVal = parseFloat(els.betInput.value) || 0;
    const limits = ROOMS[activeRoom];
    let newVal = currentVal;

    switch (action) {
        case 'half':
            newVal = currentVal / 2;
            if (newVal < limits.min) newVal = limits.min;
            break;
        case 'double':
            newVal = currentVal * 2;
            if (newVal > limits.max) newVal = limits.max;
            break;
        case 'min':
            newVal = limits.min;
            break;
        case 'max':
            const userMax = currentBalance > limits.max ? limits.max : currentBalance;
            newVal = userMax > limits.max ? limits.max : userMax; 
            if (newVal < limits.min) newVal = limits.min;
            break;
    }
    if (newVal < limits.min) newVal = limits.min;
    if (newVal > limits.max) newVal = limits.max;
    els.betInput.value = newVal.toFixed(2);
}

function switchRoom(roomName) {
    if (unsubscribeRoom) unsubscribeRoom();
    activeRoom = roomName;
    
    if (els.roomBtns) {
        els.roomBtns.forEach(btn => {
            if(btn.dataset.room === roomName) btn.classList.add('active');
            else btn.classList.remove('active');
        });
    }

    if(els.betInput) els.betInput.value = ROOMS[roomName].min.toFixed(2);
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
        els.tapeTrack.classList.remove('spinning');
        els.tapeTrack.style.transition = 'none';
        els.tapeTrack.style.transform = 'translateX(0)';
        els.tapeTrack.style.paddingLeft = '0'; 
        els.tapeTrack.style.display = 'flex';
        els.tapeTrack.style.width = '100%'; 
        els.tapeTrack.style.justifyContent = 'center';
        els.tapeTrack.style.alignItems = 'center';
        
        els.tapeTrack.innerHTML = `
            <div class="jackpot-waiting-visual">
                <div class="hourglass-icon"></div>
                <div class="jackpot-waiting-text">Ожидание...</div>
            </div>
        `;
    }

    if (els.winnerDisplay) {
        els.winnerDisplay.classList.add('hidden');
        document.getElementById('jp-winner-name').textContent = '...';
        document.getElementById('jp-winner-sum').textContent = '+0.00';
    }

    if (els.statusText) els.statusText.textContent = "Ожидание...";
    if (els.timerText) els.timerText.textContent = "20";
    if (els.playersList) els.playersList.innerHTML = '';
    if (els.potAmount) els.potAmount.innerHTML = '0.00';
    if (els.totalPlayers) els.totalPlayers.textContent = '0';
    if (els.chanceDisplay) els.chanceDisplay.textContent = 'Ваш шанс: 0%';
    if (els.timerCircle) els.timerCircle.style.borderColor = "#F5A623";
    if(countdownInterval) clearInterval(countdownInterval);
}

function handleRoundUpdate(data) {
    currentRoundData = data;
    
    // 1. Банк
    if (els.potAmount) els.potAmount.innerHTML = `${data.pot.toFixed(2)}`;
    
    // 2. Игроки и Превью ленты
    renderPlayers(data.players || [], data.pot);

    // 3. Статус
    if (data.status === 'waiting') {
        if (els.statusText) els.statusText.textContent = "Ждем игроков...";
        if (els.timerText) els.timerText.textContent = "20";
        if (els.timerCircle) els.timerCircle.style.borderColor = "#F5A623";
        if(countdownInterval) clearInterval(countdownInterval);
    
    } else if (data.status === 'countdown') {
        if (els.statusText) els.statusText.textContent = "Старт через:";
        if (els.timerCircle) els.timerCircle.style.borderColor = "#00D26A";
        startLocalTimer(data.endTime);
        
    } else if (data.status === 'rolling') {
        if (els.statusText) els.statusText.textContent = "Розыгрыш!";
        if (els.timerText) els.timerText.textContent = "0";
        if(countdownInterval) clearInterval(countdownInterval); // Останавливаем таймер
        
        // Запуск рулетки сразу после окончания таймера (Point 2)
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
    
    if(els.totalPlayers) els.totalPlayers.textContent = players.length;

    // --- ЛОГИКА ОТОБРАЖЕНИЯ ЛЕНТЫ ---
    if (currentRoundData && currentRoundData.status !== 'rolling') {
        if (players.length === 0) {
            if (els.tapeTrack) {
                els.tapeTrack.style.justifyContent = 'center';
                els.tapeTrack.innerHTML = `
                    <div class="jackpot-waiting-visual">
                        <div class="hourglass-icon"></div>
                        <div class="jackpot-waiting-text">Ждем игроков...</div>
                    </div>
                `;
            }
        } else {
            // Показываем превью (по 1 уникальной аватарке)
            previewTape(players, totalPot);
        }
    }

    let myBet = 0;
    const sorted = [...players].sort((a,b) => b.amount - a.amount);

    sorted.forEach(p => {
        if(p.username === currentUser) myBet += p.amount;
        const chance = totalPot > 0 ? (p.amount / totalPot) * 100 : 0;
        const ava = p.avatar || 'assets/avatars/orange_cat_ava.png';
        const isMe = p.username === currentUser ? 'is-me' : '';
        
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

// Показывает ТОЛЬКО по одной аватарке каждого игрока
function previewTape(players, totalPot) {
    if (!els.tapeTrack) return;
    
    els.tapeTrack.innerHTML = '';
    els.tapeTrack.style.justifyContent = 'center';
    els.tapeTrack.style.paddingLeft = '0';
    
    players.forEach(player => {
        const chanceVal = totalPot > 0 ? (player.amount / totalPot) * 100 : 0;
        
        const div = document.createElement('div');
        div.className = 'tape-card rare-1'; 
        div.style.transform = 'scale(0.9)'; 
        
        div.innerHTML = `
            <div class="tape-avatar-box">
                <img src="${player.avatar || 'assets/avatars/orange_cat_ava.png'}">
            </div>
            <div class="tape-chance-badge">${chanceVal.toFixed(1)}%</div>
        `;
        els.tapeTrack.appendChild(div);
    });
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
            // СРАЗУ ТРИГГЕРИМ ПЕРЕХОД В ROLLING (Point 2)
            tryToTransitionToRolling(); 
        } else {
            if (els.timerText) els.timerText.textContent = left;
        }
    };
    update();
    countdownInterval = setInterval(update, 1000);
}

async function placeBet() {
    // Используем showNotification вместо alert (Point 3)
    if (!currentUser) return showNotification("Войдите в аккаунт для совершения ставки", 'info');
    if (!els.betInput) return;
    
    const amount = parseFloat(els.betInput.value);
    const limits = ROOMS[activeRoom];

    if (isNaN(amount) || amount < 0.01) return showNotification("Сумма ставки должна быть больше 0.01 RUB", 'error');
    
    // Проверяем баланс до транзакции для оптимистического обновления
    if (amount > currentBalance) return showNotification("Недостаточно средств на балансе. Пополните счет.", 'error');

    updateVisualBalance(-amount);

    let optimisticAvatar = 'assets/avatars/orange_cat_ava.png';
    if (currentUserData) {
        if (currentUserData.customization && currentUserData.customization.avatar) {
            optimisticAvatar = currentUserData.customization.avatar;
        } else if (currentUserData.avatar) {
            optimisticAvatar = currentUserData.avatar;
        }
    }

    const previousPot = currentRoundData?.pot || 0;
    const previousPlayers = currentRoundData?.players ? [...currentRoundData.players] : [];
    
    let optimisticPlayers = JSON.parse(JSON.stringify(previousPlayers));
    const myIndex = optimisticPlayers.findIndex(p => p.username === currentUser);
    
    if (myIndex !== -1) {
        optimisticPlayers[myIndex].amount += amount;
    } else {
        optimisticPlayers.push({
            username: currentUser,
            amount: amount,
            avatar: optimisticAvatar 
        });
    }

    const optimisticPot = previousPot + amount;
    if(els.potAmount) els.potAmount.innerHTML = optimisticPot.toFixed(2);
    renderPlayers(optimisticPlayers, optimisticPot);

    try {
        const roomRef = doc(db, 'jackpot_rooms', activeRoom);
        const userQ = query(collection(db, "users"), where("username", "==", currentUser));
        const userSnap = await getDocs(userQ);
        if (userSnap.empty) throw "Пользователь не найден";
        
        const userRef = userSnap.docs[0].ref; 
        const userData = userSnap.docs[0].data();
        const dbAvatar = (userData.customization && userData.customization.avatar) ? userData.customization.avatar : optimisticAvatar;

        await runTransaction(db, async (transaction) => {
            const roomDoc = await transaction.get(roomRef);
            if (!roomDoc.exists()) throw "Комната не найдена";
            
            const rData = roomDoc.data();
            if (rData.status === 'rolling') throw "Раунд уже идет, подождите";

            const freshUserDoc = await transaction.get(userRef);
            if (!freshUserDoc.exists()) throw "User not found";
            const freshBalance = freshUserDoc.data().balance || 0;

            if (freshBalance < amount) throw "Недостаточно средств";

            let players = rData.players || [];
            let playerIndex = players.findIndex(p => p.username === currentUser);
            
            let newTotalBet = amount;
            if (playerIndex !== -1) newTotalBet += players[playerIndex].amount;
            
            if (playerIndex === -1 && amount < limits.min) throw `Минимальная ставка ${limits.min} RUB`;
            if (newTotalBet > limits.max) throw `Ваша общая ставка превышает лимит комнаты: до ${limits.max} RUB`; // Улучшенное сообщение

            if (playerIndex !== -1) {
                players[playerIndex].amount = newTotalBet;
                players[playerIndex].avatar = dbAvatar; 
            } else {
                players.push({ username: currentUser, amount: amount, avatar: dbAvatar });
            }

            const newPot = (rData.pot || 0) + amount;
            let updates = { pot: newPot, players: players };

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
        console.error("Ошибка ставки:", e);
        updateVisualBalance(+amount); // Возвращаем средства
        if(els.potAmount) els.potAmount.innerHTML = previousPot.toFixed(2);
        renderPlayers(previousPlayers, previousPot); // Возвращаем UI в предыдущее состояние
        
        let msg = "Произошла неизвестная ошибка сервера";
        if (typeof e === 'string') {
            msg = e;
        } else if (e.message) {
            msg = e.message;
        }
        
        // Красивые уведомления вместо alert (Point 3)
        if (msg.includes("Раунд уже идет")) {
            showNotification("Раунд уже запущен, подождите его окончания", 'warning');
        } else if (msg.includes("Минимальная ставка")) {
            showNotification(msg, 'error');
        } else if (msg.includes("превышает лимит комнаты")) {
            showNotification(msg, 'error');
        } else if (msg.includes("Недостаточно средств")) {
            showNotification("Недостаточно средств на балансе. Пополните счет.", 'error');
        } else if (msg.includes("Пользователь не найден")) {
            showNotification("Ошибка аутентификации. Перезагрузите страницу.", 'error');
        } else {
            showNotification(msg, 'error');
        }
    }
}

async function tryToTransitionToRolling() {
    try {
        const roomRef = doc(db, 'jackpot_rooms', activeRoom);
        await runTransaction(db, async (transaction) => {
            const docSnap = await transaction.get(roomRef);
            if(!docSnap.exists()) return;
            // Проверяем, что все еще в режиме обратного отсчета
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

            let tickets = [];
            let currentTicket = 0;
            
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
        });
    } catch(e) {}
}

// --- ВРАЩЕНИЕ РУЛЕТКИ (Байтерская анимация) ---
function spinTape(winner, players) {
    const tape = els.tapeTrack;
    if (!tape) return;
    
    // СБРОС СТИЛЕЙ
    tape.innerHTML = '';
    tape.style.width = ''; 
    tape.style.justifyContent = '';
    tape.style.paddingLeft = ''; 

    tape.style.display = 'flex'; 
    tape.classList.add('spinning');

    const WIN_INDEX = 80;
    const TOTAL_CARDS = 105;
    const CARD_WIDTH = 70; // 60px + 10px margins

    let displayPool = [];
    players.forEach(p => {
        let count = Math.ceil(p.amount / (currentRoundData.pot / 50)); 
        if (count < 1) count = 1;
        if (count > 20) count = 20; 
        for(let k=0; k<count; k++) displayPool.push(p);
    });
    
    // Перемешиваем пул для рулетки
    displayPool.sort(() => Math.random() - 0.5);

    for (let i = 0; i < TOTAL_CARDS; i++) {
        let player;
        let chanceDisplay = "0%";

        if (i === WIN_INDEX) {
            // КАРТОЧКА ПОБЕДИТЕЛЯ (Point 1: всегда аватар победителя)
            player = { avatar: winner.avatar, username: winner.username }; 
            if (winner.chance !== undefined) {
                chanceDisplay = winner.chance.toFixed(1) + "%";
            } else if (currentRoundData && currentRoundData.pot > 0) {
                 chanceDisplay = "?%"; 
            }
        } else {
            // СЛУЧАЙНАЯ
            player = displayPool[Math.floor(Math.random() * displayPool.length)];
            if (currentRoundData && currentRoundData.pot > 0) {
                const chanceVal = (player.amount / currentRoundData.pot) * 100;
                chanceDisplay = chanceVal.toFixed(1) + "%";
            }
        }
        
        const div = document.createElement('div');
        div.className = 'tape-card';
        if (player.username === winner.username) div.classList.add('rare-3'); 
        else div.classList.add('rare-1');
        
        div.innerHTML = `
            <div class="tape-avatar-box">
                <img src="${player.avatar || 'assets/avatars/orange_cat_ava.png'}">
            </div>
            <div class="tape-chance-badge">${chanceDisplay}</div>
        `;
        tape.appendChild(div);
    }

    const parentWidth = els.tapeTrack.parentElement ? els.tapeTrack.parentElement.offsetWidth : 600;
    const targetX = (WIN_INDEX * CARD_WIDTH) - (parentWidth / 2) + (CARD_WIDTH / 2);

    tape.style.transition = 'none';
    tape.style.transform = 'translateX(0px)';
    tape.offsetHeight; 

    // --- БАЙТЕРСКАЯ АНИМАЦИЯ ---
    tape.style.transition = 'transform 8s cubic-bezier(0.05, 0.7, 0.1, 1.0)';
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
        
        setTimeout(() => {
            resetRoundInDB();
            resetUI(); 
        }, 5000);

    }, 8500); // Тайм-аут 8.5 сек (чуть больше длительности анимации)
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