import fetch from "node-fetch";

async function tiktok(sock, chatId, text, key, msg) {
    const cmd = text.split(" ")[0].toLowerCase();
    if (cmd !== ".tt" && cmd !== ".tiktok") return;

    const url = text.split(" ")[1];
    if (!url) return sock.sendMessage(chatId, { text: "⚠️ Masukkan link TikTok!" });

    await sock.sendMessage(chatId, { text: "⏳ Sedang memproses..." }, { quoted: msg });

    try {
        // Request ke API
        const response = await fetch(`https://zelapioffciall.koyeb.app/download/tiktok?url=${url}`);
        const json = await response.json();

        // --- DEBUGGING (Cek Terminal VPS Anda) ---
        console.log("RESPON API TIKTOK:", JSON.stringify(json, null, 2));
        // -----------------------------------------

        // Validasi Status
        if (!json.status || !json.result) {
            return sock.sendMessage(chatId, { text: "❌ Gagal: API Error atau Link Private." });
        }

        const data = json.result;
        const caption = `✅ *TIKTOK DOWNLOADER*\n👤 ${data.author || "-"}\n📝 ${data.title || "-"}`;

        // 1. Cek Apakah Slide Foto?
        if (data.images && data.images.length > 0) {
            for (let img of data.images) {
                await sock.sendMessage(chatId, { image: { url: img } });
            }
            return sock.sendMessage(chatId, { text: "✅ Selesai mengirim slide." });
        }

        // 2. Cek Apakah Video? (Cari di semua kemungkinan key)
        const vid = data.video || data.play || data.hdplay || data.nowm || data.without_watermark || data.url;

        if (vid) {
            await sock.sendMessage(chatId, { 
                video: { url: vid }, 
                caption: caption 
            }, { quoted: msg });
        } else {
            // Jika video tetap tidak ketemu, kirim pesan error + cek terminal
            sock.sendMessage(chatId, { text: "❌ Link video tidak ditemukan. Cek terminal untuk detail JSON." });
        }

    } catch (e) {
        console.error(e);
        sock.sendMessage(chatId, { text: "❌ Terjadi kesalahan sistem." });
    }
}

export default tiktok;
