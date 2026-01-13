import fetch from "node-fetch";

async function tiktok(sock, chatId, text, key, msg) {
    const cmd = text.split(" ")[0].toLowerCase();
    if (cmd !== ".tt" && cmd !== ".tiktok") return;

    const url = text.split(" ")[1];
    if (!url) return sock.sendMessage(chatId, { text: "⚠️ Masukkan link TikTok!" });

    await sock.sendMessage(chatId, { text: "⏳ Sedang memproses..." }, { quoted: msg });

    try {
        const response = await fetch(`https://zelapioffciall.koyeb.app/download/tiktok?url=${url}`);
        const json = await response.json();

        // Cek Status
        if (!json.status || !json.result) {
            return sock.sendMessage(chatId, { text: "❌ Gagal: Respon API kosong atau error." });
        }

        const data = json.result;
        
        // Ambil Metadata (Info Video) sesuai struktur JSON terbaru
        const author = data.metadata?.creator || data.creator || "-";
        const title = data.metadata?.title || data.metadata?.description || "-";
        const caption = `✅ *Berhasil Didownload*\n👤 Creator: ${author}\n📝 Desc: ${title}`;

        // 1. Cek Slide Foto (Images)
        if (data.images && data.images.length > 0) {
            for (let img of data.images) {
                await sock.sendMessage(chatId, { image: { url: img } });
            }
            return sock.sendMessage(chatId, { text: "✅ Selesai mengirim slide." });
        }

        // 2. Cek Video (FIX: Ambil dari array 'urls')
        let videoUrl = null;

        // Coba ambil dari 'urls' urutan pertama (paling umum di API ini)
        if (data.urls && Array.isArray(data.urls) && data.urls.length > 0) {
            videoUrl = data.urls[0];
        } 
        // Backup: Coba cari key lain siapa tau format berubah lagi
        else {
            videoUrl = data.video || data.play || data.hdplay; 
        }

        if (videoUrl) {
            await sock.sendMessage(chatId, { 
                video: { url: videoUrl }, 
                caption: caption 
            }, { quoted: msg });
        } else {
            sock.sendMessage(chatId, { text: "❌ Link video tidak ditemukan dalam respon API." });
        }

    } catch (e) {
        console.error("TikTok Error:", e);
        sock.sendMessage(chatId, { text: "❌ Terjadi kesalahan sistem." });
    }
}

export default tiktok;
