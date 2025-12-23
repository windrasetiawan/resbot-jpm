import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { downloadAndSaveMedia, isOwner } from "../lib/utils.js";

async function hcFeatures(sock, chatId, text, key, msg) {
    const cmd = text.split(" ")[0].toLowerCase();
    const args = text.split(" ").slice(1).join(" ");
    const dbHC = "./DATABASE/HC";
    
    // Pastikan folder database HC ada
    if (!fs.existsSync(dbHC)) fs.mkdirSync(dbHC, { recursive: true });

    const isCreator = isOwner(msg.key.participant || msg.key.remoteJid);

    // --- 1. ADD HC (.addhc) ---
    if (cmd === ".addhc") {
        if (!isCreator) return;
        const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!q?.documentMessage) return sock.sendMessage(chatId, { text: "⚠️ Reply file config yang mau disimpan!" });
        
        const name = args || q.documentMessage.fileName;
        const p = await downloadAndSaveMedia(sock, q, name);
        fs.renameSync(p, path.join(dbHC, name));
        return sock.sendMessage(chatId, { text: `✅ File disimpan: *${name}*` });
    }

    // --- 2. UPLOAD HC ZIP (#uploadhc) ---
    if (cmd === "#uploadhc") {
        if (!isCreator) return;
        const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!q?.documentMessage?.fileName.endsWith(".zip")) return sock.sendMessage(chatId, { text: "⚠️ Reply file ZIP!" });
        
        const p = await downloadAndSaveMedia(sock, q, "temp.zip");
        try {
            const zip = new AdmZip(p);
            zip.extractAllTo(dbHC, true);
            fs.unlinkSync(p);
            return sock.sendMessage(chatId, { text: "✅ Berhasil Unzip ke Database." });
        } catch (e) {
            return sock.sendMessage(chatId, { text: "❌ File ZIP rusak atau tidak valid." });
        }
    }

    // --- 3. WINTUNELING (Kirim Semua File Satu Per Satu - No Caption) ---
    if (cmd === "#wintuneling") {
        const files = fs.readdirSync(dbHC);
        if (files.length === 0) return sock.sendMessage(chatId, { text: "📂 Database Config Kosong." });

        await sock.sendMessage(chatId, { text: `🚀 Mengirim ${files.length} file config...` });

        for (const file of files) {
            const filePath = path.join(dbHC, file);
            try {
                await sock.sendMessage(chatId, { 
                    document: fs.readFileSync(filePath), 
                    fileName: file,
                    mimetype: 'application/octet-stream',
                    caption: "" // Kosongkan caption untuk hindari spam filter
                });
                
                // Jeda 2 detik per file agar aman dari banned
                await new Promise(r => setTimeout(r, 2000)); 
            } catch (e) {
                console.error(`Gagal kirim: ${file}`);
            }
        }
        return sock.sendMessage(chatId, { text: "✅ Pengiriman selesai." });
    }

    // --- 4. LIST HC (.listhc) ---
    if (cmd === ".listhc") {
        const files = fs.readdirSync(dbHC);
        if (files.length === 0) return sock.sendMessage(chatId, { text: "📂 Database Kosong." });
        let txt = `📂 *DATABASE CONFIG (${files.length})*\n\n` + files.map((f, i) => `${i + 1}. #${f}`).join("\n");
        txt += `\n\n_Gunakan #wintuneling untuk ambil semua._`;
        return sock.sendMessage(chatId, { text: txt });
    }

    // --- 5. GET SINGLE FILE (#namafile - No Caption) ---
    if (text.startsWith("#") && cmd !== "#uploadhc" && cmd !== "#wintuneling") {
        const file = text.slice(1).trim();
        const p = path.join(dbHC, file);
        if (fs.existsSync(p)) {
            return sock.sendMessage(chatId, { 
                document: fs.readFileSync(p), 
                fileName: file,
                mimetype: 'application/octet-stream',
                caption: "" // Tanpa caption
            });
        }
    }

    // --- 6. DELETE HC (.delhc) ---
    if (cmd === ".delhc") {
        if (!isCreator) return;
        if (!args) return sock.sendMessage(chatId, { text: "⚠️ Contoh: .delhc namafile.hc" });
        const p = path.join(dbHC, args);
        if (fs.existsSync(p)) {
            fs.unlinkSync(p);
            return sock.sendMessage(chatId, { text: `✅ File *${args}* dihapus.` });
        }
    }
}

export default hcFeatures;
