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

    // 1. .addhc (Simpan Manual)
    if (cmd === ".addhc" && isCreator) {
        const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!q?.documentMessage) return sock.sendMessage(chatId, { text: "Reply file!" });
        const name = args || q.documentMessage.fileName;
        const p = await downloadAndSaveMedia(sock, q, name);
        fs.renameSync(p, path.join(dbHC, name));
        return sock.sendMessage(chatId, { text: `✅ Saved: ${name}` });
    }

    // 2. #uploadhc (Upload ZIP -> Flatten / Keluarkan File dari Folder)
    if (cmd === "#uploadhc" && isCreator) {
        const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        
        // Validasi apakah file zip
        const isZip = q?.documentMessage?.fileName.endsWith(".zip") || q?.documentMessage?.mimetype === "application/zip";
        if (!isZip) return sock.sendMessage(chatId, { text: "❌ Reply file ZIP!" });

        try {
            const p = await downloadAndSaveMedia(sock, q, "temp.zip");
            const zip = new AdmZip(p);
            const zipEntries = zip.getEntries();

            let count = 0;
            
            // Loop semua isi ZIP
            zipEntries.forEach((entry) => {
                // Pastikan entry adalah FILE (bukan folder)
                if (!entry.isDirectory) {
                    // entry.name = hanya nama file (misal: config.hc)
                    // entry.entryName = path lengkap (misal: folder/subfolder/config.hc)
                    // Kita pakai entry.name agar folder diabaikan dan file langsung ditaruh di luar
                    
                    const filename = entry.name;
                    
                    // Filter file sampah (misal .DS_Store atau __MACOSX)
                    if (filename && !filename.startsWith('.') && !filename.startsWith('__')) {
                        const targetPath = path.join(dbHC, filename);
                        
                        // Tulis file ke root folder database (otomatis timpa jika ada nama sama)
                        fs.writeFileSync(targetPath, entry.getData());
                        count++;
                    }
                }
            });

            fs.unlinkSync(p); // Hapus file temp
            
            if (count > 0) {
                return sock.sendMessage(chatId, { text: `✅ Ekstrak Sukses!\n📂 ${count} file berhasil dikeluarkan dari folder & disimpan.` });
            } else {
                return sock.sendMessage(chatId, { text: "⚠️ File ZIP kosong atau hanya berisi folder kosong." });
            }

        } catch (e) {
            console.error(e);
            return sock.sendMessage(chatId, { text: "❌ Gagal mengekstrak ZIP." });
        }
    }

    // 3. #wintuneling (Kirim Semua Config)
    if (cmd === "#wintuneling") {
        const files = fs.readdirSync(dbHC);
        if (files.length === 0) return sock.sendMessage(chatId, { text: "📂 Database Kosong." });
        
        await sock.sendMessage(chatId, { text: `🚀 Mengirim ${files.length} file...` });

        for (const f of files) {
            try {
                await sock.sendMessage(chatId, { 
                    document: fs.readFileSync(path.join(dbHC, f)), 
                    fileName: f, 
                    mimetype: 'application/octet-stream',
                    caption: "" 
                });
                // Delay agar tidak spamming berlebihan
                await new Promise(r => setTimeout(r, 2000)); 
            } catch {}
        }
        return sock.sendMessage(chatId, { text: "✅ Selesai dikirim." });
    }

    // 4. .listhc (Cek Daftar File)
    if (cmd === ".listhc") {
        const files = fs.readdirSync(dbHC);
        if (files.length === 0) return sock.sendMessage(chatId, { text: "📂 Kosong." });
        
        let t = `📂 *DATABASE CONFIG (${files.length})*\n\n` + files.map((f, i) => `${i+1}. #${f}`).join("\n");
        return sock.sendMessage(chatId, { text: t });
    }

    // 5. #namafile (Pencarian Parsial / Tidak Perlu Nama Lengkap)
    if (text.startsWith("#") && cmd !== "#uploadhc" && cmd !== "#wintuneling") {
        // Ambil kata kunci pencarian (hapus tanda #)
        const query = text.slice(1).trim().toLowerCase();
        if (!query) return;

        const files = fs.readdirSync(dbHC);
        
        // Cari file yang MENGANDUNG kata kunci (Simple Partial Search)
        const matched = files.filter(f => f.toLowerCase().includes(query));

        if (matched.length === 0) {
            return sock.sendMessage(chatId, { text: `❌ File dengan nama "${query}" tidak ditemukan.` });
        } else if (matched.length === 1) {
            // Jika cuma ketemu 1, langsung kirim
            const f = matched[0];
            return sock.sendMessage(chatId, { 
                document: fs.readFileSync(path.join(dbHC, f)), 
                fileName: f, 
                mimetype: 'application/octet-stream',
                caption: "" 
            });
        } else {
            // Jika ketemu banyak yang mirip, tampilkan daftarnya
            let list = `🔍 *Ditemukan ${matched.length} file mirip:*\n\n`;
            list += matched.map((f, i) => `${i+1}. #${f}`).join("\n");
            list += `\n⚠️ Harap ketik nama lebih spesifik.`;
            return sock.sendMessage(chatId, { text: list });
        }
    }

    // 6. .delhc (Hapus File)
    if (cmd === ".delhc" && isCreator) {
        const fileName = args;
        const p = path.join(dbHC, fileName);
        if (fs.existsSync(p)) { 
            fs.unlinkSync(p); 
            return sock.sendMessage(chatId, { text: `✅ File ${fileName} dihapus.` }); 
        } else { 
            return sock.sendMessage(chatId, { text: "❌ File tidak ditemukan." }); 
        }
    }
}

export default hcFeatures;
