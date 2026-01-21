import fetch from "node-fetch";

async function tiktok(sock, chatId, text, key, msg) {
    const cmd = text.split(" ")[0].toLowerCase();
    if (cmd !== ".tt" && cmd !== ".tiktok") return;

    const url = text.split(" ")[1];
    if (!url) return sock.sendMessage(chatId, { text: "⚠️ Masukkan link TikTok!" });

    // Style Original: Kirim pesan, bukan typing
    await sock.sendMessage(chatId, { text: "⏳ Sedang memproses..." }, { quoted: msg });

    try {
        // Menggunakan 1 Endpoint sesuai request
        const response = await fetch(`https://api-faa.my.id/faa/tiktok?url=${url}`);
        const json = await response.json();

        // Validasi response
        if (!json.result) {
            return sock.sendMessage(chatId, { text: "❌ Gagal: Video tidak ditemukan atau Private." });
        }

        const data = json.result;
        const caption = `✅ ${data.title || "TikTok Video"}`;

        // Cek Video atau Slide
        if (data.video) {
            await sock.sendMessage(chatId, { 
                video: { url: data.video }, 
                caption: caption,
                mimetype: 'video/mp4'
            }, { quoted: msg });
        } else if (data.images && data.images.length > 0) {
            // Jika Slide Gambar
            for (let img of data.images) {
                await sock.sendMessage(chatId, { image: { url: img } });
            }
        } else {
            sock.sendMessage(chatId, { text: "❌ Media tidak valid." });
        }

    } catch (e) {
        console.error("TikTok Error:", e);
        sock.sendMessage(chatId, { text: "❌ Terjadi kesalahan sistem." });
    }
}

export default tiktok;
