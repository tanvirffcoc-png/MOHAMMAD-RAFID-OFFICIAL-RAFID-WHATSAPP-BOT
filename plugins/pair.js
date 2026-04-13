const { makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require("@whiskeysockets/baileys");
const pino = require('pino');
const fs = require('fs');
const path = require('path');

module.exports = {
  config: {
    name: "pair",
    aliases: ["getpair", "clone", "session", "paircode"],
    permission: 0,
    prefix: true,
    description: "নাম্বার দিয়ে WhatsApp বট ক্লোন করো (Stable Fix for RAFID BOT)",
    category: "Utility",
    credit: "Tanvir + Grok Stable Fix",
  },

  start: async ({ api, event, args }) => {
    const { threadId, message } = event;

    let phoneNumber = args.join("").trim().replace(/[^0-9]/g, "");

    // BD number auto fix
    if (phoneNumber.startsWith("0") && phoneNumber.length === 11) {
      phoneNumber = "88" + phoneNumber.slice(1);
    }
    if (!phoneNumber.startsWith("880") && phoneNumber.length === 10) {
      phoneNumber = "88" + phoneNumber;
    }

    if (!phoneNumber || phoneNumber.length < 11 || phoneNumber.length > 15) {
      return api.sendMessage(threadId, {
        text: "❌ সঠিক নাম্বার দাও!\nউদাহরণ: `.pair 8801714426665`"
      }, { quoted: message });
    }

    const sessionId = `session-${phoneNumber}`;
    const sessionsDir = path.resolve(__dirname, '../../seassions'); // তোমার বটে seassions (typo) আছে
    const sessionPath = path.join(sessionsDir, sessionId);

    if (!fs.existsSync(sessionsDir)) {
      fs.mkdirSync(sessionsDir, { recursive: true });
    }

    await api.sendMessage(threadId, {
      text: `⏳ *${phoneNumber}* এর জন্য পেয়ারিং শুরু হচ্ছে...\n\n১৫-৪০ সেকেন্ড অপেক্ষা করো, প্রথমবার Connection Closed আসতে পারে...`
    }, { quoted: message });

    try {
      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

      const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ["Ubuntu", "Chrome", "20.0.04"],   // ← সবচেয়ে স্টেবল pairing-এর জন্য
        // browser: Browsers.ubuntu("Chrome"),      // চাইলে এটাও ট্রাই করতে পারো
        connectTimeoutMs: 80000,
        defaultQueryTimeoutMs: undefined,           // Connection Closed fix
        keepAliveIntervalMs: 30000,
        retryRequestDelayMs: 5000,
      });

      sock.ev.on('creds.update', saveCreds);

      let pairingRequested = false;
      let retryCount = 0;
      const maxRetries = 2;

      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (connection === 'open') {
          await api.sendMessage(threadId, {
            text: `✅ *সফলভাবে কানেক্ট হয়েছে!*\n\n📱 নাম্বার: ${phoneNumber}\n🔑 সেশন: ${sessionId}`
          }, { quoted: message });
        }

        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          console.log(`[Pair] Connection closed for ${phoneNumber} | Code: ${statusCode}`);
        }

        // Pairing code request — connecting/qr event এ + retry logic
        if ((connection === 'connecting' || !!qr) && !pairingRequested && retryCount < maxRetries) {
          pairingRequested = true;
          retryCount++;

          setTimeout(async () => {
            try {
              const code = await sock.requestPairingCode(phoneNumber);

              const successText = `✅ *Pairing Code তৈরি হয়েছে!*\n\n` +
                `📱 নাম্বার: *${phoneNumber}*\n` +
                `🔑 কোড: *${code}*\n\n` +
                `**লিংক করার নিয়ম:**\n` +
                `1. তোমার মেইন WhatsApp অ্যাপ খোলো\n` +
                `2. Settings → Linked Devices → Link a Device\n` +
                `3. **"Link with phone number instead"** ক্লিক করো\n` +
                `4. উপরের ৮ অক্ষরের কোডটি দাও\n\n` +
                `⚠️ কোড ১ মিনিটের মধ্যে ব্যবহার করো। নোটিফিকেশন না আসলে নিজে "Link with phone number instead" অপশনে যাও।`;

              await api.sendMessage(threadId, { text: successText }, { quoted: message });

              setTimeout(() => {
                api.sendMessage(threadId, { text: `*${code}*` }, { quoted: message });
              }, 2500);

            } catch (err) {
              console.error("Pairing Error:", err.message);

              if (retryCount < maxRetries) {
                await api.sendMessage(threadId, {
                  text: `❌ প্রথম চেষ্টায় Connection Closed হয়েছে।\n\n🔄 আবার চেষ্টা করছি... (${retryCount}/${maxRetries})`
                }, { quoted: message });
                pairingRequested = false; // retry করার জন্য reset
              } else {
                await api.sendMessage(threadId, {
                  text: `❌ বার বার Connection Closed হচ্ছে।\n\nসমাধান:\n• বট রিস্টার্ট করো\n• `.pair আবার ট্রাই করো\n• WhatsApp অ্যাপ আপডেট করো`
                }, { quoted: message });
              }
            }
          }, 6000); // 6 সেকেন্ড অপেক্ষা — connecting state পুরোপুরি সেট হওয়ার জন্য
        }
      });

    } catch (error) {
      console.error("Pair main error:", error);
      await api.sendMessage(threadId, {
        text: `❌ বড় সমস্যা:\n${error.message}\n\nবট রিস্টার্ট করে আবার চেষ্টা করো।`
      }, { quoted: message });
    }
  },
};
