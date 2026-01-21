import fetch from "node-fetch";

async function tiktok(sock, chatId, text, key, msg) {
    const cmd = text.split(" ")[0].toLowerCase();
    if (cmd !== ".tt" && cmd !== ".tiktok") return;

    let url = text.split(" ")[1];
    if (!url) return sock.sendMessage(chatId, { text: "⚠️ Masukkan link TikTok!" });

    // --- HUMANIZED (HANYA MENGETIK) ---
    // Bagian react emoji dihapus sesuai request
    await sock.sendPresenceUpdate('composing', chatId);
    
    // LIST API (Multi-Server)
    const apis = [
        { url: `https://api.tiklydown.eu.org/api/download?url=${url}`, type: "tiklydown" },
        { url: `https://api.agatz.xyz/api/tiktok?url=${url}`, type: "agatz" },
        { url: `https://api-faa.my.id/faa/tiktok?url=${url}`, type: "faa" }
    ];

    let success = false;

    for (let api of apis) {
        if (success) break;
        
        try {
            const res = await fetch(api.url);
            const json = await res.json();
            
            let videoUrl = null;
            let images = [];
            let caption = "";

            if (api.type === "tiklydown" && json.video) {
                videoUrl = json.video.noWatermark || json.video.watermark;
                images = json.images || [];
                caption = json.title || "TikTok Video";
            }
            else if (api.type === "agatz" && json.status === 200) {
                videoUrl = json.data.data.find(v => v.type === "nowatermark")?.url || json.data.data[0]?.url;
                caption = json.data.title || "TikTok Video";
            }
            else if (api.type === "faa" && json.result) {
                videoUrl = json.result.video;
                images = json.result.images || [];
                caption = json.result.title || "TikTok Video";
            }

            if (videoUrl) {
                await sock.sendMessage(chatId, { 
                    video: { url: videoUrl }, 
                    caption: `✅ *TikTok Downloaded*\n📝 ${caption}`,
                    mimetype: 'video/mp4'
                }, { quoted: msg });
                success = true;
            }
            else if (images.length > 0) {
                await sock.sendMessage(chatId, { text: `📸 Mengirim ${images.length} gambar...` }, { quoted: msg });
                for (let img of images) {
                    await sock.sendMessage(chatId, { image: { url: img.url || img } });
                }
                success = true;
            }

        } catch (e) {
            console.log(`API ${api.type} Gagal.`);
        }
    }

    if (!success) {
        await sock.sendMessage(chatId, { text: "❌ Gagal mendownload video." });
    }

    await sock.sendPresenceUpdate('paused', chatId);
}

export default tiktok;
