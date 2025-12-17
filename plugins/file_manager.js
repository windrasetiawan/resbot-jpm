import fs from "fs";
import path from "path";
import { downloadAndSaveMedia } from "../lib/utils.js";

const filesDir = './ADDTIONAL/files';
if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir, { recursive: true });

async function fileManager(sock, sender, message, key, messageEvent) {
    const parts = message.trim().split(" ");
    const command = parts[0]?.toLowerCase(); // Command murni (misal: .addhc)
    const prefix = message.trim()[0];
    const q = parts.slice(1).join(" ");
    const senderNumber = sender.split('@')[0];

    // --- ADD FILE (.addhc / .addfile) ---
    if (command === `${prefix}addhc` || command === `${prefix}addfile`) {
        if (!q) return sock.sendMessage(sender, { text: "⚠️ Masukkan nama file! Contoh: .addhc wintuneling" });
        
        let fileName = q.endsWith('.hc') ? q : q + '.hc';
        
        // Cek media (dokumen)
        let mediaMsg = messageEvent.messages[0]?.message?.documentMessage 
            || messageEvent.messages[0]?.message?.extendedTextMessage?.contextInfo?.quotedMessage?.documentMessage;

        if (mediaMsg) {
            // Jika quoted, bungkus ulang agar bisa dibaca fungsi download
            if (!mediaMsg.url) mediaMsg = { message: { documentMessage: mediaMsg } };
            else mediaMsg = { message: { documentMessage: mediaMsg } }; // Jika direct

            // Gunakan pesan asli untuk download
            const msgToDownload = messageEvent.messages[0]?.message?.documentMessage ? messageEvent.messages[0] : 
                { message: messageEvent.messages[0].message.extendedTextMessage.contextInfo.quotedMessage };

            try {
                // Simpan ke tmp dulu
                const saved = await downloadAndSaveMedia(sock, msgToDownload, fileName);
                if (saved) {
                    fs.renameSync(`./tmp/${fileName}`, path.join(filesDir, fileName));
                    return sock.sendMessage(sender, { text: `✅ File *${fileName}* berhasil disimpan!\nKetik *#${q}* untuk mengambilnya.` });
                }
            } catch (e) {
                console.error(e);
                return sock.sendMessage(sender, { text: "❌ Gagal menyimpan file." });
            }
        } else {
            return sock.sendMessage(sender, { text: "⚠️ Kirim/Reply file dokumen dengan caption .addhc namafile" });
        }
    }

    // --- DELETE FILE (.delhc) ---
    if (command === `${prefix}delhc`) {
        if (!q) return sock.sendMessage(sender, { text: "⚠️ Masukkan nama file yang mau dihapus." });
        const target = q.endsWith('.hc') ? q : q + '.hc';
        const filePath = path.join(filesDir, target);
        
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return sock.sendMessage(sender, { text: `✅ File ${target} berhasil dihapus.` });
        } else {
            return sock.sendMessage(sender, { text: `❌ File ${target} tidak ditemukan.` });
        }
    }

    // --- DELETE ALL (.delallhc) ---
    if (command === `${prefix}delallhc`) {
        const files = fs.readdirSync(filesDir);
        if (files.length === 0) return sock.sendMessage(sender, { text: "⚠️ Folder kosong." });
        
        files.forEach(f => fs.unlinkSync(path.join(filesDir, f)));
        return sock.sendMessage(sender, { text: `✅ Berhasil menghapus ${files.length} file.` });
    }

    // --- MENU FILE (#wintuneling / list) ---
    // Jika user mengetik #wintuneling, kita anggap dia ingin LIST SEMUA file
    // Sesuai request: "untuk memanggil semua file #wintuneling"
    if (message.trim().toLowerCase() === '#wintuneling') {
        const files = fs.readdirSync(filesDir).filter(f => f.endsWith('.hc'));
        if (files.length === 0) return sock.sendMessage(sender, { text: "📂 Belum ada file tersimpan." });
        
        let txt = `📂 *LIST FILE .HC*\n\n`;
        files.forEach((f, i) => {
            txt += `${i+1}. ${f.replace('.hc', '')}\n`;
        });
        txt += `\n_Ketik #namafile untuk mengambil._`;
        return sock.sendMessage(sender, { text: txt });
    }
}

export default fileManager;
