const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");

const pino = require('pino');

const fs = require('fs');

const path = require('path');

module.exports = {

  config: {

    name: "pair",

    aliases: ["getpair", "clone", "session"],

    permission: 0,        // 0 = সবাই ব্যবহার করতে পারবে (চাইলে 2 বা 3 করে দিতে পারো)

    prefix: true,

    description: "যেকোনো নাম্বার দিয়ে বট ক্লোন/পেয়ার করে দিবে (Multi Session)",

    category: "Utility",

    credit: "Tanvir + Grok",

  },

  start: async ({ api, event, args }) => {

    const { threadId, message } = event;

    let phoneNumber = args.join("").trim().replace(/[^0-9]/g, "");

    if (!phoneNumber) {

      return api.sendMessage(threadId, { text: "❌ নাম্বার দাও!\nউদাহরণ: .pair 8801760234907" }, { quoted: message });

    }

    if (phoneNumber.length < 10 || phoneNumber.length > 15) {

      return api.sendMessage(threadId, { text: "❌ সঠিক নাম্বার দাও (দেশের কোড সহ, + ছাড়া)" }, { quoted: message });

    }

    const sessionId = `session_${phoneNumber}`; // প্রত্যেক নাম্বারের জন্য আলাদা ফোল্ডার

    const sessionPath = path.join(__dirname, '../../sessions', sessionId); // sessions ফোল্ডারে সেভ হবে

    await api.sendMessage(threadId, { text: `⏳ *${phoneNumber}* নাম্বারে পেয়ারিং শুরু হচ্ছে...\n\nএকটু অপেক্ষা করো...` }, { quoted: message });

    try {

      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

      const sock = makeWASocket({

        auth: state,

        printQRInTerminal: false,

        logger: pino({ level: 'silent' }),

        browser: ["Ubuntu", "Chrome", "20.0.04"],

      });

      sock.ev.on('creds.update', saveCreds);

      sock.ev.on('connection.update', async (update) => {

        const { connection, lastDisconnect, qr } = update;

        if (qr) {

          // QR না দেখিয়ে pairing code চাই

        }

        if (connection === 'open') {

          await api.sendMessage(threadId, {

            text: `✅ *সফলভাবে কানেক্ট হয়েছে!*\n\n📱 নাম্বার: ${phoneNumber}\n🔗 সেশন: ${sessionId}\n\nবট এখন এই নাম্বার থেকে চলবে।`

          }, { quoted: message });

          // এখানে চাইলে মেইন বটকে জানাতে পারো নতুন সেশন অ্যাড হয়েছে

        }

        if (connection === 'close') {

          const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

          if (shouldReconnect) {

            // আবার কানেক্ট করার লজিক

          }

        }

      });

      // Pairing Code Request

      if (!sock.authState.creds.registered) {

        setTimeout(async () => {

          try {

            const code = await sock.requestPairingCode(phoneNumber);

            const successText = `✅ *Pairing Code Generated*\n\n` +

                               `📱 Number: ${phoneNumber}\n` +

                               `🔑 Code: ${code}\n\n` +

                               `WhatsApp খুলে → Linked Devices → Link a Device → "Link with phone number instead" → এই কোড দাও।`;

            await api.sendMessage(threadId, { text: successText }, { quoted: message });

            // কোড আলাদা করে পাঠানো (কপি করা সহজ)

            setTimeout(() => {

              api.sendMessage(threadId, { text: `*${code}*` }, { quoted: message });

            }, 1500);

          } catch (err) {

            console.error(err);

            api.sendMessage(threadId, { text: `❌ Pairing code পাওয়া যায়নি। আবার চেষ্টা করো।\nError: ${err.message}` }, { quoted: message });

          }

        }, 3000);

      }

    } catch (error) {

      console.error("Pair error:", error);

      api.sendMessage(threadId, { text: `❌ কোনো সমস্যা হয়েছে:\n${error.message}` }, { quoted: message });

    }

  },

};