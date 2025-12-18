import axios from 'axios';

async function instagram(sock, chatId, message, key, msg) {
    const parts = message.trim().split(" ");
    let command = parts[0]?.toLowerCase();
    if (command.startsWith(".") || command.startsWith("#")) command = command.substring(1);
    const args = parts.slice(1);

    if (command === "ig" || command === "instagram") {
        if (!args[0]) return sock.sendMessage(chatId, { text: "⚠️ Masukkan Link IG!" }, { quoted: msg });

        await sock.sendMessage(chatId, { text: "⏳ Downloading..." }, { quoted: msg });
        
        try {
            const apiUrl = `https://api.jerexd666.wongireng.my.id/download/instagram?url=${encodeURIComponent(args[0])}`;
            const { data } = await axios.get(apiUrl);
            
            if (data.status && data.result?.media) {
                for (let item of data.result.media) {
                    // Download ke buffer untuk cek header tipe file
                    const bufferRes = await axios.get(item.url, { responseType: 'arraybuffer' });
                    const contentType = bufferRes.headers['content-type'] || '';
                    
                    if (contentType.includes('video')) {
                        await sock.sendMessage(chatId, { video: bufferRes.data, caption: "✅ IG Video" }, { quoted: msg });
                    } else {
                        await sock.sendMessage(chatId, { image: bufferRes.data, caption: "✅ IG Image" }, { quoted: msg });
                    }
                }
            } else {
                await sock.sendMessage(chatId, { text: "❌ Gagal/Private" }, { quoted: msg });
            }
        } catch (e) {
            await sock.sendMessage(chatId, { text: "❌ Error Server / Link Expired" }, { quoted: msg });
        }
    }
}
export default instagram;
