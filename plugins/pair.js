const { makeWASocket, useMultiFileAuthState, Browsers } = require("@whiskeysockets/baileys");
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
    credit: "Adapted for RAFID BOT by Tanvir + Grok Stable Fix",
  },

  start: async ({ api, event, args }) => {
    const { threadId, message, senderId } = event;

    // Extract phone number (তোমার পুরনো pair.js এর মতোই)
    let phoneNumber = args.join(" ").trim().replace(/[^0-9]/g, "");

    if (!phoneNumber) {
      phoneNumber = senderId.split("@")[0];
    }

    // BD number auto fix
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
    const sessionsDir = path.resolve(__dirname, '../../sessions');   // তোমার বটে sessions ফোল্ডার
    const sessionPath = path.join(sessionsDir, sessionId);

    // অটো sessions ফোল্ডার তৈরি
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
        browser: Browsers.ubuntu("Chrome"),        // সবচেয়ে স্টেবল ব্রাউজার (নোটিফিকেশন আসার জন্য)
        markOnlineOnConnect: false,                // তোমার Baileys এর সাজেশন অনুসারে
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
          await api.sendMessage(threadId, {
            text: `✅ *সফলভাবে কানেক্ট হয়েছে!*\n\n📱 নাম্বার: ${phoneNumber}\n🔑 সেশন সেভ হয়েছে।\n\nবট এখন এই নাম্বার থেকে ক্লোন হয়ে চলবে।`
          }, { quoted: message });
        }

        // Connection Closed ফিক্স + নোটিফিকেশন নিশ্চিত করার জন্য সঠিক টাইমিং
        if ((connection === 'connecting' || !!qr) && !pairingRequested && retryCount < maxRetries) {
          pairingRequested = true;
          retryCount++;

          setTimeout(async () => {
            try {
              // তোমার Baileys এর ঠিক এই লাইনটা ব্যবহার করা হয়েছে
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

              // কোড আলাদা করে পাঠানো (কপি সহজ)
              setTimeout(async () => {
                await api.sendMessage(threadId, { text: `*${code}*` }, { quoted: message });
              }, 2000);

            } catch (err) {
              console.error(`Pairing attempt ${retryCount} error:`, err.message);

              if (retryCount < maxRetries && err.message.includes("Connection Closed")) {
                pairingRequested = false; // রিট্রাই চালু
                await api.sendMessage(threadId, {
                  text: `❌ Connection Closed (Attempt ${retryCount}/${maxRetries})\n\n🔄 আবার চেষ্টা করছি...`
                }, { quoted: message });
              } else {
                await api.sendMessage(threadId, {
                  text: `❌ Failed to get pairing code.\nError: ${err.message}\n\nআবার চেষ্টা করো (.pair আবার দাও)`
                }, { quoted: message });
              }
            }
          }, 6500); // ৬.৫ সেকেন্ড অপেক্ষা — connecting state পুরোপুরি রেডি হওয়ার জন্য
        }
      });

    } catch (error) {
      console.error("Pair command error:", error.message);
      await api.sendMessage(threadId, {
        text: `❌ Failed to get pairing code.\nError: ${error.message}\n\nবট রিস্টার্ট করে আবার চেষ্টা করো।`
      }, { quoted: message });
    }
  },
};
