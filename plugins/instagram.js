import axios from 'axios';

async function instagram(sock, chatId, message, key, msg) {
    const parts = message.trim().split(" ");
    let command = parts[0]?.toLowerCase();
    if (command.startsWith(".") || command.startsWith("#")) {
        command = command.substring(1);
    }
    const args = parts.slice(1);

    if (command === "ig") {
        if (!args[0]) return sock.sendMessage(chatId, { text: "⚠️ Masukkan link IG!" }, { quoted: msg });

        await sock.sendMessage(chatId, { text: "⏳ Downloading..." }, { quoted: msg });
        try {
            const apiUrl = `https://api.jerexd666.wongireng.my.id/download/instagram?url=${encodeURIComponent(args[0])}`;
            const response = await axios.get(apiUrl);
            if (response.data.status && response.data.result.media) {
                for (let item of response.data.result.media) {
                    const buffer = await axios.get(item.url, { responseType: 'arraybuffer' });
                    if (item.type === 'video' || item.url.includes('.mp4')) {
                        await sock.sendMessage(chatId, { video: buffer.data, caption: "✅ Instagram Video" }, { quoted: msg });
                    } else {
                        await sock.sendMessage(chatId, { image: buffer.data, caption: "✅ Instagram Image" }, { quoted: msg });
                    }
                }
            } else {
                await sock.sendMessage(chatId, { text: "❌ Gagal." }, { quoted: msg });
            }
        } catch (e) {
            await sock.sendMessage(chatId, { text: "❌ Error." }, { quoted: msg });
        }
    }
}
export default instagram;
