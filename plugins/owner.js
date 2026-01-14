import fs from "fs";
// Import fungsi isOwner dari utils agar Creator juga bisa akses
import { isOwner } from "../lib/utils.js"; 

async function owner(sock, chatId, text, key, msg) {
    const cmd = text.split(" ")[0].toLowerCase();
    const isOwnerCmd = [".addowner", ".delowner", ".listowner"].includes(cmd);

    if (!isOwnerCmd) return;

    // Tentukan siapa pengirim pesan
    const sender = msg.key.participant || msg.key.remoteJid;

    // --- CEK PERMISSION (REVISI) ---
    // Sekarang cek: Apakah Pengirim = Bot (fromMe) ATAU Pengirim = Owner Terdaftar?
    if (!key.fromMe && !isOwner(sender)) {
        return sock.sendMessage(chatId, { text: "❌ Perintah ini khusus Owner/Creator Bot!" });
    }

    const dbPath = "./DATABASE/settings.json";

    const readDB = () => {
        try {
            if (!fs.existsSync(dbPath)) return { owners: [] };
            return JSON.parse(fs.readFileSync(dbPath));
        } catch (e) {
            return { owners: [] };
        }
    };

    const writeDB = (data) => {
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    };

    // --- 1. ADD OWNER ---
    if (cmd === ".addowner") {
        let number;
        // Prioritas 1: Reply Chat
        if (msg.message.extendedTextMessage?.contextInfo?.participant) {
            number = msg.message.extendedTextMessage.contextInfo.participant.split("@")[0];
        } 
        // Prioritas 2: Input Text (.addowner 628xxx)
        else {
            number = text.split(" ")[1];
        }

        if (!number) return sock.sendMessage(chatId, { text: "⚠️ Format salah.\nReply chat orangnya atau ketik: .addowner 628xx" });

        number = number.replace(/\D/g, '');
        if (number.startsWith('0')) number = '62' + number.slice(1);

        const db = readDB();
        if (!db.owners) db.owners = [];

        if (db.owners.includes(number)) {
            return sock.sendMessage(chatId, { text: "⚠️ Nomor tersebut sudah menjadi Owner." });
        }

        db.owners.push(number);
        writeDB(db);
        
        await sock.sendMessage(chatId, { 
            text: `✅ Sukses menambahkan owner baru:\n👑 @${number}`, 
            mentions: [number + "@s.whatsapp.net"] 
        });
    }

    // --- 2. DEL OWNER ---
    if (cmd === ".delowner") {
        let number;
        if (msg.message.extendedTextMessage?.contextInfo?.participant) {
            number = msg.message.extendedTextMessage.contextInfo.participant.split("@")[0];
        } else {
            number = text.split(" ")[1];
        }

        if (!number) return sock.sendMessage(chatId, { text: "⚠️ Masukkan nomor yang akan dihapus." });

        number = number.replace(/\D/g, '');
        if (number.startsWith('0')) number = '62' + number.slice(1);

        const db = readDB();
        if (!db.owners) db.owners = [];

        const index = db.owners.indexOf(number);
        if (index > -1) {
            db.owners.splice(index, 1);
            writeDB(db);
            await sock.sendMessage(chatId, { 
                text: `✅ Nomor @${number} telah dihapus dari list Owner.`, 
                mentions: [number + "@s.whatsapp.net"] 
            });
        } else {
            sock.sendMessage(chatId, { text: "⚠️ Nomor tidak ditemukan di database." });
        }
    }

    // --- 3. LIST OWNER ---
    if (cmd === ".listowner") {
        const db = readDB();
        const list = db.owners || [];
        
        if (list.length === 0) return sock.sendMessage(chatId, { text: "📂 Belum ada owner tambahan." });

        let txt = "👑 *LIST OWNER TAMBAHAN* 👑\n\n";
        list.forEach((num, i) => {
            txt += `${i + 1}. @${num}\n`;
        });

        await sock.sendMessage(chatId, { text: txt, mentions: list.map(n => n + "@s.whatsapp.net") });
    }
}

export default owner;
