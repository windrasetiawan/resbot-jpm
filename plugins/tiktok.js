import fetch from "node-fetch";

async function tiktok(sock, chatId, text, key, msg) {
    const cmd = text.split(" ")[0].toLowerCase();
    if (cmd !== ".tt" && cmd !== ".tiktok") return;

    const url = text.split(" ")[1];
    if (!url) return sock.sendMessage(chatId, { text: "⚠️ Masukkan link TikTok!" });

    // --- HUMANIZED (Anti-Ban) ---
    await sock.sendMessage(chatId, { react: { text: "🎵", key: msg.key } });
    await sock.sendPresenceUpdate('composing', chatId);
    await new Promise(r => setTimeout(r, 1000));

    try {
        // GANTI API KE YANG BARU & STABIL
        const response = await fetch(`https://api-faa.my.id/faa/tiktok?url=${url}`);
        const json = await response.json();

        // Validasi
        if (!json.result || (!json.result.video && !json.result.images)) {
            await sock.sendPresenceUpdate('paused', chatId);
            return sock.sendMessage(chatId, { text: "❌ Gagal. Pastikan link benar atau video tidak diprivate." });
        }

        const data = json.result;
        const author = data.author || "-";
        const title = data.title || "TikTok Downloader";
        const caption = `✅ *TikTok No Watermark*\n👤 ${author}\n📝 ${title}`;

        // 1. Cek Jika Slide Gambar (Images)
        if (data.images && data.images.length > 0) {
            await sock.sendMessage(chatId, { text: `📸 Mengirim ${data.images.length} slide gambar...` }, { quoted: msg });
            for (let imgUrl of data.images) {
                await sock.sendMessage(chatId, { image: { url: imgUrl } }); // Kirim gambar satu per satu
            }
        } 
        // 2. Cek Jika Video
        else if (data.video) {
            await sock.sendMessage(chatId, { 
                video: { url: data.video }, 
                caption: caption,
                mimetype: 'video/mp4'
            }, { quoted: msg });
        } else {
            sock.sendMessage(chatId, { text: "❌ Format media tidak didukung." });
        }

    } catch (e) {
        console.error("TikTok Error:", e);
        sock.sendMessage(chatId, { text: "❌ Terjadi kesalahan koneksi API." });
    } finally {
        await sock.sendPresenceUpdate('paused', chatId);
    }
}

export default tiktok;
