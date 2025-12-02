/*
 * Апгрейд Админки: Добавлена вкладка Anti-Minus
 */

import { fetchAllUsers, patchUser, createPromocode, deleteUser, fetchUserDepositHistory, fetchUserWithdrawalHistory, clearBetHistory, AntiMinus } from './global.js';

// --- ЭЛЕМЕНТЫ DOM ---
let adminTabs, adminTabContents;
let userSearchInput, userListBody;
let promoForm, promoNameInput, promoAmountInput, promoActivationsInput, promoCreateBtn, promoStatusEl;
let adminStatsModal, adminStatsClose, adminStatsUsername, adminStatsDeposits, adminStatsWithdrawals, adminStatsProfit, adminStatsProfitBox;
let promoWagerInput;
let clearHistoryBtn, clearHistoryStatus;

// Элементы Anti-Minus
let amRtpInput, amBankInput, amToggle, amSaveBtn, amStatus, amCurrentRtpDisplay;

// Локальный кеш пользователей
let allUsersCache = null;

const RANK_OPTIONS = {
    'None Rang': 'Без ранга',
    'Kitten': 'Котенок',
    'Old Cat': 'Бывалый кот',
    'Street Cat': 'Уличный боец',
    'King': 'Король',
    'admin': 'Владелец'
};

function initAdminTabs() {
    adminTabs = document.querySelectorAll('#admin-tabs .ref-tab');
    adminTabContents = document.querySelectorAll('#admin-page .ref-tab-content');

    adminTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetId = tab.getAttribute('data-target');
            adminTabs.forEach(t => t.classList.remove('active'));
            adminTabContents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            const targetContent = document.getElementById(targetId);
            if (targetContent) targetContent.classList.add('active');
            
            // Обновляем данные Anti-Minus при открытии вкладки
            if (targetId === 'admin-tab-antiminus') {
                updateAntiMinusUI();
            }
        });
    });
}

export async function handleSearchUsers(force = false) {
    if (!allUsersCache || force) {
        const usersData = await fetchAllUsers(); 
        if (Array.isArray(usersData)) {
            allUsersCache = usersData;
        } else if (typeof usersData === 'object' && usersData !== null) {
            allUsersCache = Object.keys(usersData).map(username => ({
                username: username,
                ...usersData[username]
            }));
        } else {
            allUsersCache = [];
        }
    }
    renderUserList(allUsersCache);
}

function renderUserList(users) {
    if (!userListBody || !users) return;
    const searchTerm = (userSearchInput ? userSearchInput.value.toLowerCase() : '').trim();
    const filteredUsers = searchTerm 
        ? users.filter(user => user.username && user.username.toLowerCase().includes(searchTerm))
        : users;

    const html = filteredUsers.map(user => {
        const dbRank = user.rank || 'None Rang';
        const rankOptionsHtml = Object.keys(RANK_OPTIONS).map(dbKey => {
            const selected = dbKey === dbRank ? 'selected' : '';
            return `<option value="${dbKey}" ${selected}>${RANK_OPTIONS[dbKey]}</option>`; 
        }).join('');
        
        const rankSelectHtml = `
            <select class="admin-rank-select">
                ${rankOptionsHtml}
            </select>
            <button class="admin-rank-save-btn button admin-button">Сохранить</button>
        `;

        return `
            <tr data-username="${user.username}">
                <td data-label="Ник">${user.username}</td>
                <td data-label="Пароль">
                    <input type="text" value="${(user.password || '')}" class="admin-password-input">
                    <button class="admin-password-save-btn button admin-button">Сохранить</button>
                </td>
                <td data-label="Баланс">
                    <input type="number" step="0.01" min="0" value="${(user.balance || 0).toFixed(2)}" class="admin-balance-input">
                    <button class="admin-balance-save-btn button admin-button">Сохранить</button>
                </td>
                <td data-label="Ранг">
                    <div class="rank-control-group">
                        ${rankSelectHtml}
                    </div>
                </td>
                <td data-label="Действия">
                    <button class="admin-stats-btn button admin-button">Статистика</button>
                    <button class="admin-block-btn button admin-button">Заблокировать</button>
                </td>
            </tr>
        `;
    }).join('');

    userListBody.innerHTML = html;
}

// ... (Обработчики баланса, пароля, ранга и блокировки без изменений) ...
async function handleUpdateBalance(e) {
    const button = e.target.closest('.admin-balance-save-btn');
    if (!button) return;
    const listItem = button.closest('tr');
    const username = listItem.getAttribute('data-username');
    const balanceInput = listItem.querySelector('.admin-balance-input');
    let newBalance = parseFloat(balanceInput.value);
    if (isNaN(newBalance) || newBalance < 0) return alert('Некорректная сумма баланса.');
    button.disabled = true;
    button.textContent = 'Сохранение...';
    const success = await patchUser(username, { balance: newBalance }); 
    if (success) {
        alert(`Баланс обновлен.`);
        allUsersCache = null;
        await handleSearchUsers(true); 
    } else {
        alert(`Ошибка.`);
    }
    button.disabled = false;
    button.textContent = 'Сохранить';
}

async function handleUpdatePassword(e) {
    const button = e.target.closest('.admin-password-save-btn');
    if (!button) return;
    const listItem = button.closest('tr');
    const username = listItem.getAttribute('data-username');
    const passwordInput = listItem.querySelector('.admin-password-input');
    const newPassword = passwordInput.value.trim();
    if (!newPassword) return alert('Пароль пуст.');
    button.disabled = true;
    button.textContent = 'Сохранение...';
    const success = await patchUser(username, { password: newPassword });
    if (success) alert(`Пароль обновлен.`);
    else alert(`Ошибка.`);
    button.disabled = false;
    button.textContent = 'Сохранить';
}

async function handleUpdateRank(e) {
    const button = e.target.closest('.admin-rank-save-btn');
    if (!button) return;
    const listItem = button.closest('tr');
    const username = listItem.getAttribute('data-username');
    const rankSelect = listItem.querySelector('.admin-rank-select');
    const newRank = rankSelect.value;
    button.disabled = true;
    button.textContent = 'Сохранение...';
    const success = await patchUser(username, { rank: newRank });
    if (success) {
        alert(`Ранг обновлен.`);
        allUsersCache = null;
        await handleSearchUsers(true); 
    } else alert(`Ошибка.`);
    button.disabled = false;
    button.textContent = 'Сохранить';
}

async function handleBlockUser(e) {
    const button = e.target.closest('.admin-block-btn');
    if (!button) return;
    const listItem = button.closest('tr');
    const username = listItem.getAttribute('data-username');
    if (!confirm(`Удалить пользователя ${username}?`)) return;
    button.disabled = true;
    button.textContent = 'Удаление...';
    const success = await deleteUser(username);
    if (success) {
        alert(`Удален.`);
        allUsersCache = null;
        await handleSearchUsers(true);
    } else {
        alert(`Ошибка.`);
        button.disabled = false;
        button.textContent = 'Заблокировать';
    }
}

async function handleShowStats(e) {
    const button = e.target.closest('.admin-stats-btn');
    if (!button) return;
    const listItem = button.closest('tr');
    const username = listItem.getAttribute('data-username');
    adminStatsUsername.textContent = username;
    adminStatsDeposits.textContent = '...';
    adminStatsWithdrawals.textContent = '...';
    adminStatsProfit.textContent = '...';
    adminStatsModal.classList.remove('hidden');
    const depositsData = await fetchUserDepositHistory(username);
    const withdrawalsData = await fetchUserWithdrawalHistory(username);
    const depositsArray = Array.isArray(depositsData) ? depositsData : Object.values(depositsData || {});
    const withdrawalsArray = Array.isArray(withdrawalsData) ? withdrawalsData : Object.values(withdrawalsData || {});
    let totalDeposits = depositsArray.reduce((sum, dep) => (dep.status === 'Success' && dep.amount) ? sum + dep.amount : sum, 0);
    adminStatsDeposits.textContent = `${totalDeposits.toFixed(2)} RUB`;
    let totalWithdrawals = withdrawalsArray.reduce((sum, wd) => (wd.status === 'Success' && wd.amount) ? sum + wd.amount : sum, 0);
    adminStatsWithdrawals.textContent = `${totalWithdrawals.toFixed(2)} RUB`;
    const profit = totalDeposits - totalWithdrawals;
    adminStatsProfit.textContent = `${profit.toFixed(2)} RUB`;
    adminStatsProfitBox.className = 'profile-box ' + (profit > 0 ? 'win' : profit < 0 ? 'loss' : '');
}

function hideStatsModal() {
    if (adminStatsModal) adminStatsModal.classList.add('hidden');
}

// --- ЛОГИКА ANTI-MINUS ---

function updateAntiMinusUI() {
    const settings = AntiMinus.settings;
    if(amRtpInput) amRtpInput.value = settings.targetRTP;
    if(amBankInput) amBankInput.value = settings.minBankReserve;
    if(amToggle) amToggle.checked = settings.active;
    
    // Расчет текущего RTP
    const stats = AntiMinus.stats;
    const totalBets = stats.totalIn || 1; // Избегаем деления на 0
    const totalWins = stats.totalOut || 0;
    const currentRTP = (totalWins / totalBets) * 100;
    
    if(amCurrentRtpDisplay) {
        amCurrentRtpDisplay.textContent = `${currentRTP.toFixed(2)}%`;
        if(currentRTP > settings.targetRTP) {
            amCurrentRtpDisplay.style.color = 'var(--color-mine-bomb)'; // Красный - перебор
        } else {
            amCurrentRtpDisplay.style.color = 'var(--color-secondary)'; // Зеленый - норма
        }
    }
}

function handleSaveAntiMinus(e) {
    e.preventDefault();
    const newSettings = {
        targetRTP: parseFloat(amRtpInput.value),
        minBankReserve: parseFloat(amBankInput.value),
        active: amToggle.checked
    };
    
    AntiMinus.saveSettings(newSettings);
    
    amStatus.textContent = "Настройки сохранены и применены!";
    amStatus.classList.add('success');
    setTimeout(() => amStatus.textContent = '', 3000);
    
    updateAntiMinusUI();
}

// --- ЛОГИКА ПРОМОКОДОВ И ИСТОРИИ (без изменений) ---
async function handleCreatePromo(e) {
    e.preventDefault();
    const code = promoNameInput.value.trim().toUpperCase();
    const amount = parseFloat(promoAmountInput.value);
    const activations = parseInt(promoActivationsInput.value, 10);
    const wager = parseInt(promoWagerInput.value, 10) || 0;
    if (!code || isNaN(amount) || amount <= 0) return;
    promoCreateBtn.disabled = true;
    promoCreateBtn.textContent = 'Создание...';
    const success = await createPromocode(code, { amount, activations, wager });
    if (success) {
        promoStatusEl.textContent = `Промокод "${code}" создан!`;
        promoStatusEl.className = 'profile-status success';
        promoForm.reset();
    } else {
        promoStatusEl.textContent = 'Ошибка.';
        promoStatusEl.className = 'profile-status error';
    }
    promoCreateBtn.disabled = false;
    promoCreateBtn.textContent = 'Создать';
}

async function handleClearHistory(e) {
    e.preventDefault();
    if (!confirm('Удалить ВСЮ историю ставок?')) return;
    clearHistoryBtn.disabled = true;
    clearHistoryBtn.textContent = 'Удаление...';
    const success = await clearBetHistory();
    clearHistoryStatus.textContent = success ? 'Очищено.' : 'Ошибка.';
    clearHistoryStatus.className = success ? 'profile-status success' : 'profile-status error';
    clearHistoryBtn.disabled = false;
    clearHistoryBtn.textContent = 'Очистить всю историю игр';
}

export function initAdmin() {
    initAdminTabs();

    // Users
    userSearchInput = document.getElementById('admin-user-search');
    userListBody = document.getElementById('admin-user-list-body');
    if (userSearchInput) userSearchInput.addEventListener('input', () => renderUserList(allUsersCache));
    if (userListBody) {
        userListBody.addEventListener('click', (e) => {
            handleUpdateBalance(e); 
            handleUpdateRank(e);
            handleUpdatePassword(e);
            handleBlockUser(e);
            handleShowStats(e);
        });
    }
    
    // Stats Modal
    adminStatsModal = document.getElementById('admin-stats-modal-overlay');
    adminStatsClose = document.getElementById('admin-stats-modal-close');
    adminStatsUsername = document.getElementById('admin-stats-username');
    adminStatsDeposits = document.getElementById('admin-stats-deposits');
    adminStatsWithdrawals = document.getElementById('admin-stats-withdrawals');
    adminStatsProfit = document.getElementById('admin-stats-profit');
    adminStatsProfitBox = document.getElementById('admin-stats-profit-box');
    if (adminStatsModal) adminStatsModal.addEventListener('click', (e) => { if (e.target === adminStatsModal) hideStatsModal(); });
    if (adminStatsClose) adminStatsClose.addEventListener('click', hideStatsModal);

    // Promos
    promoForm = document.getElementById('admin-promo-form');
    promoNameInput = document.getElementById('admin-promo-name');
    promoAmountInput = document.getElementById('admin-promo-amount');
    promoActivationsInput = document.getElementById('admin-promo-activations');
    promoCreateBtn = document.getElementById('admin-promo-create-btn');
    promoStatusEl = document.getElementById('admin-promo-status');
    promoWagerInput = document.getElementById('admin-promo-wager');
    if (promoForm) promoForm.addEventListener('submit', handleCreatePromo);

    // Clear History
    clearHistoryBtn = document.getElementById('admin-clear-history-btn');
    clearHistoryStatus = document.getElementById('admin-clear-history-status');
    if (clearHistoryBtn) clearHistoryBtn.addEventListener('click', handleClearHistory);
    
    // Anti-Minus
    amRtpInput = document.getElementById('am-rtp-input');
    amBankInput = document.getElementById('am-bank-input');
    amToggle = document.getElementById('am-active-toggle');
    amSaveBtn = document.getElementById('am-save-btn');
    amStatus = document.getElementById('am-status');
    amCurrentRtpDisplay = document.getElementById('am-current-rtp');
    
    if (amSaveBtn) amSaveBtn.addEventListener('click', handleSaveAntiMinus);
    
    // Динамическое добавление вкладки Anti-Minus, если её нет в HTML
    const tabsContainer = document.getElementById('admin-tabs');
    if(tabsContainer && !document.querySelector('[data-target="admin-tab-antiminus"]')) {
        const amTab = document.createElement('button');
        amTab.className = 'ref-tab';
        amTab.setAttribute('data-target', 'admin-tab-antiminus');
        amTab.textContent = 'Anti-Minus AI';
        tabsContainer.appendChild(amTab);
        
        const amContent = document.createElement('div');
        amContent.className = 'ref-tab-content';
        amContent.id = 'admin-tab-antiminus';
        amContent.innerHTML = `
            <div class="admin-container" style="max-width: 600px;">
                <h3 class="ref-list-header">Настройки Умного Анти-Минуса</h3>
                <div class="profile-box" style="margin-bottom: 15px;">
                    <span>Текущий RTP Проекта:</span>
                    <span id="am-current-rtp" style="font-size: 1.2em;">Загрузка...</span>
                </div>
                
                <form class="ref-form">
                    <div class="crash-auto-row-styled" style="margin-bottom: 15px;">
                        <span class="crash-label-title">Активен</span>
                        <label class="switch-toggle">
                            <input type="checkbox" id="am-active-toggle">
                            <span class="slider round"></span>
                        </label>
                    </div>
                    
                    <div class="form-group">
                        <label>Целевой RTP (%) - Рекомендуется 70-90%</label>
                        <input type="number" id="am-rtp-input" step="1" min="1" max="100">
                    </div>
                    
                    <div class="form-group">
                        <label>Мин. Резерв Банка (RUB)</label>
                        <input type="number" id="am-bank-input" step="100">
                    </div>
                    
                    <button id="am-save-btn" class="auth-button green-button full-width">Применить настройки</button>
                    <div id="am-status" class="profile-status"></div>
                </form>
                
                <p style="font-size: 0.8em; color: #888; margin-top: 10px; text-align: center;">
                    * Система автоматически подкручивает результаты всех 6 режимов, если RTP превышает целевой или банк опускается ниже резерва.
                </p>
            </div>
        `;
        document.querySelector('.admin-container').appendChild(amContent);
        
        // Re-bind elements after creating HTML
        initAdmin(); 
    }
}
