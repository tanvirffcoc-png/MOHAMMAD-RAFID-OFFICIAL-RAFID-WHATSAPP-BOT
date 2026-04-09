const axios = require("axios");

module.exports = {
    config: {
        name: 'love',
        aliases: ['luv'],
        permission: 0,
        prefix: 'both',
        categorie: 'Fun',
        credit: 'Developed by Mohammad Nayan',
        usages: [
            `${global.config.PREFIX}love 1 @mention - Create a love1 image with the mentioned user.`,
            `${global.config.PREFIX}love 2 @mention - Create a love2 image with the mentioned user.`,
            `${global.config.PREFIX}love 3 @mention - Create a love3 image with the mentioned user.`,
            `${global.config.PREFIX}love 3 @mention - Create a love3 image with the mentioned user.`
        ]
    },

    start: async ({ event, api, args }) => {
        try {
            
            const allowedNumbers = ["1", "2", "3", "4"];
            const loveType = args[0];

            
            if (!allowedNumbers.includes(loveType)) {
                return api.sendMessage(
                    event.threadId, 
                    { text: `⚠️ Please provide a valid number!\nAvailable options: ${allowedNumbers.join(", ")}` }, 
                    { quoted: event.message }
                );
            }

            let targetId;
            const context = event.message.message?.extendedTextMessage?.contextInfo;

            if (context?.mentionedJid?.length > 0) {
                targetId = context.mentionedJid[0];
            } else if (context?.participant) {
                targetId = context.participant;
            } else {
                return api.sendMessage(event.threadId, { text: '⚠️ Please mention someone or reply to a user.' }, { quoted: event.message });
            }

            
            const url1 = await api.profilePictureUrl(event.senderId, 'image');
            const url2 = await api.profilePictureUrl(targetId, 'image');

            const {data} = await axios.get(`https://raw.githubusercontent.com/MOHAMMAD-NAYAN-OFFICIAL/Nayan/refs/heads/main/api.json`)

            
            const apiURL = `${data.api3}/love${loveType}?url1=${encodeURIComponent(url1)}&url2=${encodeURIComponent(url2)}`;

            
            const captions = [
                "❤️ True love is here!",
                "💞 Lovebirds detected!",
                "😍 Feeling the love!",
                "💖 Perfect match!"
            ];
            const randomCaption = captions[Math.floor(Math.random() * captions.length)];

            
            await api.sendMessage(event.threadId, {
                image: { url: apiURL },
                caption: `Love Style ${loveType} 💘\n${randomCaption}`
            }, { quoted: event.message });

        } catch (error) {
            console.error("Love Command Error:", error);
            await api.sendMessage(event.threadId, { text: '⚠️ Failed to generate love image.' }, { quoted: event.message });
        }
    }
};
