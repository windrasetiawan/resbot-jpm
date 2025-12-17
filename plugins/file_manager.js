import fs from "fs";
import path from "path";
import { downloadAndSaveMedia } from "../lib/utils.js";

const filesDir = './ADDTIONAL/files'; // Pastikan path ini sesuai
if (!fs.existsSync(filesDir)) {
    // Buat folder parent jika belum ada
    if (!fs.existsSync('./ADDTIONAL')) fs.mkdirSync('./ADDTIONAL');
    fs.mkdirSync(filesDir);
}

// FIX: Argumen ke-5 adalah 'msg' (objek pesan tunggal), bukan 'messageEvent'
async function fileManager(sock, sender, message, key, msg) {
    const parts = message.trim().split(" ");
    const cmd = parts[0]?.toLowerCase();
    const q = parts.slice(1).join(" ");

    // --- ADD FILE (.addhc <nama>) ---
    if (cmd === ".addhc" || cmd === ".addfile") {
        if (!q) return sock.sendMessage(sender, { text: "⚠️ Masukkan nama file! Contoh: .addhc indosat" }, { quoted: msg });
        
        const name = q.endsWith('.hc') ? q : q + '.hc';
        
        // 1. Cek apakah dokumen dikirim langsung bersama caption
        // 2. Cek apakah dokumen ada di pesan yang di-reply (quoted)
        let media = msg.message?.documentMessage 
                 || msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.documentMessage;
        
        if (media) {
             // Mock object message agar fungsi downloadAndSaveMedia bisa membacanya
             const msgObj = { message: { documentMessage: media } };
             
             // Download dan simpan
             const success = await downloadAndSaveMedia(sock, msgObj, name, "../ADDTIONAL/files");
             
             if (success) {
                 return sock.sendMessage(sender, { text: `✅ File *${name}* berhasil disimpan!` }, { quoted: msg });
             } else {
                 return sock.sendMessage(sender, { text: "❌ Gagal menyimpan file." }, { quoted: msg });
             }
        } else {
             return sock.sendMessage(sender, { text: "⚠️ Silakan kirim dokumen dengan caption perintah, atau reply dokumen yang sudah ada." }, { quoted: msg });
        }
    }

    // --- DELETE FILE (.delhc <nama>) ---
    if (cmd === ".delhc") {
        if (!q) return sock.sendMessage(sender, { text: "⚠️ Masukkan nama file yang akan dihapus." }, { quoted: msg });
        
        const name = q.endsWith('.hc') ? q : q + '.hc';
        const p = path.join(filesDir, name);
        
        if (fs.existsSync(p)) { 
            fs.unlinkSync(p); 
            return sock.sendMessage(sender, { text: `✅ File *${name}* telah dihapus.` }, { quoted: msg }); 
        } else {
            return sock.sendMessage(sender, { text: "❌ File tidak ditemukan." }, { quoted: msg });
        }
    }
    
    // --- DELETE ALL (.delallhc) ---
    if (cmd === ".delallhc") {
        try {
            const files = fs.readdirSync(filesDir);
            files.forEach(f => fs.unlinkSync(path.join(filesDir, f)));
            return sock.sendMessage(sender, { text: "✅ Semua file di database telah dihapus." }, { quoted: msg });
        } catch (e) {
            console.error(e);
            return sock.sendMessage(sender, { text: "❌ Terjadi kesalahan saat menghapus." }, { quoted: msg });
        }
    }
}

export default fileManager;
