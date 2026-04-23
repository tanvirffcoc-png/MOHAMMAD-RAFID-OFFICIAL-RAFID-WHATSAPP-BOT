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

      // পুরো ওয়েলকাম মেসেজ (ক্যাপশন হিসেবে পরে এডিট হবে)
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

      // প্রথম ক্যাপশন
      const initialCaption = `> *${username} WELCOME.....*`;

      if (profilePicUrl) {
        // ১. ইমেজ + প্রথম ক্যাপশন পাঠাও
        const sentMsg = await api.sendMessage(event.id, {
          image: { url: profilePicUrl },
          caption: initialCaption,
          mentions: [member]
        });

        // ২. ২০ সেকেন্ড পর ক্যাপশন এডিট করে পুরো মেসেজ করো
        setTimeout(async () => {
          try {
            await api.sendMessage(event.id, {
              text: fullWelcomeMessage,   // নতুন ক্যাপশন
              edit: sentMsg.key           // আগের ইমেজ মেসেজটিই এডিট হবে
            });
            // এখানে আলাদাভাবে mentions দিতে চাইলে সেটিও পাঠাতে পারো, তবে অনেক API edit-এ mentions সাপোর্ট করে না। প্রয়োজনে যোগ করতে পারো।
          } catch (err) {
            console.error("Edit caption failed:", err);
          }
        }, 20000);
      } else {
        // প্রোফাইল পিক ছাড়া: টেক্সট মেসেজ পাঠাও + পরে সেটি এডিট (ping.js এর মতো)
        const sentMsg = await api.sendMessage(event.id, {
          text: initialCaption,
          mentions: [member]
        });
        setTimeout(async () => {
          try {
            await api.sendMessage(event.id, {
              text: fullWelcomeMessage,
              edit: sentMsg.key,
              mentions: [member]
            });
          } catch (err) {
            console.error("Edit text failed:", err);
          }
        }, 20000);
      }
    }
  }
};
