import fetch from "node-fetch";

// --- FUNGSI DOWNLOAD PINTAR (ANTI 403) ---
const getBuffer = async (url) => {
    try {
        // PERCOBAAN 1: Pakai Headers (Menyamar jadi Chrome)
        const res1 = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
                "Referer": "https://www.instagram.com/"
            }
        });
        
        if (res1.ok) {
            const ab1 = await res1.arrayBuffer();
            return Buffer.from(ab1);
        }

        // PERCOBAAN 2: Jika Gagal (403), coba Polosan (Tanpa Header)
        // Kadang CDN Instagram justru menolak kalau ada header aneh-aneh
        const res2 = await fetch(url); 
        if (res2.ok) {
            const ab2 = await res2.arrayBuffer();
            return Buffer.from(ab2);
        }

        throw new Error(`Gagal download (Status: ${res1.status} / ${res2.status})`);

    } catch (e) {
        throw e;
    }
};

async function igdl(sock, chatId, text, key, msg) {
    const cmd = text.split(" ")[0].toLowerCase();
    if (cmd !== ".ig" && cmd !== ".igdl") return;

    let url = text.split(" ")[1];
    if (!url) return sock.sendMessage(chatId, { text: "⚠️ Masukkan link Instagram!" });

    url = url.split("?")[0];

    await sock.sendMessage(chatId, { text: "⏳ Sedang Memproses IG..." }, { quoted: msg });

    try {
        const response = await fetch(`https://api-faa.my.id/faa/igdl?url=${url}`);
        const json = await response.json();

        // Debugging Log
        console.log("RESPON IG:", JSON.stringify(json, null, 2));

        if (!json.status || !json.result) {
            return sock.sendMessage(chatId, { text: "❌ Gagal mengambil data." });
        }

        const result = json.result;
        
        // 1. Ambil List URL
        let mediaUrls = result.url;
        if (!Array.isArray(mediaUrls)) mediaUrls = [mediaUrls];

        // 2. Ambil Metadata
        const meta = result.metadata || {};
        const username = meta.username || "-";
        const captionText = meta.caption || "-";
        
        const finalCaption = `✅ *Berhasil Didownload*\nUsername : ${username}\nCaption : ${captionText}`;

        // 3. Loop Download & Kirim
        let successCount = 0;

        for (let i = 0; i < mediaUrls.length; i++) {
            let link = mediaUrls[i];
            if (!link) continue;

            try {
                // Download Buffer (Akan otomatis coba 2 metode)
                const buffer = await getBuffer(link);
                const cap = (i === 0) ? finalCaption : "";

                // Cek Tipe File
                if (link.includes(".mp4") || meta.isVideo) {
                    await sock.sendMessage(chatId, { 
                        video: buffer, 
                        caption: cap,
                        mimetype: 'video/mp4' // ✅ WAJIB: Biar video bisa diputar
                    }, { quoted: msg });
                } else {
                    await sock.sendMessage(chatId, { 
                        image: buffer, 
                        caption: cap,
                        mimetype: 'image/jpeg' // ✅ WAJIB: Biar gambar normal
                    }, { quoted: msg });
                }
                successCount++;

            } catch (err) {
                console.log(`Gagal download slide ke-${i}: ${err.message}`);
            }
        }

        if (successCount === 0) {
            sock.sendMessage(chatId, { text: "❌ Gagal mendownload media (Link Expired/Error 403)." });
        }

    } catch (e) {
        console.error("IGDL Error:", e);
        sock.sendMessage(chatId, { text: "❌ Terjadi kesalahan sistem." });
    }
}

export default igdl;
        
