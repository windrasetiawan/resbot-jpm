import fs from "fs";

async function owner(sock, chatId, text, key, msg) {
    const cmd = text.split(" ")[0].toLowerCase();
    const isOwnerCmd = [".addowner", ".delowner", ".listowner"].includes(cmd);

    if (!isOwnerCmd) return;

    // Path Database
    const dbPath = "./DATABASE/settings.json";

    // Fungsi Helper: Baca Database
    const readDB = () => {
        try {
            return JSON.parse(fs.readFileSync(dbPath));
        } catch (e) {
            return { owners: [] };
        }
    };

    // Fungsi Helper: Tulis Database
    const writeDB = (data) => {
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    };

    // --- CEK PERMISSION ---
    // Hanya Owner Utama (yang pegang HP bot / Creator) yang boleh pakai perintah ini
    if (!key.fromMe) return sock.sendMessage(chatId, { text: "❌ Perintah ini khusus Pemilik Bot!" });

    // --- 1. ADD OWNER ---
    if (cmd === ".addowner") {
        let number;
        // Cek Reply
        if (msg.message.extendedTextMessage?.contextInfo?.participant) {
            number = msg.message.extendedTextMessage.contextInfo.participant.split("@")[0];
        } 
        // Cek Input Text
        else {
            number = text.split(" ")[1];
        }

        if (!number) return sock.sendMessage(chatId, { text: "⚠️ Format salah.\nReply chat orangnya atau ketik: .addowner 628xx" });

        // Bersihkan Nomor (Hapus spasi, strip, ganti 08 jadi 628)
        number = number.replace(/\D/g, '');
        if (number.startsWith('0')) number = '62' + number.slice(1);

        const db = readDB();
        if (!db.owners) db.owners = [];

        if (db.owners.includes(number)) {
            return sock.sendMessage(chatId, { text: "⚠️ Nomor sudah ada di list owner." });
        }

        db.owners.push(number);
        writeDB(db);
        sock.sendMessage(chatId, { text: `✅ Sukses menambah owner baru: @${number}`, mentions: [number + "@s.whatsapp.net"] });
    }

    // --- 2. DEL OWNER ---
    if (cmd === ".delowner") {
        let number;
        if (msg.message.extendedTextMessage?.contextInfo?.participant) {
            number = msg.message.extendedTextMessage.contextInfo.participant.split("@")[0];
        } else {
            number = text.split(" ")[1];
        }

        if (!number) return sock.sendMessage(chatId, { text: "⚠️ Format salah.\nReply chat orangnya atau ketik: .delowner 628xx" });

        number = number.replace(/\D/g, '');
        if (number.startsWith('0')) number = '62' + number.slice(1);

        const db = readDB();
        if (!db.owners) db.owners = [];

        const index = db.owners.indexOf(number);
        if (index > -1) {
            db.owners.splice(index, 1);
            writeDB(db);
            sock.sendMessage(chatId, { text: `✅ Sukses menghapus owner: @${number}`, mentions: [number + "@s.whatsapp.net"] });
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

        sock.sendMessage(chatId, { text: txt, mentions: list.map(n => n + "@s.whatsapp.net") });
    }
}

export default owner;
  
