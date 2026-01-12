import fetch from "node-fetch"; // Pastikan sudah install node-fetch

async function tiktok(sock, chatId, text, key, msg) {
    const cmd = text.split(" ")[0].toLowerCase();
    
    // Command trigger: .tt atau .tiktok
    if (cmd !== ".tt" && cmd !== ".tiktok") return;

    const url = text.split(" ")[1];
    if (!url) return sock.sendMessage(chatId, { text: "⚠️ Masukkan link TikTok!\nContoh: .tt https://vt.tiktok.com/xxxx" });

    // Notifikasi tunggu
    await sock.sendMessage(chatId, { text: "⏳ Sedang mendownload..." }, { quoted: msg });

    try {
        // Request ke API Endpoint Anda
        const apiUrl = `https://zelapioffciall.koyeb.app/download/tiktok?url=${url}`;
        const response = await fetch(apiUrl);
        const json = await response.json();

        // Validasi response
        if (!json.status || !json.result) {
            return sock.sendMessage(chatId, { text: "❌ Gagal mengambil data. Server API mungkin gangguan atau link private." });
        }

        const data = json.result;
        const caption = `✅ *TIKTOK DOWNLOADER*\n\n📝 *Caption:* ${data.title || "-"}\n👤 *Author:* ${data.author || "-"}`;

        // KASUS 1: SLIDE FOTO (Images)
        if (data.images && data.images.length > 0) {
            await sock.sendMessage(chatId, { text: `📸 Mengirim ${data.images.length} slide foto...` });
            for (let img of data.images) {
                await sock.sendMessage(chatId, { image: { url: img } });
            }
            return sock.sendMessage(chatId, { text: "✅ Selesai." });
        }

        // KASUS 2: VIDEO
        // Prioritas: Video HD -> Video Biasa -> Play
        const videoUrl = data.video || data.hdplay || data.play;

        if (videoUrl) {
            await sock.sendMessage(chatId, { 
                video: { url: videoUrl }, 
                caption: caption 
            }, { quoted: msg });
        } else {
            sock.sendMessage(chatId, { text: "❌ Video tidak ditemukan di respon API." });
        }

    } catch (e) {
        console.error("TikTok Error:", e);
        sock.sendMessage(chatId, { text: "❌ Terjadi kesalahan sistem." });
    }
}

export default tiktok;
                                                                 
