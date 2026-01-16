import os from "os";

async function ping(sock, chatId, text, key, msg) {
    if (text.toLowerCase() !== ".ping" && text.toLowerCase() !== "ping") return;

    // 1. React
    await sock.sendMessage(chatId, { react: { text: "🏓", key: msg.key } });

    // 2. Typing
    await sock.sendPresenceUpdate('composing', chatId);
    
    // 3. Delay Sedikit (0.5 - 1 detik)
    await new Promise(r => setTimeout(r, 500 + Math.random() * 500));

    const start = Date.now();
    // Hitung kecepatan respon server
    const latensi = Date.now() - start;
    
    // Info Server
    const hostname = os.hostname();
    const type = os.type();

    await sock.sendMessage(chatId, { 
        text: `🚀 *PONG!*\n📶 Kecepatan: ${latensi}ms\n🖥️ Host: ${hostname} (${type})` 
    }, { quoted: msg });

    await sock.sendPresenceUpdate('paused', chatId);
}

export default ping;
