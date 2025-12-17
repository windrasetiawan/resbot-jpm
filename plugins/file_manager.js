import fs from "fs";
import path from "path";
import { downloadAndSaveMedia } from "../lib/utils.js";

const filesDir = './ADDTIONAL/files';
if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir, { recursive: true });

async function fileManager(sock, sender, message, key, messageEvent) {
    const parts = message.trim().split(" ");
    const cmd = parts[0]?.toLowerCase();
    const q = parts.slice(1).join(" ");

    // ADD FILE
    if (cmd === ".addhc" || cmd === ".addfile") {
        if (!q) return sock.sendMessage(sender, { text: "⚠️ Beri nama file!" });
        const name = q.endsWith('.hc') ? q : q + '.hc';
        
        // Ambil pesan dokumen (baik langsung atau quoted)
        let media = messageEvent.messages[0]?.message?.documentMessage 
                 || messageEvent.messages[0]?.message?.extendedTextMessage?.contextInfo?.quotedMessage?.documentMessage;
        
        if (media) {
             // Mock object message untuk download
             const msgObj = { message: { documentMessage: media } };
             if (await downloadAndSaveMedia(sock, msgObj, name, "../ADDTIONAL/files")) {
                 return sock.sendMessage(sender, { text: `✅ File ${name} tersimpan!` });
             }
        } else {
             return sock.sendMessage(sender, { text: "⚠️ Reply file dokumen!" });
        }
    }

    // DEL FILE
    if (cmd === ".delhc") {
        const p = path.join(filesDir, q.endsWith('.hc') ? q : q + '.hc');
        if (fs.existsSync(p)) { fs.unlinkSync(p); return sock.sendMessage(sender, { text: "✅ Terhapus." }); }
    }
    
    // DEL ALL
    if (cmd === ".delallhc") {
        fs.readdirSync(filesDir).forEach(f => fs.unlinkSync(path.join(filesDir, f)));
        return sock.sendMessage(sender, { text: "✅ Semua file dihapus." });
    }
}
export default fileManager;
