const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require('pino');
const fs = require('fs');
const path = require('path');

module.exports = {
  config: {
    name: "pair",
    aliases: ["getpair", "clonebot", "paircode", "session"],
    permission: 0,
    prefix: true,
    description: "Get a pairing code to link a new WhatsApp device as a bot session (Stable Multi-Session).",
    category: "Utility",
    credit: "Adapted for RAFID BOT by Tanvir + Grok",
  },

  start: async ({ api, event, args }) => {
    const { threadId, message, senderId } = event;

    let phoneNumber = args.join(" ").trim().replace(/[^0-9]/g, "");

    if (!phoneNumber) {
      phoneNumber = senderId.split("@")[0];
    }

    if (phoneNumber.length < 10 || phoneNumber.length > 15) {
      return api.sendMessage(
        threadId,
        { text: "❌ Please provide a valid phone number without `+` or spaces.\nExample: `.pair 8801714426665`" },
        { quoted: message }
      );
    }

    // BD number fix
    if (phoneNumber.startsWith("0") && phoneNumber.length === 11) phoneNumber = "88" + phoneNumber.slice(1);
    if (!phoneNumber.startsWith("880") && phoneNumber.length === 10) phoneNumber = "88" + phoneNumber;

    const sessionId = `session-${phoneNumber}`;
    const sessionsDir = path.resolve(__dirname, '../../seassions');
    const sessionPath = path.join(sessionsDir, sessionId);

    if (!fs.existsSync(sessionsDir)) {
      fs.mkdirSync(sessionsDir, { recursive: true });
    }

    await api.sendMessage(
      threadId,
      { text: `⏳ Requesting pairing code for *${phoneNumber}*...\n\nপ্রথমবার Connection Closed আসতে পারে, অটো রিট্রাই চলছে...` },
      { quoted: message }
    );

    try {
      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

      const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        connectTimeoutMs: 90000,
        defaultQueryTimeoutMs: undefined,
        keepAliveIntervalMs: 30000,
      });

      sock.ev.on('creds.update', saveCreds);

      let pairingRequested = false;
      let retryCount = 0;
      const maxRetries = 3;

      sock.ev.on('connection.update', async (update) => {
        const { connection, qr } = update;

        if (connection === 'open') {
          await api.sendMessage(threadId, { text: `✅ সফলভাবে কানেক্ট হয়েছে!\n📱 নাম্বার: ${phoneNumber}` }, { quoted: message });
        }

        if ((connection === 'connecting' || !!qr) && !pairingRequested && retryCount < maxRetries) {
          pairingRequested = true;
          retryCount++;

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
                `> After entering, the bot will be connected to that number.`;

              await api.sendMessage(threadId, { text: successText }, { quoted: message });

              setTimeout(async () => {
                await api.sendMessage(threadId, { text: `*${code}*` }, { quoted: message });
              }, 2000);

            } catch (err) {
              console.error(`Pairing attempt ${retryCount} error:`, err.message);

              if (retryCount < maxRetries && err.message.includes("Connection Closed")) {
                pairingRequested = false; // retry চালু
                await api.sendMessage(threadId, {
                  text: `❌ Connection Closed (Attempt ${retryCount}/${maxRetries})\n\n🔄 আবার চেষ্টা করছি...`
                }, { quoted: message });
              } else {
                await api.sendMessage(threadId, {
                  text: `❌ Failed to get pairing code.\nError: ${err.message}\n\nআবার চেষ্টা করো (.pair আবার দাও)`
                }, { quoted: message });
              }
            }
          }, 7000); // 7 সেকেন্ড অপেক্ষা (সবচেয়ে গুরুত্বপূর্ণ)
        }
      });

    } catch (error) {
      console.error("Pair command error:", error.message);
      await api.sendMessage(threadId, {
        text: `❌ Failed to get pairing code.\nError: ${error.message}`
      }, { quoted: message });
    }
  },
};
