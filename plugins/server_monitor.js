import net from "net";
import fs from "fs";
import path from "path";
import { isOwner } from "../lib/utils.js";

const dbPath = "./DATABASE/monitored_servers.json";
const settingsPath = "./DATABASE/settings.json";

if (!fs.existsSync("./DATABASE")) fs.mkdirSync("./DATABASE");
if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, "[]");
}

const serverStatus = {}; 
let monitorInterval = null;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const checkPortAttempt = (host, port) => {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        let isOnline = false;

        socket.setTimeout(5000); 

        socket.on('connect', () => {
            isOnline = true;
            socket.destroy();
        });

        socket.on('timeout', () => {
            socket.destroy();
        });

        socket.on('error', (err) => {
            socket.destroy();
        });

        socket.on('close', () => {
            resolve(isOnline);
        });

        socket.connect(port, host);
    });
};

const checkPort = async (host, port) => {
    for (let i = 0; i < 3; i++) {
        const status = await checkPortAttempt(host, port);
        if (status) return true; 
        await sleep(1000); 
    }
    return false; 
};

export const startMonitor = (sock) => {
    if (monitorInterval) clearInterval(monitorInterval);

    console.log("🚀 Server Monitor Started (Privacy Mode)...");

    monitorInterval = setInterval(async () => {
        let servers = [];
        try { servers = JSON.parse(fs.readFileSync(dbPath)); } catch {}
        
        let settings = {};
        try { settings = JSON.parse(fs.readFileSync(settingsPath)); } catch {}

        const notifChannel = settings.monitorChannel; 

        for (const s of servers) {
            const key = `${s.host}:${s.port}`;
            
            const isOnline = await checkPort(s.host, s.port);
            
            if (serverStatus[key] === undefined) {
                serverStatus[key] = isOnline;
                continue;
            }

            if (serverStatus[key] !== isOnline) {
                serverStatus[key] = isOnline; 

                if (notifChannel) {
                    const statusText = isOnline ? "✅ *SERVER ACTIVE (ON)*" : "🔴 *SERVER DOWN (OFF)*";
                    
                    // PRIVACY: Hanya menampilkan NAMA (s.name), Host disembunyikan
                    const displayName = s.name || "Server (Hidden)";
                    
                    const msg = `${statusText}\n\n` +
                                `🏷️ *Server:* ${displayName}\n` + 
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
    }, 60000); 
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

        let txt = "🖥️ *DAFTAR SERVER MONITORING:*\n(Sedang mengecek status...)\n\n";
        await sock.sendMessage(chatId, { text: txt });

        let resultTxt = "🖥️ *DAFTAR SERVER MONITORING:*\n\n";
        for (let i = 0; i < servers.length; i++) {
            const s = servers[i];
            const isAlive = await checkPort(s.host, s.port); 
            const icon = isAlive ? "✅ ON" : "🔴 OFF";
            
            // PRIVACY: Hanya tampilkan Nama
            const displayName = s.name || "Server (Hidden)";
            resultTxt += `${i+1}. ${displayName} (${s.port}) [${icon}]\n`;
        }
        
        return sock.sendMessage(chatId, { text: resultTxt });
    }

    // FORMAT BARU: .addserver Nama|Host|Port
    if (cmd === ".addserver") {
        const input = args.join(" "); 
        const [name, host, port] = input.split("|");
        
        if (!name || !host) return sock.sendMessage(chatId, { text: "⚠️ Format Baru (Pakai Nama):\n.addserver Nama Alias|Host/IP|Port\n\nContoh:\n.addserver Server SG 1|sg1.domain.com|80" });
        
        let servers = [];
        try { servers = JSON.parse(fs.readFileSync(dbPath)); } catch {}

        servers.push({ 
            name: name.trim(), 
            host: host.trim(), 
            port: parseInt(port) || 80 
        });
        
        fs.writeFileSync(dbPath, JSON.stringify(servers, null, 2));
        
        return sock.sendMessage(chatId, { text: `✅ Server *${name}* berhasil ditambahkan.` });
    }

    if (cmd === ".delserver") {
        const query = args.join(" ");
        if (!query) return sock.sendMessage(chatId, { text: "⚠️ Masukkan Nama Server yang mau dihapus." });

        let servers = [];
        try { servers = JSON.parse(fs.readFileSync(dbPath)); } catch {}

        const initialLen = servers.length;
        // Hapus berdasarkan Nama atau Host
        servers = servers.filter(s => s.name !== query && s.host !== query);
        
        if (servers.length < initialLen) {
            fs.writeFileSync(dbPath, JSON.stringify(servers, null, 2));
            return sock.sendMessage(chatId, { text: `✅ Server *${query}* dihapus.` });
        } else {
            return sock.sendMessage(chatId, { text: "❌ Server tidak ditemukan." });
        }
    }
}

export default serverMonitor;
                
