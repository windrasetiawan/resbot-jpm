import fs from "fs";
import path from "path";
import { isOwner, downloadAndSaveMedia } from "../lib/utils.js";

const ID_SALURAN_TESTI = "120363405429396163@newsletter"; 
const countPath = path.join(process.cwd(), "DATABASE", "testi_count.json");

function getTestiCount() {
    try {
        if (fs.existsSync(countPath)) return JSON.parse(fs.readFileSync(countPath)).count || 829; 
    } catch (e) {}
    return 829; 
}

function saveTestiCount(count) {
    if (!fs.existsSync(path.dirname(countPath))) fs.mkdirSync(path.dirname(countPath), { recursive: true });
    fs.writeFileSync(countPath, JSON.stringify({ count: count }));
}

export default async function testi(sock, chatId, text, key, msg) {
    const cmd = text.toLowerCase().split(" ")[0];
    if (cmd !== ".testi" && cmd !== ".testi2") return;

    const sender = msg.key.participant || msg.key.remoteJid;
    if (!isOwner(sender)) return;

    const args = text.split(" ").slice(1);
    if (args[0] && args[0].toLowerCase() === "set" && !isNaN(args[1])) {
        const angkaBaru = parseInt(args[1]);
        saveTestiCount(angkaBaru);
        return sock.sendMessage(chatId, { text: `✅ Testi diubah ke: ${angkaBaru}` }, { quoted: msg });
    }

    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quotedMsg) return sock.sendMessage(chatId, { text: "⚠️ Reply struk dengan format input." }, { quoted: msg });

    try {
        await sock.sendMessage(chatId, { text: "⏳ Memposting..." }, { quoted: msg });
        let currentCount = getTestiCount();
        let data = args.join(" ").trim().split(",").map(item => item.trim());
        let finalCaption = "";

        if (cmd === ".testi") {
            finalCaption = `✨PEMBELIAN BERHASIL✨  \n◇━━━━━━━━━━━━━━━━━◇ \n🗄️ ISP : ${data[0] || ""}\n🌐 Protokol : ${data[1] || ""}\n📦 Produk : ${data[2] || "-"}\n🌍 Region : ${data[3] || ""}\n⚡ Config : ${data[4] || ""}\n💻 Device : ${data[5] || ""}\n💰 Harga : Rp ${data[6] || ""}\n⏳ Durasi : ${data[7] || ""}\n\n◇━━━━━━━━━━━━━━━━━◇ \n✅ TRANSAKSI SUKSES (${currentCount}) \n📂 Grup Sharing Config  \nhttps://chat.whatsapp.com/IRaOCbFdgaO6Rmx0tsgyyb?mode=ems_copy_t \n📞 Kontak Admin \n👉 wa.me/6285921645742\n\n*BOT VPN ➙* t.me/wintunelingvpnbot\n*BOT ZIVPN ➙* t.me/wintunelingzivpnBot\n◇━━━━━━━━━━━━━━━━━◇ \n🚀 Terima kasih telah bertransaksi di ✨WINTUNELING VPN`;
        } else if (cmd === ".testi2") {
            finalCaption = `✨PEMBELIAN BERHASIL✨  \n◇━━━━━━━━━━━━━━━━━◇ \n📦 Produk : ${data[0] || ""}\n💰 Harga : Rp ${data[1] || ""}\n⏳ Masa Aktif : ${data[2] || ""}\n\n◇━━━━━━━━━━━━━━━━━◇ \n✅ TRANSAKSI SUKSES (${currentCount}) \n📂 Grup Sharing Config  \nhttps://chat.whatsapp.com/IRaOCbFdgaO6Rmx0tsgyyb?mode=ems_copy_t \n📞 Kontak Admin \n👉 wa.me/6285921645742\n\n*BOT VPN ➙* t.me/wintunelingvpnbot\n*BOT ZIVPN ➙* t.me/wintunelingzivpnBot\n*BOT KUOTA ➙* t.me/wintunelingkoutabot\n◇━━━━━━━━━━━━━━━━━◇ \n🚀 Terima kasih telah bertransaksi di ✨WINTUNELING VPN✨`;
        }

        if (quotedMsg.imageMessage) {
            const pathImg = await downloadAndSaveMedia(sock, { message: { imageMessage: quotedMsg.imageMessage } }, "testi_temp.jpg");
            const buffer = fs.readFileSync(pathImg);
            await sock.sendMessage(ID_SALURAN_TESTI, { image: buffer, caption: finalCaption });
            fs.unlinkSync(pathImg); 
        } else if (quotedMsg.conversation || quotedMsg.extendedTextMessage?.text) {
            const teksPembeli = quotedMsg.conversation || quotedMsg.extendedTextMessage?.text;
            await sock.sendMessage(ID_SALURAN_TESTI, { text: `💬 *PESAN PEMBELI:*\n_"${teksPembeli}"_\n\n${finalCaption}` });
        } else {
             return sock.sendMessage(chatId, { text: "⚠️ Reply Gambar/Teks." }, { quoted: msg });
        }

        saveTestiCount(currentCount + 1);
        return sock.sendMessage(chatId, { text: `✅ Sukses!` }, { quoted: msg });
    } catch (err) {}
}
