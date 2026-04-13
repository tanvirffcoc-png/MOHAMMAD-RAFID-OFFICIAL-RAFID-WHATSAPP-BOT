const { makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require("@whiskeysockets/baileys");
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

    // Extract phone number (পুরনো কোডের মতোই)
    let phoneNumber = args.join(" ").trim().replace(/[^0-9]/g, "");

    if (!phoneNumber) {
      phoneNumber = senderId.split("@")[0];
    }

    // Validate phone number
    if (phoneNumber.length < 10 || phoneNumber.length > 15) {
      return api.sendMessage(
        threadId,
        {
          text: "❌ Please provide a valid phone number without `+` or spaces.\nExample: `.pair 8801714426665`",
        },
        { quoted: message }
      );
    }

    // BD number auto fix
    if (phoneNumber.startsWith("0") && phoneNumber.length === 11) {
      phoneNumber = "88" + phoneNumber.slice(1);
    }
    if (!phoneNumber.startsWith("880") && phoneNumber.length === 10) {
      phoneNumber = "88" + phoneNumber;
    }

    const sessionId = `session-${phoneNumber}`;
    const sessionsDir = path.resolve(__dirname, '../../seassions'); // তোমার বটে seassions আছে
    const sessionPath = path.join(sessionsDir, sessionId);

    // অটো সেশন ফোল্ডার তৈরি করবে (তোমাকে ম্যানুয়ালি খুলতে হবে না)
    if (!fs.existsSync(sessionsDir)) {
      fs.mkdirSync(sessionsDir, { recursive: true });
    }

    // Processing message (পুরনো স্টাইলে)
    await api.sendMessage(
      threadId,
      { text: `⏳ Requesting pairing code for *${phoneNumber}*...\n\nএকটু অপেক্ষা করো (১৫-৩০ সেকেন্ড)...` },
      { quoted: message }
    );

    try {
      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

      const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ["Ubuntu", "Chrome", "20.0.04"],   // ← সবচেয়ে স্টেবল
        connectTimeoutMs: 80000,
        defaultQueryTimeoutMs: undefined,
        keepAliveIntervalMs: 30000,
      });

      sock.ev.on('creds.update', saveCreds);

      let pairingRequested = false;

      sock.ev.on('connection.update', async (update) => {
        const { connection, qr } = update;

        if (connection === 'open') {
          await api.sendMessage(threadId, {
            text: `✅ *সফলভাবে কানেক্ট হয়েছে!*\n\n📱 নাম্বার: ${phoneNumber}`
          }, { quoted: message });
        }

        // Pairing code request (Connection Closed fix করার জন্য সঠিক সময়ে)
        if ((connection === 'connecting' || !!qr) && !pairingRequested) {
          pairingRequested = true;

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

              // কোড আলাদা করে পাঠানো (কপি সহজ)
              setTimeout(async () => {
                await api.sendMessage(threadId, { text: `*${code}*` }, { quoted: message });
              }, 2000);

            } catch (err) {
              console.error("Pairing code error:", err.message);
              await api.sendMessage(threadId, {
                text: `❌ Failed to get pairing code.\nError: ${err.message}\n\nআবার চেষ্টা করো (.pair আবার দাও)`
              }, { quoted: message });
            }
          }, 6000); // 6 সেকেন্ড অপেক্ষা — connecting পুরোপুরি হওয়ার জন্য
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
