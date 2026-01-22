import fetch from "node-fetch";

async function tiktok(sock, chatId, text, key, msg) {
    const cmd = text.split(" ")[0].toLowerCase();
    if (cmd !== ".tt" && cmd !== ".tiktok") return;

    const url = text.split(" ")[1];
    if (!url) return sock.sendMessage(chatId, { text: "⚠️ Masukkan link TikTok!" });

    // Pesan Proses
    await sock.sendMessage(chatId, { text: "⏳ Sedang memproses..." }, { quoted: msg });

    try {
        const apiUrl = `https://api-faa.my.id/faa/tiktok?url=${url}`;
        
        const response = await fetch(apiUrl, {
            method: "GET",
            headers: {
                "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
            }
        });

        // Cek koneksi ke API
        if (!response.ok) {
            return sock.sendMessage(chatId, { text: `❌ Gagal menghubungi server API (Status: ${response.status})` });
        }

        const json = await response.json();
        console.log("[TikTok Debug]", json); // Cek log di terminal VPS jika error

        // Validasi Response API
        if (!json.status || !json.result) {
            return sock.sendMessage(chatId, { text: "❌ Video tidak ditemukan atau Link Private." });
        }

        const data = json.result;

        // --- AMBIL INFO (Author & Caption) ---
        // Fallback berjenjang biar tidak undefined
        const authorName = data.author?.nickname || data.author?.fullname || data.nickname || "TikTok User";
        const desc = data.title || data.caption || data.description || "No Caption";

        const finalCaption = `✅ *Berhasil didownload*\n\n📸 *Username:* ${authorName}\n📃 *Caption:* ${desc}`;

        // --- CARI LINK VIDEO (Pencarian Menyeluruh) ---
        // Kita cari link di 'data', 'nowm', 'play', atau 'video' (Prioritas: No Watermark)
        const videoUrl = data.data || data.nowm || data.play || data.video || data.download_url;

        // --- CARI GAMBAR (Jika Slide) ---
        const images = data.images || data.slide;

        // --- EKSEKUSI PENGIRIMAN ---
        
        // 1. Cek Slide Gambar Dulu
        if (images && Array.isArray(images) && images.length > 0) {
            await sock.sendMessage(chatId, { text: `📸 Mengirim ${images.length} slide gambar...` }, { quoted: msg });
            
            for (let img of images) {
                await sock.sendMessage(chatId, { image: { url: img } });
            }
            // Kirim caption terpisah
            await sock.sendMessage(chatId, { text: finalCaption });
        }
        
        // 2. Kirim Video (Jika URL Video ketemu)
        else if (videoUrl) {
            await sock.sendMessage(chatId, { 
                video: { url: videoUrl }, 
                caption: finalCaption,
                mimetype: 'video/mp4'
            }, { quoted: msg });
        }
        
        // 3. Jika Tidak Ada Media
        else {
            sock.sendMessage(chatId, { text: "❌ Media tidak valid (Link download kosong di respon API)." });
        }

    } catch (e) {
        console.error("TikTok Error:", e);
        sock.sendMessage(chatId, { text: "❌ Terjadi kesalahan sistem (Cek log console)." });
    }
}

export default tiktok;
