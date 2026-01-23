import net from "net";
import fs from "fs";
import path from "path";
import { isOwner } from "../lib/utils.js";

const dbPath = "./DATABASE/monitored_servers.json";
const settingsPath = "./DATABASE/settings.json";

// Inisialisasi Database Server
if (!fs.existsSync("./DATABASE")) fs.mkdirSync("./DATABASE");
if (!fs.existsSync(dbPath)) {
    const defaultServers = [
        { host: "udp-premium.wintunneling.web.id", port: 80 },
        { host: "vvip.wintunneling.web.id", port: 80 },
        { host: "udp-premium.windratuneup.my.id", port: 80 },
        { host: "premium.wintunneling.web.id", port: 80 }
    ];
    fs.writeFileSync(dbPath, JSON.stringify(defaultServers, null, 2));
}

// Penyimpanan Status Terakhir (Memori Sementara)
const serverStatus = {}; 
let monitorInterval = null;

// Fungsi Cek Port
const checkPort = (host, port) => {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(2000); // Timeout 2 detik sesuai request

        socket.on('connect', () => {
            socket.destroy();
            resolve(true); // ON
        });

        socket.on('timeout', () => {
            socket.destroy();
            resolve(false); // OFF
        });

        socket.on('error', (err) => {
            socket.destroy();
            resolve(false); // OFF
        });

        socket.connect(port, host);
    });
};

// Fungsi Utama Loop Monitoring
export const startMonitor = (sock) => {
    if (monitorInterval) clearInterval(monitorInterval);

    console.log("🚀 Server Monitor Started...");

    monitorInterval = setInterval(async () => {
        const servers = JSON.parse(fs.readFileSync(dbPath));
        let settings = {};
        try { settings = JSON.parse(fs.readFileSync(settingsPath)); } catch {}

        const notifChannel = settings.monitorChannel; // ID Channel Tujuan

        for (const s of servers) {
            const key = `${s.host}:${s.port}`;
            const isOnline = await checkPort(s.host, s.port);
            
            // Inisialisasi status awal jika belum ada
            if (serverStatus[key] === undefined) {
                serverStatus[key] = isOnline;
                continue;
            }

            // Jika Status BERUBAH
            if (serverStatus[key] !== isOnline) {
                serverStatus[key] = isOnline; // Update status baru

                // Kirim Notifikasi jika Channel ID sudah diset
                if (notifChannel) {
                    const statusText = isOnline ? "✅ *SERVER ACTIVE (ON)*" : "⚠️ *SERVER DOWN (OFF)*";
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
        const servers = JSON.parse(fs.readFileSync(dbPath));
        let txt = "🖥️ *DAFTAR SERVER MONITORING:*\n\n";
        servers.forEach((s, i) => {
            const status = serverStatus[`${s.host}:${s.port}`] ? "✅ ON" : "🔴 OFF";
            txt += `${i+1}. ${s.host} (${s.port}) [${status}]\n`;
        });
        return sock.sendMessage(chatId, { text: txt });
    }

    if (cmd === ".addserver") {
        const input = args.join(" "); // host|port
        const [host, port] = input.split("|");
        if (!host) return sock.sendMessage(chatId, { text: "⚠️ Format: .addserver domain|port" });
        
        const servers = JSON.parse(fs.readFileSync(dbPath));
        servers.push({ host: host.trim(), port: parseInt(port) || 80 });
        fs.writeFileSync(dbPath, JSON.stringify(servers, null, 2));
        
        return sock.sendMessage(chatId, { text: `✅ Server ${host} ditambahkan.` });
    }

    if (cmd === ".delserver") {
        const host = args[0];
        let servers = JSON.parse(fs.readFileSync(dbPath));
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
              
