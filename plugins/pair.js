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
      { text: `⏳ Requesting pairing code for *${phoneNumber}*...\n\nএকটু অপেক্ষা করো (১৫-৩০ সেকেন্ড)...\nপ্রথমবার Connection Closed আসলে অটো রিট্রাই চলবে।` },
      { quoted: message }
    );

    try {
      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

      const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: Browsers.ubuntu("Chrome"),   // নোটিফিকেশনের জন্য সবচেয়ে স্টেবল
        markOnlineOnConnect: false,
        connectTimeoutMs: 90000,
        defaultQueryTimeoutMs: undefined,
        keepAliveIntervalMs: 30000,
      });

      sock.ev.on('creds.update', saveCreds);

      // Promise দিয়ে Connection Closed এড়ানো + সঠিক টাইমিং
      const baileysPairingPromise = new Promise((resolve, reject) => {
        let resolved = false;
        let retryCount = 0;
        const maxRetries = 4;

        const tryPairing = async () => {
          if (resolved) return;
          retryCount++;

          try {
            // সকেট সম্পূর্ণ রেডি হওয়ার জন্য অপেক্ষা
            await new Promise(r => setTimeout(r, 8000));
            const code = await sock.requestPairingCode(phoneNumber);
            resolved = true;
            resolve(code);
          } catch (err) {
            console.error(`Pairing attempt ${retryCount} failed:`, err.message);
            if (retryCount < maxRetries && err.message.includes("Connection Closed")) {
              await api.sendMessage(threadId, {
                text: `❌ Connection Closed (Attempt ${retryCount}/${maxRetries})\n\n🔄 আবার চেষ্টা করছি...`
              }, { quoted: message });
              tryPairing(); // retry
            } else {
              resolved = true;
              reject(err);
            }
          }
        };

        sock.ev.on('connection.update', (update) => {
          const { connection } = update;
          if (connection === 'connecting' && !resolved) {
            tryPairing();
          }
          if (connection === 'open') {
            api.sendMessage(threadId, {
              text: `✅ *সফলভাবে কানেক্ট হয়েছে!*\n\n📱 নাম্বার: ${phoneNumber}\n\nবট এখন এই নাম্বার থেকে ক্লোন হয়ে চলবে।`
            }, { quoted: message });
          }
        });

        // ৩০ সেকেন্ডের মধ্যে না পেলে টাইমআউট
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            reject(new Error("Pairing timeout after 30 seconds"));
          }
        }, 30000);
      });

      const code = await baileysPairingPromise;

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

      // কোড আলাদা করে পাঠানো (কপি সহজ)
      setTimeout(async () => {
        await api.sendMessage(threadId, { text: `*${code}*` }, { quoted: message });
      }, 2000);

    } catch (error) {
      console.error("Pair command error:", error.message);
      await api.sendMessage(threadId, {
        text: `❌ Failed to get pairing code.\nError: ${error.message}\n\nবট রিস্টার্ট করে আবার চেষ্টা করো।`
      }, { quoted: message });
    }
  },
};
