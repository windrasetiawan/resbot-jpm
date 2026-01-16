import fs from "fs";
import { downloadAndSaveMedia } from "../lib/utils.js";

async function hcFeatures(sock, chatId, text, key, msg) {
    const cmd = text.split(" ")[0].toLowerCase();
    // Cek command
    const isHcCmd = [".addhc", ".listhc", ".delhc", "#delallhc", "#wintuneling"].includes(cmd) || text.startsWith("#");

    if (!isHcCmd) return;

    // --- HUMANIZED START ---
    // Efek mengetik agar natural
    await sock.sendPresenceUpdate('composing', chatId);
    // Jeda acak (0.8 - 1.6 detik)
    await new Promise(r => setTimeout(r, 800 + Math.random() * 800));

    try {
        const dbPath = "./DATABASE/data_grub.json"; 
        
        // Pastikan database ada
        if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, "[]");
        let data = JSON.parse(fs.readFileSync(dbPath));

        // 1. ADD HC (Simpan File)
        if (cmd === ".addhc") {
            if (!msg.message.documentMessage) {
                await sock.sendPresenceUpdate('paused', chatId);
                return sock.sendMessage(chatId, { text: "⚠️ Reply file dokumen/script yang mau disimpan!" });
            }
            
            const fileName = msg.message.documentMessage.fileName;

            // Cek Duplikat
            if (data.some(item => item.name === fileName)) {
                await sock.sendPresenceUpdate('paused', chatId);
                return sock.sendMessage(chatId, { text: "⚠️ File dengan nama tersebut sudah ada." });
            }
            
            // Download File
            const filePath = await downloadAndSaveMedia(sock, msg, fileName);
            
            // Simpan ke Database
            data.push({ name: fileName, path: filePath });
            fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));

            await sock.sendMessage(chatId, { text: `✅ File *${fileName}* berhasil ditambahkan ke database.` });
        }

        // 2. LIST HC (Lihat Daftar)
        else if (cmd === ".listhc") {
            if (data.length === 0) {
                await sock.sendMessage(chatId, { text: "📂 Database kosong." });
            } else {
                let txt = "📂 *LIST FILE TERSIMPAN:*\n\n";
                data.forEach((item, index) => {
                    txt += `${index + 1}. ${item.name}\n`;
                });
                txt += "\nKetik *#namafile* untuk ambil satu.\nKetik *#wintuneling* untuk ambil SEMUA (Tanpa Caption).";
                await sock.sendMessage(chatId, { text: txt });
            }
        }

        // 3. DEL HC (Hapus Satu)
        else if (cmd === ".delhc") {
            const query = text.split(" ").slice(1).join(" ");
            if (!query) return sock.sendMessage(chatId, { text: "⚠️ Masukkan nama file. Contoh: .delhc script.js" });

            const index = data.findIndex(item => item.name === query);
            if (index !== -1) {
                try { fs.unlinkSync(data[index].path); } catch (e) {}
                data.splice(index, 1);
                fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
                await sock.sendMessage(chatId, { text: `✅ File *${query}* berhasil dihapus.` });
            } else {
                await sock.sendMessage(chatId, { text: "❌ File tidak ditemukan." });
            }
        }

        // 4. DEL ALL (Hapus Semua)
        else if (cmd === "#delallhc") {
            if (data.length === 0) return sock.sendMessage(chatId, { text: "📂 Database sudah kosong." });

            data.forEach(item => {
                try { fs.unlinkSync(item.path); } catch (e) {}
            });

            fs.writeFileSync(dbPath, "[]");
            await sock.sendMessage(chatId, { text: "✅ Semua file database telah dihapus bersih." });
        }

        // 5. SEND ALL (#wintuneling) - NO CAPTION
        else if (cmd === "#wintuneling") {
            if (data.length === 0) {
                return sock.sendMessage(chatId, { text: "📂 Database kosong." });
            }

            await sock.sendMessage(chatId, { text: `🚀 Mengirim ${data.length} file (Tanpa Caption)...` });

            // Loop semua file
            for (let item of data) {
                if (fs.existsSync(item.path)) {
                    // Kirim File POLOSAN (Tanpa Caption sama sekali)
                    await sock.sendMessage(chatId, { 
                        document: fs.readFileSync(item.path), 
                        fileName: item.name, 
                        mimetype: 'application/octet-stream'
                        // caption: "" <--- Dihapus total agar aman
                    });
                    
                    // Jeda Aman (Delay) per file (2-4 detik)
                    await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000));
                }
            }
            await sock.sendMessage(chatId, { text: "✅ Selesai." });
        }
        
        // 6. GET ONE (#namafile) - NO CAPTION
        else if (text.startsWith("#")) {
            const query = text.replace("#", "").trim();
            const fileData = data.find(item => item.name === query);

            if (fileData) {
                if (fs.existsSync(fileData.path)) {
                    await sock.sendMessage(chatId, { 
                        document: fs.readFileSync(fileData.path), 
                        fileName: fileData.name, 
                        mimetype: 'application/octet-stream'
                        // Caption dihapus juga disini
                    }, { quoted: msg });
                } else {
                    await sock.sendMessage(chatId, { text: "❌ File fisik hilang." });
                }
            } 
        }

    } catch (e) {
        console.error("HC Error:", e);
        sock.sendMessage(chatId, { text: "❌ Terjadi kesalahan sistem database." });
    } finally {
        // Stop status mengetik
        await sock.sendPresenceUpdate('paused', chatId);
    }
}

export default hcFeatures;
