import fs from "fs";
import { downloadAndSaveMedia, readWhitelist } from "../lib/utils.js";
import { saveAutoJPMStatus } from "../lib/autojpmStatus.js";

// Global Variable (Default 60 menit)
global.autojpm = global.autojpm || { delay: 60 };
global.autojpmRunning = false;

async function autojpm(sock, sender, message, key, messageEvent) {
  // Parsing Command
  const parts = message.trim().split(" "); // [.autojpm, time, 60]
  const command = parts[0].toLowerCase();
  const subCommand = parts[1] ? parts[1].toLowerCase() : "";
  const args = parts.slice(1);
  const text = args.join(" "); // text full setelah command

  // ==========================================
  // 1. SETTING WAKTU (Cara Pakai: .autojpm time 60)
  // ==========================================
  if (subCommand === "time" || subCommand === "set" || subCommand === "timer") {
      const menit = parseFloat(parts[2]);
      if (isNaN(menit)) return sock.sendMessage(sender, { text: "⚠️ Masukkan angka menit!\nContoh: *.autojpm time 60*" });
      
      global.autojpm.delay = menit;
      return sock.sendMessage(sender, { text: `✅ Waktu istirahat diatur menjadi: *${menit} menit*.` });
  }

  // ==========================================
  // 2. STOP JPM (Cara Pakai: .autojpm stop)
  // ==========================================
  if (subCommand === "stop" || subCommand === "off") {
      global.autojpmRunning = false;
      saveAutoJPMStatus(false);
      return sock.sendMessage(sender, { text: "🛑 Auto JPM Berhasil Dihentikan." });
  }

  // ==========================================
  // 3. START JPM (Cara Pakai: .autojpm <teks>)
  // ==========================================
  // Cek apakah user mengirim teks/gambar untuk disebar
  if (args.length > 0) {
      // Cek apakah sudah berjalan
      if (global.autojpmRunning) {
          return sock.sendMessage(sender, { text: "⚠️ Auto JPM sedang berjalan! Ketik *.autojpm stop* untuk berhenti." });
      }

      global.autojpmRunning = true;
      let imgPath = null;
      let msgToSend = {};

      // Anti Crash Object
      const msg = messageEvent; 

      // --- LOGIKA DOWNLOAD GAMBAR ---
      let msgToDownload = null;
      if (msg.message?.imageMessage) {
          msgToDownload = msg;
      } else if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage) {
          msgToDownload = { message: msg.message.extendedTextMessage.contextInfo.quotedMessage };
      }

      if (msgToDownload) {
          if (await downloadAndSaveMedia(sock, msgToDownload, "jpm.jpg", "../tmp")) {
              imgPath = "./tmp/jpm.jpg";
          } else {
              return sock.sendMessage(sender, { text: "❌ Gagal mendownload gambar." });
          }
      }

      saveAutoJPMStatus(true, text, imgPath);
      await sock.sendMessage(sender, { text: `🚀 *JPM DIMULAI (NATIVE MODE)*\n\n⏱️ Istirahat: ${global.autojpm.delay} menit\n🎯 Target: Semua Grup` });

      // --- LOOPING PENYEBARAN ---
      while (global.autojpmRunning) {
          const groups = await sock.groupFetchAllParticipating();
          const whitelist = readWhitelist();
          const targets = Object.values(groups).filter(g => !whitelist.includes(g.id));

          let successCount = 0;

          for (const g of targets) {
              if (!global.autojpmRunning) break;

              // --- LOGIKA PESAN (Murni Native) ---
              if (imgPath && fs.existsSync(imgPath)) {
                  // Jika ada gambar: Kirim Gambar + Caption
                  // (Preview link WA biasanya tidak muncul jika ada gambar)
                  msgToSend = { image: fs.readFileSync(imgPath), caption: text };
              } else {
                  // Jika TEXT SAJA: Kirim Teks Murni
                  // WhatsApp akan otomatis memunculkan tombol "Lihat Grup" jika ada link
                  msgToSend = { text: text };
              }

              // KIRIM
              try {
                  await sock.sendMessage(g.id, msgToSend);
                  successCount++;
                  // Delay Random 4-8 Detik (Memberi waktu WA generate preview)
                  await new Promise(r => setTimeout(r, Math.floor(Math.random() * 4000) + 4000));
              } catch (e) {}
          }
          
          if (!global.autojpmRunning) break;

          // LAPORAN & ISTIRAHAT
          await sock.sendMessage(sender, { 
              text: `✅ *Selesai 1 Putaran*\n📨 Terkirim: ${successCount} Grup\n😴 Istirahat: ${global.autojpm.delay} Menit` 
          });

          await new Promise(r => setTimeout(r, global.autojpm.delay * 60 * 1000));
      }
  } else {
      // Jika user cuma ketik .autojpm tanpa argumen
      return sock.sendMessage(sender, { text: "⚠️ Masukkan teks atau command!\n\n*Contoh:*\n.autojpm Halo ini promosi... (Mulai JPM)\n.autojpm time 60 (Set waktu)\n.autojpm stop (Berhenti)" });
  }
}
export default autojpm;
