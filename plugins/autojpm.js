import fs from "fs";
import { downloadAndSaveMedia, readWhitelist } from "../lib/utils.js";
import { saveAutoJPMStatus } from "../lib/autojpmStatus.js";

// Global Variable (Default istirahat 60 menit)
global.autojpm = global.autojpm || { delay: 60 };
global.autojpmRunning = false;

async function autojpm(sock, sender, message, key, messageEvent) {
  // Parsing Command
  const parts = message.trim().split(" "); 
  const command = parts[0].toLowerCase();
  const subCommand = parts[1] ? parts[1].toLowerCase() : "";
  const args = parts.slice(1);
  const text = args.join(" "); // Pesan promosi full

  //  SETTING WAKTU ISTIRAHAT (Contoh: .autojpm time 60)
  if (subCommand === "time" || subCommand === "timer" || subCommand === "set") {
      const menit = parseFloat(parts[2]);
      if (isNaN(menit)) return sock.sendMessage(sender, { text: "⚠️ Masukkan angka menit!\nContoh: *.autojpm time 60*" });
      
      global.autojpm.delay = menit;
      return sock.sendMessage(sender, { text: `✅ Waktu istirahat per putaran diatur menjadi: *${menit} menit*.` });
  }

  //  STOP JPM (Contoh: .autojpm stop)
  if (subCommand === "stop" || subCommand === "off") {
      global.autojpmRunning = false;
      saveAutoJPMStatus(false);
      return sock.sendMessage(sender, { text: "🛑 Auto JPM Berhasil Dihentikan." });
  }

  // ==========================================
  // 3. START JPM (Normal Mode)
  // ==========================================
  if (command === ".autojpm" && args.length > 0) {
      // Cek apakah sedang berjalan
      if (global.autojpmRunning) {
          return sock.sendMessage(sender, { text: "⚠️ Auto JPM sedang berjalan! Ketik *.autojpm stop* untuk berhenti." });
      }

      global.autojpmRunning = true;
      let imgPath = null;
      
      // Object Pesan
      const msg = messageEvent; 

      // --- CEK DOWNLOAD GAMBAR ---
      // Jika user mengirim gambar saat mengetik command, download gambar tersebut
      let msgToDownload = null;
      if (msg.message?.imageMessage) {
          msgToDownload = msg;
      } else if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage) {
          msgToDownload = { message: msg.message.extendedTextMessage.contextInfo.quotedMessage };
      }

      if (msgToDownload) {
          try {
              if (await downloadAndSaveMedia(sock, msgToDownload, "jpm.jpg", "../tmp")) {
                  imgPath = "./tmp/jpm.jpg";
              }
          } catch (e) {
              console.log("Gagal download media:", e);
          }
      }

      // Simpan status agar kalau bot restart bisa lanjut (opsional tergantung lib Anda)
      saveAutoJPMStatus(true, text, imgPath);
      
      await sock.sendMessage(sender, { 
          text: `🚀 *JPM DIMULAI (MODE NORMAL)*\n\n🛡️ *Keamanan:* Delay 5-10 detik antar grup\n⏱️ *Istirahat:* ${global.autojpm.delay} menit per putaran` 
      });

      while (global.autojpmRunning) {
          // Ambil daftar grup terbaru
          const groups = await sock.groupFetchAllParticipating();
          const whitelist = readWhitelist(); // Pastikan Anda punya fungsi ini untuk skip grup penting
          
          // Filter grup (kecualikan grup yang ada di whitelist/database pengecualian)
          const targets = Object.values(groups).filter(g => !whitelist.includes(g.id));

          let successCount = 0;

          // --- LOOPING KIRIM KE SETIAP GRUP ---
          for (const g of targets) {
              // Cek tombol stop darurat
              if (!global.autojpmRunning) break;

              let msgToSend = {};

              // Tentukan format pesan (Gambar+Text ATAU Text saja)
              if (imgPath && fs.existsSync(imgPath)) {
                  msgToSend = { image: fs.readFileSync(imgPath), caption: text };
              } else {
                  msgToSend = { text: text };
              }

              try {
                  // Kirim pesan
                  await sock.sendMessage(g.id, msgToSend);
                  successCount++;
                  

                  const delayAman = Math.floor(Math.random() * 5000) + 5000;
                  await new Promise(r => setTimeout(r, delayAman));

              } catch (e) {
                  // Error handler (misal bot dikick, biarkan lanjut ke grup berikutnya)
              }
          }
          
          if (!global.autojpmRunning) break;

          // LAPORAN PUTARAN SELESAI
          await sock.sendMessage(sender, { 
              text: `✅ *Putaran Selesai*\n📨 Terkirim: ${successCount} Grup\n😴 Bot istirahat ${global.autojpm.delay} menit...` 
          });

          // ISTIRAHAT ANTAR PUTARAN (Menit)
          await new Promise(r => setTimeout(r, global.autojpm.delay * 60 * 1000));
      }
  } else {
      // Halaman Help Jika Salah Ketik
      return sock.sendMessage(sender, { text: "⚠️ Format Salah!\n\n*Cara Pakai:*\n.autojpm <kata-kata promosi>\n.autojpm time 60\n.autojpm stop" });
  }
}
export default autojpm;
