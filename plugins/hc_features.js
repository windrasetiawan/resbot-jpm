import fs from "fs";
import path from "path";

const folderHC = './DATABASE/hc';

// Pastikan folder ada
if (!fs.existsSync(folderHC)) {
    if (!fs.existsSync('./DATABASE')) fs.mkdirSync('./DATABASE');
    fs.mkdirSync(folderHC);
}

async function hcFeatures(sock, chatId, message, key, msg) {
    const parts = message.trim().split(" ");
    const command = parts[0]?.toLowerCase().substring(1);
    const q = parts.slice(1).join(" ");

    // --- LIST HC ---
    if (command === "listhc" || command === "listconfig") {
        try {
            const files = fs.readdirSync(folderHC);
            const hcFiles = files.filter(f => f.endsWith('.hc')); 

            if (hcFiles.length === 0) {
                return sock.sendMessage(chatId, { text: "📂 *DATABASE HC KOSONG*\nBelum ada file .hc yang diupload ke folder database." }, { quoted: msg });
            }

            let text = `📂 *LIST CONFIG HC* (Total: ${hcFiles.length})\n\n`;
            hcFiles.forEach((file, index) => {
                text += `${index + 1}. ${file}\n`;
            });
            text += `\n📥 *Cara Ambil:*\nKetik: .gethc <namafile>`;
            
            return sock.sendMessage(chatId, { text: text }, { quoted: msg });

        } catch (e) {
            console.error(e);
            return sock.sendMessage(chatId, { text: "❌ Gagal membaca folder database." }, { quoted: msg });
        }
    }

    // --- GET HC ---
    if (command === "gethc") {
        if (!q) return sock.sendMessage(chatId, { text: "⚠️ Masukkan nama file!\nContoh: *.gethc indosat.hc*" }, { quoted: msg });

        const filename = q.trim();
        const filePath = path.join(folderHC, filename);

        if (fs.existsSync(filePath)) {
            await sock.sendMessage(chatId, { 
                document: fs.readFileSync(filePath), 
                mimetype: 'application/octet-stream', 
                fileName: filename,
                caption: `✅ File Config: ${filename}`
            }, { quoted: msg });
        } else {
            return sock.sendMessage(chatId, { text: "❌ File tidak ditemukan! Pastikan nama file sesuai di .listhc" }, { quoted: msg });
        }
    }
}

export default hcFeatures;
