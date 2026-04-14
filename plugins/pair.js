const { makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require('pino');
const fs = require('fs');
const path = require('path');

module.exports = {
  config: {
    name: "pair",
    aliases: ["getpair", "clonebot", "paircode", "session"],
    permission: 0,
    prefix: true,
    description: "Generate a pairing code to link a new WhatsApp number as a bot session.",
    category: "Utility",
    credit: "Stable version for RAFID BOT",
  },

  start: async ({ api, event, args }) => {
    const { threadId, message, senderId } = event;

    // ---------- Format phone number ----------
    let phoneNumber = args.join(" ").trim().replace(/[^0-9]/g, "");
    if (!phoneNumber) {
      phoneNumber = senderId.split("@")[0];
    }

    // Auto-correct BD numbers
    if (phoneNumber.startsWith("0") && phoneNumber.length === 11) {
      phoneNumber = "88" + phoneNumber.slice(1);
    }
    if (!phoneNumber.startsWith("880") && phoneNumber.length === 10) {
      phoneNumber = "88" + phoneNumber;
    }

    if (phoneNumber.length < 11 || phoneNumber.length > 15) {
      return api.sendMessage(
        threadId,
        { text: "❌ Invalid phone number.\nExample: `.pair 8801714426665`" },
        { quoted: message }
      );
    }

    // ---------- Auto‑create session directory ----------
    const sessionId = `session-${phoneNumber}`;
    const sessionsDir = path.resolve(__dirname, '../../seassions');
    const sessionPath = path.join(sessionsDir, sessionId);

    if (!fs.existsSync(sessionsDir)) {
      fs.mkdirSync(sessionsDir, { recursive: true });
    }

    await api.sendMessage(
      threadId,
      { text: `⏳ Requesting pairing code for *${phoneNumber}*...\nThis may take up to 30 seconds.` },
      { quoted: message }
    );

    // ---------- Create WhatsApp socket ----------
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      browser: Browsers.ubuntu("Chrome"),            // Can also use Browsers.appropriate("Chrome")
      markOnlineOnConnect: false,
      connectTimeoutMs: 90000,
      defaultQueryTimeoutMs: undefined,
      keepAliveIntervalMs: 30000,
      // The following option ensures pairing code works reliably
      mobile: false,                                 // false is default; keep as false for pairing code
    });

    sock.ev.on('creds.update', saveCreds);

    let pairingRequested = false;  // Prevent multiple requests

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // When socket is fully open, we can confirm the session is linked
      if (connection === 'open') {
        await api.sendMessage(
          threadId,
          { text: `✅ Successfully connected!\nThe bot is now active on *${phoneNumber}*.` },
          { quoted: message }
        );
        console.log(`[PAIR] Session opened for ${phoneNumber}`);
      }

      // If we receive a QR code (shouldn't happen), notify and ignore
      if (qr) {
        console.log(`[PAIR] QR code received unexpectedly for ${phoneNumber}`);
      }

      // **The key moment: request pairing code when socket is connecting/ready**
      if (connection === 'connecting' && !pairingRequested) {
        pairingRequested = true;

        // Wait an extra 5 seconds for full handshake (essential for notification to appear)
        setTimeout(async () => {
          try {
            const code = await sock.requestPairingCode(phoneNumber);

            const instructions = `✅ *Pairing Code Generated*\n\n` +
              `📱 Number: ${phoneNumber}\n` +
              `🔑 Code: ${code}\n\n` +
              `*How to link:*\n` +
              `1. Open WhatsApp on your phone.\n` +
              `2. Go to *Settings* → *Linked Devices*.\n` +
              `3. Tap *Link a Device*.\n` +
              `4. Choose *Link with phone number instead*.\n` +
              `5. Enter the code: *${code}*\n\n` +
              `⚠️ A notification should appear automatically. If not, manually go to "Link with phone number instead".`;

            await api.sendMessage(threadId, { text: instructions }, { quoted: message });

            // Send the code separately for easy copying
            setTimeout(() => {
              api.sendMessage(threadId, { text: `*${code}*` }, { quoted: message });
            }, 2000);

            await api.sendMessage(
              threadId,
              { text: `✅ Session folder created. The bot will be ready after you enter the code.` },
              { quoted: message }
            );
          } catch (err) {
            console.error(`[PAIR] Error requesting code:`, err.message);
            await api.sendMessage(
              threadId,
              { text: `❌ Failed to get pairing code.\nError: ${err.message}\n\nPossible reasons:\n- Number already registered with multi‑device.\n- Temporary server issue.\nTry again after a few minutes.` },
              { quoted: message }
            );
          }
        }, 5000); // 5-second delay ensures socket is ready
      }

      // Handle disconnection (non‑fatal)
      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        console.log(`[PAIR] Connection closed for ${phoneNumber}. Reconnect: ${shouldReconnect}`);
        if (shouldReconnect) {
          // Optional: attempt reconnect? Not needed for pairing command.
        }
      }
    });
  },
};
