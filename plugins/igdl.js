import fetch from "node-fetch";

async function igdl(sock, chatId, text, key, msg) {
    const cmd = text.split(" ")[0].toLowerCase();
    if (cmd !== ".ig" && cmd !== ".igdl") return;

    const url = text.split(" ")[1];
    if (!url) return sock.sendMessage(chatId, { text: "⚠️ Masukkan link Instagram!" });

    await sock.sendMessage(chatId, { text: "⏳ Sedang memproses IG..." }, { quoted: msg });

    try {
        // Request ke API
        const response = await fetch(`https://api-faa.my.id/faa/igdl?url=${url}`);
        const json = await response.json();

        // Debugging (Cek Terminal jika error)
        console.log("RESPON IG:", JSON.stringify(json, null, 2));

        // Validasi Status
        if (!json.result) {
            return sock.sendMessage(chatId, { text: "❌ Gagal mengambil data IG. Pastikan akun tidak private." });
        }

        // Instagram biasanya mereturn Array (bisa banyak slide)
        // Kita paksa jadi array biar aman loopingnya
        let mediaData = json.result;
        if (!Array.isArray(mediaData)) mediaData = [mediaData];

        for (let item of mediaData) {
            // Cek apakah item punya property 'url'
            const mediaUrl = item.url || item.download_url || item; 
            
            // Cek tipe file (berdasarkan ekstensi atau type)
            if (mediaUrl.includes(".mp4") || item.type === 'video') {
                await sock.sendMessage(chatId, { video: { url: mediaUrl }, caption: "" }, { quoted: msg });
            } else {
                await sock.sendMessage(chatId, { image: { url: mediaUrl }, caption: "" }, { quoted: msg });
            }
        }

        await sock.sendMessage(chatId, { text: "✅ Selesai." });

    } catch (e) {
        console.error("IGDL Error:", e);
        sock.sendMessage(chatId, { text: "❌ Terjadi kesalahan sistem." });
    }
}

export default igdl;
      
