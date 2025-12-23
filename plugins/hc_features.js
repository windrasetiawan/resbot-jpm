import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { downloadAndSaveMedia, isOwner } from "../lib/utils.js";

async function hcFeatures(sock, chatId, text, key, msg) {
    const cmd = text.split(" ")[0].toLowerCase();
    const args = text.split(" ").slice(1).join(" ");
    const dbHC = "./DATABASE/HC";
    if (!fs.existsSync(dbHC)) fs.mkdirSync(dbHC, { recursive: true });
    const isCreator = isOwner(msg.key.participant || msg.key.remoteJid);

    // .addhc (Simpan)
    if (cmd === ".addhc" && isCreator) {
        const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!q?.documentMessage) return sock.sendMessage(chatId, { text: "Reply file!" });
        const name = args || q.documentMessage.fileName;
        const p = await downloadAndSaveMedia(sock, q, name);
        fs.renameSync(p, path.join(dbHC, name));
        return sock.sendMessage(chatId, { text: `✅ Saved: ${name}` });
    }

    // #uploadhc (Zip to DB)
    if (cmd === "#uploadhc" && isCreator) {
        const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!q?.documentMessage?.fileName.endsWith(".zip")) return;
        const p = await downloadAndSaveMedia(sock, q, "temp.zip");
        const zip = new AdmZip(p);
        zip.extractAllTo(dbHC, true);
        fs.unlinkSync(p);
        return sock.sendMessage(chatId, { text: "✅ Extracted." });
    }

    // #wintuneling (Kirim semua 1 per 1, no caption, delay)
    if (cmd === "#wintuneling") {
        const files = fs.readdirSync(dbHC);
        if (files.length === 0) return sock.sendMessage(chatId, { text: "📂 Kosong." });
        await sock.sendMessage(chatId, { text: `🚀 Mengirim ${files.length} config...` });

        for (const f of files) {
            try {
                await sock.sendMessage(chatId, { 
                    document: fs.readFileSync(path.join(dbHC, f)), 
                    fileName: f, 
                    mimetype: 'application/octet-stream',
                    caption: "" // NO CAPTION
                });
                await new Promise(r => setTimeout(r, 2000)); // DELAY 2 DETIK
            } catch {}
        }
        return sock.sendMessage(chatId, { text: "✅ Selesai." });
    }

    // .listhc
    if (cmd === ".listhc") {
        const files = fs.readdirSync(dbHC);
        let t = `📂 *DATABASE (${files.length})*\n` + files.map((f, i) => `${i+1}. #${f}`).join("\n");
        return sock.sendMessage(chatId, { text: t });
    }

    // #namafile (Ambil 1 file, no caption)
    if (text.startsWith("#") && cmd !== "#uploadhc" && cmd !== "#wintuneling") {
        const f = text.slice(1).trim();
        const p = path.join(dbHC, f);
        if (fs.existsSync(p)) {
            return sock.sendMessage(chatId, { 
                document: fs.readFileSync(p), 
                fileName: f, 
                mimetype: 'application/octet-stream',
                caption: "" // NO CAPTION
            });
        }
    }

    // .delhc
    if (cmd === ".delhc" && isCreator) {
        const p = path.join(dbHC, args);
        if (fs.existsSync(p)) { fs.unlinkSync(p); return sock.sendMessage(chatId, { text: "✅ Dihapus." }); }
    }
}
export default hcFeatures;
