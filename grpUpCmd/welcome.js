module.exports = {
  event: 'add',
  handle: async ({ api, event }) => {
    const newMembers = event.participants;
    const groupInfo = await api.groupMetadata(event.id);
    const groupName = groupInfo.subject;
    const totalMembers = groupInfo.participants.length;

    for (const member of newMembers) {
      let profilePicUrl;
      try {
        profilePicUrl = await api.profilePictureUrl(member, 'image');
      } catch (error) {
        profilePicUrl = null;
      }

      const username = `@${member.split('@')[0]}`;

      // পুরো ওয়েলকাম মেসেজ (যেটা পরে এডিট হয়ে দেখাবে)
      const fullWelcomeMessage = `
🦚⃝⃕⃔ ${username} 💙🌸
*𓂋⃝⃟⃟⃝⃪⃔ Welcome to the lovely journey!*  ꧁༒ ${groupName} ✰༒꧂
                 *❛❛ Every new join is a new little celebration ❜❜*
*And your arrival feels like one of those tiny celebrations that make life sweeter 🌷*
*May you find friendship, fun, and peaceful vibes in every corner of this group 🫶*
            *Stay with us and enjoy the beautiful flow of conversations ✨*
                       *Warm welcome to you 💖*
> *Members:> ${totalMembers} 🫵🎀*
      `.trim();

      // ১. প্রথম মেসেজ: শুধু "> *@মেনশন WELCOME.....*"
      const initialMessage = `> *${username} WELCOME.....*`;

      // মেসেজ পাঠাও (এখনো ইমেজ ছাড়া)
      const sentMsg = await api.sendMessage(event.id, {
        text: initialMessage,
        mentions: [member]
      });

      // ২. ২০ সেকেন্ড পর উপরের মেসেজটি এডিট করে পুরো ওয়েলকাম মেসেজ দেখাও
      setTimeout(async () => {
        try {
          await api.sendMessage(event.id, {
            text: fullWelcomeMessage,
            edit: sentMsg.key,   // আগের মেসেজটি এডিট হবে
            mentions: [member]   // মেনশন যেন থাকে
          });
        } catch (err) {
          console.error("Edit failed:", err);
        }
      }, 20000); // 20 সেকেন্ড

      // ৩. প্রোফাইল পিকচার থাকলে আলাদাভাবে ইমেজ মেসেজ পাঠাও (যা এডিট হবে না, কিন্তু রাখা ভালো)
      if (profilePicUrl) {
        await api.sendMessage(event.id, {
          image: { url: profilePicUrl },
          caption: `🌸 Welcome ${username} 🌸`,
          mentions: [member]
        });
      }
    }
  }
};
