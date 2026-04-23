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
    credit: "Fixed & Stable Version for RAFID BOT",
  },

  start: async ({ api, event, args }) => {
    const { threadId, message, senderId } = event;

    // ---------- 1. Phone number formatting ----------
    let phoneNumber = args.join(" ").trim().replace(/[^0-9]/g, "");
    if (!phoneNumber) {
      phoneNumber = senderId.split("@")[0];
    }

    // Auto-correct Bangladeshi numbers
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

    // ---------- 2. Auto-create session folder ----------
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

    // ---------- 3. Create WhatsApp socket ----------
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      browser: Browsers.macOS("Chrome"),
      markOnlineOnConnect: false,
      connectTimeoutMs: 90000,
      defaultQueryTimeoutMs: undefined,
      keepAliveIntervalMs: 30000,
    });

    sock.ev.on('creds.update', saveCreds);

    let pairingRequested = false;
    let connectionEstablished = false;

    // Listen for successful connection
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === 'open' && !connectionEstablished) {
        connectionEstablished = true;
        console.log(`[PAIR] Connection opened for ${phoneNumber}`);
        await api.sendMessage(
          threadId,
          { text: `✅ Successfully connected! Bot is now active on *${phoneNumber}*.` },
          { quoted: message }
        );
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        console.log(`[PAIR] Connection closed for ${phoneNumber}. Reconnect: ${shouldReconnect}`);
      }
    });

    // ---------- 4. Request pairing code after socket is ready ----------
    // Give the socket a moment to initialize, then request the code
    setTimeout(async () => {
      if (pairingRequested) return;
      pairingRequested = true;

      try {
        // Request pairing code from WhatsApp
        const code = await sock.requestPairingCode(phoneNumber);

        const instructions = `✅ *Pairing Code Generated*\n\n` +
          `📱 Number: ${phoneNumber}\n` +
          `🔑 Code: *${code}*\n\n` +
          `*How to link:*\n` +
          `1. Open WhatsApp on your phone.\n` +
          `2. Go to *Settings* → *Linked Devices*.\n` +
          `3. Tap *Link a Device*.\n` +
          `4. Choose *Link with phone number instead*.\n` +
          `5. Enter the code: *${code}*\n\n` +
          `⚠️ After entering the code, the bot will be cloned to the new number within a few seconds.\n` +
          `📁 Session saved in: ${sessionPath}`;

        await api.sendMessage(threadId, { text: instructions }, { quoted: message });

        // Also send just the code for easy copying
        setTimeout(() => {
          api.sendMessage(threadId, { text: `*${code}*` }, { quoted: message });
        }, 2000);

      } catch (err) {
        console.error(`[PAIR] Error requesting code:`, err.message);
        let errorMsg = `❌ Failed to get pairing code.\nError: ${err.message}\n\nPossible reasons:\n- The number is already linked to another device.\n- Invalid phone number format.\n- Network issue.\n\nTry again after a few minutes.`;
        if (err.message.includes("already logged in")) {
          errorMsg = `❌ This number *${phoneNumber}* is already linked to a session.\nPlease delete the session folder \`${sessionPath}\` and try again.`;
        }
        await api.sendMessage(threadId, { text: errorMsg }, { quoted: message });
      }
    }, 3000); // Wait 3 seconds to ensure socket is ready
  },
};
