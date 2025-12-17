/*
⚠️ CODE UTAMA RESBOT JPM V3 (FINAL UPGRADE)
Fitur: JPM, Cek Kuota, Delete All HC, Add Owner, Self/Public Mode
*/
console.log('Start App ..');

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import P from "pino";
import clc from "cli-color";
import readline from "readline";
import axios from "axios"; 

// IMPORT BAILEYS
import * as baileys from "baileys";
const makeWASocket = baileys.default?.default || baileys.default || baileys;
const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, jidNormalizedUser } = baileys;

// Import Helper
import { handleCommand, ChangeStatus, getStatus, isOwner } from "./lib/utils.js"; 
import resumeAutoJPM from "./lib/resumeAutoJPM.js";
import fileManager from "./plugins/file_manager.js";
import groupFeatures, { checkAntilink } from "./plugins/group_features.js";
import admin from "./plugins/admin.js"; 
import menu from "./plugins/menu.js"; // Import Menu agar sinkron

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const status = getStatus(`${__dirname}/sessions/`);

// --- DATABASE SETTINGS ---
const pathSettings = './DATABASE/settings.json';
// Update struktur database (tambah field owners)
if (!fs.existsSync(pathSettings)) {
    if (!fs.existsSync('./DATABASE')) fs.mkdirSync('./DATABASE'); 
    fs.writeFileSync(pathSettings, JSON.stringify({ 
        mode: 'public', // Default Public
        antilink: [], 
        autojoin: false,
        owners: [] // Array untuk menyimpan Owner Tambahan
    }, null, 2));
}

// Fungsi Baca Database
const getDbSettings = () => {
    try {
        return JSON.parse(fs.readFileSync(pathSettings));
    } catch {
        return { mode: 'public', antilink: [], autojoin: false, owners: [] };
    }
};

// Fungsi Simpan Database
const saveDbSettings = (data) => {
    fs.writeFileSync(pathSettings, JSON.stringify(data, null, 2));
};

const question = (text) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.question(text, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
};

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState("sessions");
    const { version } = await fetchLatestBaileysVersion();
    
    const sock = makeWASocket({
        version,
        auth: state,
        logger: P({ level: "silent" }),
        printQRInTerminal: false,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        generateHighQualityLinkPreview: true 
    });

    if (!sock.authState.creds.registered) {
        console.log(clc.cyan.bold("\n🤖 Mode Pairing Code Aktif!"));
        setTimeout(async () => {
            const phoneNumber = await question(clc.yellow("Masukkan Nomor WhatsApp (contoh: 628123456xxx): "));
            if (phoneNumber) {
                try {
                    const code = await sock.requestPairingCode(phoneNumber.trim());
                    console.log(clc.green.bold(`🔗 KODE PAIRING: ${code?.match(/.{1,4}/g)?.join("-") || code}`));
                } catch (e) {
                    console.error(clc.red("Gagal request pairing code."), e);
                }
            }
        }, 3000);
    }

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(clc.red("Reconnect..."));
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === "open") {
            console.log(clc.green("✅ Terhubung!"));
            ChangeStatus(`${__dirname}/sessions/`, "connected");
            resumeAutoJPM(sock);
            startScheduler(sock);
        }
    });

    sock.ev.on("messages.upsert", async (m) => {
        if (!m.messages[0]) return;
        const msg = m.messages[0]; 
        await handleIncomingMessages(sock, msg);
    });
     
    sock.ev.on("creds.update", saveCreds);
}

function startScheduler(sock) {
    setInterval(() => {
        const now = new Date();
        const time = `${String(now.getHours()).padStart(2,0)}:${String(now.getMinutes()).padStart(2,0)}`;
        const dbPath = './DATABASE/group_schedule.json';
        if (!fs.existsSync(dbPath)) return;
        try {
            const db = JSON.parse(fs.readFileSync(dbPath));
            Object.entries(db).forEach(async ([id, t]) => {
                if (t.open === time) {
                    await sock.groupSettingUpdate(id, "not_announcement");
                    await sock.sendMessage(id, { text: "⏰ Grup dibuka otomatis." });
                }
                if (t.close === time) {
                    await sock.groupSettingUpdate(id, "announcement");
                    await sock.sendMessage(id, { text: "⏰ Grup ditutup otomatis." });
                }
            });
        } catch {}
    }, 60000);
}

async function handleIncomingMessages(sock, msg) {
    try {
        if (!msg.message || msg.key.fromMe) return;

        const chatId = msg.key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');
        
        // Normalize Sender
        let sender = isGroup ? (msg.key.participant || msg.key.remoteJid) : chatId;
        sender = jidNormalizedUser(sender);
        const senderNum = sender.split('@')[0];

        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || "";
        
        // --- LOGIKA SELF MODE & OWNER ---
        const dbData = getDbSettings();
        
        // Cek apakah user adalah Owner Utama ATAU Owner Tambahan (dari database)
        const isCreator = isOwner(sender) || (dbData.owners && dbData.owners.includes(senderNum));

        // Jika Mode SELF dan bukan Creator, abaikan pesan (Silent)
        if (dbData.mode === 'self' && !isCreator) return;

        // --- COMMANDS HANDLING ---

        // 1. UBAH MODE (SELF/PUBLIC)
        if (text === '.self') {
            if (!isCreator) return;
            dbData.mode = 'self';
            saveDbSettings(dbData);
            return sock.sendMessage(chatId, { text: '🔴 *Mode SELF Aktif*\nHanya Owner yang bisa akses bot.' }, { quoted: msg });
        }
        if (text === '.public') {
            if (!isCreator) return;
            dbData.mode = 'public';
            saveDbSettings(dbData);
            return sock.sendMessage(chatId, { text: '🟢 *Mode PUBLIC Aktif*\nSemua orang bisa akses bot.' }, { quoted: msg });
        }

        // 2. ADD OWNER (Tambah akses Self Mode)
        if (text.startsWith('.addowner')) {
            if (!isCreator) return;
            const args = text.split(' ');
            let targetNum = args[1] ? args[1].replace(/[^0-9]/g, '') : '';
            
            if (!targetNum) return sock.sendMessage(chatId, { text: '⚠️ Masukkan nomor!\nContoh: .addowner 628123456' }, { quoted: msg });
            
            if (!dbData.owners) dbData.owners = [];
            if (dbData.owners.includes(targetNum)) {
                return sock.sendMessage(chatId, { text: '⚠️ Nomor sudah jadi owner.' }, { quoted: msg });
            }

            dbData.owners.push(targetNum);
            saveDbSettings(dbData);
            return sock.sendMessage(chatId, { text: `✅ Berhasil menambah Owner.\nNomor: ${targetNum}\nBisa akses saat Mode Self.` }, { quoted: msg });
        }

        // 3. DELETE ALL .HC (Hapus semua config)
        if (text.toLowerCase() === '.delallhc' || text.toLowerCase() === '.deleteallhc') {
            if (!isCreator) return sock.sendMessage(chatId, { text: '⚠️ Khusus Owner!' }, { quoted: msg });
            
            const dir = './ADDTIONAL/files';
            if (fs.existsSync(dir)) {
                const files = fs.readdirSync(dir);
                const hcFiles = files.filter(f => f.endsWith('.hc'));
                
                if (hcFiles.length === 0) return sock.sendMessage(chatId, { text: '⚠️ Tidak ada file .hc.' }, { quoted: msg });

                hcFiles.forEach(f => fs.unlinkSync(path.join(dir, f)));
                return sock.sendMessage(chatId, { text: `✅ *SUKSES*\nDihapus: ${hcFiles.length} file .hc` }, { quoted: msg });
            }
        }

        // 4. CEK ANTILINK
        if (isGroup && text && /chat.whatsapp.com/i.test(text)) {
            let isAdmin = false;
            try {
                const groupMetadata = await sock.groupMetadata(chatId);
                const participant = groupMetadata.participants.find(p => p.id === sender);
                isAdmin = (participant?.admin === 'admin' || participant?.admin === 'superadmin');
            } catch (e) {}
            const isSpam = await checkAntilink(sock, chatId, text, msg, sender, isAdmin);
            if (isSpam) return; 
        }

        // 5. CEK AUTO JOIN
        if (dbData.autojoin && isCreator && text.includes("chat.whatsapp.com")) {
            let code = text.split('chat.whatsapp.com/')[1].split(' ')[0];
            await sock.groupAcceptInvite(code)
                .then(() => sock.sendMessage(sender, { text: '✅ Berhasil Join!' }))
                .catch(() => sock.sendMessage(sender, { text: '❌ Gagal Join.' }));
        }

        // 6. FITUR CEK KUOTA (Direct)
        if (text.startsWith('.cekkuota') || text.startsWith('.cekxl')) {
            const args = text.split(" ").slice(1);
            if (!args[0]) {
                 await sock.sendMessage(chatId, { text: "⚠️ Masukkan nomor!\nContoh: .cekkuota 62878xxxx" }, { quoted: msg });
                 return; 
            }
            const msisdn = args[0].replace(/[^0-9]/g, '');
            await sock.sendMessage(chatId, { text: "⏳ Sedang mengambil data..." }, { quoted: msg });

            try {
                const response = await axios.get(`https://apigw.kmsp-store.com/sidompul/v4/cek_kuota`, {
                    params: { msisdn: msisdn, isJSON: 'true' },
                    headers: { 
                        'Authorization': 'Basic c2lkb21wdWxhcGk6YXBpZ3drbXNw', 
                        'X-API-Key': '60ef29aa-a648-4668-90ae-20951ef90c55', 
                        'X-App-Version': '4.0.0', 
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }, timeout: 20000 
                });
                const res = response.data;
                if (res.status === true) {
                    let hasil = res.data.hasil || "Info kosong";
                    hasil = hasil.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>?/gm, '');
                    await sock.sendMessage(chatId, { text: `✅ *DETAIL KUOTA XL*\nNomor: ${msisdn}\n\n${hasil}` }, { quoted: msg });
                } else {
                    await sock.sendMessage(chatId, { text: `❌ Gagal: ${res.message || "Nomor salah/gangguan"}` }, { quoted: msg });
                }
            } catch (e) {
                console.error("Axios Error:", e.message);
                await sock.sendMessage(chatId, { text: "❌ Error Server." }, { quoted: msg });
            }
            return; 
        }

        // 7. FITUR # AMBIL FILE (Tanpa Caption)
        if (text.startsWith("#") && text.length > 1) {
            const query = text.substring(1).trim();
            const dir = './ADDTIONAL/files'; 
            if (fs.existsSync(dir)) {
                const files = fs.readdirSync(dir);
                let match = files.find(f => f.toLowerCase() === query.toLowerCase());
                if (!match) match = files.find(f => f.toLowerCase() === query.toLowerCase() + '.hc');
                if (!match) match = files.find(f => f.toLowerCase().includes(query.toLowerCase()));
                
                if (match) {
                    await sock.sendMessage(chatId, { 
                        document: fs.readFileSync(path.join(dir, match)), 
                        mimetype: 'application/octet-stream', 
                        fileName: match
                    }, { quoted: msg });
                    return;
                }
            }
        }

        // --- PANGGIL PLUGINS LAIN ---
        if (fileManager) await fileManager(sock, chatId, text, msg.key, msg);
        if (groupFeatures) await groupFeatures(sock, chatId, text, msg.key, msg);
        if (admin) await admin(sock, chatId, text, msg.key, msg);
        // Menu dipanggil lewat handleCommand, tapi bisa juga diimport kalau mau custom
        // Namun standardnya lewat handleCommand di utils.js

        await handleCommand(sock, chatId, text, msg.key, senderNum, msg, false);

    } catch (e) { console.error("Msg Error:", e); }
}

if (status === "connected") connectToWhatsApp();
else connectToWhatsApp();
