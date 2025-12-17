import fs from "fs";
import path from "path";
import { downloadAndSaveMedia } from "../lib/utils.js";

const filesDir = './ADDTIONAL/files'; 

// Buat folder jika belum ada
if (!fs.existsSync(filesDir)) {
    if (!fs.existsSync('./ADDTIONAL')) fs.mkdirSync('./ADDTIONAL');
    fs.mkdirSync(filesDir);
}

// FIX: Menerima 'msg' (objek pesan) agar tidak crash
async function fileManager(sock, sender, message, key, msg) {
    const parts = message.trim().split(" ");
    const cmd = parts[0]?.toLowerCase();
    const q = parts.slice(1).join(" ");

    // --- 1. ADD FILE ---
    if (cmd === ".addhc" || cmd === ".addfile") {
        if (!q) return sock.sendMessage(sender, { text: "⚠️ Masukkan nama file! Contoh: .addhc indosat" }, { quoted: msg });
        
        const name = q.endsWith('.hc') ? q : q + '.hc';
        
        // Cek dokumen (baik dikirim langsung atau direply)
        let media = msg.message?.documentMessage 
                 || msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.documentMessage;
        
        if (media) {
             const msgObj = { message: { documentMessage: media } };
             // Download ke folder ADDTIONAL/files
             const success = await downloadAndSaveMedia(sock, msgObj, name, "../ADDTIONAL/files");
             
             if (success) {
                 return sock.sendMessage(sender, { text: `✅ File *${name}* berhasil disimpan!\nAmbil dengan ketik: *#${name.replace('.hc','')}*` }, { quoted: msg });
             } else {
                 return sock.sendMessage(sender, { text: "❌ Gagal menyimpan file." }, { quoted: msg });
             }
        } else {
             return sock.sendMessage(sender, { text: "⚠️ Reply file dokumen atau kirim dokumen dengan caption!" }, { quoted: msg });
        }
    }

    // --- 2. DELETE FILE ---
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

    // --- 3. DELETE ALL ---
    if (cmd === ".delallhc") {
        try {
            const files = fs.readdirSync(filesDir);
            files.forEach(f => fs.unlinkSync(path.join(filesDir, f)));
            return sock.sendMessage(sender, { text: "✅ Semua file di database telah dihapus." }, { quoted: msg });
        } catch (e) {
            return sock.sendMessage(sender, { text: "❌ Gagal menghapus semua file." }, { quoted: msg });
        }
    }

    // --- 4. LIST FILE (.listhc) ---
    // Sekarang fitur ini ada di sini, jadi tidak perlu file hc_features.js terpisah
    if (cmd === ".listhc" || cmd === ".listconfig") {
        try {
            if (!fs.existsSync(filesDir)) return sock.sendMessage(sender, { text: "❌ Folder database belum dibuat." }, { quoted: msg });
            
            const files = fs.readdirSync(filesDir);
            // Filter file (opsional: hanya tampilkan .hc)
            // const hcFiles = files.filter(f => f.endsWith('.hc')); 

            if (files.length === 0) {
                return sock.sendMessage(sender, { text: "📂 *DATABASE KOSONG*\nBelum ada file yang diupload." }, { quoted: msg });
            }

            let text = `📂 *LIST FILE CONFIG* (Total: ${files.length})\n\n`;
            files.forEach((file, index) => {
                text += `${index + 1}. ${file}\n`;
            });
            text += `\n🚀 *Cara Ambil Cepat:*\nKetik tanda pagar + nama file.\nContoh: *#${files[0].replace('.hc','')}*`;
            
            return sock.sendMessage(sender, { text: text }, { quoted: msg });
        } catch (e) {
            console.error(e);
            return sock.sendMessage(sender, { text: "❌ Error membaca database." }, { quoted: msg });
        }
    }

    // --- 5. GET FILE (.gethc) ---
    // Alternatif jika user tidak mau pakai #
    if (cmd === ".gethc") {
        if (!q) return sock.sendMessage(sender, { text: "⚠️ Masukkan nama file!" }, { quoted: msg });
        
        // Cek dengan ekstensi atau tanpa ekstensi
        let filename = q;
        if (!fs.existsSync(path.join(filesDir, filename)) && fs.existsSync(path.join(filesDir, filename + '.hc'))) {
            filename += '.hc';
        }

        const filePath = path.join(filesDir, filename);
        if (fs.existsSync(filePath)) {
            await sock.sendMessage(sender, { 
                document: fs.readFileSync(filePath), 
                mimetype: 'application/octet-stream', 
                fileName: filename,
                caption: `✅ File: ${filename}`
            }, { quoted: msg });
        } else {
            return sock.sendMessage(sender, { text: "❌ File tidak ditemukan." }, { quoted: msg });
        }
    }
}

export default fileManager;
