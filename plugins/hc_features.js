import fs from "fs";
import path from "path";
import AdmZip from "adm-zip"; 
import archiver from "archiver"; 
import { downloadAndSaveMedia, isOwner } from "../lib/utils.js";

async function hcFeatures(sock, chatId, message, key, msg) {
    const sender = msg.key.participant || msg.key.remoteJid;
    const text = message.trim();
    const command = text.split(" ")[0].toLowerCase(); 
    const args = text.split(" ").slice(1).join(" ");
    const isCreator = isOwner(sender);

    const dbFolder = path.join(process.cwd(), "DATABASE", "HC");
    if (!fs.existsSync(dbFolder)) fs.mkdirSync(dbFolder, { recursive: true });

    // 1. ADD HC (Simpan 1 file)
    if (command === ".addhc") {
        if (!isCreator) return sock.sendMessage(chatId, { text: "🔒 Khusus Owner" }, { quoted: msg });
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quoted?.documentMessage) return sock.sendMessage(chatId, { text: "⚠️ Reply file config!" }, { quoted: msg });

        let fileName = args || quoted.documentMessage.fileName;
        try {
            const savedPath = await downloadAndSaveMedia(sock, quoted, fileName);
            fs.renameSync(savedPath, path.join(dbFolder, fileName));
            return sock.sendMessage(chatId, { text: `✅ File disimpan: *${fileName}*` }, { quoted: msg });
        } catch { return sock.sendMessage(chatId, { text: "❌ Gagal." }, { quoted: msg }); }
    }

    // 2. UPLOAD HC ZIP (Bulk Upload)
    if (command === "#uploadhc") {
        if (!isCreator) return sock.sendMessage(chatId, { text: "🔒 Khusus Owner" }, { quoted: msg });
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quoted?.documentMessage?.fileName.endsWith('.zip')) return sock.sendMessage(chatId, { text: "⚠️ Reply file ZIP!" }, { quoted: msg });

        await sock.sendMessage(chatId, { text: "⏳ Mengekstrak..." }, { quoted: msg });
        try {
            const zipPath = await downloadAndSaveMedia(sock, quoted, "temp.zip");
            const zip = new AdmZip(zipPath);
            zip.extractAllTo(dbFolder, true);
            fs.unlinkSync(zipPath);
            return sock.sendMessage(chatId, { text: `✅ Sukses Extract ke Database.` }, { quoted: msg });
        } catch { return sock.sendMessage(chatId, { text: "❌ Gagal ekstrak." }, { quoted: msg }); }
    }

    // 3. WINTUNELING (Download All)
    if (command === "#wintuneling") {
        const files = fs.readdirSync(dbFolder);
        if (files.length === 0) return sock.sendMessage(chatId, { text: "📂 Database Kosong." }, { quoted: msg });
        await sock.sendMessage(chatId, { text: `⏳ Mengompres ${files.length} file...` }, { quoted: msg });

        const zipName = "All_Config_Resbot.zip";
        const outputZipPath = path.join(process.cwd(), "tmp", zipName);
        const output = fs.createWriteStream(outputZipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', async () => {
            await sock.sendMessage(chatId, { document: fs.readFileSync(outputZipPath), mimetype: 'application/zip', fileName: zipName }, { quoted: msg });
            fs.unlinkSync(outputZipPath);
        });
        archive.pipe(output);
        archive.directory(dbFolder, false);
        archive.finalize();
        return;
    }

    // 4. LIST & DEL
    if (command === ".listhc") {
        const files = fs.readdirSync(dbFolder);
        if (files.length === 0) return sock.sendMessage(chatId, { text: "📂 Database Kosong." }, { quoted: msg });
        let txt = `📂 *DATABASE CONFIG (${files.length})*\n\n` + files.map((f, i) => `${i + 1}. #${f}`).join("\n");
        return sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    }
    if (command === ".delhc") {
        if (!isCreator || !args) return sock.sendMessage(chatId, { text: "⚠️ Contoh: .delhc namafile.hc" }, { quoted: msg });
        const p = path.join(dbFolder, args);
        if (fs.existsSync(p)) { fs.unlinkSync(p); return sock.sendMessage(chatId, { text: "✅ Dihapus." }, { quoted: msg }); }
        else return sock.sendMessage(chatId, { text: "⚠️ File tidak ada." }, { quoted: msg });
    }

    // 5. GET FILE (#namafile)
    if (text.startsWith("#") && !text.startsWith("#uploadhc") && !text.startsWith("#wintuneling")) {
        const target = text.substring(1).trim();
        const p = path.join(dbFolder, target);
        if (fs.existsSync(p)) await sock.sendMessage(chatId, { document: fs.readFileSync(p), mimetype: 'application/octet-stream', fileName: target }, { quoted: msg });
    }
}
export default hcFeatures;
