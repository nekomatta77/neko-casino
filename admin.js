/*
 * ADMIN.JS - COMPLETE (User Cards, Promo Management, Anti-Minus)
 */

import { 
    fetchAllUsers, patchUser, createPromocode, deleteUser, 
    fetchUserDepositHistory, fetchUserWithdrawalHistory, clearBetHistory, 
    AntiMinus, fetchAllPromocodes, deletePromocodeById, bulkDeletePromocodes 
} from './global.js';

// --- ЭЛЕМЕНТЫ DOM ---
let adminTabs, adminTabContents;

// Пользователи
let userSearchInput, userListContainer;

// Промокоды
let promoForm, promoNameInput, promoAmountInput, promoActivationsInput, promoWagerInput, promoCreateBtn, promoStatusEl;
let promoTabs, promoTabContents, promoListBody, btnLoadPromos;
let btnBulkDelete, deleteModal, deleteModalClose, deleteOptionsBtns;

// Статистика
let adminStatsModal, adminStatsClose, adminStatsUsername, adminStatsDeposits, adminStatsWithdrawals, adminStatsProfit, adminStatsProfitBox;

// Настройки
let clearHistoryBtn, clearHistoryStatus;

// Anti-Minus
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

// ==========================================
// 1. ИНИЦИАЛИЗАЦИЯ ВКЛАДОК
// ==========================================

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
            
            // Обновляем специфичные данные при открытии вкладки
            if (targetId === 'admin-tab-antiminus') {
                updateAntiMinusUI();
            }
        });
    });
}

function initPromoSubTabs() {
    promoTabs = document.querySelectorAll('#admin-tab-promocodes .ref-subtab');
    promoTabContents = document.querySelectorAll('#admin-tab-promocodes .ref-subtab-content');

    promoTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetId = tab.getAttribute('data-target');
            
            promoTabs.forEach(t => t.classList.remove('active'));
            promoTabContents.forEach(c => c.classList.remove('active'));
            
            tab.classList.add('active');
            document.getElementById(targetId).classList.add('active');
            
            if (targetId === 'admin-subtab-list') {
                loadPromocodesList();
            }
        });
    });
}

// ==========================================
// 2. УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ (КАРТОЧКИ)
// ==========================================

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

/**
 * Рендер списка пользователей (КАРТОЧКИ)
 */
function renderUserList(users) {
    // Ищем контейнер для сетки или создаем его, заменяя таблицу
    let container = document.getElementById('admin-users-grid-container');
    
    if (!container) {
        const oldTableWrapper = document.querySelector('#admin-tab-users .ref-table-wrapper');
        if (oldTableWrapper) {
            container = document.createElement('div');
            container.id = 'admin-users-grid-container';
            container.className = 'admin-users-grid';
            oldTableWrapper.parentNode.replaceChild(container, oldTableWrapper);
            
            // Вешаем делегирование событий один раз
            container.addEventListener('click', handleUserActions);
            container.addEventListener('change', handleUserActions); // Для селектов
        } else {
            return; 
        }
    }
    
    userListContainer = container;

    const searchTerm = (userSearchInput ? userSearchInput.value.toLowerCase() : '').trim();
    const filteredUsers = searchTerm 
        ? users.filter(user => user.username && user.username.toLowerCase().includes(searchTerm))
        : users;

    if (filteredUsers.length === 0) {
        userListContainer.innerHTML = '<div class="ref-list-placeholder">Пользователи не найдены</div>';
        return;
    }

    const html = filteredUsers.map(user => {
        const dbRank = user.rank || 'None Rang';
        const rankOptionsHtml = Object.keys(RANK_OPTIONS).map(dbKey => {
            const selected = dbKey === dbRank ? 'selected' : '';
            return `<option value="${dbKey}" ${selected}>${RANK_OPTIONS[dbKey]}</option>`; 
        }).join('');
        
        const initial = user.username.charAt(0).toUpperCase();

        return `
            <div class="admin-user-card" data-username="${user.username}">
                
                <div class="user-card-header">
                    <div class="user-card-identity">
                        <div class="user-avatar-placeholder">${initial}</div>
                        <span class="user-card-name">${user.username}</span>
                    </div>
                    
                    <select class="user-rank-select action-change-rank">
                        ${rankOptionsHtml}
                    </select>
                </div>

                <div class="user-card-body">
                    <div class="user-input-group">
                        <span class="user-input-label">Пароль</span>
                        <input type="text" value="${(user.password || '')}" class="user-card-input input-password">
                        <button class="input-save-btn action-save-pass" title="Сохранить">💾</button>
                    </div>

                    <div class="user-input-group">
                        <span class="user-input-label">Баланс</span>
                        <input type="number" step="0.01" value="${(user.balance || 0).toFixed(2)}" class="user-card-input input-balance">
                        <button class="input-save-btn action-save-balance" title="Сохранить">💾</button>
                    </div>
                </div>

                <div class="user-card-footer">
                    <button class="card-action-btn btn-stats-card action-stats">
                        📊 Статистика
                    </button>
                    <button class="card-action-btn btn-block-card action-block">
                        🚫 БАН
                    </button>
                </div>

            </div>
        `;
    }).join('');

    userListContainer.innerHTML = html;
}

// --- ЕДИНЫЙ ОБРАБОТЧИК СОБЫТИЙ ДЛЯ КАРТОЧЕК ---
async function handleUserActions(e) {
    const target = e.target;
    
    // Находим карточку
    const card = target.closest('.admin-user-card');
    if (!card) return;
    
    const username = card.getAttribute('data-username');

    // 1. Сохранить Баланс
    if (target.closest('.action-save-balance')) {
        const btn = target.closest('.action-save-balance');
        const input = card.querySelector('.input-balance');
        const newBalance = parseFloat(input.value);
        
        if (isNaN(newBalance) || newBalance < 0) return alert('Некорректный баланс');
        
        btn.innerHTML = '⏳';
        const success = await patchUser(username, { balance: newBalance });
        btn.innerHTML = success ? '✅' : '❌';
        setTimeout(() => btn.innerHTML = '💾', 1500);
        if(success) allUsersCache = null; // Инвалидация кеша
    }
    
    // 2. Сохранить Пароль
    if (target.closest('.action-save-pass')) {
        const btn = target.closest('.action-save-pass');
        const input = card.querySelector('.input-password');
        const newPass = input.value.trim();
        
        if (!newPass) return alert('Пароль пуст');
        
        btn.innerHTML = '⏳';
        const success = await patchUser(username, { password: newPass });
        btn.innerHTML = success ? '✅' : '❌';
        setTimeout(() => btn.innerHTML = '💾', 1500);
    }
    
    // 3. Изменить Ранг (change событие)
    if (target.classList.contains('action-change-rank') && e.type === 'change') {
        const newRank = target.value;
        target.style.borderColor = '#F5A623'; // Индикация процесса
        const success = await patchUser(username, { rank: newRank });
        if(success) {
            target.style.borderColor = '#00D26A'; // Успех
            setTimeout(() => target.style.borderColor = 'rgba(255,255,255,0.1)', 1000);
            allUsersCache = null;
        } else {
            target.style.borderColor = '#FF5555'; // Ошибка
            alert('Ошибка смены ранга');
        }
    }
    
    // 4. Статистика
    if (target.closest('.action-stats')) {
        handleShowStats(username);
    }
    
    // 5. Бан
    if (target.closest('.action-block')) {
        const btn = target.closest('.action-block');
        if (!confirm(`Удалить пользователя ${username}?`)) return;
        
        btn.innerHTML = '⏳ Удаление...';
        const success = await deleteUser(username);
        if (success) {
            card.remove(); 
            allUsersCache = null;
        } else {
            btn.innerHTML = 'Ошибка';
        }
    }
}

async function handleShowStats(username) {
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


// ==========================================
// 3. УПРАВЛЕНИЕ ПРОМОКОДАМИ
// ==========================================

async function loadPromocodesList() {
    if (!promoListBody) return;
    promoListBody.innerHTML = '<tr><td colspan="4" class="ref-list-placeholder">Загрузка...</td></tr>';
    
    const promos = await fetchAllPromocodes();
    
    if (!promos || promos.length === 0) {
        promoListBody.innerHTML = '<tr><td colspan="4" class="ref-list-placeholder">Нет активных промокодов</td></tr>';
        return;
    }
    
    const html = promos.map(p => `
        <tr>
            <td><span style="color: #fff; font-weight: bold;">${p.code}</span></td>
            <td>${p.amount}</td>
            <td>${p.activations_left}</td>
            <td>
                <button class="icon-btn delete-promo-btn" data-id="${p.id}" title="Удалить">
                    🗑️
                </button>
            </td>
        </tr>
    `).join('');
    
    promoListBody.innerHTML = html;
}

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
        const resultHTML = `
            <div class="admin-promo-result-card">
                <div class="admin-promo-result-header">Промокод "${code}" создан!</div>
                <div class="admin-promo-result-details">
                    <div class="admin-promo-detail-item"><span>Сумма:</span> <span>${amount.toFixed(2)} RUB</span></div>
                    <div class="admin-promo-detail-item"><span>Активаций:</span> <span>${activations}</span></div>
                    <div class="admin-promo-detail-item"><span>Вейджер:</span> <span>x${wager}</span></div>
                </div>
            </div>
        `;
        
        promoStatusEl.innerHTML = resultHTML;
        promoStatusEl.className = 'profile-status'; 
        promoForm.reset();
    } else {
        promoStatusEl.textContent = 'Ошибка создания.';
        promoStatusEl.className = 'profile-status error';
    }
    
    promoCreateBtn.disabled = false;
    promoCreateBtn.textContent = 'Создать';
}

async function handleDeletePromo(e) {
    const btn = e.target.closest('.delete-promo-btn');
    if (!btn) return;
    
    if (!confirm('Удалить этот промокод?')) return;
    
    const id = btn.getAttribute('data-id');
    const success = await deletePromocodeById(id);
    
    if (success) {
        loadPromocodesList();
    } else {
        alert('Ошибка удаления');
    }
}

function initDeleteModal() {
    btnBulkDelete = document.getElementById('admin-bulk-delete-btn');
    deleteModal = document.getElementById('delete-modal-overlay');
    deleteModalClose = document.getElementById('delete-modal-close');
    deleteOptionsBtns = document.querySelectorAll('.delete-options-grid button');
    
    if (btnBulkDelete) {
        btnBulkDelete.addEventListener('click', (e) => {
            e.preventDefault(); 
            deleteModal.classList.remove('hidden');
        });
    }
    
    if (deleteModalClose) {
        deleteModalClose.addEventListener('click', () => deleteModal.classList.add('hidden'));
    }
    
    deleteOptionsBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            const period = btn.getAttribute('data-period');
            if (!confirm(`Вы уверены? Это действие нельзя отменить.`)) return;
            
            btn.disabled = true;
            btn.textContent = '...';
            
            const success = await bulkDeletePromocodes(period);
            
            if (success) {
                alert('Удалено.');
                loadPromocodesList();
                deleteModal.classList.add('hidden');
            } else {
                alert('Ошибка.');
            }
            
            btn.disabled = false;
            if(period === '24h') btn.textContent = 'За сутки';
            else if(period === 'week') btn.textContent = 'За неделю';
            else btn.textContent = 'Удалить ВСЕ';
        });
    });
}

// --- ANTI-MINUS & SETTINGS ---
function updateAntiMinusUI() {
    const settings = AntiMinus.settings;
    if(amRtpInput) amRtpInput.value = settings.targetRTP;
    if(amBankInput) amBankInput.value = settings.minBankReserve;
    if(amToggle) amToggle.checked = settings.active;
    
    const stats = AntiMinus.stats;
    const totalBets = stats.totalIn || 1; 
    const totalWins = stats.totalOut || 0;
    const currentRTP = (totalWins / totalBets) * 100;
    
    if(amCurrentRtpDisplay) {
        amCurrentRtpDisplay.textContent = `${currentRTP.toFixed(2)}%`;
        if(currentRTP > settings.targetRTP) {
            amCurrentRtpDisplay.style.color = 'var(--color-mine-bomb)';
        } else {
            amCurrentRtpDisplay.style.color = 'var(--color-secondary)';
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
    amStatus.textContent = "Настройки сохранены!";
    amStatus.classList.add('success');
    setTimeout(() => amStatus.textContent = '', 3000);
    updateAntiMinusUI();
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

// ==========================================
// 4. ИНИЦИАЛИЗАЦИЯ МОДУЛЯ
// ==========================================

export function initAdmin() {
    initAdminTabs();
    initPromoSubTabs(); 
    initDeleteModal();

    // Users
    userSearchInput = document.getElementById('admin-user-search');
    // Теперь handleSearchUsers сам найдет или создаст контейнер
    if (userSearchInput) userSearchInput.addEventListener('input', () => renderUserList(allUsersCache));

    // Инициализация загрузки (если список еще не создан, handleSearchUsers создаст его)
    handleSearchUsers();

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
    
    promoListBody = document.getElementById('admin-promo-list-body');
    if (promoListBody) {
        promoListBody.addEventListener('click', handleDeletePromo);
    }

    // Settings
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
        
        initAdmin(); 
    }
}