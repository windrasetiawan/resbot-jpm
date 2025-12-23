import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { downloadAndSaveMedia, isOwner } from "../lib/utils.js";

async function hcFeatures(sock, chatId, text, key, msg) {
    const cmd = text.split(" ")[0].toLowerCase();
    const args = text.split(" ").slice(1).join(" ");
    
    // Pastikan folder database tersedia
    const dbHC = "./DATABASE/HC";
    if (!fs.existsSync(dbHC)) fs.mkdirSync(dbHC, { recursive: true });
    
    const isCreator = isOwner(msg.key.participant || msg.key.remoteJid);

    // ==========================================
    // 1. .addhc (Simpan Manual dari Reply)
    // ==========================================
    if (cmd === ".addhc" && isCreator) {
        const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!q?.documentMessage) return sock.sendMessage(chatId, { text: "❌ Reply file dokumen!" });
        
        const name = args || q.documentMessage.fileName;
        const targetPath = path.join(dbHC, name);

        // Bersihkan file/folder lama jika ada
        if (fs.existsSync(targetPath)) {
            fs.rmSync(targetPath, { recursive: true, force: true });
        }

        const p = await downloadAndSaveMedia(sock, q, name);
        fs.renameSync(p, targetPath);
        return sock.sendMessage(chatId, { text: `✅ Saved: ${name}` });
    }

    // ==========================================
    // 2. #uploadhc (Upload ZIP -> Flatten & Replace)
    // ==========================================
    if (cmd === "#uploadhc" && isCreator) {
        const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const isZip = q?.documentMessage?.fileName.endsWith(".zip") || q?.documentMessage?.mimetype === "application/zip";
        
        if (!isZip) return sock.sendMessage(chatId, { text: "❌ Reply file ZIP!" });

        try {
            const p = await downloadAndSaveMedia(sock, q, "temp.zip");
            const zip = new AdmZip(p);
            const zipEntries = zip.getEntries();

            let count = 0;
            
            zipEntries.forEach((entry) => {
                // Pastikan bukan folder & bukan file sampah sistem
                if (!entry.isDirectory) {
                    const filename = entry.name; // Ambil nama file saja (flatten)
                    
                    if (filename && !filename.startsWith('.') && !filename.startsWith('__')) {
                        const targetPath = path.join(dbHC, filename);
                        
                        // Hapus file/folder lama jika ada (agar tidak error EISDIR/EEXIST)
                        if (fs.existsSync(targetPath)) {
                            fs.rmSync(targetPath, { recursive: true, force: true });
                        }
                        
                        // Simpan file baru
                        fs.writeFileSync(targetPath, entry.getData());
                        count++;
                    }
                }
            });

            fs.unlinkSync(p); // Hapus temp zip
            
            if (count > 0) {
                return sock.sendMessage(chatId, { text: `✅ Sukses!\n📂 ${count} file diekstrak & disimpan.\n(Folder lama dibersihkan)` });
            } else {
                return sock.sendMessage(chatId, { text: "⚠️ File ZIP kosong atau tidak valid." });
            }

        } catch (e) {
            console.error(e);
            return sock.sendMessage(chatId, { text: `❌ Error: ${e.message}` });
        }
    }

    // ==========================================
    // 3. #wintuneling (Kirim Semua Config)
    // ==========================================
    if (cmd === "#wintuneling") {
        const files = fs.readdirSync(dbHC);
        // Filter hanya file
        const validFiles = files.filter(f => fs.statSync(path.join(dbHC, f)).isFile());

        if (validFiles.length === 0) return sock.sendMessage(chatId, { text: "📂 Database Kosong." });
        
        await sock.sendMessage(chatId, { text: `🚀 Mengirim ${validFiles.length} file...` });

        for (const f of validFiles) {
            try {
                await sock.sendMessage(chatId, { 
                    document: fs.readFileSync(path.join(dbHC, f)), 
                    fileName: f, 
                    mimetype: 'application/octet-stream',
                    caption: "" 
                });
                await new Promise(r => setTimeout(r, 2000)); // Delay
            } catch {}
        }
        return sock.sendMessage(chatId, { text: "✅ Selesai." });
    }

    // ==========================================
    // 4. .listhc (Cek Daftar File)
    // ==========================================
    if (cmd === ".listhc") {
        const files = fs.readdirSync(dbHC);
        const validFiles = files.filter(f => fs.statSync(path.join(dbHC, f)).isFile());
        
        if (validFiles.length === 0) return sock.sendMessage(chatId, { text: "📂 Database Kosong." });
        
        let t = `📂 *DATABASE CONFIG (${validFiles.length})*\n\n` + validFiles.map((f, i) => `${i+1}. #${f}`).join("\n");
        return sock.sendMessage(chatId, { text: t });
    }

    // ==========================================
    // 5. #namafile (Pencarian Parsial)
    // ==========================================
    if (text.startsWith("#") && cmd !== "#uploadhc" && cmd !== "#wintuneling") {
        const query = text.slice(1).trim().toLowerCase();
        if (!query) return;

        const files = fs.readdirSync(dbHC);
        // Filter hanya file
        const validFiles = files.filter(f => fs.statSync(path.join(dbHC, f)).isFile());
        
        // Cari yang mengandung kata kunci
        const matched = validFiles.filter(f => f.toLowerCase().includes(query));

        if (matched.length === 0) {
            return sock.sendMessage(chatId, { text: `❌ File "${query}" tidak ditemukan.` });
        } else if (matched.length === 1) {
            const f = matched[0];
            return sock.sendMessage(chatId, { 
                document: fs.readFileSync(path.join(dbHC, f)), 
                fileName: f, 
                mimetype: 'application/octet-stream',
                caption: "" 
            });
        } else {
            let list = `🔍 *Ditemukan ${matched.length} file mirip:*\n\n`;
            list += matched.map((f, i) => `${i+1}. #${f}`).join("\n");
            list += `\n⚠️ Ketik nama lebih spesifik.`;
            return sock.sendMessage(chatId, { text: list });
        }
    }

    // ==========================================
    // 6. .delhc (Hapus Satu File)
    // ==========================================
    if (cmd === ".delhc" && isCreator) {
        const fileName = args;
        const p = path.join(dbHC, fileName);
        
        if (fs.existsSync(p)) { 
            fs.rmSync(p, { recursive: true, force: true }); // Aman untuk file & folder
            return sock.sendMessage(chatId, { text: `✅ Berhasil menghapus ${fileName}` }); 
        } else { 
            return sock.sendMessage(chatId, { text: "❌ File tidak ditemukan." }); 
        }
    }

    // ==========================================
    // 7. .delallhc (Hapus SEMUA File Database) - BARU
    // ==========================================
    if (cmd === ".delallhc" && isCreator) {
        try {
            const files = fs.readdirSync(dbHC);
            if (files.length === 0) return sock.sendMessage(chatId, { text: "⚠️ Database HC sudah kosong." });

            let count = 0;
            // Loop semua file dan hapus satu per satu
            files.forEach(file => {
                const filePath = path.join(dbHC, file);
                // rmSync dengan recursive:true menghapus file maupun folder dengan aman
                fs.rmSync(filePath, { recursive: true, force: true });
                count++;
            });

            return sock.sendMessage(chatId, { text: `✅ *SUKSES MENGHAPUS DATABASE*\n\n🗑️ Total: ${count} item dihapus bersih.` });
        } catch (e) {
            console.error(e);
            return sock.sendMessage(chatId, { text: `❌ Gagal menghapus: ${e.message}` });
        }
    }
}

export default hcFeatures;
