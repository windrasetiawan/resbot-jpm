import { spintax, isOwner } from "../lib/utils.js";

async function pushkontak(sock, sender, message, key, msg) {
    if (!message.toLowerCase().startsWith(".pushkontak")) return;

    // --- PROTEKSI: HANYA OWNER ---
    if (!isOwner(sender)) return sock.sendMessage(sender, { text: "⚠️ Fitur ini khusus Owner Bot!" }, { quoted: msg });

    const text = message.split(" ").slice(1).join(" ");
    if (!text) return sock.sendMessage(sender, { text: "⚠️ Masukkan pesan!" });

    const chatId = key.remoteJid;
    if (!chatId.endsWith('@g.us')) return sock.sendMessage(sender, { text: "⚠️ Gunakan fitur ini di dalam grup!" });

    try {
        const metadata = await sock.groupMetadata(chatId);
        const members = metadata.participants.map(p => p.id);
        await sock.sendMessage(sender, { text: `🚀 Push ke ${members.length} kontak...` });

        for (const jid of members) {
            if (jid.includes(sock.user.id.split(':')[0]) || jid === sender) continue;
            try {
                const finalMsg = spintax(text);
                await sock.sendMessage(jid, { text: finalMsg });
                const delay = 15000 + Math.floor(Math.random() * 5000); 
                await new Promise(r => setTimeout(r, delay));
            } catch {}
        }
        await sock.sendMessage(sender, { text: `✅ Selesai.` });
    } catch (e) {
        sock.sendMessage(sender, { text: "❌ Gagal mengambil data grup." });
    }
}
export default pushkontak;
