import { isOwner } from "../lib/utils.js";

async function pushkontak(sock, sender, text, key, msg) {
    if (!text.toLowerCase().startsWith(".pushkontak")) return;

    // --- PROTEKSI: HANYA OWNER ---
    if (!isOwner(sender)) return sock.sendMessage(sender, { text: "⚠️ Fitur ini khusus Owner Bot!" }, { quoted: msg });
    // -----------------------------

    const args = text.split(" ");
    const pesan = args.slice(1).join(" ");
    
    if (!pesan) return sock.sendMessage(sender, { text: "⚠️ Format salah. Gunakan: .pushkontak Halo kak promo nih" });

    // Cek apakah di dalam grup
    const chatId = msg.key.remoteJid;
    if (!chatId.endsWith('@g.us')) return sock.sendMessage(sender, { text: "⚠️ Gunakan fitur ini di dalam grup!" });

    try {
        const metadata = await sock.groupMetadata(chatId);
        const participants = metadata.participants;
        
        await sock.sendMessage(sender, { text: `🚀 Memulai Push Kontak ke ${participants.length} member...` });

        for (let member of participants) {
            if (member.id === sock.user.id) continue; // Skip bot sendiri

            try {
                await sock.sendMessage(member.id, { text: pesan });
                // Jeda 3-5 detik
                await new Promise(resolve => setTimeout(resolve, 3000));
            } catch (e) {
                console.log(`Gagal kirim ke ${member.id}`);
            }
        }
        await sock.sendMessage(sender, { text: "✅ Push Kontak Selesai!" });

    } catch (e) {
        console.error(e);
        await sock.sendMessage(sender, { text: "❌ Gagal mengambil data grup." });
    }
}
export default pushkontak;
