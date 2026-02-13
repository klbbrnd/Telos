/**
 * TELOS Encryption Module
 * Uses Web Crypto API: PBKDF2 for key derivation, AES-256-GCM for encryption.
 * All sensitive data is encrypted at rest in localStorage.
 */

const TeloCrypto = (() => {
    const SALT_LENGTH = 16;
    const IV_LENGTH = 12;
    const PBKDF2_ITERATIONS = 600000;
    const ALGORITHM = 'AES-GCM';
    const KEY_LENGTH = 256;
    const STORAGE_PREFIX = 'telos_enc_';
    const HASH_KEY = 'telos_pwd_hash';
    const SALT_KEY = 'telos_pwd_salt';

    function getRandomBytes(length) {
        return crypto.getRandomValues(new Uint8Array(length));
    }

    function bufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    function base64ToBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    async function deriveKey(password, salt) {
        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            'PBKDF2',
            false,
            ['deriveKey']
        );

        return crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: PBKDF2_ITERATIONS,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: ALGORITHM, length: KEY_LENGTH },
            false,
            ['encrypt', 'decrypt']
        );
    }

    async function hashPassword(password, salt) {
        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            'PBKDF2',
            false,
            ['deriveBits']
        );

        const bits = await crypto.subtle.deriveBits(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: PBKDF2_ITERATIONS,
                hash: 'SHA-256'
            },
            keyMaterial,
            256
        );

        return bufferToBase64(bits);
    }

    async function encrypt(plaintext, key) {
        const encoder = new TextEncoder();
        const iv = getRandomBytes(IV_LENGTH);

        const ciphertext = await crypto.subtle.encrypt(
            { name: ALGORITHM, iv: iv },
            key,
            encoder.encode(plaintext)
        );

        return {
            iv: bufferToBase64(iv),
            data: bufferToBase64(ciphertext)
        };
    }

    async function decrypt(encryptedObj, key) {
        const decoder = new TextDecoder();
        const iv = base64ToBuffer(encryptedObj.iv);
        const data = base64ToBuffer(encryptedObj.data);

        const plaintext = await crypto.subtle.decrypt(
            { name: ALGORITHM, iv: iv },
            key,
            data
        );

        return decoder.decode(plaintext);
    }

    // --- Public API ---

    let _derivedKey = null;

    return {
        isSetUp() {
            return localStorage.getItem(HASH_KEY) !== null;
        },

        async setup(password) {
            const salt = getRandomBytes(SALT_LENGTH);
            const hash = await hashPassword(password, salt);

            localStorage.setItem(SALT_KEY, bufferToBase64(salt));
            localStorage.setItem(HASH_KEY, hash);

            _derivedKey = await deriveKey(password, salt);
            return true;
        },

        async authenticate(password) {
            const saltB64 = localStorage.getItem(SALT_KEY);
            const storedHash = localStorage.getItem(HASH_KEY);
            if (!saltB64 || !storedHash) return false;

            const salt = base64ToBuffer(saltB64);
            const hash = await hashPassword(password, salt);

            if (hash !== storedHash) return false;

            _derivedKey = await deriveKey(password, salt);
            return true;
        },

        lock() {
            _derivedKey = null;
        },

        isUnlocked() {
            return _derivedKey !== null;
        },

        async saveEncrypted(key, plaintext) {
            if (!_derivedKey) throw new Error('Not authenticated');
            const encrypted = await encrypt(plaintext, _derivedKey);
            localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(encrypted));
        },

        async loadEncrypted(key) {
            if (!_derivedKey) throw new Error('Not authenticated');
            const raw = localStorage.getItem(STORAGE_PREFIX + key);
            if (!raw) return null;

            try {
                const encrypted = JSON.parse(raw);
                return await decrypt(encrypted, _derivedKey);
            } catch {
                return null;
            }
        },

        savePlain(key, value) {
            localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
        },

        loadPlain(key) {
            const raw = localStorage.getItem(STORAGE_PREFIX + key);
            if (!raw) return null;
            try {
                return JSON.parse(raw);
            } catch {
                return null;
            }
        }
    };
})();
