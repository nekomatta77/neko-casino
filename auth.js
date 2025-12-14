/*
 * AUTH.JS - Fixed Logic for Linking vs Registration
 */

import { showSection, setCurrentUser, getSessionUser, fetchUser, updateUser, startDepositHistoryPoller, stopDepositHistoryPoller, startWithdrawalHistoryPoller, stopWithdrawalHistoryPoller, currentUser, setLocalWager, fetchUserByTelegramId } from './global.js';
import { updateProfileData } from './profile.js';

const STARTING_BALANCE = 1000.00;

const TG_CONFIG = {
    BOT_USERNAME: 'CashCatOfficial_Bot', 
    REDIRECT_URL: 'https://neko-casino.vercel.app/' 
};

async function checkWagerLock() {
    if (!currentUser) return;

    const wagerStatusEl = document.getElementById('wallet-wager-status');
    const withdrawalButton = document.getElementById('wallet-withdrawal-button');

    if (!wagerStatusEl || !withdrawalButton) return;

    wagerStatusEl.classList.remove('hidden');
    withdrawalButton.disabled = true;

    const userData = await fetchUser(currentUser);
    let wagerBalance = userData?.wager_balance || 0;
    wagerBalance = Math.max(0, wagerBalance);
    
    setLocalWager(wagerBalance);

    if (wagerBalance > 0) {
        wagerStatusEl.innerHTML = `
            <div class="wallet-wager-card">
                <div class="wager-icon">🔒</div>
                <div class="wager-info">
                    <span class="wager-label">Необходимый отыгрыш</span>
                    <span class="wager-amount">${wagerBalance.toFixed(2)} RUB</span>
                </div>
            </div>
        `;
        wagerStatusEl.classList.remove('hidden');
        withdrawalButton.disabled = true;
    } else {
        wagerStatusEl.innerHTML = ''; 
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
        if (tab.id.startsWith('tab-btn-')) return;

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

// === ЛОГИКА АВТОРИЗАЦИИ ЧЕРЕЗ TELEGRAM ===

function handleTelegramLoginClick() {
    const tempContainer = document.createElement('div');
    tempContainer.style.display = 'none';
    document.body.appendChild(tempContainer);

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', TG_CONFIG.BOT_USERNAME);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-auth-url', TG_CONFIG.REDIRECT_URL); 
    script.setAttribute('data-request-access', 'write');
    
    tempContainer.appendChild(script);
    
    const btnLogin = document.getElementById('login-with-tg-btn');
    const btnReg = document.getElementById('register-with-tg-btn');
    
    if (btnLogin) {
        btnLogin.innerHTML = '';
        btnLogin.appendChild(script);
    }
    if (btnReg) {
        btnReg.innerHTML = '';
        btnReg.appendChild(script);
    }
}

// ПРОВЕРКА ВОЗВРАТА ОТ TELEGRAM
export async function checkTelegramAuthReturn() {
    const params = new URLSearchParams(window.location.search);
    
    if (params.has('id') && params.has('hash')) {
        // !!! ГЛАВНОЕ ИСПРАВЛЕНИЕ !!!
        // Если currentUser уже установлен (мы восстановили сессию), 
        // то мы НЕ трогаем параметры URL и НЕ пытаемся войти заново.
        // Мы оставляем URL как есть, чтобы profile.js считал их и выполнил ПРИВЯЗКУ.
        if (currentUser) {
            console.log("Пользователь уже вошел. Передаем управление в profile.js для привязки.");
            return; 
        }

        const tgId = params.get('id');
        const tgFirstName = params.get('first_name');
        const tgUsername = params.get('username'); 
        
        // Если мы тут, значит пользователя нет в сессии. Это Вход или Регистрация.
        // Очищаем URL, чтобы не мешался
        window.history.replaceState({}, document.title, window.location.pathname);

        const existingUser = await fetchUserByTelegramId(tgId);

        if (existingUser) {
            // === ВХОД ===
            await setCurrentUser(existingUser.username);
            sessionStorage.setItem('justLoggedIn', 'true');
            if(typeof window.addAppNotification === 'function') {
                window.addAppNotification('👋 Добро пожаловать', `Вход выполнен как ${existingUser.username}`);
            }
            showSection('lobby');
        } else {
            // === РЕГИСТРАЦИЯ ===
            let newUsername = tgUsername;
            if (!newUsername) {
                const randomSuffix = Math.floor(Math.random() * 10000);
                newUsername = (tgFirstName || 'User').replace(/\s+/g, '') + randomSuffix;
            }

            const checkUser = await fetchUser(newUsername);
            if (checkUser) {
                newUsername = newUsername + Math.floor(Math.random() * 1000);
            }

            const newUser = {
                password: "tg_auth_no_password", 
                balance: STARTING_BALANCE,
                rank: "None Rang", 
                customization: {}, 
                wager_balance: 0,
                tg_linked: true,
                tg_id: tgId,
                tg_name: tgUsername ? `@${tgUsername}` : tgFirstName,
                tg_username: tgUsername || ""
            };

            const success = await updateUser(newUsername, newUser);

            if (success) {
                await setCurrentUser(newUsername);
                sessionStorage.setItem('justLoggedIn', 'true');
                if(typeof window.addAppNotification === 'function') {
                    window.addAppNotification('🚀 Регистрация', `Аккаунт ${newUsername} создан!`);
                }
                showSection('lobby');
            } else {
                alert("Ошибка при создании аккаунта через Telegram.");
            }
        }
    }
}

// === СТАНДАРТНАЯ ЛОГИКА ===

export async function checkLoginState() {
    const loggedInUsername = getSessionUser();
    
    // !!! ИСПРАВЛЕННЫЙ ПОРЯДОК !!!
    // 1. Сначала восстанавливаем сессию
    if (loggedInUsername) {
        await setCurrentUser(loggedInUsername); 
    } else {
        await setCurrentUser(null); 
    }

    // 2. Только ПОТОМ проверяем Telegram
    // Если сессия восстановилась (п.1), checkTelegramAuthReturn увидит currentUser и выйдет.
    await checkTelegramAuthReturn();

    showSection('lobby'); 
}

function showAuthModal(mode = 'login') {
    const overlay = document.getElementById('auth-modal-overlay');
    const modalTitle = document.getElementById('auth-modal-title');
    const loginTab = document.getElementById('tab-btn-login');
    const registerTab = document.getElementById('tab-btn-register');
    const loginContent = document.getElementById('auth-tab-login');
    const registerContent = document.getElementById('auth-tab-register');

    if (!overlay) return;

    overlay.classList.remove('hidden');

    document.getElementById('modal-login-form').reset();
    document.getElementById('modal-register-form').reset();

    if (mode === 'login') {
        modalTitle.textContent = 'Вход';
        loginTab.classList.add('active');
        registerTab.classList.remove('active');
        loginContent.classList.add('active');
        registerContent.classList.remove('active');
    } else {
        modalTitle.textContent = 'Регистрация';
        registerTab.classList.add('active');
        loginTab.classList.remove('active');
        registerContent.classList.add('active');
        loginContent.classList.remove('active');
    }
}

function hideAuthModal() {
    const overlay = document.getElementById('auth-modal-overlay');
    if (overlay) overlay.classList.add('hidden');
}

function initAuthModalTabs() {
    const loginTab = document.getElementById('tab-btn-login');
    const registerTab = document.getElementById('tab-btn-register');
    
    if (loginTab) {
        loginTab.addEventListener('click', () => showAuthModal('login'));
    }
    if (registerTab) {
        registerTab.addEventListener('click', () => showAuthModal('register'));
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('modal-reg-username').value.trim();
    const pass = document.getElementById('modal-reg-password').value;
    const confirmPass = document.getElementById('modal-reg-confirm').value;

    if (!username || !pass) {
        alert('Имя пользователя и пароль не могут быть пустыми.');
        return;
    }
    if (pass !== confirmPass) {
        alert('Пароли не совпадают.');
        return;
    }
    
    const existingUser = await fetchUser(username);

    if (existingUser) {
        alert('Пользователь с таким именем уже существует.');
        return;
    }

    const newUser = {
        password: pass, 
        balance: STARTING_BALANCE,
        rank: "None Rang", 
        customization: {}, 
        wager_balance: 0 
    };
    
    const success = await updateUser(username, newUser); 
    
    if (!success) {
        alert('Ошибка регистрации! Не удалось сохранить данные на сервере.');
        return;
    }

    alert('Регистрация успешна! Теперь вы вошли.');
    sessionStorage.setItem('justLoggedIn', 'true');
    await setCurrentUser(username);
    hideAuthModal();
    showSection('lobby');
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('modal-login-username').value.trim();
    const pass = document.getElementById('modal-login-password').value;

    const userData = await fetchUser(username);

    if (!userData) {
        alert('Пользователь не найден.');
        return;
    }

    if (userData.password !== pass) {
        alert('Неверный пароль.');
        return;
    }

    sessionStorage.setItem('justLoggedIn', 'true');
    await setCurrentUser(username);
    hideAuthModal();
    showSection('lobby');
}

export function initAuth() {
    const loginForm = document.getElementById('modal-login-form');
    const registerForm = document.getElementById('modal-register-form');
    
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (registerForm) registerForm.addEventListener('submit', handleRegister);
    
    const headerLoginBtn = document.getElementById('header-login-btn');
    const headerRegisterBtn = document.getElementById('header-register-btn');

    if (headerLoginBtn) {
        headerLoginBtn.addEventListener('click', () => showAuthModal('login'));
    }
    if (headerRegisterBtn) {
        headerRegisterBtn.addEventListener('click', () => showAuthModal('register'));
    }

    const authOverlay = document.getElementById('auth-modal-overlay');
    const authCloseBtn = document.getElementById('auth-modal-close');
    
    if (authOverlay) {
        authOverlay.addEventListener('click', (e) => {
            if (e.target === authOverlay) hideAuthModal();
        });
    }
    if (authCloseBtn) {
        authCloseBtn.addEventListener('click', hideAuthModal);
    }
    
    initAuthModalTabs();

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

    const quickWalletBtn = document.getElementById('header-quick-wallet-btn');
    if (quickWalletBtn) {
        quickWalletBtn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            showWalletModal();
        });
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

    const btnTgLogin = document.getElementById('login-with-tg-btn');
    const btnTgReg = document.getElementById('register-with-tg-btn');
    
    const loadTgWidget = (container) => {
        container.innerHTML = 'Загрузка...';
        const script = document.createElement('script');
        script.async = true;
        script.src = 'https://telegram.org/js/telegram-widget.js?22';
        script.setAttribute('data-telegram-login', TG_CONFIG.BOT_USERNAME);
        script.setAttribute('data-size', 'large');
        script.setAttribute('data-auth-url', TG_CONFIG.REDIRECT_URL);
        script.setAttribute('data-request-access', 'write');
        container.innerHTML = '';
        container.appendChild(script);
    };

    if (btnTgLogin) btnTgLogin.addEventListener('click', () => loadTgWidget(document.getElementById('auth-tg-login-container')));
    if (btnTgReg) btnTgReg.addEventListener('click', () => loadTgWidget(btnTgReg.parentElement));
}