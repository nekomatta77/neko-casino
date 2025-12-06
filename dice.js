/*
 * DICE.JS - С ВНЕДРЕННЫМ ANTI-MINUS
 */
import { currentBalance, updateBalance, showSection, writeBetToHistory, currentUser, reduceWager, AntiMinus } from './global.js';
import { checkBetAchievement } from './achievements.js'; // ИМПОРТ

let diceBet = 10.00;
let diceChance = 50.00; 
let diceMultiplier = 2.00;
let lastGameData = null; 

// ... (sha256 и generateSalt без изменений) ...
async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function generateSalt(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) result += characters.charAt(Math.floor(Math.random() * characters.length));
    return result;
}

function calculateDiceMultiplier(chance) {
    if (chance <= 0 || chance >= 100) return 0;
    return (100.00 / chance).toFixed(2); 
}

function updateDiceCalculations() {
    let currentBetVal = parseFloat(document.getElementById('dice-bet').value) || 0;
    let currentChanceVal = parseFloat(document.getElementById('dice-chance').value) || 0;
    const clampedChance = parseFloat(Math.min(98.00, Math.max(1.00, currentChanceVal)).toFixed(2));
    const clampedBet = parseFloat(Math.max(1.00, currentBetVal).toFixed(2));
    const tempMultiplier = calculateDiceMultiplier(clampedChance);
    const winAmount = clampedBet * parseFloat(tempMultiplier);
    const profitDisplayElement = document.getElementById('dice-profit-display');
    profitDisplayElement.textContent = winAmount.toFixed(2); 
    if (winAmount <= clampedBet) profitDisplayElement.classList.add('zero');
    else profitDisplayElement.classList.remove('zero');
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
    let currentVal = parseFloat(inputElement.value) || 1.00;
    if (action === 'half') currentVal = Math.max(1.00, currentVal / 2); 
    else if (action === 'double') currentVal = Math.min(currentBalance, currentVal * 2); 
    else if (action === 'min') currentVal = 1.00;
    else if (action === 'max') currentVal = currentBalance;
    
    diceBet = parseFloat(Math.max(1.00, currentVal).toFixed(2));
    inputElement.value = diceBet.toFixed(2);
    formatAndSyncDiceUI();
}

function handleDiceChanceAction(action, inputElement) {
    let currentVal = parseFloat(inputElement.value) || 1.00;
    if (action === 'half') currentVal = Math.max(1.00, currentVal / 2);
    else if (action === 'double') currentVal = Math.min(98.00, currentVal * 2); 
    else if (action === 'min') currentVal = 1.00;
    else if (action === 'max') currentVal = 98.00;
    
    diceChance = parseFloat(Math.min(98.00, Math.max(1.00, currentVal)).toFixed(2));
    inputElement.value = diceChance.toFixed(2);
    formatAndSyncDiceUI();
}

async function rollDice(rollType) {
    formatAndSyncDiceUI();
    const bet = diceBet;
    const multiplier = parseFloat(diceMultiplier);
    const potentialWin = bet * multiplier;
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

    updateBalance(-bet);
    reduceWager(bet);
    
    // --- ПРОВЕРКА ДОСТИЖЕНИЯ ---
    checkBetAchievement('dice_backgammon', bet);
    // ---------------------------

    // --- ANTI-MINUS LOGIC ---
    let rollRaw = Math.floor(Math.random() * 1000000);
    let targetNumber;
    let isWinNatural = false;

    if (rollType === 'under') {
        targetNumber = Math.floor(diceChance * 10000) - 1;
        if (rollRaw <= targetNumber) isWinNatural = true;
    } else {
        targetNumber = Math.ceil((100.00 - diceChance) * 10000);
        if (rollRaw >= targetNumber) isWinNatural = true;
    }

    let win = isWinNatural;
    if (isWinNatural) {
        const profit = potentialWin - bet;
        if (!AntiMinus.canUserWin(profit, bet)) {
            win = false;
            if (rollType === 'under') {
                rollRaw = targetNumber + Math.floor(Math.random() * (999999 - targetNumber));
            } else {
                rollRaw = Math.floor(Math.random() * targetNumber);
            }
        }
    }
    // ------------------------

    const rollDisplay = rollRaw.toString().padStart(6, '0'); 
    document.getElementById('dice-result-number').textContent = rollDisplay;

    // --- ОБНОВЛЕННЫЙ ФОРМАТ РЕЗУЛЬТАТА ДЛЯ ИСТОРИИ ---
    // Сохраняем: "123456 | 49.50% | <" (Например)
    const directionSymbol = rollType === 'under' ? '<' : '>';
    const resultString = `${rollDisplay} | ${diceChance.toFixed(2)}% | ${directionSymbol}`;

    const betData = {
        username: currentUser,
        game: 'dice',
        result: resultString, // Новый формат
        betAmount: bet,
        amount: 0
    };

    if (win) {
        updateBalance(potentialWin); 
        statusElement.textContent = `Выигрыш ${potentialWin.toFixed(2)} RUB`; 
        statusElement.classList.add('win');
        betData.amount = potentialWin - bet;
        // betData.result = `${multiplier.toFixed(2)}x`; // УБРАНО, чтобы сохранить resultString
        betData.multiplier = `${multiplier.toFixed(2)}x`;
    } else {
        statusElement.textContent = `Выпало: ${rollDisplay}`; 
        statusElement.classList.add('loss');
        betData.amount = -bet;
        betData.multiplier = `${multiplier.toFixed(2)}x`;
    }

    writeBetToHistory(betData);

    const salt1 = generateSalt(16);
    const salt2 = generateSalt(16);
    const combined = `${salt1}|${rollRaw}|${salt2}`;
    const hash = await sha256(combined); 
    const gameId = Math.floor(Math.random() * 90000000) + 10000000; 

    lastGameData = {
        gameId, combined, hash, salt1, number: rollDisplay, salt2, betAmount: bet, chance: diceChance, rollType, win
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
    document.getElementById('hash-modal-overlay').classList.remove('hidden');
}

function hideHashModal() {
    document.getElementById('hash-modal-overlay').classList.add('hidden');
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
        statusEl.textContent = '✅ Верификация успешна!';
        statusEl.classList.add('success');
    } else {
        statusEl.textContent = `❌ Ошибка верификации!`;
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
                    handleDiceBetAction(actionClass.substring(4), diceBetInput);
                } else if (actionClass && actionClass.startsWith('chance')) {
                    handleDiceChanceAction(actionClass.substring(7), diceChanceInput);
                }
            });
        });
        const rollUnderBtn = document.getElementById('roll-under');
        const rollOverBtn = document.getElementById('roll-over');
        if (rollUnderBtn) rollUnderBtn.addEventListener('click', () => rollDice('under'));
        if (rollOverBtn) rollOverBtn.addEventListener('click', () => rollDice('over'));
    }
    const checkLink = document.getElementById('dice-check-game');
    const hashModalOverlay = document.getElementById('hash-modal-overlay');
    const hashModalClose = document.getElementById('hash-modal-close');
    const hashVerifyBtn = document.getElementById('hash-verify-button');
    if (checkLink) checkLink.addEventListener('click', showHashModal);
    if (hashModalOverlay) hashModalOverlay.addEventListener('click', (e) => { if (e.target === hashModalOverlay) hideHashModal(); });
    if (hashModalClose) hashModalClose.addEventListener('click', hideHashModal);
    if (hashVerifyBtn) hashVerifyBtn.addEventListener('click', verifyHash);
}

export { initDice };