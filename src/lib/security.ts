/**
 * Security utilities using Web Crypto PBKDF2 for salted PIN hashing and WebAuthn support.
 * Never stores plain text PINs.
 */

const PIN_STORAGE_KEY = 'meu_bolso_pin_hash';
const PIN_SALT_KEY = 'meu_bolso_pin_salt';
const PIN_LENGTH_KEY = 'meu_bolso_pin_length';
const FAILED_ATTEMPTS_KEY = 'meu_bolso_pin_failed_attempts';
const MAX_FAILED_ATTEMPTS = 5;

// Convert ArrayBuffer to Hex string
function bufToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Convert Hex string to Uint8Array
function hexToBuf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Derives a PBKDF2 hash from a PIN and salt using the browser's native Web Crypto API.
 */
export async function hashPin(pin: string, saltHex?: string): Promise<{ hash: string; salt: string }> {
  const enc = new TextEncoder();
  const pinData = enc.encode(pin);

  let saltBuffer: Uint8Array;
  if (saltHex) {
    saltBuffer = hexToBuf(saltHex);
  } else {
    saltBuffer = crypto.getRandomValues(new Uint8Array(16));
  }

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    pinData,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer as unknown as ArrayBuffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const exported = await crypto.subtle.exportKey('raw', derivedKey);
  const hashHex = bufToHex(exported);
  const saltOut = bufToHex(saltBuffer.buffer as ArrayBuffer);

  return { hash: hashHex, salt: saltOut };
}

/**
 * Sets a new PIN in local device storage.
 */
export async function setupDevicePin(pin: string): Promise<boolean> {
  if (pin.length < 4 || pin.length > 6) return false;
  const { hash, salt } = await hashPin(pin);
  localStorage.setItem(PIN_STORAGE_KEY, hash);
  localStorage.setItem(PIN_SALT_KEY, salt);
  localStorage.setItem(PIN_LENGTH_KEY, String(pin.length));
  localStorage.setItem(FAILED_ATTEMPTS_KEY, '0');
  return true;
}

/**
 * Returns the length of the configured PIN (4, 5, or 6).
 */
export function getDevicePinLength(): number {
  const raw = localStorage.getItem(PIN_LENGTH_KEY);
  const parsed = raw ? parseInt(raw, 10) : 4;
  return parsed >= 4 && parsed <= 6 ? parsed : 4;
}

/**
 * Removes PIN from device storage.
 */
export function removeDevicePin() {
  localStorage.removeItem(PIN_STORAGE_KEY);
  localStorage.removeItem(PIN_SALT_KEY);
  localStorage.removeItem(PIN_LENGTH_KEY);
  localStorage.removeItem(FAILED_ATTEMPTS_KEY);
}

/**
 * Checks if a PIN is configured on this device.
 */
export function isDevicePinSet(): boolean {
  return !!localStorage.getItem(PIN_STORAGE_KEY) && !!localStorage.getItem(PIN_SALT_KEY);
}

/**
 * Verifies entered PIN against stored PBKDF2 hash.
 */
export async function verifyDevicePin(enteredPin: string): Promise<{ success: boolean; exceededAttempts: boolean; remainingAttempts: number }> {
  const storedHash = localStorage.getItem(PIN_STORAGE_KEY);
  const storedSalt = localStorage.getItem(PIN_SALT_KEY);
  let failedAttempts = parseInt(localStorage.getItem(FAILED_ATTEMPTS_KEY) || '0', 10);

  if (!storedHash || !storedSalt) {
    return { success: true, exceededAttempts: false, remainingAttempts: MAX_FAILED_ATTEMPTS };
  }

  const { hash } = await hashPin(enteredPin, storedSalt);

  if (hash === storedHash) {
    // Reset failed counter
    localStorage.setItem(FAILED_ATTEMPTS_KEY, '0');
    return { success: true, exceededAttempts: false, remainingAttempts: MAX_FAILED_ATTEMPTS };
  } else {
    failedAttempts += 1;
    localStorage.setItem(FAILED_ATTEMPTS_KEY, String(failedAttempts));

    if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
      return { success: false, exceededAttempts: true, remainingAttempts: 0 };
    }
    return {
      success: false,
      exceededAttempts: false,
      remainingAttempts: MAX_FAILED_ATTEMPTS - failedAttempts,
    };
  }
}

/**
 * WebAuthn biometric availability check.
 */
export async function isBiometricsAvailable(): Promise<boolean> {
  if (!window.PublicKeyCredential) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}