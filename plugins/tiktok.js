import axios from 'axios';

async function tiktok(sock, chatId, message, key, msg) {
    const parts = message.trim().split(" ");
    
    // Parsing Command (Support . dan #)
    let command = parts[0]?.toLowerCase();
    if (command.startsWith(".") || command.startsWith("#")) {
        command = command.substring(1);
    }
    const args = parts.slice(1);

    if (command === "tiktok" || command === "tt") {
        if (!args[0]) {
            return sock.sendMessage(chatId, { text: "⚠️ Masukkan link TikTok!" }, { quoted: msg });
        }

        const url = args[0];
        await sock.sendMessage(chatId, { text: "⏳ Sedang mendownload..." }, { quoted: msg });

        try {
            const apiUrl = `https://api.jerexd666.wongireng.my.id/download/tiktok?url=${encodeURIComponent(url)}`;
            const response = await axios.get(apiUrl);
            const res = response.data;

            if (res.status && res.result) {
                const data = res.result;
                let videoUrl = "";
                const noWmHd = data.data.find(item => item.type === "nowatermark_hd");
                const noWm = data.data.find(item => item.type === "nowatermark");
                videoUrl = (noWmHd || noWm)?.url;

                if (videoUrl) {
                    await sock.sendMessage(chatId, { 
                        video: { url: videoUrl }, 
                        caption: `✅ *TIKTOK* | ${data.author?.nickname}` 
                    }, { quoted: msg });
                } else {
                    await sock.sendMessage(chatId, { text: "❌ Video tidak ditemukan." }, { quoted: msg });
                }
            } else {
                await sock.sendMessage(chatId, { text: "❌ Gagal mengambil data." }, { quoted: msg });
            }
        } catch (error) {
            await sock.sendMessage(chatId, { text: "❌ Error: " + error.message }, { quoted: msg });
        }
    }
}
export default tiktok;
