import fetch from "node-fetch";

async function tiktok(sock, chatId, text, key, msg) {
    const cmd = text.split(" ")[0].toLowerCase();
    if (cmd !== ".tt" && cmd !== ".tiktok") return;

    const url = text.split(" ")[1];
    if (!url) return sock.sendMessage(chatId, { text: "⚠️ Masukkan link TikTok!" });

    // Style Original: Kirim pesan proses
    await sock.sendMessage(chatId, { text: "⏳ Sedang memproses..." }, { quoted: msg });

    try {
        // Request ke API FAA
        const response = await fetch(`https://api-faa.my.id/faa/tiktok?url=${url}`);
        const json = await response.json();

        // Validasi response
        if (!json.result) {
            return sock.sendMessage(chatId, { text: "❌ Gagal: Video tidak ditemukan atau Private." });
        }

        const data = json.result;
        
        // Ambil Info Username & Judul
        // API biasanya mengembalikan author/nickname/username
        const username = data.author || data.nickname || data.username || "TikTok User";
        const desc = data.title || "No Caption";

        // Format Caption dengan Username
        const finalCaption = `✅ *TikTok Downloader*\n\n👤 *Username:* ${username}\n📝 *Caption:* ${desc}`;

        // LOGIC: Cek Slide Gambar DULUAN (Prioritas)
        if (data.images && data.images.length > 0) {
            await sock.sendMessage(chatId, { text: `📸 Mengirim ${data.images.length} slide gambar dari user ${username}...` }, { quoted: msg });
            
            for (let img of data.images) {
                // Kirim gambar satu per satu
                await sock.sendMessage(chatId, { image: { url: img } });
            }
        } 
        // Jika tidak ada gambar, baru kirim Video
        else if (data.video) {
            await sock.sendMessage(chatId, { 
                video: { url: data.video }, 
                caption: finalCaption,
                mimetype: 'video/mp4'
            }, { quoted: msg });
        } 
        else {
            sock.sendMessage(chatId, { text: "❌ Media tidak valid." });
        }

    } catch (e) {
        console.error("TikTok Error:", e);
        sock.sendMessage(chatId, { text: "❌ Terjadi kesalahan sistem." });
    }
}

export default tiktok;
