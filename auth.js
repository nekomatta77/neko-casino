/*
 * Краткое описание апгрейда (Миграция на Supabase):
 * 1. Сохранена логика "Custom Table Auth" (хранение пользователей в таблице).
 * 2. `handleRegister`: Проверка существования пользователя (fetch) -> Создание (update/insert).
 * 3. Важно: `global.js` должен реализовывать `updateUser` как `supabase.from('users').insert()`.
 */

import { showSection, setCurrentUser, getSessionUser, fetchUser, updateUser, startDepositHistoryPoller, stopDepositHistoryPoller, startWithdrawalHistoryPoller, stopWithdrawalHistoryPoller, currentUser, setLocalWager } from './global.js';
import { updateProfileData } from './profile.js';

const STARTING_BALANCE = 1000.00;

/**
 * Проверяет вейджер и блокирует кнопку вывода, если необходимо.
 */
async function checkWagerLock() {
    if (!currentUser) return;

    const wagerStatusEl = document.getElementById('wallet-wager-status');
    const withdrawalButton = document.getElementById('wallet-withdrawal-button');

    if (!wagerStatusEl || !withdrawalButton) return;

    wagerStatusEl.textContent = 'Проверка отыгрыша...';
    wagerStatusEl.classList.remove('hidden');
    withdrawalButton.disabled = true;

    const userData = await fetchUser(currentUser);
    const wagerBalance = userData?.wager_balance || 0;
    
    setLocalWager(wagerBalance);

    if (wagerBalance > 0) {
        wagerStatusEl.textContent = `Для вывода необходимо отыграть: ${wagerBalance.toFixed(2)} RUB`;
        wagerStatusEl.classList.remove('hidden');
        withdrawalButton.disabled = true;
    } else {
        wagerStatusEl.classList.add('hidden');
        withdrawalButton.disabled = false;
    }
}

async function showWalletModal() {
    const walletOverlay = document.getElementById('wallet-modal-overlay');
    if (walletOverlay) {
        walletOverlay.classList.remove('hidden');
        await checkWagerLock();
        
        startDepositHistoryPoller(); 
        stopDepositHistoryPoller(); 
    }
}

function hideWalletModal() {
    const walletOverlay = document.getElementById('wallet-modal-overlay');
    if (walletOverlay) {
        walletOverlay.classList.add('hidden');
        stopDepositHistoryPoller(); 
        stopWithdrawalHistoryPoller();
    }
}

function initWalletTabs() {
    const tabs = document.querySelectorAll('.wallet-tab');
    const contents = document.querySelectorAll('.wallet-tab-content');
    const depositHistory = document.getElementById('deposit-history-container');
    const withdrawalHistory = document.getElementById('withdrawal-history-container');

    tabs.forEach(tab => {
        tab.addEventListener('click', async () => {
            const targetId = tab.getAttribute('data-target');
            
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            
            tab.classList.add('active');
            const targetContent = document.getElementById(targetId);
            if (targetContent) {
                targetContent.classList.add('active');
            }
            
            stopDepositHistoryPoller();
            stopWithdrawalHistoryPoller();
            
            if (targetId === 'wallet-deposit-content') {
                if (depositHistory) depositHistory.classList.remove('hidden');
                if (withdrawalHistory) withdrawalHistory.classList.add('hidden');
                startDepositHistoryPoller();
            } else if (targetId === 'wallet-withdrawal-content') {
                if (depositHistory) depositHistory.classList.add('hidden');
                if (withdrawalHistory) withdrawalHistory.classList.remove('hidden');
                startWithdrawalHistoryPoller();
                await checkWagerLock();
            }
        });
    });
}

function initWalletMethodSwitching() {
    const methodContainers = document.querySelectorAll('.wallet-methods');
    
    methodContainers.forEach(container => {
        container.addEventListener('click', (e) => {
            const clickedButton = e.target.closest('.wallet-method-button');
            if (!clickedButton) return;
            
            container.querySelectorAll('.wallet-method-button').forEach(btn => {
                btn.classList.remove('active');
            });
            
            clickedButton.classList.add('active');
        });
    });
}


export async function checkLoginState() {
    const loggedInUsername = getSessionUser();
    
    if (loggedInUsername) {
        await setCurrentUser(loggedInUsername); 
        showSection('lobby'); 
    } else {
        await setCurrentUser(null); 
        showSection('auth'); 
    }
}

/**
 * Обрабатывает отправку формы регистрации
 */
async function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('register-username').value.trim();
    const pass = document.getElementById('register-password').value;
    const confirmPass = document.getElementById('register-confirm-password').value;

    if (!username || !pass) {
        alert('Имя пользователя и пароль не могут быть пустыми.');
        return;
    }
    if (pass !== confirmPass) {
        alert('Пароли не совпадают.');
        return;
    }
    
    // ИЗМЕНЕНО: Проверка через SQL select (реализовано в global.js/fetchUser)
    const existingUser = await fetchUser(username);

    if (existingUser) {
        alert('Пользователь с таким именем уже существует.');
        return;
    }

    // Структура пользователя для Supabase
    const newUser = {
        password: pass, // Примечание: Желательно использовать хеширование или Supabase Auth
        balance: STARTING_BALANCE,
        rank: "None Rang", 
        customization: {}, 
        wager_balance: 0 
    };
    
    // ИЗМЕНЕНО: updateUser в global.js должен делать INSERT
    const success = await updateUser(username, newUser); 
    
    if (!success) {
        alert('Ошибка регистрации! Не удалось сохранить данные на сервере.');
        return;
    }

    alert('Регистрация успешна! Теперь вы можете войти.');
    
    document.getElementById('register-container').classList.add('hidden');
    document.getElementById('login-container').classList.remove('hidden');
    document.getElementById('login-username').value = username;
    document.getElementById('login-password').focus();
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const pass = document.getElementById('login-password').value;

    // Получаем данные пользователя
    const userData = await fetchUser(username);

    if (!userData) {
        alert('Пользователь не найден.');
        return;
    }

    // Проверка пароля
    if (userData.password !== pass) {
        alert('Неверный пароль.');
        return;
    }

    await setCurrentUser(username);
    showSection('lobby');
}

export function initAuth() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegisterLink = document.getElementById('show-register');
    const showLoginLink = document.getElementById('show-login');
    const loginContainer = document.getElementById('login-container');
    const registerContainer = document.getElementById('register-container');
    
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (registerForm) registerForm.addEventListener('submit', handleRegister);
    
    if (showRegisterLink && loginContainer && registerContainer) {
        showRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            loginContainer.classList.add('hidden');
            registerContainer.classList.remove('hidden');
        });
    }

    if (showLoginLink && loginContainer && registerContainer) {
        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            registerContainer.classList.add('hidden');
            loginContainer.classList.remove('hidden');
        });
    }

    const profileTextContent = document.getElementById('mobile-profile-text-content'); 
    
    const goToProfile = () => {
        updateProfileData(); 
        showSection('profile-page'); 
    };
    
    if (profileTextContent) {
        profileTextContent.addEventListener('click', goToProfile);
    }


    const bottomNavProfileButton = document.getElementById('bottom-nav-profile-button');
    const bottomNavProfileButtonText = document.getElementById('bottom-nav-profile-button-text');

    if (bottomNavProfileButton) {
        bottomNavProfileButton.addEventListener('click', showWalletModal); 
    }
    if (bottomNavProfileButtonText) {
        bottomNavProfileButtonText.addEventListener('click', showWalletModal); 
    }

    const walletOverlay = document.getElementById('wallet-modal-overlay');
    const walletCloseButton = document.getElementById('wallet-modal-close');
    
    if (walletOverlay) {
        walletOverlay.addEventListener('click', (e) => {
            if (e.target === walletOverlay) {
                hideWalletModal();
            }
        });
    }
    if (walletCloseButton) {
        walletCloseButton.addEventListener('click', hideWalletModal);
    }
    
    initWalletTabs();
    initWalletMethodSwitching();
}
