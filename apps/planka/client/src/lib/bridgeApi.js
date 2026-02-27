/**
 * Bridge API client — connects the Planka frontend to the bridge-api service.
 * The BRIDGE_API_URL defaults to localhost:3000 which is the default bridge-api port.
 * Set the env variable VITE_BRIDGE_API_URL to override in production.
 */
const BASE =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BRIDGE_API_URL) ||
    'http://localhost:3000';

/**
 * Fetch all WhatsApp contacts synced via Baileys.
 * @returns {Promise<Array<{id: string, name: string, notify: string}>>}
 */
export const getWhatsAppContacts = () =>
    fetch(`${BASE}/whatsapp/contacts`, { signal: AbortSignal.timeout(5000) })
        .then((r) => {
            if (!r.ok) throw new Error('Bridge offline');
            return r.json();
        })
        .catch(() => []); // gracefully return empty if bridge is down

/**
 * Ensures a WhatsApp contact has a corresponding Planka user.
 * @param {string} phone
 * @param {string} name
 * @returns {Promise<{id: string, username: string}>}
 */
export const syncWhatsAppUser = (phone, name) =>
    fetch(`${BASE}/whatsapp/sync-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, name }),
        signal: AbortSignal.timeout(10000),
    }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data?.message || `Bridge error ${r.status}`);
        if (!data?.id) throw new Error('Invalid user returned from bridge (missing id)');
        return data;
    });

/**
 * Send a WhatsApp welcome notification to a new board member.
 * @param {string} phone  – phone number without + (e.g. "5511999999999")
 * @param {string} boardName
 * @param {string} inviterName – name of the user who added the member
 * @returns {Promise<{status: string}>}
 */
export const notifyWhatsAppMember = (phone, boardName, inviterName, boardId, role = 'editor', contactName = '') =>
    fetch(`${BASE}/whatsapp/notify-member`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, contactName, boardName, inviterName, boardId, role }),
        signal: AbortSignal.timeout(8000),
    }).then((r) => r.json());

/**
 * Fetch WhatsApp QR Code data.
 * @returns {Promise<{connected: boolean, qr: string|null}>}
 */
export const getWhatsAppQR = () =>
    fetch(`${BASE}/whatsapp/qr-data`, { signal: AbortSignal.timeout(5000) })
        .then((r) => r.json())
        .catch(() => ({ connected: false, qr: null }));

/**
 * Force a reconnection and QR code generation.
 * @returns {Promise<{status: string}>}
 */
export const restartWhatsApp = () =>
    fetch(`${BASE}/whatsapp/restart`, {
        method: 'POST',
    }).then((r) => r.json());

/**
 * Disconnect WhatsApp and clear the session (triggers fresh QR on next connect).
 * @returns {Promise<{status: string}>}
 */
export const disconnectWhatsApp = () =>
    fetch(`${BASE}/whatsapp/session`, {
        method: 'DELETE',
        signal: AbortSignal.timeout(8000),
    }).then((r) => r.json());
