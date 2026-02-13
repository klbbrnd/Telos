// ===== Constants =====
const VALID_TABS = ['dashboard', 'finances', 'health', 'career', 'personal'];
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const LOCKED_TEXT = '[Locked]';

// Default values for encrypted fields (used on first setup)
const DEFAULT_PRIVATE_DATA = {
    net_worth: '$XX,XXX',
    bank_accounts: 'Checking: $X,XXX.XX\nSavings: $XX,XXX.XX\nInvestment: $XXX,XXX.XX',
    budget_housing: '$X,XXX',
    budget_food: '$XXX',
    budget_transport: '$XXX',
    weight: 'XXX lbs',
    bmi: 'XX.X',
    blood_type: 'Blood Type: X+',
    allergies: 'Allergies: XXXXX',
    medications: 'Medications: XXXXX',
    basic_info: 'Name: Kaleb Brandy\nDate of Birth: XX/XX/XXXX\nSSN: XXX-XX-XXXX',
    contact_info: 'Email: XXXXX@XXXXX.com\nPhone: (XXX) XXX-XXXX\nAddress: XXXXX'
};

// ===== DOM Elements =====
const loginOverlay = document.getElementById('loginOverlay');
const appContainer = document.getElementById('appContainer');
const setupForm = document.getElementById('setupForm');
const loginForm = document.getElementById('loginForm');
const setupBtn = document.getElementById('setupBtn');
const loginBtn = document.getElementById('loginBtn');
const newPasswordInput = document.getElementById('newPassword');
const confirmPasswordInput = document.getElementById('confirmPassword');
const loginPasswordInput = document.getElementById('loginPassword');
const setupError = document.getElementById('setupError');
const loginError = document.getElementById('loginError');
const privacyToggle = document.getElementById('privacyToggle');
const lockBtn = document.getElementById('lockBtn');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const privateFields = document.querySelectorAll('.private-content[data-field]');

// ===== Inactivity Timer =====
let inactivityTimer = null;

function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    if (TeloCrypto.isUnlocked()) {
        inactivityTimer = setTimeout(lockApp, INACTIVITY_TIMEOUT_MS);
    }
}

['click', 'keydown', 'mousemove', 'scroll'].forEach(event => {
    document.addEventListener(event, resetInactivityTimer, { passive: true });
});

// ===== Authentication =====

function showLoginScreen() {
    loginOverlay.style.display = 'flex';
    appContainer.style.display = 'none';

    if (TeloCrypto.isSetUp()) {
        setupForm.style.display = 'none';
        loginForm.style.display = 'flex';
        loginPasswordInput.value = '';
        loginError.textContent = '';
        loginPasswordInput.focus();
    } else {
        setupForm.style.display = 'flex';
        loginForm.style.display = 'none';
        newPasswordInput.value = '';
        confirmPasswordInput.value = '';
        setupError.textContent = '';
        newPasswordInput.focus();
    }
}

function showApp() {
    loginOverlay.style.display = 'none';
    appContainer.style.display = 'block';
    resetInactivityTimer();
}

setupBtn.addEventListener('click', async () => {
    const password = newPasswordInput.value;
    const confirm = confirmPasswordInput.value;

    setupError.textContent = '';

    if (password.length < 8) {
        setupError.textContent = 'Password must be at least 8 characters.';
        return;
    }

    if (password !== confirm) {
        setupError.textContent = 'Passwords do not match.';
        return;
    }

    setupBtn.disabled = true;
    setupBtn.textContent = 'Encrypting...';

    try {
        await TeloCrypto.setup(password);

        // Encrypt default placeholder data
        for (const [field, value] of Object.entries(DEFAULT_PRIVATE_DATA)) {
            await TeloCrypto.saveEncrypted(field, value);
        }

        newPasswordInput.value = '';
        confirmPasswordInput.value = '';

        showApp();
        await loadPrivateData();
    } catch (err) {
        setupError.textContent = 'Setup failed. Please try again.';
    } finally {
        setupBtn.disabled = false;
        setupBtn.textContent = 'Set Up Encryption';
    }
});

loginBtn.addEventListener('click', async () => {
    const password = loginPasswordInput.value;
    loginError.textContent = '';

    if (!password) {
        loginError.textContent = 'Please enter your password.';
        return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = 'Decrypting...';

    try {
        const success = await TeloCrypto.authenticate(password);

        if (!success) {
            loginError.textContent = 'Incorrect password.';
            loginPasswordInput.value = '';
            loginPasswordInput.focus();
            return;
        }

        loginPasswordInput.value = '';

        showApp();
        await loadPrivateData();
    } catch (err) {
        loginError.textContent = 'Authentication error.';
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = 'Unlock';
    }
});

// Allow Enter key to submit
loginPasswordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loginBtn.click();
});
confirmPasswordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') setupBtn.click();
});

// ===== Lock =====

function lockApp() {
    TeloCrypto.lock();
    clearTimeout(inactivityTimer);

    // Clear decrypted data from the DOM
    privateFields.forEach(el => {
        el.textContent = LOCKED_TEXT;
        el.classList.remove('revealed');
    });

    privacyToggle.checked = false;

    showLoginScreen();
}

lockBtn.addEventListener('click', lockApp);

// ===== Private Data (Encrypted) =====

async function loadPrivateData() {
    for (const el of privateFields) {
        const field = el.getAttribute('data-field');
        if (!field) continue;

        const value = await TeloCrypto.loadEncrypted(field);
        if (value !== null) {
            // Store decrypted value as a data attribute (in memory only)
            el.dataset.decrypted = value;
        }
    }

    // If toggle is already checked, reveal
    if (privacyToggle.checked) {
        revealPrivateData();
    }
}

function revealPrivateData() {
    privateFields.forEach(el => {
        const decrypted = el.dataset.decrypted;
        if (decrypted) {
            // Use textContent (not innerHTML) to prevent XSS
            el.textContent = decrypted;
            el.classList.add('revealed');
        }
    });
}

function hidePrivateData() {
    privateFields.forEach(el => {
        el.textContent = LOCKED_TEXT;
        el.classList.remove('revealed');
    });
}

// ===== Privacy Toggle =====

privacyToggle.addEventListener('change', (e) => {
    if (e.target.checked) {
        revealPrivateData();
    } else {
        hidePrivateData();
    }
    savePreferences();
});

// ===== Tab Navigation (validated) =====

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const tabName = btn.getAttribute('data-tab');

        // Validate tab name against whitelist
        if (!VALID_TABS.includes(tabName)) return;

        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        const tabEl = document.getElementById(tabName);
        if (tabEl) tabEl.classList.add('active');

        savePreferences();
    });
});

// ===== Preferences (non-sensitive, stored as plain JSON) =====

function savePreferences() {
    TeloCrypto.savePlain('prefs', {
        lastTab: document.querySelector('.tab-btn.active')?.getAttribute('data-tab') || 'dashboard'
    });
}

function loadPreferences() {
    const prefs = TeloCrypto.loadPlain('prefs');
    if (!prefs) return;

    if (prefs.lastTab && VALID_TABS.includes(prefs.lastTab)) {
        tabBtns.forEach(btn => {
            if (btn.getAttribute('data-tab') === prefs.lastTab) {
                btn.click();
            }
        });
    }
}

// ===== Last Updated =====

document.getElementById('lastUpdated').textContent = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
});

// ===== Init =====

loadPreferences();
showLoginScreen();
