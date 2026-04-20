module.exports = {
    config: {
    name: "kickall",
    permission: 3,
    prefix: true,
    category: "Moderation",
    credit: "ZAHID-BOT"
    },
    start: async ({ event, api }) => {
    const { threadId, senderId, message } = event;
    const metadata = await api.groupMetadata(threadId);
    const participants = metadata.participants;

    // Admin list
    const admins = participants
    .filter(p => p.admin)
    .map(p => p.id);

    // Admin check
    if (!admins.includes(senderId)) {
    return api.sendMessage(threadId, {
    text: `${Only admins can use this command!}`,
    quoted: message });
    }

    // Bot ID
    const botId = api.user?.id || api.user?.jid;

    // Target (non-admin only)
    const targets = participants
    .filter(p => p.admin && p.id !== botId)
    .map(p => p.id);

    if (targets.length === 0) {
    return api.sendMessage(threadId, {
    text: "No members to remove!"
    });
    }

    await api.sendMessage(threadId, {
    text: `Removing all members...`,
    quoted: message });
    }

    // delay function
    const delay = ms => new Promise(res => setTimeout(res, ms));

    try {
    for (const user of targets) {
    await api.groupParticipantsUpdate(threadId, [user], "remove");
    await delay(800); // anti-ban delay
    }
    await api.sendMessage(threadId, {
    text: "All members removed successfully!"
    });
    } catch (err) {
    console.error("KICK ERROR:", err);
    }

    await api.sendMessage(threadId, {
    text: "Failed to remove some members!"
    });
    }
};