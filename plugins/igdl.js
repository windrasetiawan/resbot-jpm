import fetch from "node-fetch";

async function igdl(sock, chatId, text, key, msg) {
    const cmd = text.split(" ")[0].toLowerCase();
    if (cmd !== ".ig" && cmd !== ".igdl") return;

    let url = text.split(" ")[1];
    if (!url) return sock.sendMessage(chatId, { text: "⚠️ Masukkan link Instagram!" });

    // Bersihkan URL dari sampah tracking
    url = url.split("?")[0];

    await sock.sendMessage(chatId, { text: "⏳ Sedang memproses IG..." }, { quoted: msg });

    try {
        // Request API
        const response = await fetch(`https://api-faa.my.id/faa/igdl?url=${url}`, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            }
        });
        const json = await response.json();

        // Cek terminal jika ingin lihat struktur data asli
        console.log("RESPON IG:", JSON.stringify(json, null, 2));

        if (!json.result) {
            return sock.sendMessage(chatId, { text: "❌ Gagal: Konten Private atau API Error." });
        }

        let mediaData = json.result;
        // Pastikan formatnya Array
        if (!Array.isArray(mediaData)) mediaData = [mediaData];

        // --- AMBIL METADATA (Username & Caption) ---
        // Karena struktur API beda-beda, kita coba ambil dari berbagai kemungkinan key
        // Kalau tidak ada, defaultnya "-"
        const meta = mediaData[0]; // Ambil info dari slide pertama
        const username = meta.username || meta.owner || meta.author || "-"; 
        const postCaption = meta.caption || meta.title || "-";

        // Format Pesan (Style TikTok)
        const msgCaption = `✅ *Berhasil Didownload*\n👤 Username: ${username}\n📝 Caption: ${postCaption}`;

        // Kirim Media
        for (let i = 0; i < mediaData.length; i++) {
            let item = mediaData[i];
            let mediaUrl = item.url || item.download_url || (typeof item === 'string' ? item : null);
            
            if (mediaUrl) {
                // Hanya slide pertama yang dikasih caption panjang
                // Slide sisanya dikosongkan agar chat tidak penuh spam teks
                let sendCaption = (i === 0) ? msgCaption : "";

                if (mediaUrl.includes(".mp4") || item.type === 'video') {
                    await sock.sendMessage(chatId, { video: { url: mediaUrl }, caption: sendCaption }, { quoted: msg });
                } else {
                    await sock.sendMessage(chatId, { image: { url: mediaUrl }, caption: sendCaption }, { quoted: msg });
                }
            }
        }

    } catch (e) {
        console.error("IGDL Error:", e);
        sock.sendMessage(chatId, { text: "❌ Terjadi kesalahan sistem." });
    }
}

export default igdl;
