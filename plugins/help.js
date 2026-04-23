const axios = require("axios");
const os = require("os");

// Helper: format uptime (seconds -> XXh XXm XXs)
function formatUptime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hours}h ${minutes}m ${secs}s`;
}

// Helper: format memory in GB with two decimals
function formatMemory(bytes) {
  return (bytes / (1024 ** 3)).toFixed(2);
}

module.exports = {
  config: {
    name: 'help',
    aliases: ['menu'],
    permission: 0,
    prefix: true,
    description: 'Show all available commands.',
    category: 'Utility',
    credit: 'Developed by Mohammad Tanvir',
    usages: ['help', 'help [command name]'],
  },

  start: async ({ event, api, args, loadcmd }) => {
    const { threadId, getPrefix, senderId } = event;
    const getAllCommands = () => loadcmd.map((plugin) => plugin.config);
    const commands = getAllCommands();

    const prefix = await getPrefix(threadId);
    const globalPrefix = global.config.PREFIX;

    // Merge categories (English with emojis)
    const mergedCategories = {
      "⚙️ System": ["Administration", "Admin", "Owner", "Bot Management", "System"],
      "🧠 AI & Chat": ["AI", "AI Chat"],
      "🎬 Media": ["Media", "Video", "Image"],
      "🧰 Utilities": ["Utility", "Utilities", "System"],
      "👥 Group": ["Group Management", "group"],
      "🎮 Fun": ["Fun", "Games", "greetings"],
      "🛰️ Tools": ["Tools", "Information"]
    };

    const categories = {};
    commands.forEach((cmd) => {
      let cat = cmd.category || cmd.categorie || cmd.categories || "📦 Uncategorized";
      for (const merged in mergedCategories) {
        if (mergedCategories[merged].includes(cat)) {
          cat = merged;
          break;
        }
      }
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(cmd);
    });

    // ───── SINGLE COMMAND INFO (unchanged) ─────
    if (args[0]) {
      const command = commands.find((cmd) => cmd.name.toLowerCase() === args[0].toLowerCase());
      if (command) {
        const infoText = `
╭─❖  COMMAND INFO  ❖─╮
│ 🔹 Name: ${command.name}
│ 🔹 Aliases: ${command.aliases?.join(", ") || "None"}
│ 🔹 Version: ${command.version || "1.0.0"}
│ 🔹 Description: ${command.description || "No description"}
│ 🔹 Usage: ${command.usage || command.usages?.join("\n│   ") || "Not defined"}
│ 🔹 Permission: ${command.permission}
│ 🔹 Category: ${command.category || "Uncategorized"}
│ 🔹 Credits: ${command.credit || command.credits || "Mohammad Tanvir"}
╰────────────────────╯`;
        await api.sendMessage(threadId, { text: infoText });
      } else {
        await api.sendMessage(threadId, { text: `⚠️ No command found named "${args[0]}".` });
      }
      return;
    }

    // ───── MAIN HELP MENU ─────
    // Bot info
    const botName = global.config.botName || "EMon System";
    const ownerName = global.config.botOwner || "Mohammad Tanvir";
    const mode = global.config.mode || "PUBLIC";
    
    // Uptime
    const uptimeSec = process.uptime();
    const uptimeStr = formatUptime(uptimeSec);
    
    // RAM usage
    const usedRamGB = formatMemory(process.memoryUsage().rss);
    const totalRamGB = formatMemory(os.totalmem());
    
    // Time & date (Bangladesh timezone)
    const timezone = global.config.timeZone || "Asia/Dhaka";
    const currentTime = new Date().toLocaleTimeString("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    });
    
    // ────────────────────────────────────────────────
    // ✅ ইউজার নাম সঠিকভাবে আনা (না পেলে মেনশন) ✅
    // ────────────────────────────────────────────────
    let pushname = "";
    let mentionUser = false; // মেনশন করতে হবে কিনা তা ট্র্যাক করতে
    const sid = senderId || event.senderId || event.senderID || event.from || event.author;
    
    // ইভেন্ট থেকে সরাসরি নাম নেওয়ার চেষ্টা
    if (event.pushName && String(event.pushName).trim() !== "") {
      pushname = String(event.pushName).trim();
    } else if (event.senderName && String(event.senderName).trim() !== "") {
      pushname = String(event.senderName).trim();
    } else if (event.sender?.pushName && String(event.sender.pushName).trim() !== "") {
      pushname = String(event.sender.pushName).trim();
    } else if (event.sender?.name && String(event.sender.name).trim() !== "") {
      pushname = String(event.sender.name).trim();
    } else if (event.author && String(event.author).trim() !== "") {
      pushname = String(event.author).trim();
    }
    
    // ইভেন্টে নাম না থাকলে API কল করে আনার চেষ্টা
    if (!pushname && sid) {
      try {
        if (typeof api.getUserInfo === "function") {
          const userInfo = await api.getUserInfo(sid);
          if (userInfo) {
            if (userInfo[sid]?.name) pushname = userInfo[sid].name;
            else if (userInfo[sid]?.pushName) pushname = userInfo[sid].pushName;
            else if (userInfo[sid]?.firstName) pushname = userInfo[sid].firstName;
            else if (Array.isArray(userInfo) && userInfo[0]?.name) pushname = userInfo[0].name;
            else if (typeof userInfo === "string") pushname = userInfo;
          }
        }
      } catch (e) {}
      
      if (!pushname && typeof api.getProfile === "function") {
        try {
          const profile = await api.getProfile(sid);
          if (profile?.name) pushname = profile.name;
          else if (profile?.pushName) pushname = profile.pushName;
          else if (profile?.displayName) pushname = profile.displayName;
        } catch (e) {}
      }
      
      if (!pushname && typeof api.getUserProfile === "function") {
        try {
          const profile = await api.getUserProfile(sid);
          if (profile?.name) pushname = profile.name;
          else if (profile?.pushName) pushname = profile.pushName;
        } catch (e) {}
      }
    }
    
    // একেবারেই নাম না পেলে মেনশন করার সিদ্ধান্ত
    if (!pushname || String(pushname).trim() === "") {
      if (sid) {
        pushname = `@${sid.split('@')[0]}`; // মেনশন ফরম্যাট
        mentionUser = true;
      } else {
        pushname = "User"; // fallback (কখনোই আসবে না আশা করি)
      }
    }
    // ────────────────────────────────────────────────
    
    const totalCommands = commands.length;
    
    // Build header (proper English/Unicode characters)
    let responseText = `*╭══ ╳-♡ ʙᴏᴏꜱ♡🫶🏻❤️‍🩹*
  ┃❍ʙᴏᴛ ɴᴀᴍᴇ: ${botName}
*┃🌸 ʀᴜɴ     :* ${uptimeStr}
*┃🛡️ ᴍᴏᴅᴇ    :* ${mode} ❤️‍🩹
*┃👀 ᴘʀᴇғɪx  :* ${prefix}
*┃🚀 ʀᴀᴍ     :* ${usedRamGB} / ${totalRamGB} GB
*┃🌨️ ᴛɪᴍᴇ    :* ${currentTime}
*┃🫂 ᴜsᴇʀ    :* ${pushname} 🥀
*┃🛡️ ᴏᴡɴᴇʀ   :* ${ownerName}
  ┃ᴛᴏᴛᴀʟ ᴄᴏᴍᴍᴀɴᴅ: ${totalCommands}
*╰═════════════════⊷*\n`;
    
    // Append each category and its commands
    for (const category in categories) {
      responseText += `\n*╭────❒ ${category} ❒⁠⁠⁠⁠*\n`;
      const cmds = categories[category];
      for (const cmd of cmds) {
        responseText += `*├◈ ${cmd.name}*\n`;
      }
      responseText += `*┕──────────────────❒*\n`;
    }
    
    // Footer
    responseText += `\n*~_Made with love by X-♡Tanvir♡😩🫶_~*`;
    
    // ─────────────────────────────────────────────────────
    // 📌 আপনার দেওয়া চ্যানেলের তথ্য (Forwarded ইফেক্ট)
    // ─────────────────────────────────────────────────────
    const channelJid = '120363408736391595@newsletter'; // আপনার চ্যানেল JID
    const channelName = 'TANVIRMD'; // ✅ আপনার পছন্দের চ্যানেল নাম

    // ─────────────────────────────────────────────────────
    // 📤 মেসেজ পেলোড তৈরি (Forwarded ট্যাগ ও চ্যানেল তথ্যসহ)
    // ─────────────────────────────────────────────────────
    const basePayload = {
        contextInfo: {
            forwardingScore: 999,            // Forwarded ট্যাগ দেখানোর জন্য
            isForwarded: true,               // কিছু ভার্সনে প্রয়োজন
            forwardedNewsletterMessageInfo: {
                newsletterJid: channelJid,
                newsletterName: channelName,
                serverMessageId: 143         // র‌্যান্ডম পজিটিভ সংখ্যা
            }
        }
    };

    // যদি মেনশন প্রয়োজন হয় তাহলে mentionedJid যোগ করা হবে
    if (mentionUser && sid) {
        basePayload.contextInfo.mentionedJid = [sid];
    }

    // Send with image if available, otherwise plain text
    try {
        const response = await axios.get(global.config.helpPic, { responseType: 'stream' });
        const messagePayload = {
            image: { stream: response.data },
            caption: responseText,
            ...basePayload
        };
        await api.sendMessage(threadId, messagePayload);
    } catch {
        const textPayload = {
            text: responseText,
            ...basePayload
        };
        await api.sendMessage(threadId, textPayload);
    }
  },
};
