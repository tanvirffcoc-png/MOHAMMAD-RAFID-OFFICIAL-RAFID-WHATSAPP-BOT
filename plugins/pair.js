const { makeWASocket, useMultiFileAuthState, Browsers } = require("@whiskeysockets/baileys");
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
    credit: "Adapted for RAFID BOT",
  },

  start: async ({ api, event, args }) => {
    const { threadId, message, senderId } = event;

    // ---------- Phone number formatting ----------
    let phoneNumber = args.join(" ").trim().replace(/[^0-9]/g, "");

    // If no number provided, use sender's WhatsApp number (without @s.whatsapp.net)
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

    // Validate length
    if (phoneNumber.length < 11 || phoneNumber.length > 15) {
      return api.sendMessage(
        threadId,
        { text: "❌ Invalid phone number. Please provide a number without `+` or spaces.\nExample: `.pair 8801714426665`" },
        { quoted: message }
      );
    }

    // ---------- Session directory auto-generation ----------
    const sessionId = `session-${phoneNumber}`;
    // Resolve path relative to the bot root (assuming command file is inside commands folder)
    const sessionsDir = path.resolve(__dirname, '../../seassions');
    const sessionPath = path.join(sessionsDir, sessionId);

    // Create sessions directory if it doesn't exist
    if (!fs.existsSync(sessionsDir)) {
      fs.mkdirSync(sessionsDir, { recursive: true });
      console.log(`[PAIR] Created sessions directory: ${sessionsDir}`);
    }

    // Initial response
    await api.sendMessage(
      threadId,
      { text: `⏳ Requesting pairing code for *${phoneNumber}*...\nPlease wait about 15–25 seconds.` },
      { quoted: message }
    );

    try {
      // Load or create auth state
      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

      // Create WhatsApp socket
      const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: Browsers.ubuntu("Chrome"),
        markOnlineOnConnect: false,
        connectTimeoutMs: 90000,
        defaultQueryTimeoutMs: undefined,
        keepAliveIntervalMs: 30000,
      });

      // Save credentials on update
      sock.ev.on('creds.update', saveCreds);

      // Wait for the connection to become ready before requesting pairing code
      sock.ev.on('connection.update', async (update) => {
        const { connection } = update;

        // When socket reaches 'connecting' state, we can safely request pairing code
        if (connection === 'connecting') {
          // Wait a bit more for full readiness
          setTimeout(async () => {
            try {
              const code = await sock.requestPairingCode(phoneNumber);

              const successText = `✅ *Pairing Code Generated*\n\n` +
                `📱 Number: ${phoneNumber}\n` +
                `🔑 Code: ${code}\n\n` +
                `*How to link:*\n` +
                `1. Open WhatsApp on your phone.\n` +
                `2. Go to *Settings* → *Linked Devices*.\n` +
                `3. Tap *Link a Device*.\n` +
                `4. Choose *Link with phone number instead*.\n` +
                `5. Enter the code: *${code}*\n\n` +
                `After entering, the bot will be connected to this number.`;

              await api.sendMessage(threadId, { text: successText }, { quoted: message });

              // Send the code alone for easy copying
              setTimeout(async () => {
                await api.sendMessage(threadId, { text: `*${code}*` }, { quoted: message });
              }, 2000);

              // Confirmation message
              await api.sendMessage(
                threadId,
                { text: `✅ Session saved successfully. The bot is now cloned to *${phoneNumber}*.` },
                { quoted: message }
              );
            } catch (err) {
              console.error("Pairing error:", err.message);
              await api.sendMessage(
                threadId,
                { text: `❌ Failed to get pairing code.\nError: ${err.message}\n\nPlease restart the bot and try again.` },
                { quoted: message }
              );
            }
          }, 3000); // 3-second buffer after 'connecting' event
        }

        // Optional: log connection close (non‑critical)
        if (connection === 'close') {
          console.log(`[PAIR] Connection closed for session: ${phoneNumber}`);
        }
      });

    } catch (error) {
      console.error("Pair command fatal error:", error.message);
      await api.sendMessage(
        threadId,
        { text: `❌ An unexpected error occurred.\nError: ${error.message}` },
        { quoted: message }
      );
    }
  },
};
