import net from "net";
import fs from "fs";
import path from "path";
import { isOwner } from "../lib/utils.js";

const dbPath = "./DATABASE/monitored_servers.json";
const settingsPath = "./DATABASE/settings.json";

// Inisialisasi Database Server
if (!fs.existsSync("./DATABASE")) fs.mkdirSync("./DATABASE");
if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, "[]");
}

// Penyimpanan Status Terakhir (Memori Sementara)
const serverStatus = {}; 
let monitorInterval = null;

// Fungsi Helper: Sleep
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Fungsi Cek Port (Satu Kali Percobaan)
const checkPortAttempt = (host, port) => {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        let isOnline = false;

        // TIMEOUT DIPERPANJANG JADI 5 DETIK (Agar tidak mudah RTO)
        socket.setTimeout(5000); 

        socket.on('connect', () => {
            isOnline = true;
            socket.destroy();
        });

        socket.on('timeout', () => {
            socket.destroy();
        });

        socket.on('error', (err) => {
            // Error koneksi (Connection Refused / Host Unreachable)
            socket.destroy();
        });

        socket.on('close', () => {
            resolve(isOnline);
        });

        socket.connect(port, host);
    });
};

// 🛡️ FUNGSI CEK UTAMA DENGAN RETRY 3X
// Mencegah status "OFF" palsu hanya karena lag sesaat
const checkPort = async (host, port) => {
    for (let i = 0; i < 3; i++) {
        const status = await checkPortAttempt(host, port);
        if (status) return true; // Jika sukses connect, langsung return ON
        await sleep(1000); // Jika gagal, tunggu 1 detik lalu coba lagi
    }
    return false; // Jika 3x dicoba tetap gagal, baru vonis OFF
};

// Fungsi Utama Loop Monitoring
export const startMonitor = (sock) => {
    if (monitorInterval) clearInterval(monitorInterval);

    console.log("🚀 Server Monitor Started (with Retry System)...");

    monitorInterval = setInterval(async () => {
        let servers = [];
        try { servers = JSON.parse(fs.readFileSync(dbPath)); } catch {}
        
        let settings = {};
        try { settings = JSON.parse(fs.readFileSync(settingsPath)); } catch {}

        const notifChannel = settings.monitorChannel; // ID Channel Tujuan

        for (const s of servers) {
            const key = `${s.host}:${s.port}`;
            
            // Cek status server
            const isOnline = await checkPort(s.host, s.port);
            
            // Inisialisasi status awal (Jangan kirim notif saat bot baru nyala)
            if (serverStatus[key] === undefined) {
                serverStatus[key] = isOnline;
                continue;
            }

            // Jika Status BERUBAH (ON -> OFF atau OFF -> ON)
            if (serverStatus[key] !== isOnline) {
                serverStatus[key] = isOnline; // Update status baru

                // Kirim Notifikasi ke Channel
                if (notifChannel) {
                    const statusText = isOnline ? "✅ *SERVER ACTIVE (ON)*" : "🔴 *SERVER DOWN (OFF)*";
                    const msg = `${statusText}\n\n` +
                                `🖥️ *Host:* ${s.host}\n` +
                                `🔌 *Port:* ${s.port}\n` +
                                `⏰ *Time:* ${new Date().toLocaleTimeString('id-ID', {timeZone: 'Asia/Jakarta'})}`;
                    
                    try {
                        await sock.sendMessage(notifChannel, { text: msg });
                    } catch (e) {
                        console.error("Gagal kirim notif monitor:", e);
                    }
                }
            }
        }
    }, 60000); // Cek setiap 60 detik
};

async function serverMonitor(sock, chatId, text, key, msg) {
    const sender = msg.key.participant || msg.key.remoteJid;
    const cmd = text.split(" ")[0].toLowerCase();
    const args = text.split(" ").slice(1);
    
    if (!isOwner(sender)) return;

    if (cmd === ".setmonitorid") {
        const channelId = args[0];
        if (!channelId) return sock.sendMessage(chatId, { text: "⚠️ Masukkan ID Channel.\nCara cek: Forward pesan channel lalu ketik .cekid" });
        
        let settings = {};
        try { settings = JSON.parse(fs.readFileSync(settingsPath)); } catch {}
        
        settings.monitorChannel = channelId;
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
        
        return sock.sendMessage(chatId, { text: `✅ Channel Notifikasi Monitor diatur ke:\n${channelId}` });
    }

    if (cmd === ".listserver") {
        let servers = [];
        try { servers = JSON.parse(fs.readFileSync(dbPath)); } catch {}
        
        if (servers.length === 0) return sock.sendMessage(chatId, { text: "Belum ada server yang dimonitor." });

        // Cek status real-time saat command diketik
        let txt = "🖥️ *DAFTAR SERVER MONITORING:*\n(Sedang mengecek status...)\n\n";
        await sock.sendMessage(chatId, { text: txt });

        let resultTxt = "🖥️ *DAFTAR SERVER MONITORING:*\n\n";
        for (let i = 0; i < servers.length; i++) {
            const s = servers[i];
            const isAlive = await checkPort(s.host, s.port); // Cek langsung
            const icon = isAlive ? "✅ ON" : "🔴 OFF";
            resultTxt += `${i+1}. ${s.host} (${s.port}) [${icon}]\n`;
        }
        
        return sock.sendMessage(chatId, { text: resultTxt });
    }

    if (cmd === ".addserver") {
        const input = args.join(" "); // host|port
        const [host, port] = input.split("|");
        if (!host) return sock.sendMessage(chatId, { text: "⚠️ Format: .addserver domain|port" });
        
        let servers = [];
        try { servers = JSON.parse(fs.readFileSync(dbPath)); } catch {}

        servers.push({ host: host.trim(), port: parseInt(port) || 80 });
        fs.writeFileSync(dbPath, JSON.stringify(servers, null, 2));
        
        return sock.sendMessage(chatId, { text: `✅ Server ${host} ditambahkan.` });
    }

    if (cmd === ".delserver") {
        const host = args[0];
        let servers = [];
        try { servers = JSON.parse(fs.readFileSync(dbPath)); } catch {}

        const initialLen = servers.length;
        servers = servers.filter(s => s.host !== host);
        
        if (servers.length < initialLen) {
            fs.writeFileSync(dbPath, JSON.stringify(servers, null, 2));
            return sock.sendMessage(chatId, { text: `✅ Server ${host} dihapus.` });
        } else {
            return sock.sendMessage(chatId, { text: "❌ Server tidak ditemukan." });
        }
    }
}

export default serverMonitor;
                                     
