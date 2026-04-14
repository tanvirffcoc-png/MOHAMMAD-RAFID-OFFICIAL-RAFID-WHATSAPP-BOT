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
    description: "Get a pairing code to link a new WhatsApp device as a bot session (Stable).",
    category: "Utility",
    credit: "Adapted for RAFID BOT by Tanvir + Grok (SMD-MINI Style)",
  },

  start: async ({ api, event, args }) => {
    const { threadId, message, senderId } = event;

    let phoneNumber = args.join(" ").trim().replace(/[^0-9]/g, "");

    if (!phoneNumber) {
      phoneNumber = senderId.split("@")[0];
    }

    // BD number fix
    if (phoneNumber.startsWith("0") && phoneNumber.length === 11) {
      phoneNumber = "88" + phoneNumber.slice(1);
    }
    if (!phoneNumber.startsWith("880") && phoneNumber.length === 10) {
      phoneNumber = "88" + phoneNumber;
    }

    if (phoneNumber.length < 11 || phoneNumber.length > 15) {
      return api.sendMessage(
        threadId,
        { text: "❌ Please provide a valid phone number without `+` or spaces.\nExample: `.pair 8801714426665`" },
        { quoted: message }
      );
    }

    const sessionId = `session-${phoneNumber}`;
    const sessionsDir = path.resolve(__dirname, '../../seassions'); // তোমার বটের আসল ফোল্ডার
    const sessionPath = path.join(sessionsDir, sessionId);

    if (!fs.existsSync(sessionsDir)) {
      fs.mkdirSync(sessionsDir, { recursive: true });
    }

    await api.sendMessage(
      threadId,
      { text: `⏳ Requesting pairing code for *${phoneNumber}*...\n\nএকটু অপেক্ষা করো (১৫-২৫ সেকেন্ড)...` },
      { quoted: message }
    );

    try {
      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

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

      sock.ev.on('creds.update', saveCreds);

      // একবারই চেষ্টা — SMD-MINI স্টাইলে সঠিক টাইমিং
      setTimeout(async () => {
        try {
          const code = await sock.requestPairingCode(phoneNumber);

          const successText = `✅ *Pairing Code Generated*\n\n` +
            `📱 Number: ${phoneNumber}\n` +
            `🔑 Code: ${code}\n\n` +
            `*How to connect:*\n` +
            `1. Open WhatsApp on your phone\n` +
            `2. Go to *Linked Devices* (Settings > Linked Devices)\n` +
            `3. Tap *Link a Device*\n` +
            `4. Choose *Link with phone number instead*\n` +
            `5. Enter this code: *${code}*\n\n` +
            `> After entering, the bot will be connected to that number.\n\n` +
            `⚠️ WhatsApp-এ নোটিফিকেশন আসবে। না আসলে নিজে "Link with phone number instead" অপশনে ক্লিক করো।`;

          await api.sendMessage(threadId, { text: successText }, { quoted: message });

          // কোড আলাদা করে পাঠানো
          setTimeout(async () => {
            await api.sendMessage(threadId, { text: `*${code}*` }, { quoted: message });
          }, 2000);

          await api.sendMessage(threadId, {
            text: `✅ সেশন সেভ হয়েছে। বট এখন এই নাম্বার থেকে ক্লোন হয়ে চলবে।`
          }, { quoted: message });

        } catch (err) {
          console.error("Pairing error:", err.message);
          await api.sendMessage(threadId, {
            text: `❌ Failed to get pairing code.\nError: ${err.message}\n\nবট রিস্টার্ট করে আবার চেষ্টা করো।`
          }, { quoted: message });
        }
      }, 8000); // ৮ সেকেন্ড অপেক্ষা — এটাই মূল ফিক্স

    } catch (error) {
      console.error("Pair command error:", error.message);
      await api.sendMessage(threadId, {
        text: `❌ Failed to get pairing code.\nError: ${error.message}`
      }, { quoted: message });
    }
  },
};
