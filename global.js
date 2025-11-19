/*
 * GLOBAL.JS - SUPABASE EDITION
 * Основной файл логики и взаимодействия с БД.
 */

// Инициализация Supabase
// ВАЖНО: Замените эти значения на ваши реальные из настроек Supabase проекта!
// В Vercel лучше использовать process.env.NEXT_PUBLIC_SUPABASE_URL (если это Next.js) или аналоги.
const SUPABASE_URL = 'https://jqkaqluzauhsdfhvhowb.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impxa2FxbHV6YXVoc2RmaHZob3diIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0OTczNzMsImV4cCI6MjA3OTA3MzM3M30.tXqrCLyRZWNfgoeSxNpE1RiEQyh8Vlh3dVU_-Le-vVk';

// Если вы используете сборщик (Vite/Webpack):
//import { createClient } from '@supabase/supabase-js';
// Если вы используете чистый HTML/JS, раскомментируйте строку ниже и закомментируйте импорт выше:
 import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Глобальные переменные ---
export let currentUser = null;
export let currentBalance = 0.00;

// --- Кеш и Поллеры ---
let depositPoller = null;
let withdrawalPoller = null;

// ==========================================
// 1. УПРАВЛЕНИЕ СЕССИЕЙ
// ==========================================

export function getSessionUser() {
    return localStorage.getItem('nekoUserSession');
}

/**
 * Устанавливает текущего пользователя и загружает его данные
 */
export async function setCurrentUser(username) {
    if (username) {
        localStorage.setItem('nekoUserSession', username);
        currentUser = username;
        // Загружаем актуальный баланс и данные
        await fetchUser(username, true); 
    } else {
        localStorage.removeItem('nekoUserSession');
        currentUser = null;
        currentBalance = 0.00;
    }
    updateUI();
}

// ==========================================
// 2. CRUD ОПЕРАЦИИ (SUPABASE)
// ==========================================

/**
 * Получает данные пользователя.
 * @param {string} username 
 * @param {boolean} updateGlobal - Если true, обновляет глобальные переменные (баланс)
 */
export async function fetchUser(username, updateGlobal = false) {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null; // Пользователь не найден
            console.error('Error fetching user:', error);
            return null;
        }

        if (updateGlobal && data) {
            currentBalance = parseFloat(data.balance || 0);
            updateUI(); // Обновляем UI (баланс в шапке)
            
            // Если есть кастомизация, применяем её (динамический импорт чтобы избежать циклов)
            if (data.customization) {
                import('./customize.js').then(module => {
                    module.applyCustomization(data.customization);
                });
            }
            // Синхронизируем локальный вейджер
            setLocalWager(data.wager_balance || 0);
        }

        return data;
    } catch (err) {
        console.error('Fetch user exception:', err);
        return null;
    }
}

/**
 * Получает ВСЕХ пользователей (для Админки)
 * Возвращает массив объектов.
 */
export async function fetchAllUsers() {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching all users:', error);
        return [];
    }
    return data;
}

/**
 * Создает нового пользователя (Регистрация)
 * Использует INSERT.
 */
export async function updateUser(username, userData) {
    // В Supabase мы используем INSERT для создания
    // Подготавливаем объект, добавляя username (он часть userData в вызове, но явно укажем)
    const dataToInsert = {
        username: username,
        password: userData.password,
        balance: userData.balance,
        rank: userData.rank,
        customization: userData.customization || {},
        wager_balance: userData.wager_balance || 0,
        created_at: new Date().toISOString()
    };

    const { error } = await supabase
        .from('users')
        .insert([dataToInsert]);

    if (error) {
        console.error('Error creating user:', error);
        return false;
    }
    return true;
}

/**
 * Обновляет частичные данные пользователя (PATCH)
 */
export async function patchUser(username, partialData) {
    const { error } = await supabase
        .from('users')
        .update(partialData)
        .eq('username', username);

    if (error) {
        console.error('Error updating user:', error);
        return false;
    }
    return true;
}

/**
 * Удаляет пользователя (Админка)
 */
export async function deleteUser(username) {
    const { error } = await supabase
        .from('users')
        .delete()
        .eq('username', username);

    if (error) {
        console.error('Error deleting user:', error);
        return false;
    }
    return true;
}

// ==========================================
// 3. УПРАВЛЕНИЕ БАЛАНСОМ И ВЕЙДЖЕРОМ
// ==========================================

/**
 * Изменяет баланс текущего пользователя.
 * В SQL лучше использовать RPC (хранимую процедуру) для атомарности,
 * но для миграции пока сделаем Read-Modify-Write или прямой инкремент, если Supabase это позволяет.
 * * @param {number} amount - Сумма для добавления (отрицательная для списания)
 * @param {number} wagerToAdd - (Опционально) Сумма для добавления к вейджеру
 */
export async function updateBalance(amount, wagerToAdd = 0) {
    if (!currentUser) return;

    try {
        // Вариант A: Использование RPC (рекомендуется создать функцию increment_balance в SQL)
        // const { error } = await supabase.rpc('increment_balance', { 
        //    user_name: currentUser, 
        //    amount: amount,
        //    wager_amount: wagerToAdd 
        // });
        
        // Вариант B: JS-логика (проще для старта, но есть риск гонки запросов)
        const userData = await fetchUser(currentUser);
        if (!userData) return;

        const newBalance = (parseFloat(userData.balance) + amount);
        const newWager = (parseFloat(userData.wager_balance || 0) + wagerToAdd);
        
        const { error } = await supabase
            .from('users')
            .update({ 
                balance: newBalance,
                wager_balance: Math.max(0, newWager) // Не даем уйти в минус
            })
            .eq('username', currentUser);

        if (error) throw error;

        // Обновляем локальное состояние
        currentBalance = newBalance;
        updateUI();
        
        if (wagerToAdd !== 0) {
            setLocalWager(Math.max(0, newWager));
        }

    } catch (err) {
        console.error('Balance update error:', err);
        alert('Ошибка синхронизации баланса. Пожалуйста, обновите страницу.');
    }
}

/**
 * Уменьшает вейджер при ставке.
 */
export async function reduceWager(betAmount) {
    if (!currentUser) return;
    // Просто вызываем updateBalance с 0 денег и отрицательным вейджером
    await updateBalance(0, -betAmount);
}

export function setLocalWager(amount) {
    const wagerEl = document.getElementById('wallet-wager-status');
    if (wagerEl) {
        if (amount > 0) {
            wagerEl.textContent = `Вейджер: ${amount.toFixed(2)} RUB`;
            wagerEl.classList.remove('hidden');
        } else {
            wagerEl.classList.add('hidden');
        }
    }
}

// ==========================================
// 4. ИСТОРИЯ ИГР И ТРАНЗАКЦИЙ
// ==========================================

export async function writeBetToHistory(betData) {
    // betData: { username, game, result, betAmount, amount, multiplier }
    const { error } = await supabase
        .from('bets')
        .insert([{
            username: betData.username,
            game: betData.game,
            result: betData.result,
            bet_amount: betData.betAmount,
            profit_amount: betData.amount, // amount здесь это чистый профит/убыток
            multiplier: betData.multiplier,
            created_at: new Date().toISOString()
        }]);

    if (error) console.error('Error writing bet history:', error);
}

export async function clearBetHistory() {
    // Удаляет ВСЕ ставки (для админа)
    const { error } = await supabase
        .from('bets')
        .delete()
        .neq('id', 0); // Удалить все, где id != 0 (хак для удаления всех строк)

    return !error;
}

// --- История депозитов/выводов (Поллеры) ---

export async function fetchUserDepositHistory(username) {
    const { data } = await supabase
        .from('deposits')
        .select('*')
        .eq('username', username)
        .order('created_at', { ascending: false });
    return data || [];
}

export async function fetchUserWithdrawalHistory(username) {
    const { data } = await supabase
        .from('withdrawals')
        .select('*')
        .eq('username', username)
        .order('created_at', { ascending: false });
    return data || [];
}

// Заглушки для поллеров (в реальном приложении можно использовать Supabase Realtime)
export function startDepositHistoryPoller() {
    if (depositPoller) return;
    console.log('Start Deposit Poller (Simulation/Realtime setup needed)');
}
export function stopDepositHistoryPoller() {
    // clearInterval(depositPoller);
}
export function startWithdrawalHistoryPoller() {}
export function stopWithdrawalHistoryPoller() {}


// ==========================================
// 5. ПРОМОКОДЫ
// ==========================================

export async function createPromocode(code, data) {
    const { error } = await supabase
        .from('promocodes')
        .insert([{
            code: code,
            amount: data.amount,
            activations_left: data.activations,
            wager: data.wager || 0
        }]);
    return !error;
}

export async function activatePromocode(code) {
    if (!currentUser) return { success: false, message: 'Необходима авторизация' };

    // 1. Ищем промокод
    const { data: promo, error } = await supabase
        .from('promocodes')
        .select('*')
        .eq('code', code)
        .single();

    if (error || !promo) return { success: false, message: 'Промокод не найден' };
    if (promo.activations_left <= 0) return { success: false, message: 'Лимит активаций исчерпан' };

    // 2. Проверяем, не активировал ли уже (нужна доп. таблица promo_activations, 
    // но для простоты пока опустим или добавим поле использовавших)

    // 3. Активируем
    // Уменьшаем активации
    await supabase
        .from('promocodes')
        .update({ activations_left: promo.activations_left - 1 })
        .eq('id', promo.id);

    // Начисляем баланс и вейджер
    await updateBalance(promo.amount, promo.wager);

    return { success: true, message: `Получено ${promo.amount} RUB!` };
}


// ==========================================
// 6. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ==========================================

export function showSection(sectionId) {
    document.querySelectorAll('.content-section').forEach(el => {
        el.classList.remove('active');
    });
    document.querySelectorAll('.nav-item').forEach(el => {
        el.classList.remove('active');
    });

    const target = document.getElementById(sectionId);
    if (target) {
        target.classList.add('active');
    }
    
    // Обновляем UI
    if (sectionId === 'lobby') {
        document.getElementById('lobby-stats-bar').classList.remove('hidden');
    } else {
        document.getElementById('lobby-stats-bar').classList.add('hidden');
    }
}

function updateUI() {
    const balanceElements = document.querySelectorAll('#balance-amount, #mobile-balance-amount, #profile-balance-amount');
    const usernameElements = document.querySelectorAll('#username-display, #mobile-username-display, #profile-username');
    
    // Аватар обновляется в customize.js
    
    if (currentUser) {
        balanceElements.forEach(el => el.textContent = currentBalance.toFixed(2));
        usernameElements.forEach(el => el.textContent = currentUser);
        
        document.body.classList.add('logged-in');
        document.body.classList.remove('logged-out');
    } else {
        balanceElements.forEach(el => el.textContent = '0.00');
        usernameElements.forEach(el => el.textContent = 'Гость');
        
        document.body.classList.add('logged-out');
        document.body.classList.remove('logged-in');
    }
}
