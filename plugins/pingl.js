module.exports = {
  config: {
    name: 'ping',
    aliases: ['p'],
    permission: 0,
    prefix: 'both',
    categories: 'system',
    description: 'Check bot response time',
    usages: ['ping', 'p'],
    credit: 'Developed by Tanvir-Bhai'
  },

  start: async ({ event, api }) => {
    const { threadId } = event;
    const startTime = Date.now();

    try {
      // রেসপন্স টাইম মেপে সরাসরি ফরওয়ার্ডেড ইফেক্ট সহ মেসেজ পাঠানো হবে
      const responseTime = Date.now() - startTime;

      // ফরওয়ার্ডেড চ্যানেলের তথ্য (এখন EVAN-BOT চ্যানেল)
      const channelJid = '120363408736391595@newsletter';
      const channelName = 'EVAN-BOT';

      // মেসেজ পেলোড তৈরি
      const messagePayload = {
        text: `> *_EVAN-BOT-SPEED💥-${responseTime} ms_*`,
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true,
          forwardedNewsletterMessageInfo: {
            newsletterJid: channelJid,
            newsletterName: channelName,
            serverMessageId: 143
          }
        }
      };

      await api.sendMessage(threadId, messagePayload);
    } catch (error) {
      console.error(error);
      await api.sendMessage(threadId, { text: `❌ Error: ${error.message}` });
    }
  },
};