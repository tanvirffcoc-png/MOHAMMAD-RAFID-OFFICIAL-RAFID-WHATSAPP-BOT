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
    description: "নাম্বার দিয়ে WhatsApp বট ক্লোন/পেয়ার করো (Multi Session Support)",
    category: "Utility",
    credit: "Tanvir + Grok Fix",
  },

  start: async ({ api, event, args }) => {
    const { threadId, message } = event;
    
    let phoneNumber = args.join("").trim().replace(/[^0-9]/g, "").replace(/^0+/, "");

    if (!phoneNumber.startsWith("880") && phoneNumber.length === 10) {
      phoneNumber = "88" + phoneNumber;
    }

    if (!phoneNumber || phoneNumber.length < 11 || phoneNumber.length > 15) {
      return api.sendMessage(threadId, {
        text: "❌ সঠিক নাম্বার দাও!\nউদাহরণ: `.pair 8801760234907`"
      }, { quoted: message });
    }

    const sessionId = `session-${phoneNumber}`;
    const sessionPath = path.resolve(__dirname, '../../sessions', sessionId);

    if (!fs.existsSync(path.resolve(__dirname, '../../sessions'))) {
      fs.mkdirSync(path.resolve(__dirname, '../../sessions'), { recursive: true });
    }

    await api.sendMessage(threadId, {
      text: `⏳ *${phoneNumber}* এর জন্য পেয়ারিং শুরু হচ্ছে...\n\nঅপেক্ষা করো (১০-২০ সেকেন্ড)...`
    }, { quoted: message });

    try {
      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

      const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: Browsers.ubuntu("Chrome"),
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
      });

      sock.ev.on('creds.update', saveCreds);

      let pairingRequested = false;

      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        // সংযোগ খোলা হলে সফলতার মেসেজ
        if (connection === 'open') {
          await api.sendMessage(threadId, {
            text: `✅ *সফলভাবে কানেক্ট হয়েছে!*\n\n📱 নাম্বার: ${phoneNumber}\n🔑 সেশন: ${sessionId}\n\nবট এখন এই নাম্বার থেকে চলবে।`
          }, { quoted: message });
        }

        // সংযোগ বন্ধ হলে
        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          console.log(`Connection closed for ${phoneNumber} | Code: ${statusCode}`);

          if (statusCode !== DisconnectReason.loggedOut) {
            // প্রয়োজনে auto reconnect লজিক
          } else {
            await api.sendMessage(threadId, { text: `❌ লগআউট হয়ে গেছে। নতুন করে পেয়ার করো।` });
          }
        }

        // পেয়ারিং কোড রিকোয়েস্টের উপযুক্ত মুহূর্ত
        if (connection === 'connecting' && !pairingRequested) {
          pairingRequested = true;
          
          try {
            // Baileys-এর pairing code ফাংশন কল
            const code = await sock.requestPairingCode(phoneNumber);
            
            const successText = `✅ *Pairing Code তৈরি হয়েছে!*\n\n` +
              `📱 নাম্বার: *${phoneNumber}*\n` +
              `🔑 কোড: *${code}*\n\n` +
              `কিভাবে ব্যবহার করবে:\n` +
              `1. WhatsApp খোলো\n` +
              `2. Settings → Linked Devices → Link a Device\n` +
              `3. "Link with phone number instead" সিলেক্ট করো\n` +
              `4. উপরের কোডটি পেস্ট করো`;

            await api.sendMessage(threadId, { text: successText }, { quoted: message });

            // কোড আলাদা করে কপি সুবিধার জন্য
            await api.sendMessage(threadId, { text: `*${code}*` }, { quoted: message });

          } catch (err) {
            console.error("Pairing code error:", err);
            let errMsg = "❌ Pairing code পাওয়া যায়নি।";
            if (err.message.includes("Connection Closed") || err.message.includes("closed")) {
              errMsg += "\n\nসম্ভাব্য কারণ:\n• নেটওয়ার্ক সমস্যা\n• Baileys ভার্সন পুরনো\n• WhatsApp সার্ভার থেকে ব্লক";
            }
            errMsg += `\n\nError: ${err.message}`;
            await api.sendMessage(threadId, { text: errMsg }, { quoted: message });
          }
        }
      });

    } catch (error) {
      console.error("Main pair error:", error);
      await api.sendMessage(threadId, {
        text: `❌ বড় সমস্যা হয়েছে:\n${error.message}\n\nবট রিস্টার্ট করে আবার চেষ্টা করো।`
      }, { quoted: message });
    }
  },
};
