import fs from "fs";
import path from "path";

// Tentukan lokasi folder HC
const folderHC = './DATABASE/hc';

// Pastikan folder ada saat file dimuat
if (!fs.existsSync(folderHC)) {
    // Membuat folder secara rekursif jika DATABASE/hc belum ada
    if (!fs.existsSync('./DATABASE')) fs.mkdirSync('./DATABASE');
    fs.mkdirSync(folderHC);
}

async function hcFeatures(sock, chatId, message, key, messageEvent) {
    const parts = message.trim().split(" ");
    const command = parts[0]?.toLowerCase().substring(1); // remove prefix
    const q = parts.slice(1).join(" ");

    // --- LIST HC ---
    if (command === "listhc" || command === "listconfig") {
        try {
            const files = fs.readdirSync(folderHC);
            const hcFiles = files.filter(f => f.endsWith('.hc')); // Filter hanya .hc

            if (hcFiles.length === 0) {
                return sock.sendMessage(chatId, { text: "❌ Belum ada file HC di database." }, { quoted: key });
            }

            let text = `📂 *LIST CONFIG HC* 📂\n\n`;
            hcFiles.forEach((file, index) => {
                text += `${index + 1}. ${file}\n`;
            });
            text += `\n📥 Ambil: .gethc <namafile>`;
            
            return sock.sendMessage(chatId, { text: text }, { quoted: key });

        } catch (e) {
            console.error(e);
            return sock.sendMessage(chatId, { text: "❌ Error membaca database." });
        }
    }

    // --- GET HC ---
    if (command === "gethc") {
        if (!q) return sock.sendMessage(chatId, { text: "⚠️ Masukkan nama file! Contoh: .gethc config.hc" }, { quoted: key });

        const filename = q.trim();
        const filePath = path.join(folderHC, filename);

        if (fs.existsSync(filePath)) {
            await sock.sendMessage(chatId, { 
                document: fs.readFileSync(filePath), 
                mimetype: 'application/octet-stream', 
                fileName: filename,
                caption: `✅ File Config: ${filename}`
            }, { quoted: key });
        } else {
            return sock.sendMessage(chatId, { text: "❌ File tidak ditemukan. Cek .listhc" }, { quoted: key });
        }
    }
    
    // --- ADD HC (Optional: Upload file via WA) ---
    // Jika Anda ingin upload file dari WA ke folder, tambahkan logic downloadMediaMessage di sini.
}

export default hcFeatures;
