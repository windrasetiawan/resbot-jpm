import axios from 'axios';

async function tiktok(sock, chatId, message, key, msg) {
    const parts = message.trim().split(" ");
    
    // Parsing Command
    let command = parts[0]?.toLowerCase();
    if (command.startsWith(".")) {
        command = command.substring(1);
    }
    const args = parts.slice(1);

    // Command yang dikenali
    if (command === "tiktok" || command === "tt") {
        if (!args[0]) {
            return sock.sendMessage(chatId, { text: "⚠️ Masukkan link TikTok!\nContoh: *.tt https://vt.tiktok.com/xxxx*" }, { quoted: msg });
        }

        const url = args[0];
        if (!url.includes("tiktok.com")) {
            return sock.sendMessage(chatId, { text: "⚠️ Link tidak valid!" }, { quoted: msg });
        }

        await sock.sendMessage(chatId, { text: "⏳ Sedang mendownload video..." }, { quoted: msg });

        try {
            // Request ke API
            const apiUrl = `https://api.jerexd666.wongireng.my.id/download/tiktok?url=${encodeURIComponent(url)}`;
            const response = await axios.get(apiUrl);
            const res = response.data;

            if (res.status && res.result) {
                const data = res.result;

                // Cari URL Video (Prioritas: HD No WM -> No WM -> WM)
                let videoUrl = "";
                const noWmHd = data.data.find(item => item.type === "nowatermark_hd");
                const noWm = data.data.find(item => item.type === "nowatermark");
                const wm = data.data.find(item => item.type === "watermark");

                videoUrl = (noWmHd || noWm || wm)?.url;

                if (!videoUrl) {
                    return sock.sendMessage(chatId, { text: "❌ Gagal mendapatkan URL video." }, { quoted: msg });
                }

                // Susun Caption
                const caption = `✅ *TIKTOK DOWNLOADER*

👤 *Author:* ${data.author?.nickname || "-"}
📝 *Title:* ${data.title || "-"}
👀 *Views:* ${data.stats?.views || "0"}
❤️ *Likes:* ${data.stats?.likes || "0"}

_Mengirim video..._`;

                // Kirim Video Saja
                await sock.sendMessage(chatId, { 
                    video: { url: videoUrl }, 
                    caption: caption 
                }, { quoted: msg });

            } else {
                await sock.sendMessage(chatId, { text: "❌ Gagal mengambil data dari API." }, { quoted: msg });
            }

        } catch (error) {
            console.error("TikTok Error:", error.message);
            await sock.sendMessage(chatId, { text: "❌ Terjadi kesalahan server." }, { quoted: msg });
        }
    }
}

export default tiktok;
