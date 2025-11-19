/*
 * Краткое описание апгрейда (Миграция на Supabase):
 * 1. `handleSearchUsers`: Переписана обработка данных. Supabase возвращает массив объектов, а не карту ключей.
 * 2. Убрана зависимость от структуры данных Firebase (Object.keys).
 * 3. Сохранена логика отображения и редактирования рангов/баланса.
 */

import { fetchAllUsers, patchUser, createPromocode, deleteUser, fetchUserDepositHistory, fetchUserWithdrawalHistory, clearBetHistory } from './global.js';

// --- ЭЛЕМЕНТЫ DOM ---
let adminTabs, adminTabContents;
let userSearchInput, userListBody;
let promoForm, promoNameInput, promoAmountInput, promoActivationsInput, promoCreateBtn, promoStatusEl;
let adminStatsModal, adminStatsClose, adminStatsUsername, adminStatsDeposits, adminStatsWithdrawals, adminStatsProfit, adminStatsProfitBox;
let promoWagerInput;
let clearHistoryBtn, clearHistoryStatus;


// Локальный кеш пользователей для поиска
let allUsersCache = null;

// Карта рангов для отображения в админ-панели
const RANK_OPTIONS = {
    'None Rang': 'Без ранга',
    'Kitten': 'Котенок',
    'Old Cat': 'Бывалый кот',
    'Street Cat': 'Уличный боец',
    'King': 'Король',
    'admin': 'Владелец'
};

/**
 * Инициализирует главные вкладки (Пользователи / Промокоды)
 */
function initAdminTabs() {
    adminTabs = document.querySelectorAll('#admin-tabs .ref-tab');
    adminTabContents = document.querySelectorAll('#admin-page .ref-tab-content');

    adminTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetId = tab.getAttribute('data-target');
            
            // Снимаем .active со всех
            adminTabs.forEach(t => t.classList.remove('active'));
            adminTabContents.forEach(c => c.classList.remove('active'));
            
            // Добавляем .active нужному
            tab.classList.add('active');
            
            const targetContent = document.getElementById(targetId);
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });
}

/**
 * Загружает всех пользователей и обновляет список
 * ИЗМЕНЕНО ДЛЯ SUPABASE: Ожидается массив объектов, а не объект ключей.
 * @param {boolean} force - Принудительно обновить кеш
 */
export async function handleSearchUsers(force = false) {
    if (!allUsersCache || force) {
        const usersData = await fetchAllUsers(); 
        
        // Supabase возвращает массив. Если пришел null/undefined, ставим пустой массив.
        // Если вдруг пришел старый формат (объект), преобразуем (на случай гибридной миграции).
        if (Array.isArray(usersData)) {
            allUsersCache = usersData;
        } else if (typeof usersData === 'object' && usersData !== null) {
             // Fallback для старой структуры Firebase
            allUsersCache = Object.keys(usersData).map(username => ({
                username: username,
                ...usersData[username]
            }));
        } else {
            allUsersCache = [];
        }
    }

    // Рендерим список
    renderUserList(allUsersCache);
}


/**
 * Рендерит список пользователей в таблицу
 */
function renderUserList(users) {
    if (!userListBody || !users) return;

    // Фильтрация по поисковому запросу
    const searchTerm = (userSearchInput ? userSearchInput.value.toLowerCase() : '').trim();
    
    const filteredUsers = searchTerm 
        ? users.filter(user => user.username && user.username.toLowerCase().includes(searchTerm))
        : users;

    const html = filteredUsers.map(user => {
        const dbRank = user.rank || 'None Rang';
        
        // --- БЛОК ВЫБОРА РАНГА ---
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
        // --- КОНЕЦ БЛОКА ВЫБОРА РАНГА ---

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

/**
 * Обрабатывает обновление баланса
 */
async function handleUpdateBalance(e) {
    const button = e.target.closest('.admin-balance-save-btn');
    if (!button) return;

    const listItem = button.closest('tr');
    const username = listItem.getAttribute('data-username');
    const balanceInput = listItem.querySelector('.admin-balance-input');
    let newBalance = parseFloat(balanceInput.value);

    if (isNaN(newBalance) || newBalance < 0) {
        alert('Некорректная сумма баланса.');
        return;
    }

    button.disabled = true;
    button.textContent = 'Сохранение...';

    // Supabase update
    const success = await patchUser(username, { balance: newBalance }); 

    if (success) {
        alert(`Баланс пользователя ${username} успешно обновлен на ${newBalance.toFixed(2)} RUB.`);
        allUsersCache = null;
        await handleSearchUsers(true); 
    } else {
        alert(`Ошибка при обновлении баланса ${username}.`);
        button.textContent = 'Ошибка';
    }
    button.disabled = false;
    button.textContent = 'Сохранить';
}

/**
 * Обрабатывает обновление пароля
 */
async function handleUpdatePassword(e) {
    const button = e.target.closest('.admin-password-save-btn');
    if (!button) return;

    const listItem = button.closest('tr');
    const username = listItem.getAttribute('data-username');
    const passwordInput = listItem.querySelector('.admin-password-input');
    const newPassword = passwordInput.value.trim();

    if (!newPassword) {
        alert('Пароль не может быть пустым.');
        return;
    }

    button.disabled = true;
    button.textContent = 'Сохранение...';

    const success = await patchUser(username, { password: newPassword });

    if (success) {
        alert(`Пароль для ${username} успешно обновлен.`);
        allUsersCache = null;
        await handleSearchUsers(true);
    } else {
        alert(`Ошибка при обновлении пароля ${username}.`);
    }
    button.disabled = false;
    button.textContent = 'Сохранить';
}

/**
 * Обрабатывает обновление ранга пользователя
 */
async function handleUpdateRank(e) {
    const button = e.target.closest('.admin-rank-save-btn');
    if (!button) return;

    const listItem = button.closest('tr');
    const username = listItem.getAttribute('data-username');
    const rankSelect = listItem.querySelector('.admin-rank-select');
    const newRank = rankSelect.value;

    if (!username || !newRank) return;

    button.disabled = true;
    button.textContent = 'Сохранение...';

    const success = await patchUser(username, { rank: newRank });

    if (success) {
        alert(`Ранг пользователя ${username} успешно обновлен на "${RANK_OPTIONS[newRank]}".`);
        allUsersCache = null;
        await handleSearchUsers(true); 
    } else {
        alert(`Ошибка при обновлении ранга ${username}.`);
        button.textContent = 'Ошибка';
    }
    button.disabled = false;
    button.textContent = 'Сохранить';
}

/**
 * Обрабатывает блокировку (удаление) пользователя
 */
async function handleBlockUser(e) {
    const button = e.target.closest('.admin-block-btn');
    if (!button) return;

    const listItem = button.closest('tr');
    const username = listItem.getAttribute('data-username');

    if (!username) return;

    if (!confirm(`Вы уверены, что хотите НАВСЕГДА удалить пользователя ${username}? Это действие необратимо.`)) {
        return;
    }

    button.disabled = true;
    button.textContent = 'Удаление...';

    const success = await deleteUser(username);

    if (success) {
        alert(`Пользователь ${username} успешно удален.`);
        allUsersCache = null;
        await handleSearchUsers(true);
    } else {
        alert(`Ошибка при удалении ${username}.`);
        button.disabled = false;
        button.textContent = 'Заблокировать';
    }
}

/**
 * Показывает модальное окно статистики
 */
async function handleShowStats(e) {
    const button = e.target.closest('.admin-stats-btn');
    if (!button) return;

    const listItem = button.closest('tr');
    const username = listItem.getAttribute('data-username');
    if (!username) return;

    adminStatsUsername.textContent = username;
    adminStatsDeposits.textContent = 'Загрузка...';
    adminStatsWithdrawals.textContent = 'Загрузка...';
    adminStatsProfit.textContent = '...';
    adminStatsProfitBox.classList.remove('win', 'loss');
    adminStatsModal.classList.remove('hidden');

    const depositsData = await fetchUserDepositHistory(username);
    const withdrawalsData = await fetchUserWithdrawalHistory(username);

    // Адаптация под Supabase (если возвращается массив) или Firebase (объект)
    const depositsArray = Array.isArray(depositsData) ? depositsData : Object.values(depositsData || {});
    const withdrawalsArray = Array.isArray(withdrawalsData) ? withdrawalsData : Object.values(withdrawalsData || {});

    let totalDeposits = depositsArray.reduce((sum, dep) => {
        return (dep.status === 'Success' && dep.amount) ? sum + dep.amount : sum;
    }, 0);
    
    adminStatsDeposits.textContent = `${totalDeposits.toFixed(2)} RUB`;

    let totalWithdrawals = withdrawalsArray.reduce((sum, wd) => {
        return (wd.status === 'Success' && wd.amount) ? sum + wd.amount : sum;
    }, 0);
    
    adminStatsWithdrawals.textContent = `${totalWithdrawals.toFixed(2)} RUB`;

    const profit = totalDeposits - totalWithdrawals;
    adminStatsProfit.textContent = `${profit.toFixed(2)} RUB`;
    if (profit > 0) {
        adminStatsProfitBox.classList.add('win');
    } else if (profit < 0) {
        adminStatsProfitBox.classList.add('loss');
    }
}

function hideStatsModal() {
    if (adminStatsModal) {
        adminStatsModal.classList.add('hidden');
    }
}


// ----------------------------------------------------------------------------------
// --- ЛОГИКА ПРОМОКОДОВ ---
// ----------------------------------------------------------------------------------

function resetPromoForm() {
    if (promoForm) promoForm.reset();
    if (promoStatusEl) {
        promoStatusEl.textContent = '';
        promoStatusEl.classList.remove('success', 'error');
    }
}

async function handleCreatePromo(e) {
    e.preventDefault();
    if (!promoNameInput || !promoAmountInput || !promoActivationsInput || !promoCreateBtn || !promoStatusEl) {
        return;
    }

    const code = promoNameInput.value.trim().toUpperCase();
    const amount = parseFloat(promoAmountInput.value);
    const activations = parseInt(promoActivationsInput.value, 10);
    const wager = parseInt(promoWagerInput.value, 10) || 0;

    if (!code || isNaN(amount) || amount <= 0 || isNaN(activations) || activations <= 0) {
        promoStatusEl.textContent = 'Ошибка: Поля должны быть заполнены корректно.';
        promoStatusEl.classList.add('error');
        return;
    }

    promoCreateBtn.disabled = true;
    promoCreateBtn.textContent = 'Создание...';
    promoStatusEl.textContent = '';
    promoStatusEl.classList.remove('success', 'error');

    const promoData = {
        amount,
        activations,
        wager: wager
    };

    const success = await createPromocode(code, promoData);

    if (success) {
        promoStatusEl.textContent = `Промокод "${code}" успешно создан! (Вейджер: x${wager})`;
        promoStatusEl.classList.add('success');
        resetPromoForm();
    } else {
        promoStatusEl.textContent = 'Ошибка: Не удалось создать промокод.';
        promoStatusEl.classList.add('error');
    }

    promoCreateBtn.disabled = false;
    promoCreateBtn.textContent = 'Создать';
}

async function handleClearHistory(e) {
    e.preventDefault();
    
    if (!clearHistoryBtn || !clearHistoryStatus) return;

    if (!confirm('Вы уверены, что хотите НАВСЕГДА удалить ВСЮ историю ставок? Это действие необратимо.')) {
        return;
    }

    clearHistoryBtn.disabled = true;
    clearHistoryBtn.textContent = 'Удаление...';
    clearHistoryStatus.textContent = '';
    clearHistoryStatus.classList.remove('success', 'error');

    const success = await clearBetHistory();

    if (success) {
        clearHistoryStatus.textContent = 'История ставок успешно очищена.';
        clearHistoryStatus.classList.add('success');
    } else {
        clearHistoryStatus.textContent = 'Ошибка при очистке истории.';
        clearHistoryStatus.classList.add('error');
    }

    clearHistoryBtn.disabled = false;
    clearHistoryBtn.textContent = 'Очистить всю историю игр';
}


export function initAdmin() {
    initAdminTabs();

    userSearchInput = document.getElementById('admin-user-search');
    userListBody = document.getElementById('admin-user-list-body');

    if (userSearchInput) {
        userSearchInput.addEventListener('input', () => {
            renderUserList(allUsersCache); 
        });
    }

    if (userListBody) {
        userListBody.addEventListener('click', (e) => {
            handleUpdateBalance(e); 
            handleUpdateRank(e);
            handleUpdatePassword(e);
            handleBlockUser(e);
            handleShowStats(e);
        });
    }
    
    adminStatsModal = document.getElementById('admin-stats-modal-overlay');
    adminStatsClose = document.getElementById('admin-stats-modal-close');
    adminStatsUsername = document.getElementById('admin-stats-username');
    adminStatsDeposits = document.getElementById('admin-stats-deposits');
    adminStatsWithdrawals = document.getElementById('admin-stats-withdrawals');
    adminStatsProfit = document.getElementById('admin-stats-profit');
    adminStatsProfitBox = document.getElementById('admin-stats-profit-box');
    
    if (adminStatsModal) {
        adminStatsModal.addEventListener('click', (e) => {
            if (e.target === adminStatsModal) {
                hideStatsModal();
            }
        });
    }
    if (adminStatsClose) {
        adminStatsClose.addEventListener('click', hideStatsModal);
    }

    promoForm = document.getElementById('admin-promo-form');
    promoNameInput = document.getElementById('admin-promo-name');
    promoAmountInput = document.getElementById('admin-promo-amount');
    promoActivationsInput = document.getElementById('admin-promo-activations');
    promoCreateBtn = document.getElementById('admin-promo-create-btn');
    promoStatusEl = document.getElementById('admin-promo-status');
    promoWagerInput = document.getElementById('admin-promo-wager');

    if (promoForm) {
        promoForm.addEventListener('submit', handleCreatePromo);
    }

    clearHistoryBtn = document.getElementById('admin-clear-history-btn');
    clearHistoryStatus = document.getElementById('admin-clear-history-status');
    
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', handleClearHistory);
    }
}
