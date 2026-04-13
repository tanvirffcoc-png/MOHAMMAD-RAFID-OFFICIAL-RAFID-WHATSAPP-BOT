const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

// Ensure temp directory exists
const tempDir = path.join(__dirname, '../temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

/**
 * Download media from a quoted message and return the local file path.
 * @param {Object} message - The media message object (e.g., imageMessage)
 * @param {string} mediaType - Type of media ('image', 'video', 'audio', 'sticker', 'document')
 * @returns {Promise<string>} - Path to the downloaded file
 */
async function downloadMediaMessage(message, mediaType) {
    const stream = await downloadContentFromMessage(message, mediaType);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    const filePath = path.join(tempDir, `${Date.now()}.${mediaType}`);
    fs.writeFileSync(filePath, buffer);
    return filePath;
}

module.exports = {
    config: {
        name: 'tag',
        aliases: ['hidetag', 'ht'],
        permission: 3, // Uses your bot's permission system: 3 = Bot admins and group admins
        prefix: true,
        description: 'Mentions all group members silently (hidden tag). Supports reply to media.',
        categories: 'group',
        usages: [`${global.config.PREFIX}tag [optional message]`],
        credit: 'Developed by Mohammad Nayan'
    },

    start: async ({ event, api, args }) => {
        const { threadId, senderId, message } = event;

        // No need for external isAdmin check - permission: 3 handles admin verification automatically
        
        // Fetch group participants
        const groupMetadata = await api.groupMetadata(threadId);
        const participants = groupMetadata.participants || [];
        const allParticipants = participants.map(p => p.id);

        if (allParticipants.length === 0) {
            return await api.sendMessage(threadId, { 
                text: '⚠️ No participants found in this group.' 
            });
        }

        // Check for a quoted/replied message
        const quotedMsg = message?.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const userMessage = args.join(' ').trim();

        // If there is a quoted message, handle media/text accordingly
        if (quotedMsg) {
            let content = {};

            try {
                // Image reply
                if (quotedMsg.imageMessage) {
                    const filePath = await downloadMediaMessage(quotedMsg.imageMessage, 'image');
                    content = { 
                        image: { url: filePath },
                        caption: userMessage || quotedMsg.imageMessage.caption || ''
                    };
                }
                // Video reply
                else if (quotedMsg.videoMessage) {
                    const filePath = await downloadMediaMessage(quotedMsg.videoMessage, 'video');
                    content = { 
                        video: { url: filePath },
                        caption: userMessage || quotedMsg.videoMessage.caption || ''
                    };
                }
                // Audio reply
                else if (quotedMsg.audioMessage) {
                    const filePath = await downloadMediaMessage(quotedMsg.audioMessage, 'audio');
                    content = { 
                        audio: { url: filePath },
                        ptt: quotedMsg.audioMessage.ptt // preserve voice note if it was one
                    };
                }
                // Sticker reply
                else if (quotedMsg.stickerMessage) {
                    const filePath = await downloadMediaMessage(quotedMsg.stickerMessage, 'sticker');
                    content = { sticker: { url: filePath } };
                }
                // Document reply
                else if (quotedMsg.documentMessage) {
                    const filePath = await downloadMediaMessage(quotedMsg.documentMessage, 'document');
                    content = { 
                        document: { url: filePath },
                        fileName: quotedMsg.documentMessage.fileName || 'document',
                        caption: userMessage || ''
                    };
                }
                // Text reply (conversation or extendedText)
                else if (quotedMsg.conversation || quotedMsg.extendedTextMessage) {
                    const text = quotedMsg.conversation || quotedMsg.extendedTextMessage?.text;
                    content = { text: userMessage || text || 'Tagged message' };
                }
                // Fallback
                else {
                    content = { text: userMessage || 'Tagged message' };
                }

                // Add hidden mentions
                content.mentions = allParticipants;

                // Send the message with hidden tag
                await api.sendMessage(threadId, content, { quoted: message });
                
                // Clean up temp file after sending (optional)
                // You can add cleanup logic here if needed
                
            } catch (error) {
                console.error('Error handling quoted message:', error);
                await api.sendMessage(threadId, { 
                    text: '❌ Failed to process the replied media.' 
                });
            }
        } else {
            // No reply: just send a text message with hidden mentions
            const text = userMessage || 'Hello everyone!';
            await api.sendMessage(threadId, {
                text: text,
                mentions: allParticipants
            }, { quoted: message });
        }
    }
};