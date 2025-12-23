import { spintax } from "../lib/utils.js";

async function pushkontak(sock, sender, message, key, msg) {
    if (!message.startsWith(".pushkontak")) return;
    const text = message.split(" ").slice(1).join(" ");
    if (!text) return sock.sendMessage(sender, { text: "⚠️ Masukkan pesan!" });

    const metadata = await sock.groupMetadata(key.remoteJid);
    const members = metadata.participants.map(p => p.id);
    await sock.sendMessage(sender, { text: `🚀 Push ke ${members.length} kontak...` });

    for (const jid of members) {
        if (jid.includes(sock.user.id.split(':')[0]) || jid === sender) continue;
        try {
            const finalMsg = spintax(text);
            await sock.sendMessage(jid, { text: finalMsg });
            const delay = 20000 + Math.floor(Math.random() * 10000); // 20-30 detik
            await new Promise(r => setTimeout(r, delay));
        } catch {}
    }
    await sock.sendMessage(sender, { text: `✅ Selesai.` });
}
export default pushkontak;
