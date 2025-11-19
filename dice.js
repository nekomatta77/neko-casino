/*
 * (ИЗМЕНЕНО: ЗАДАЧА 1 - Убраны await для моментального старта)
 */
import { currentBalance, updateBalance, showSection, writeBetToHistory, currentUser, reduceWager } from './global.js';

// --- ЛОКАЛЬНЫЕ ПЕРЕМЕННЫЕ DICE ---
let diceBet = 10.00;
let diceChance = 50.00; 
let diceMultiplier = 2.00;
let lastGameData = null; 

// --- ПРОВЕРКА ХЭША (Provably Fair) ---
async function sha256(message) {
    try {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    } catch (error) {
        console.error("Ошибка SHA-256:", error);
        return null;
    }
}

function generateSalt(length) {
    try {
        const arr = new Uint8Array(length / 2);
        crypto.getRandomValues(arr);
        return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
        let result = '';
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return result;
    }
}

// --- ЛОГИКА DICE ---
function calculateDiceMultiplier(chance) {
    if (chance <= 0 || chance >= 100) return 0;
    return (100.00 / chance).toFixed(2); 
}

function updateDiceCalculations() {
    let currentBetVal = parseFloat(document.getElementById('dice-bet').value);
    let currentChanceVal = parseFloat(document.getElementById('dice-chance').value);

    if (isNaN(currentBetVal)) currentBetVal = 0;
    if (isNaN(currentChanceVal)) currentChanceVal = 0;

    const clampedChance = parseFloat(Math.min(98.00, Math.max(1.00, currentChanceVal)).toFixed(2));
    const clampedBet = parseFloat(Math.max(1.00, currentBetVal).toFixed(2));
    
    const tempMultiplier = calculateDiceMultiplier(clampedChance);
    const winAmount = clampedBet * parseFloat(tempMultiplier);
    
    const profitDisplayElement = document.getElementById('dice-profit-display');
    profitDisplayElement.textContent = winAmount.toFixed(2); 
    
    if (winAmount <= clampedBet) { 
        profitDisplayElement.classList.add('zero');
    } else {
        profitDisplayElement.classList.remove('zero');
    }
    
    const targetUnderNumber = Math.floor(clampedChance * 10000) - 1; 
    document.getElementById('roll-under-value').textContent = targetUnderNumber.toString().padStart(6, '0');
    
    const targetOverNumber = Math.ceil((100.00 - clampedChance) * 10000);
    document.getElementById('roll-over-value').textContent = targetOverNumber.toString().padStart(6, '0');
}

function formatAndSyncDiceUI() {
    let betVal = parseFloat(document.getElementById('dice-bet').value);
    let chanceVal = parseFloat(document.getElementById('dice-chance').value);

    diceBet = parseFloat(Math.max(1.00, isNaN(betVal) ? 1.00 : betVal).toFixed(2)); 
    diceChance = parseFloat(Math.min(98.00, Math.max(1.00, isNaN(chanceVal) ? 1.00 : chanceVal)).toFixed(2));
    
    diceMultiplier = calculateDiceMultiplier(diceChance);

    document.getElementById('dice-bet').value = diceBet.toFixed(2);
    document.getElementById('dice-chance').value = diceChance.toFixed(2);

    updateDiceCalculations();
}

function handleDiceBetAction(action, inputElement) {
    let currentVal = parseFloat(inputElement.value);
    if (isNaN(currentVal)) currentVal = 1.00;

    if (action === 'half') {
        currentVal = Math.max(1.00, currentVal / 2); 
    } else if (action === 'double') {
        currentVal = Math.min(currentBalance, currentVal * 2); 
    } else if (action === 'min') {
        currentVal = 1.00;
    } else if (action === 'max') {
        currentVal = currentBalance;
    }
    
    diceBet = parseFloat(Math.max(1.00, currentVal).toFixed(2));
    inputElement.value = diceBet.toFixed(2);
    formatAndSyncDiceUI();
}

function handleDiceChanceAction(action, inputElement) {
    let currentVal = parseFloat(inputElement.value);
    if (isNaN(currentVal)) currentVal = 1.00;

    if (action === 'half') {
        currentVal = Math.max(1.00, currentVal / 2);
    } else if (action === 'double') {
        currentVal = Math.min(98.00, currentVal * 2); 
    } else if (action === 'min') {
        currentVal = 1.00;
    } else if (action === 'max') {
        currentVal = 98.00;
    }
    
    diceChance = parseFloat(Math.min(98.00, Math.max(1.00, currentVal)).toFixed(2));
    inputElement.value = diceChance.toFixed(2);
    formatAndSyncDiceUI();
}

async function rollDice(rollType) {
    formatAndSyncDiceUI();

    const bet = diceBet;
    const multiplier = parseFloat(diceMultiplier);
    
    const statusElement = document.getElementById('dice-status');
    const checkLink = document.getElementById('dice-check-game');
    
    statusElement.textContent = ''; 
    statusElement.classList.remove('win', 'loss');
    checkLink.classList.add('hidden'); 

    void statusElement.offsetWidth;

    if (currentBalance < bet) {
        statusElement.textContent = '⚠️ Недостаточно средств!';
        statusElement.classList.add('loss');
        return;
    }
    
    if (bet < 1.00) {
        statusElement.textContent = '❌ Минимальная ставка 1.00!';
        statusElement.classList.add('loss');
        return;
    }

    // ИЗМЕНЕНО: Убраны await для моментального старта
    updateBalance(-bet);
    reduceWager(bet);

    const rollRaw = Math.floor(Math.random() * 1000000);
    const rollDisplay = rollRaw.toString().padStart(6, '0'); 
    // Показываем число сразу
    document.getElementById('dice-result-number').textContent = rollDisplay;

    let win = false;
    let targetNumber;

    if (rollType === 'under') {
        targetNumber = Math.floor(diceChance * 10000) - 1; 
        if (rollRaw <= targetNumber) {
            win = true;
        }
    } else {
        targetNumber = Math.ceil((100.00 - diceChance) * 10000);
        if (rollRaw >= targetNumber) {
            win = true;
        }
    }

    const betData = {
        username: currentUser,
        game: 'dice',
        result: rollDisplay,
        betAmount: bet,
        amount: 0
    };

    if (win) {
        const winAmount = bet * multiplier;
        
        // ИЗМЕНЕНО: Убран await
        updateBalance(winAmount); 
        
        statusElement.textContent = `Выигрыш ${winAmount.toFixed(2)} RUB`; 
        statusElement.classList.add('win');

        betData.amount = winAmount - bet;
        betData.result = `${multiplier.toFixed(2)}x`;
        betData.multiplier = `${multiplier.toFixed(2)}x`;

    } else {
        // ИЗМЕНЕНО: Показываем выпавшее число при проигрыше
        statusElement.textContent = `Выпало: ${rollDisplay}`; 
        statusElement.classList.add('loss');

        betData.amount = -bet;
        betData.multiplier = `${multiplier.toFixed(2)}x`;
    }

    // ИЗМЕНЕНО: Убран await
    writeBetToHistory(betData);

    // Генерация хэша (асинхронно, но не блокирует игру)
    const salt1 = generateSalt(16);
    const salt2 = generateSalt(16);
    const number = rollRaw;
    const combined = `${salt1}|${number}|${salt2}`;
    const hash = await sha256(combined); 
    const gameId = Math.floor(Math.random() * 90000000) + 10000000; 

    lastGameData = {
        gameId,
        combined,
        hash,
        salt1,
        number: rollDisplay,
        salt2,
        betAmount: bet,
        chance: diceChance,
        rollType,
        win
    };
    
    checkLink.textContent = `Проверить игру #${gameId}`;
    checkLink.classList.remove('hidden');
}

function showHashModal(e) {
    e.preventDefault();
    if (!lastGameData) return;

    document.getElementById('hash-modal-game-id').textContent = `#${lastGameData.gameId}`;
    document.getElementById('hash-modal-combined').textContent = lastGameData.combined;
    document.getElementById('hash-modal-hash').textContent = lastGameData.hash;
    document.getElementById('hash-modal-salt1').textContent = lastGameData.salt1;
    document.getElementById('hash-modal-number').textContent = lastGameData.number;
    document.getElementById('hash-modal-salt2').textContent = lastGameData.salt2;
    
    document.getElementById('hash-modal-bet').textContent = `${lastGameData.betAmount.toFixed(2)} RUB`;
    document.getElementById('hash-modal-chance').textContent = `${lastGameData.chance.toFixed(2)}% (${lastGameData.rollType === 'under' ? 'Меньше' : 'Больше'})`;
    document.getElementById('hash-modal-result').textContent = lastGameData.win ? 'Выигрыш' : 'Проигрыш';

    const statusEl = document.getElementById('hash-verify-status');
    statusEl.textContent = '';
    statusEl.classList.remove('success', 'error');

    const modalOverlay = document.getElementById('hash-modal-overlay');
    if (modalOverlay) {
        modalOverlay.classList.remove('hidden');
    }
}

function hideHashModal() {
    const modalOverlay = document.getElementById('hash-modal-overlay');
    if (modalOverlay) {
        modalOverlay.classList.add('hidden');
    }
}

async function verifyHash() {
    const statusEl = document.getElementById('hash-verify-status');
    statusEl.textContent = 'Проверка...';
    statusEl.classList.remove('success', 'error');

    const salt1 = document.getElementById('hash-modal-salt1').textContent;
    const number = parseInt(document.getElementById('hash-modal-number').textContent, 10); 
    const salt2 = document.getElementById('hash-modal-salt2').textContent;
    const displayedHash = document.getElementById('hash-modal-hash').textContent;
    
    const combined = `${salt1}|${number}|${salt2}`;
    const calculatedHash = await sha256(combined);

    if (calculatedHash === displayedHash) {
        statusEl.textContent = '✅ Верификация успешна! Хэши совпадают.';
        statusEl.classList.add('success');
    } else {
        statusEl.textContent = `❌ Ошибка верификации! Хэши не совпадают. (Расчет: ${calculatedHash})`;
        statusEl.classList.add('error');
    }
}

function initDice() {
    const diceBetInput = document.getElementById('dice-bet');
    const diceChanceInput = document.getElementById('dice-chance');
    const diceActionsContainer = document.querySelector('.dice-game-container');
    
    formatAndSyncDiceUI(); 

    if (diceActionsContainer) {
        diceBetInput.addEventListener('input', updateDiceCalculations);
        diceChanceInput.addEventListener('input', updateDiceCalculations);

        diceBetInput.addEventListener('blur', formatAndSyncDiceUI);
        diceChanceInput.addEventListener('blur', formatAndSyncDiceUI);

        diceActionsContainer.querySelectorAll('.dice-input-group .bet-actions-grid button').forEach(button => {
            button.addEventListener('click', (e) => {
                const actionClass = Array.from(e.currentTarget.classList).find(cls => 
                    ['bet-min', 'bet-double', 'bet-half', 'bet-max', 'chance-min', 'chance-double', 'chance-half', 'chance-max'].includes(cls)
                );
                
                if (actionClass && actionClass.startsWith('bet')) {
                    const action = actionClass.substring(4); 
                    handleDiceBetAction(action, diceBetInput);
                } else if (actionClass && actionClass.startsWith('chance')) {
                    const action = actionClass.substring(7); 
                    handleDiceChanceAction(action, diceChanceInput);
                }
            });
        });

        const rollUnderBtn = document.getElementById('roll-under');
        const rollOverBtn = document.getElementById('roll-over');
        
        if (rollUnderBtn) {
            rollUnderBtn.addEventListener('click', () => rollDice('under'));
        }
        if (rollOverBtn) {
            rollOverBtn.addEventListener('click', () => rollDice('over'));
        }
    }

    const checkLink = document.getElementById('dice-check-game');
    const hashModalOverlay = document.getElementById('hash-modal-overlay');
    const hashModalClose = document.getElementById('hash-modal-close');
    const hashVerifyBtn = document.getElementById('hash-verify-button');

    if (checkLink) {
        checkLink.addEventListener('click', showHashModal);
    }
    if (hashModalOverlay) {
        hashModalOverlay.addEventListener('click', (e) => {
            if (e.target === hashModalOverlay) {
                hideHashModal();
            }
        });
    }
    if (hashModalClose) {
        hashModalClose.addEventListener('click', hideHashModal);
    }
    if (hashVerifyBtn) {
        hashVerifyBtn.addEventListener('click', verifyHash);
    }
}

export { initDice };
