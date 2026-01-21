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
        const username = data.author || data.nickname || data.username || "TikTok User";
        const desc = data.title || data.caption || "No Caption";

        // Format Caption dengan Username
        const finalCaption = `✅ *Berhasil didownload*\n\n👤 *Username:* ${username}\n📝 *Caption:* ${desc}`;

        // --- PERBAIKAN DI SINI ---
        // Kita cek semua kemungkinan nama agar tidak error "Media tidak valid"
        const videoUrl = data.video || data.play || data.nowatermark || data.watermark || (data.url ? data.url[0] : null);

        // LOGIC: Cek Slide Gambar DULUAN (Prioritas)
        if (data.images && data.images.length > 0) {
            await sock.sendMessage(chatId, { text: `📸 Mengirim ${data.images.length} slide gambar dari user ${username}...` }, { quoted: msg });
            
            for (let img of data.images) {
                // Kirim gambar satu per satu
                await sock.sendMessage(chatId, { image: { url: img } });
            }
        } 
        // Jika tidak ada gambar, baru kirim Video (Gunakan variabel videoUrl yang sudah dicek di atas)
        else if (videoUrl) {
            await sock.sendMessage(chatId, { 
                video: { url: videoUrl }, 
                caption: finalCaption,
                mimetype: 'video/mp4'
            }, { quoted: msg });
        } 
        else {
            // Jika benar-benar kosong
            console.log("JSON RESULT:", data); // Cek log jika masih error
            sock.sendMessage(chatId, { text: "❌ Media tidak valid (Link video tidak ditemukan)." });
        }

    } catch (e) {
        console.error("TikTok Error:", e);
        sock.sendMessage(chatId, { text: "❌ Terjadi kesalahan sistem." });
    }
}

export default tiktok;
