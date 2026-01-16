import fetch from "node-fetch";

async function tiktok(sock, chatId, text, key, msg) {
    const cmd = text.split(" ")[0].toLowerCase();
    if (cmd !== ".tt" && cmd !== ".tiktok") return;

    let url = text.split(" ")[1];
    if (!url) return sock.sendMessage(chatId, { text: "⚠️ Masukkan link TikTok!" });

    // 1. REAKSI EMOTE (Biar terlihat natural)
    await sock.sendMessage(chatId, { react: { text: "🎵", key: msg.key } });

    // 2. SIMULASI MENGETIK
    await sock.sendPresenceUpdate('composing', chatId);
    
    // 3. JEDA 1-2 DETIK
    await new Promise(r => setTimeout(r, 1000 + Math.random() * 1500));

    try {
        // Menggunakan Endpoint API (Contoh pakai api-faa, bisa ganti jika mati)
        const response = await fetch(`https://api-faa.my.id/faa/tiktok?url=${url}`);
        const json = await response.json();

        if (!json.result || !json.result.video) {
            await sock.sendMessage(chatId, { text: "❌ Video tidak ditemukan / Private." });
            return;
        }

        const videoUrl = json.result.video;
        const captionText = json.result.title || "TikTok Downloader";
        const author = json.result.author || "-";

        // Download Buffer Dulu (Supaya aman dari error 403)
        const bufferRes = await fetch(videoUrl);
        const buffer = await bufferRes.buffer();

        await sock.sendMessage(chatId, { 
            video: buffer, 
            caption: `✅ *TIKTOK NO WATERMARK*\n👤 Author: ${author}\n📝 Desc: ${captionText}`,
            mimetype: 'video/mp4'
        }, { quoted: msg });

    } catch (e) {
        console.error("TikTok Error:", e);
        sock.sendMessage(chatId, { text: "❌ Terjadi kesalahan sistem." });
    } finally {
        // Stop Mengetik
        await sock.sendPresenceUpdate('paused', chatId);
    }
}

export default tiktok;
