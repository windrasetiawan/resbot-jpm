import fetch from "node-fetch";

// --- FUNGSI DOWNLOADER ANTI 403 ---
const getBuffer = async (url) => {
    try {
        // Opsi 1: Menyamar sebagai Browser (Chrome Windows)
        const res = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
                "Referer": "https://www.instagram.com/"
            }
        });
        if (res.ok) return Buffer.from(await res.arrayBuffer());

        // Opsi 2: Jika Opsi 1 gagal (403), coba Polosan (Tanpa Header)
        // Kadang CDN Instagram justru menolak header tertentu
        const res2 = await fetch(url);
        if (res2.ok) return Buffer.from(await res2.arrayBuffer());

        throw new Error("Gagal mengambil buffer media.");
    } catch (e) {
        throw e;
    }
};

async function igdl(sock, chatId, text, key, msg) {
    const cmd = text.split(" ")[0].toLowerCase();
    if (cmd !== ".ig" && cmd !== ".igdl") return;

    let url = text.split(" ")[1];
    if (!url) return sock.sendMessage(chatId, { text: "⚠️ Masukkan link Instagram!" });

    // --- HUMANIZED (Anti-Ban) ---
    await sock.sendMessage(chatId, { react: { text: "📸", key: msg.key } });
    await sock.sendPresenceUpdate('composing', chatId);
    await new Promise(r => setTimeout(r, 1000)); 

    try {
        // Menggunakan API Alternative yang stabil
        const response = await fetch(`https://api-faa.my.id/faa/igdl?url=${url}`);
        const json = await response.json();

        if (!json.result) {
            await sock.sendPresenceUpdate('paused', chatId);
            return sock.sendMessage(chatId, { text: "❌ Media tidak ditemukan atau akun Private." });
        }

        // Normalisasi Data (Bisa berupa Array atau Object)
        let mediaData = json.result.url || json.result;
        if (!Array.isArray(mediaData)) mediaData = [mediaData];

        let success = 0;
        for (let item of mediaData) {
            // Ambil URL (support berbagai format output API)
            let mediaUrl = (typeof item === 'string') ? item : (item.url || item.download_url);
            
            if (mediaUrl) {
                try {
                    const buffer = await getBuffer(mediaUrl);
                    
                    if (mediaUrl.includes(".mp4")) {
                        await sock.sendMessage(chatId, { video: buffer, caption: "✅ Instagram Video", mimetype: 'video/mp4' }, { quoted: msg });
                    } else {
                        await sock.sendMessage(chatId, { image: buffer, caption: "✅ Instagram Image", mimetype: 'image/jpeg' }, { quoted: msg });
                    }
                    success++;
                } catch (err) {
                    console.log("Gagal download slide:", err);
                }
            }
        }

        if (success === 0) {
            sock.sendMessage(chatId, { text: "❌ Gagal mendownload media (Error 403/Link Expired)." });
        }

    } catch (e) {
        console.error("IGDL Error:", e);
        sock.sendMessage(chatId, { text: "❌ Terjadi kesalahan sistem." });
    } finally {
        await sock.sendPresenceUpdate('paused', chatId);
    }
}

export default igdl;
