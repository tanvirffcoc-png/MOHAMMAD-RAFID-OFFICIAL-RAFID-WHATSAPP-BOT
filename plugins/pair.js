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
    description: "নাম্বার দিয়ে WhatsApp বট ক্লোন করো (Stable Pairing Code)",
    category: "Utility",
    credit: "Tanvir + Grok Fixed",
  },

  start: async ({ api, event, args }) => {
    const { threadId, message } = event;

    let phoneNumber = args.join("").trim().replace(/[^0-9]/g, "");

    if (phoneNumber.startsWith("0") && phoneNumber.length === 11) {
      phoneNumber = "88" + phoneNumber.slice(1); // BD number fix
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
    const sessionsDir = path.resolve(__dirname, '../../sessions');
    const sessionPath = path.join(sessionsDir, sessionId);

    if (!fs.existsSync(sessionsDir)) {
      fs.mkdirSync(sessionsDir, { recursive: true });
    }

    await api.sendMessage(threadId, {
      text: `⏳ *${phoneNumber}* এর জন্য পেয়ারিং শুরু হচ্ছে...\n\nএকটু অপেক্ষা করো (১৫-৩০ সেকেন্ড)...`
    }, { quoted: message });

    try {
      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

      const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: Browsers.ubuntu("Chrome"),   // ← এটা সবচেয়ে স্টেবল pairing-এর জন্য
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,             // important for pairing
        keepAliveIntervalMs: 30000,
      });

      sock.ev.on('creds.update', saveCreds);

      let pairingRequested = false;

      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (connection === 'open') {
          await api.sendMessage(threadId, {
            text: `✅ *সফলভাবে কানেক্ট হয়েছে!*\n\n📱 নাম্বার: ${phoneNumber}\n🔑 সেশন: ${sessionId}`
          }, { quoted: message });
        }

        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          console.log(`Pair connection closed for ${phoneNumber} | Code: ${statusCode}`);
        }

        // Pairing code request — শুধুমাত্র connecting/qr event এ
        if ((connection === 'connecting' || !!qr) && !pairingRequested) {
          pairingRequested = true;

          setTimeout(async () => {
            try {
              const code = await sock.requestPairingCode(phoneNumber);

              const successText = `✅ *Pairing Code তৈরি হয়েছে!*\n\n` +
                `📱 নাম্বার: *${phoneNumber}*\n` +
                `🔑 কোড: *${code}*\n\n` +
                `✅ **কিভাবে লিংক করবে (সবচেয়ে গুরুত্বপূর্ণ):**\n\n` +
                `1. তোমার মেইন WhatsApp অ্যাপ খোলো (যে নাম্বারে বট ক্লোন করতে চাও)\n` +
                `2. Settings → Linked Devices → Link a Device\n` +
                `3. **"Link with phone number instead"** এ ক্লিক করো\n` +
                `4. উপরের ৮ অক্ষরের কোডটি পেস্ট করো\n\n` +
                `⚠️ নোটিফিকেশন না আসলে:\n` +
                `• WhatsApp অ্যাপ আপডেট করো\n` +
                `• "Link with phone number instead" অপশনটি নিজে খুঁজে ক্লিক করো\n` +
                `• কোড ১ মিনিটের মধ্যে দাও\n\n` +
                `কোডটি একবার ব্যবহার করা যাবে।`;

              await api.sendMessage(threadId, { text: successText }, { quoted: message });

              // কোড আলাদা করে পাঠানো (কপি সহজ)
              setTimeout(() => {
                api.sendMessage(threadId, { text: `*${code}*` }, { quoted: message });
              }, 2500);

            } catch (err) {
              console.error("Pairing Error:", err);
              let errText = "❌ Pairing code পাওয়া যায়নি।";
              if (err.message.includes("Connection Closed") || err.message.includes("closed")) {
                errText += "\n\nআবার চেষ্টা করো। প্রথমবার প্রায়ই এমন হয়।";
              }
              errText += `\nError: ${err.message}`;
              await api.sendMessage(threadId, { text: errText }, { quoted: message });
            }
          }, 5000); // 5 সেকেন্ড অপেক্ষা — connecting state এ পৌঁছানোর জন্য
        }
      });

    } catch (error) {
      console.error("Pair main error:", error);
      await api.sendMessage(threadId, {
        text: `❌ বড় সমস্যা হয়েছে:\n${error.message}\n\nবট রিস্টার্ট করে আবার চেষ্টা করো।`
      }, { quoted: message });
    }
  },
};
