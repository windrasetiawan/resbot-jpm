import fs from "fs";
import path from "path";
import AdmZip from "adm-zip"; 
import { downloadAndSaveMedia, isOwner } from "../lib/utils.js";

// FOLDER UTAMA
const targetDir = "./ADDTIONAL/files";
const tempDir = "./tmp_extract"; 

if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

function findHcFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            findHcFiles(filePath, fileList); 
        } else {
            if (file.endsWith('.hc')) {
                fileList.push(filePath);
            }
        }
    });
    return fileList;
}

async function hcFeatures(sock, chatId, message, key, msg) {
    const sender = msg.key.participant || msg.key.remoteJid;
    const parts = message.trim().split(" ");
    
    let rawCmd = parts[0]?.toLowerCase();
    let command = rawCmd;
    if (command.startsWith(".") || command.startsWith("#")) {
        command = command.substring(1);
    }
    
    const args = parts.slice(1).join(" "); 
    const isCreator = isOwner(sender);

    // 1. LIST CONFIG
    if (command === "listhc" || command === "listconfig") {
        try {
            const files = fs.readdirSync(targetDir).filter(f => f.endsWith('.hc')); 
            if (files.length === 0) return sock.sendMessage(chatId, { text: "📂 *DATABASE KOSONG*" }, { quoted: msg });

            let text = `📂 *STOK CONFIG HC* (Total: ${files.length})\n\n`;
            files.forEach((file, index) => {
                text += `${index + 1}. ${file}\n`;
            });
            text += `\n🚀 *Shortcut:*\nKetik tanda pagar + nama file.\nContoh: *#${files[0].replace('.hc','')}*`;
            return sock.sendMessage(chatId, { text: text }, { quoted: msg });
        } catch (e) {
            return sock.sendMessage(chatId, { text: "❌ Error database." }, { quoted: msg });
        }
    }

    // 2. AMBIL FILE (MANUAL)
    if (command === "gethc") {
        if (!args) return sock.sendMessage(chatId, { text: "⚠️ Masukkan nama file!" }, { quoted: msg });

        const filename = args.trim();
        const allFiles = fs.readdirSync(targetDir);
        const matchFile = allFiles.find(f => f.toLowerCase() === filename.toLowerCase()) || 
                          allFiles.find(f => f.toLowerCase() === (filename + '.hc').toLowerCase());

        if (matchFile) {
            await sock.sendMessage(chatId, { 
                document: fs.readFileSync(path.join(targetDir, matchFile)), 
                mimetype: 'application/octet-stream', 
                fileName: matchFile,
                caption: `✅ Config: ${matchFile}`
            }, { quoted: msg });
        } else {
            return sock.sendMessage(chatId, { text: "❌ File tidak ditemukan." }, { quoted: msg });
        }
    }

    // 3. KIRIM SEMUA (BULK SEND)
    if (message.trim().toLowerCase() === "#wintuneling") {
        const files = fs.readdirSync(targetDir).filter(f => f.endsWith('.hc'));
        if (files.length === 0) return sock.sendMessage(chatId, { text: "⚠️ Config belum ready." }, { quoted: msg });

        await sock.sendMessage(chatId, { text: `🚀 Mengirim ${files.length} file config...` }, { quoted: msg });

        for (let f of files) {
            try {
                await sock.sendMessage(chatId, { 
                    document: fs.readFileSync(path.join(targetDir, f)), 
                    mimetype: 'application/octet-stream', 
                    fileName: f
                }, { quoted: msg });
                await new Promise(r => setTimeout(r, 1500)); 
            } catch (e) {}
        }
        return; 
    }

    // 4. ADMIN FEATURES (Add, Del, Update, Clear)
    if (command === "addhc" || command === "addfile") {
        if (!isCreator) return sock.sendMessage(chatId, { text: "❌ Khusus Owner!" }, { quoted: msg });
        if (!args) return sock.sendMessage(chatId, { text: "⚠️ Masukkan nama file!" }, { quoted: msg });

        const name = args.endsWith('.hc') ? args : args + '.hc';
        let media = msg.message?.documentMessage || msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.documentMessage;
        
        if (media) {
             const success = await downloadAndSaveMedia(sock, { message: { documentMessage: media } }, name, "ADDTIONAL/files");
             if (success) return sock.sendMessage(chatId, { text: `✅ File *${name}* tersimpan!` }, { quoted: msg });
             return sock.sendMessage(chatId, { text: "❌ Gagal menyimpan file." }, { quoted: msg });
        }
        return sock.sendMessage(chatId, { text: "⚠️ Kirim file dokumennya!" }, { quoted: msg });
    }

    if (command === "delhc") {
        if (!isCreator) return sock.sendMessage(chatId, { text: "❌ Khusus Owner!" }, { quoted: msg });
        if (!args) return sock.sendMessage(chatId, { text: "⚠️ Masukkan nama file!" }, { quoted: msg });
        
        const name = args.endsWith('.hc') ? args : args + '.hc';
        const p = path.join(targetDir, name);
        if (fs.existsSync(p)) { fs.unlinkSync(p); return sock.sendMessage(chatId, { text: `✅ Dihapus: ${name}` }, { quoted: msg }); }
        return sock.sendMessage(chatId, { text: "❌ File tidak ditemukan." }, { quoted: msg });
    }

    if (command === "updatehc") {
        if (!isCreator) return sock.sendMessage(chatId, { text: "❌ Khusus Owner!" }, { quoted: msg });
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const document = msg.message?.documentMessage || quoted?.documentMessage;

        if (!document?.fileName?.endsWith(".zip")) return sock.sendMessage(chatId, { text: "⚠️ Kirim file .zip dengan caption .updatehc" }, { quoted: msg });
        
        await sock.sendMessage(chatId, { text: "⏳ Update via Zip..." }, { quoted: msg });
        try {
            const zipName = "temp.zip";
            await downloadAndSaveMedia(sock, document.fileName ? msg : { message: quoted }, zipName, "tmp");
            const zipPath = path.join("./tmp", zipName);

            // Bersihkan folder lama
            const oldFiles = fs.readdirSync(targetDir).filter(f => f.endsWith('.hc'));
            oldFiles.forEach(f => fs.unlinkSync(path.join(targetDir, f)));

            // Ekstrak ZIP
            const zip = new AdmZip(zipPath);
            if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
            fs.mkdirSync(tempDir);
            zip.extractAllTo(tempDir, true);

            // Cari & Pindahkan
            const foundFiles = findHcFiles(tempDir);
            foundFiles.forEach(src => fs.renameSync(src, path.join(targetDir, path.basename(src))));

            fs.unlinkSync(zipPath);
            fs.rmSync(tempDir, { recursive: true, force: true });

            return sock.sendMessage(chatId, { text: `✅ *UPDATE SUKSES*\nTotal: ${foundFiles.length} file .hc` }, { quoted: msg });
        } catch (e) { return sock.sendMessage(chatId, { text: `❌ Gagal: ${e.message}` }, { quoted: msg }); }
    }

    if (command === "clearhc") {
        if (!isCreator) return;
        const files = fs.readdirSync(targetDir).filter(f => f.endsWith('.hc'));
        files.forEach(f => fs.unlinkSync(path.join(targetDir, f)));
        return sock.sendMessage(chatId, { text: `✅ ${files.length} file dihapus.` }, { quoted: msg });
    }

    // 5. SHORTCUT #NAMAFILE
    if (rawCmd.startsWith("#")) {
        const query = rawCmd.substring(1); 
        const allFiles = fs.readdirSync(targetDir);
        
        const matchFile = allFiles.find(f => f.toLowerCase().includes(query) && f.endsWith('.hc'));

        if (matchFile) {
             await sock.sendMessage(chatId, { 
                document: fs.readFileSync(path.join(targetDir, matchFile)), 
                mimetype: 'application/octet-stream', 
                fileName: matchFile,
                caption: `✅ Config: ${matchFile}`
            }, { quoted: msg });
        }
    }
}

export default hcFeatures;
