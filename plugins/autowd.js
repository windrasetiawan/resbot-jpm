import fs from "fs";
import path from "path";
import { isOwner } from "../lib/utils.js";
import { numberAllowed } from "../config.js"; 

const settingsPath = path.join(process.cwd(), "DATABASE", "settings.json");
const baseUrl = "https://allxddev.biz.id/api.php?apikey=allxdxxl&username=allufi&token=1991647%3A0jkip97VR6huEtrc2XvWUDsOBY5yFMxA";

let isProcessing = false; 
let autoWDInterval = null; 

// --- 1. COMMAND PENGATURAN (ON/OFF) ---
async function autowd(sock, chatId, text, key, msg) {
    if (!text.toLowerCase().startsWith(".autowd")) return;

    const sender = msg.key.participant || msg.key.remoteJid;
    if (!isOwner(sender)) return sock.sendMessage(chatId, { text: "⚠️ Fitur khusus Owner!" }, { quoted: msg });

    const args = text.split(" ");
    const cmd = args[1]?.toLowerCase();

    let db = {};
    if (fs.existsSync(settingsPath)) db = JSON.parse(fs.readFileSync(settingsPath));

    if (cmd === "on") {
        db.auto_withdraw = true;
        db.autowd_target = sender; // <--- SIMPAN NOMOR YANG MENGAKTIFKAN
        
        fs.writeFileSync(settingsPath, JSON.stringify(db, null, 2));
        return sock.sendMessage(chatId, { text: "✅ *AUTO WITHDRAW AKTIF*\nLaporan akan dikirim ke nomor ini." });
    }
    
    if (cmd === "off") {
        db.auto_withdraw = false;
        // db.autowd_target tidak perlu dihapus, biar history tetap ada
        fs.writeFileSync(settingsPath, JSON.stringify(db, null, 2));
        return sock.sendMessage(chatId, { text: "🛑 *AUTO WITHDRAW MATI*" });
    }

    return sock.sendMessage(chatId, { text: "Format: .autowd on/off" });
}

// --- 2. MESIN OTOMATIS (Background) ---
export async function startAutoWD(sock) {
    if (autoWDInterval) clearInterval(autoWDInterval);

    console.log("🚀 [SYSTEM] Auto Withdraw Monitor Started...");

    autoWDInterval = setInterval(async () => {
        const currentSock = global.sock || sock;

        if (!fs.existsSync(settingsPath)) return;
        const db = JSON.parse(fs.readFileSync(settingsPath));
        if (!db.auto_withdraw) return; 

        if (isProcessing) return; 
        isProcessing = true;

        try {
            // Cek Saldo
            const checkUrl = `${baseUrl}&action=profile`;
            const response = await fetch(checkUrl);
            const json = await response.json();

            if (json.status && json.result) {
                const qrisBalance = parseInt(json.result.qris_balance); 

                // Hitung Kelipatan 1000
                const withdrawAmount = Math.floor(qrisBalance / 1000) * 1000;

                // Eksekusi jika saldo cukup (Minimal 1000)
                if (withdrawAmount >= 1000) {
                    console.log(`[AUTO-WD] Mencoba menarik Rp ${withdrawAmount}...`);

                    const wdUrl = `${baseUrl}&amount=${withdrawAmount}&action=wdqr`;
                    const wdRes = await fetch(wdUrl);
                    const wdJson = await wdRes.json();

                    if (wdJson.status && wdJson.result) {
                        const resWd = wdJson.result.qris_withdraw;
                        
                        if (resWd.success) {
                            const acc = wdJson.result.account.results;
                            
                            const msgSukses = `✅ *AUTO WITHDRAW SUKSES*\n\n` +
                                              `💸 *Ditarik*: Rp ${withdrawAmount.toLocaleString('id-ID')}\n` +
                                              `🏧 *Sisa QRIS*: Rp ${acc.qris_balance_str}\n` +
                                              `💳 *Saldo Utama*: Rp ${acc.balance_str}\n` + 
                                              `🕒 *Waktu*: ${new Date().toLocaleTimeString('id-ID')}`;
                            
                            // TENTUKAN TARGET PENGIRIMAN
                            // Prioritas: Nomor yang mengaktifkan (db.autowd_target)
                            // Fallback: Owner pertama di config (jika data db hilang)
                            let targetId = db.autowd_target;
                            
                            if (!targetId) {
                                const ownerNum = numberAllowed[0]; 
                                targetId = ownerNum.replace(/\D/g, "") + "@s.whatsapp.net";
                            }

                            await currentSock.sendMessage(targetId, { text: msgSukses });
                            console.log(`[AUTO-WD] Laporan dikirim ke: ${targetId}`);
                        } else {
                            console.log(`[AUTO-WD] Gagal Withdraw: ${resWd.message}`);
                        }
                    }
                }
            }
        } catch (e) {
            console.error("[AUTO-WD] Error:", e.message);
        } finally {
            isProcessing = false;
        }

    }, 60000); // Cek tiap 60 detik
}

export default autowd;
