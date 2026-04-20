const activeIntervals = {};

module.exports = {
    config: {
        name: "namajauto",
        permission: 2,
        prefix: true,
        category: "group",
        credit: "TANVIR-BHai 🛰️💨"
    },

    start: async ({ event, api, args }) => {
        const { threadId, senderId } = event;

        // 👑 BOT OWNER & ADMIN CHECK
        const botAdmins = (global.config.admin || []).map(id => id.includes("@") ? id : id + "@s.whatsapp.net");

        const metadata = await api.groupMetadata(threadId);
        const groupAdmins = metadata.participants
            .filter(p => p.admin)
            .map(p => p.id);

        if (!groupAdmins.includes(senderId) && !botAdmins.includes(senderId)) {
            return api.sendMessage(threadId, {
                text: "🚫 Only admins or owners can use this command!"
            });
        }

        const action = args[0]?.toLowerCase();

        // 🕋 Prayer Schedule (24-hour format)
        const schedule = [
            { name: "Fajr", start: "05:10", end: "05:40" },
            { name: "Dhuhr", start: "13:15", end: "13:45" },
            { name: "Asr", start: "16:40", end: "17:10" },
            { name: "Maghrib", start: "18:25", end: "18:50" },
            { name: "Isha", start: "19:55", end: "20:30" }
        ];

        const getMinutes = (time) => {
            const [h, m] = time.split(":").map(Number);
            return h * 60 + m;
        };

        // 🧱 ON ACTION
        if (action === "on") {
            if (activeIntervals[threadId]) {
                return api.sendMessage(threadId, { text: "⚠️ Prayer Auto-Lock is already ON!" });
            }

            activeIntervals[threadId] = setInterval(async () => {
                try {
                    const now = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Dhaka"}));
                    const current = now.getHours() * 60 + now.getMinutes();

                    for (const p of schedule) {
                        const start = getMinutes(p.start);
                        const end = getMinutes(p.end);

                        if (current === start) {
                            await api.groupSettingUpdate(threadId, "announcement");
                            await api.sendMessage(threadId, {
                                text: `🕋 *নামাজের বিরতি*\n\nএখন *${p.name}* নামাজের সময় হয়েছে। সবাই নামাজ পড়তে যান। নামাজের জন্য গ্রুপটি সাময়িকভাবে বন্ধ করা হলো।`
                            });
                        }

                        if (current === end) {
                            await api.groupSettingUpdate(threadId, "not_announcement");
                            await api.sendMessage(threadId, {
                                text: `✅ *নামাজের বিরতি শেষ*\n\n${p.name} নামাজের বিরতি শেষ হয়েছে। গ্রুপটি এখন সবার জন্য উন্মুক্ত। সবাই নামাজ পড়েছেন তো?`
                            });
                        }
                    }
                } catch (e) {
                    console.log("Prayer Lock Error:", e);
                }
            }, 60000); // Checks every minute

            return api.sendMessage(threadId, {
                text: "🏰 Namaz auto-lock system has been turned ON!"
            });
        }

        // 🔒 OFF ACTION
        if (action === "off") {
            if (!activeIntervals[threadId]) {
                return api.sendMessage(threadId, { text: "⚠️ System is already OFF!" });
            }

            clearInterval(activeIntervals[threadId]);
            delete activeIntervals[threadId];

            return api.sendMessage(threadId, {
                text: "❌ Namaz auto-lock system has been turned OFF!"
            });
        }

        return api.sendMessage(threadId, {
            text: "Usage:\n/namajauto on\n/namajauto off"
        });
    }
};