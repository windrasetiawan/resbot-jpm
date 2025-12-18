import axios from 'axios';

async function instagram(sock, chatId, message, key, msg) {
    const parts = message.trim().split(" ");
    
    // Parsing Command
    let command = parts[0]?.toLowerCase();
    if (command.startsWith(".") || command.startsWith("#")) {
        command = command.substring(1);
    }
    const args = parts.slice(1);

    // Command yang dikenali: .ig, .instagram, .igdl
    if (command === "ig" || command === "instagram" || command === "igdl") {
        if (!args[0]) {
            return sock.sendMessage(chatId, { text: "⚠️ Masukkan link Instagram!\nContoh: *.ig https://www.instagram.com/p/xxxx*" }, { quoted: msg });
        }

        const url = args[0];
        if (!url.includes("instagram.com")) {
            return sock.sendMessage(chatId, { text: "⚠️ Link tidak valid! Pastikan link dari Instagram." }, { quoted: msg });
        }

        await sock.sendMessage(chatId, { text: "⏳ Sedang mendownload media Instagram..." }, { quoted: msg });

        try {
            // Request ke API
            const apiUrl = `https://api.jerexd666.wongireng.my.id/download/instagram?url=${encodeURIComponent(url)}`;
            const response = await axios.get(apiUrl);
            const res = response.data;

            if (res.status && res.result && res.result.media) {
                const mediaList = res.result.media;
                const metadata = res.result.metadata || {};

                // Kirim setiap media yang ditemukan (Slide/Carousel)
                for (let i = 0; i < mediaList.length; i++) {
                    const item = mediaList[i];
                    
                    // Deteksi Video vs Image
                    let isVideo = item.type === 'video' || item.url.includes('.mp4');

                    const caption = i === 0 ? `
📝 *Caption:* ${metadata.caption || "-"}
❤️ *Likes:* ${metadata.like || 0}
💬 *Comments:* ${metadata.comment || 0}
` : ""; 

                    if (isVideo) {
                        await sock.sendMessage(chatId, { 
                            video: { url: item.url }, 
                            caption: caption 
                        }, { quoted: msg });
                    } else {
                        await sock.sendMessage(chatId, { 
                            image: { url: item.url }, 
                            caption: caption 
                        }, { quoted: msg });
                    }
                }

            } else {
                await sock.sendMessage(chatId, { text: "❌ Gagal mengambil data. Pastikan akun tidak diprivate." }, { quoted: msg });
            }

        } catch (error) {
            console.error("IG Error:", error.message);
            await sock.sendMessage(chatId, { text: "❌ Terjadi kesalahan server." }, { quoted: msg });
        }
    }
}

export default instagram;
