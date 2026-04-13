const fs = require("fs");
const path = require("path");

const configPath = path.join(__dirname, "../config.json");

module.exports = {
  config: {
    name: "admin",
    aliases: ["admins", "botadmin", "botadmins", "badmin"],
    permission: 0,
    prefix: true,
    description: "Show group admins (admin) or bot admins (botadmin). Use botadmin add/remove to manage bot admins.",
    category: "Administration",
    credit: "Developed by Mohammad Nayan",
  },

  start: async ({ api, event, args }) => {
    try {
      const { threadId, message, senderId, isSenderBotadmin } = event;

      // Helper: get full message text
      const getMessageText = (msg) => {
        if (msg.message?.conversation) return msg.message.conversation;
        if (msg.message?.extendedTextMessage?.text) return msg.message.extendedTextMessage.text;
        return "";
      };

      // Identify which command was used
      const fullText = getMessageText(message);
      const prefix = global.config.PREFIX;
      if (!fullText.startsWith(prefix)) return; // should not happen
      const withoutPrefix = fullText.slice(prefix.length).trim();
      const parts = withoutPrefix.split(/\s+/);
      const usedCmd = parts[0].toLowerCase();

      const isBotAdminCmd = ["botadmin", "botadmins", "badmin"].includes(usedCmd);
      const isGroupAdminCmd = ["admin", "admins"].includes(usedCmd);

      // If neither, do nothing (shouldn't happen because aliases cover all)
      if (!isBotAdminCmd && !isGroupAdminCmd) return;

      // Save config helper
      const saveConfig = () => {
        fs.writeFileSync(configPath, JSON.stringify(global.config, null, 2), "utf8");
      };

      // --- Bot admin commands (including add/remove) ---
      if (isBotAdminCmd) {
        // Subcommand: add
        if (args[0] === "add") {
          if (!isSenderBotadmin) {
            await api.sendMessage(threadId, { text: `Only bot admins can use the ${global.config.PREFIX}botadmin add.` }, { quoted: message });
            return;
          }
          const mentions = event.message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
          if (mentions.length === 0) {
            return api.sendMessage(threadId, { text: "⚠️ Please mention a user to add as bot admin." }, { quoted: message });
          }

          mentions.forEach(jid => {
            const uid = jid.split("@")[0];
            if (!global.config.admin.includes(uid)) {
              global.config.admin.push(uid);
            }
          });

          saveConfig();

          return api.sendMessage(threadId, {
            text: `✅ Added as bot admin:\n${mentions.map(u => `@${u.split('@')[0]}`).join("\n")}`,
            mentions: mentions
          }, { quoted: message });
        }

        // Subcommand: remove
        if (args[0] === "remove") {
          if (!isSenderBotadmin) {
            await api.sendMessage(threadId, { text: `Only bot admins can use the ${global.config.PREFIX}botadmin remove.` }, { quoted: message });
            return;
          }
          const mentions = event.message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
          if (mentions.length === 0) {
            return api.sendMessage(threadId, { text: "⚠️ Please mention a user to remove from bot admin." }, { quoted: message });
          }

          let removed = [];
          mentions.forEach(jid => {
            const uid = jid.split("@")[0];
            if (global.config.admin.includes(uid)) {
              global.config.admin = global.config.admin.filter(a => a !== uid);
              removed.push(uid);
            }
          });

          saveConfig();

          return api.sendMessage(threadId, {
            text: removed.length > 0
              ? `❌ Removed from bot admin:\n${removed.map(u => `@${u.split('@')[0]}`).join("\n")}`
              : "⚠️ Mentioned user(s) are not bot admins.",
            mentions: removed
          }, { quoted: message });
        }

        // No subcommand -> show bot admins list
        let text = `🤖 *Bot Admins List*\n\n`;
        const botAdmins = global.config.admin || [];
        if (botAdmins.length === 0) {
          text += "No bot admins configured.";
        } else {
          botAdmins.forEach((admin, idx) => {
            const uid = admin.split('@')[0];
            text += `${idx + 1}. @${uid} (${uid})\n`;
          });
        }

        const mentions = botAdmins;
        return api.sendMessage(threadId, { text, mentions }, { quoted: message });
      }

      // --- Group admin command (admin / admins) ---
      if (isGroupAdminCmd) {
        // If someone tries add/remove here, guide them
        if (args[0] === "add" || args[0] === "remove") {
          return api.sendMessage(threadId, { 
            text: `⚠️ To manage bot admins, use *${global.config.PREFIX}botadmin ${args[0]}*.\n\nShowing group admins instead:` 
          }, { quoted: message });
        }

        // Fetch group metadata
        const metadata = await api.groupMetadata(threadId);
        const participants = metadata.participants;

        const owners = participants.filter(p => p.admin === "superadmin");
        const moderators = participants.filter(p => p.admin === "admin");
        const totalAdmins = owners.length + moderators.length;
        const groupName = metadata.subject || "Unnamed Group";

        // Try to get invite link (only if bot is admin)
        let groupLink = null;
        try {
          const inviteCode = await api.groupInviteCode(threadId);
          groupLink = `https://chat.whatsapp.com/${inviteCode}`;
        } catch (e) {
          // Bot not admin – ignore
        }

        // Build message
        let text = `╭─❖  𝗔𝗗𝗠𝗜𝗡 𝗟𝗜𝗦𝗧  ❖─╮\n`;
        text += `│ 🛡️ Gʀᴏᴜᴩ: ${groupName}\n`;
        text += `│ 👤 Tᴏᴛᴀʟ Aᴅᴍɪɴꜱ: ${totalAdmins}\n`;
        text += `╰───────────────────╯\n\n`;

        if (owners.length > 0) {
          text += `┏━━〔 *👑 OWNER* 〕━┈\n`;
          owners.forEach(owner => {
            const uid = owner.id.split('@')[0];
            text += `┃ ──●@${uid} {ᴏᴡɴᴇʀ}\n`;
          });
          text += `┗━━━━━━━━━━━━━━┈\n\n`;
        }

        if (moderators.length > 0) {
          text += `┌─⊷〔 🛡️ MODERATORS 〕━┈\n`;
          moderators.forEach((mod, idx) => {
            const uid = mod.id.split('@')[0];
            text += `┃ ▢ ${idx + 1}. @${uid}\n`;
          });
          text += `└───────────━┈\n\n`;
        } else {
          text += `No moderators (other admins) in this group.\n\n`;
        }

        text += `> ✨ ᴩᴏᴡᴇʀᴇᴅ ʙʏ ꜱᴛʀɪᴋᴇʀ ᴛᴀɴᴠɪʀ \n`;

        if (groupLink) {
          text += `🔗 *Group Link:* ${groupLink}`;
        }

        const mentions = [
          ...owners.map(o => o.id),
          ...moderators.map(m => m.id)
        ];

        return api.sendMessage(threadId, { text, mentions }, { quoted: message });
      }

    } catch (err) {
      console.error("❌ Error in admin command:", err);
      await api.sendMessage(event.threadId, { text: "❌ Failed to fetch group information. Make sure the bot is in the group." });
    }
  },
};