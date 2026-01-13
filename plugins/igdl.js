import fetch from "node-fetch";

// FUNGSI HELPER: Download File jadi Buffer (Tembus Proteksi 403)
const getBuffer = async (url) => {
    try {
        const res = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
                "Referer": "https://www.instagram.com/"
            }
        });
        if (!res.ok) throw new Error(`Gagal download: HTTP ${res.status}`);
        return await res.buffer();
    } catch (e) {
        throw e;
    }
};

async function igdl(sock, chatId, text, key, msg) {
    const cmd = text.split(" ")[0].toLowerCase();
    if (cmd !== ".ig" && cmd !== ".igdl") return;

    let url = text.split(" ")[1];
    if (!url) return sock.sendMessage(chatId, { text: "⚠️ Masukkan link Instagram!" });

    // Bersihkan Link
    url = url.split("?")[0];

    await sock.sendMessage(chatId, { text: "⏳ Sedang Memproses IG..." }, { quoted: msg });

    try {
        // 1. Request ke API FAA
        const response = await fetch(`https://api-faa.my.id/faa/igdl?url=${url}`);
        const json = await response.json();

        // Cek JSON di terminal untuk debugging
        console.log("RESPON IG (FAA):", JSON.stringify(json, null, 2));

        if (!json.result) {
            return sock.sendMessage(chatId, { text: "❌ Gagal mengambil data. Akun private atau API Down." });
        }

        let mediaData = json.result;
        // Pastikan jadi Array
        if (!Array.isArray(mediaData)) mediaData = [mediaData];

        // Ambil Info Caption & Username (Jika ada)
        const meta = mediaData[0];
        const username = meta.username || meta.owner || "-";
        const captionText = meta.caption || meta.title || "Instagram Downloader";
        
        const finalCaption = `✅ *Berhasil Didownload*\n👤 ${username}\n📝 ${captionText}`;

        // 2. Loop Download & Kirim
        let successCount = 0;

        for (let i = 0; i < mediaData.length; i++) {
            let item = mediaData[i];
            let mediaUrl = item.url || item.download_url || (typeof item === 'string' ? item : null);

            if (mediaUrl) {
                try {
                    // --- DOWNLOAD KE BUFFER (KUNCI PERBAIKAN) ---
                    const buffer = await getBuffer(mediaUrl);
                    
                    // Hanya slide pertama yang dikasih caption panjang
                    const cap = (i === 0) ? finalCaption : "";

                    if (mediaUrl.includes(".mp4") || item.type === 'video') {
                        await sock.sendMessage(chatId, { video: buffer, caption: cap }, { quoted: msg });
                    } else {
                        await sock.sendMessage(chatId, { image: buffer, caption: cap }, { quoted: msg });
                    }
                    successCount++;

                } catch (err) {
                    console.log(`Gagal kirim slide ke-${i}: ${err}`);
                }
            }
        }

        if (successCount === 0) {
            sock.sendMessage(chatId, { text: "❌ Gagal mendownload file media (Error 403/Link Expired)." });
        }

    } catch (e) {
        console.error("IGDL Error:", e);
        sock.sendMessage(chatId, { text: "❌ Terjadi kesalahan sistem." });
    }
}

export default igdl;
