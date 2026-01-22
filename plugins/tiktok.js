import fetch from "node-fetch";

async function tiktok(sock, chatId, text, key, msg) {
    const cmd = text.split(" ")[0].toLowerCase();
    if (cmd !== ".tt" && cmd !== ".tiktok") return;

    const url = text.split(" ")[1];
    if (!url) return sock.sendMessage(chatId, { text: "⚠️ Masukkan link TikTok!" });

    // Kirim pesan proses
    await sock.sendMessage(chatId, { text: "⏳ Sedang memproses..." }, { quoted: msg });

    try {
        // --- UPDATE ENDPOINT API ---
        const apiUrl = `https://zelapioffciall.koyeb.app/download/tiktok?url=${url}`;
        const response = await fetch(apiUrl, { method: 'GET' });
        const json = await response.json();

        // Debugging di console (opsional, untuk cek struktur data jika error)
        console.log("TikTok API Response:", json);

        // Validasi dasar
        // Beberapa API menyimpan data di json.result, json.data, atau langsung di root
        const data = json.result || json.data || json;

        if (!data || (json.status === false)) {
            return sock.sendMessage(chatId, { text: "❌ Gagal: Video tidak ditemukan atau server sibuk." });
        }
        
        // Ambil Info Username & Caption
        // Cek berbagai kemungkinan key agar kompatibel
        const username = data.author || data.nickname || data.unique_id || data.username || "TikTok User";
        const desc = data.title || data.description || data.caption || "No Caption";

        // Format Caption Akhir
        const finalCaption = `✅ *TikTok Downloader*\n\n👤 *Username:* ${username}\n📝 *Caption:* ${desc}`;

        // Cek URL Video di berbagai kemungkinan key (Prioritas No Watermark)
        const videoUrl = data.nowm || data.play || data.video || data.download_url || data.link || (data.url ? data.url[0] : null);
        
        // Cek Slide Gambar
        const images = data.images || data.slide;

        // --- LOGIC PENGIRIMAN ---
        
        // 1. Jika Slide Gambar (Prioritas)
        if (images && Array.isArray(images) && images.length > 0) {
            await sock.sendMessage(chatId, { text: `📸 Mengirim ${images.length} slide gambar...` }, { quoted: msg });
            
            for (let img of images) {
                await sock.sendMessage(chatId, { image: { url: img } });
            }
            // Kirim caption terpisah di akhir slide
            await sock.sendMessage(chatId, { text: finalCaption });
        } 
        
        // 2. Jika Video
        else if (videoUrl) {
            await sock.sendMessage(chatId, { 
                video: { url: videoUrl }, 
                caption: finalCaption,
                mimetype: 'video/mp4'
            }, { quoted: msg });
        } 
        
        // 3. Jika Gagal (Tidak ada media valid)
        else {
            sock.sendMessage(chatId, { text: "❌ Media tidak valid (Link video/gambar tidak ditemukan di respon API)." });
        }

    } catch (e) {
        console.error("TikTok Error:", e);
        sock.sendMessage(chatId, { text: "❌ Terjadi kesalahan sistem atau API Down." });
    }
}

export default tiktok;
