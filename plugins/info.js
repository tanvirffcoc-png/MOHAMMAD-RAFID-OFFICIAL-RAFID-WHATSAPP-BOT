const os = require('os');

module.exports = {
  config: {
    name: 'info',
    aliases: ['about', 'admininfo', 'serverinfo'],
    permission: 0,
    prefix: 'both',
    categorie: 'Utilities',
    credit: 'Developed by Mohammad Nayan',
    usages: [`${global.config.PREFIX}info - Show admin and server information.`],
  },
  start: async ({ event, api, message }) => {
    try {
      const imageUrl = "https://www.image2url.com/r2/default/images/1776448167175-4b8f60ca-90ae-42a6-87e3-2b56c59353e9.png";
      const loadingText = "*TANVIR-MD BOT ER INFO COMING...*";

      // প্রথমে লোডিং মেসেজ (ছবি + টেক্সট) পাঠানো
      const sentMsg = await api.sendMessage(
        event.threadId,
        {
          image: { url: imageUrl },
          caption: loadingText
        },
        { quoted: event.message }
      );

      // চূড়ান্ত ইনফো কন্টেন্ট (ইউজারের দেওয়া টেক্সট)
      const finalInfo = `
╭━━━〔🖤 𝐏𝐄𝐑𝐒𝐎𝐍𝐀𝐋 𝐈𝐍𝐅𝐎 🖤〕━━╮
┃ ✦ 𝔸𝕤𝕤𝕒𝕝𝕒𝕞𝕦 𝔸𝕝𝕒𝕚𝕜𝕦𝕞 ✨
┃ 🥷𝐍𝐚𝐦𝐞 : *тαиνιʀ ᴀɴᴊᴜᴍ ʀᴀꜰɪᴅ*.🥷
┃ 📍𝐀𝐝𝐝𝐫𝐞𝐬𝐬: *ꜱʏʟнєт*.
┃❤️𝐅𝐚𝐯𝐨𝐫𝐢𝐭𝐞 𝐩𝐞𝐫𝐬𝐨𝐧: *ѕυιту*.
┃ 🤝 🄱🄴🅂🅃 𝐅𝐫𝐢𝐞𝐧𝐝 : *ADNAN*.
┃𝐈 𝐀𝐦 𝐌𝐮𝐬𝐥𝐢𝐦 .𝐀𝐧𝐝 𝐈'𝐦 𝐀𝐥𝐰𝐚𝐲𝐬 
┃𝐕𝐡𝐨𝐧𝐝𝐨🥷.
╰━━━〔🖤 T̆̈H̑̈A͜͡N͜͡𝗞 𝗬O͜͡𝗨🖤〕━━━╯`;

      // পূর্বের মেসেজটি এডিট করে চূড়ান্ত ক্যাপশন বসানো
      await api.sendMessage(
        event.threadId,
        {
          image: { url: imageUrl },  // ছবি একই থাকবে
          caption: finalInfo,
          edit: sentMsg.key          // এডিট করার জন্য মেসেজ কী
        }
      );

    } catch (error) {
      console.error(error);
      await api.sendMessage(event.threadId, '❌ An error occurred while fetching info.', { quoted: event.message });
    }
  },
};
