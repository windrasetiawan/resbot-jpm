import fetch from "node-fetch";

// Fungsi Download Anti-Error 403
const getBuffer = async (url) => {
    try {
        const res = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
            }
        });
        if (res.ok) return Buffer.from(await res.arrayBuffer());
        
        const res2 = await fetch(url);
        if (res2.ok) return Buffer.from(await res2.arrayBuffer());
        
        throw new Error("Gagal mengambil media.");
    } catch (e) {
        throw e;
    }
};

async function igdl(sock, chatId, text, key, msg) {
    const cmd = text.split(" ")[0].toLowerCase();
    if (cmd !== ".ig" && cmd !== ".igdl") return;

    let url = text.split(" ")[1];
    if (!url) return sock.sendMessage(chatId, { text: "⚠️ Masukkan link Instagram!" });

    // --- HUMANIZED (HANYA MENGETIK) ---
    // Bagian react emoji dihapus sesuai request
    await sock.sendPresenceUpdate('composing', chatId);
    await new Promise(r => setTimeout(r, 1000)); // Delay 1 detik

    try {
        const response = await fetch(`https://api-faa.my.id/faa/igdl?url=${url}`);
        const json = await response.json();

        if (!json.result) {
            await sock.sendPresenceUpdate('paused', chatId);
            return sock.sendMessage(chatId, { text: "❌ Media tidak ditemukan atau akun Private." });
        }

        const data = json.result;
        const username = data.username || data.owner || "Instagram User";
        const captionRaw = data.caption || data.title || "";
        
        const finalCaption = `✅ *IG Downloader*\n\n👤 *User:* ${username}\n📝 *Caption:*\n${captionRaw}`;

        let mediaList = data.url || data; 
        if (!Array.isArray(mediaList)) mediaList = [mediaList];

        let successCount = 0;

        for (let item of mediaList) {
            let mediaUrl = (typeof item === 'string') ? item : (item.url || item.download_url);

            if (mediaUrl) {
                try {
                    const buffer = await getBuffer(mediaUrl);

                    if (mediaUrl.includes(".mp4")) {
                        await sock.sendMessage(chatId, { 
                            video: buffer, 
                            caption: finalCaption, 
                            mimetype: 'video/mp4' 
                        }, { quoted: msg });
                    } else {
                        await sock.sendMessage(chatId, { 
                            image: buffer, 
                            caption: finalCaption, 
                            mimetype: 'image/jpeg' 
                        }, { quoted: msg });
                    }
                    successCount++;
                } catch (err) {
                    console.log(`Gagal download slide: ${err.message}`);
                }
            }
        }

        if (successCount === 0) {
            sock.sendMessage(chatId, { text: "❌ Gagal mendownload media." });
        }

    } catch (e) {
        console.error("IGDL Error:", e);
        sock.sendMessage(chatId, { text: "❌ Terjadi kesalahan sistem." });
    } finally {
        await sock.sendPresenceUpdate('paused', chatId);
    }
}

export default igdl;
