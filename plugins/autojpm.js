import fs from "fs";
import { downloadAndSaveMedia, readWhitelist } from "../lib/utils.js";
import { saveAutoJPMStatus } from "../lib/autojpmStatus.js";

// Global Variable untuk menyimpan settingan (Default 60 menit)
global.autojpm = global.autojpm || { delayMinutes: 60 };
global.autojpmRunning = false;

async function autojpm(sock, sender, message, key, messageEvent) {
  const parts = message.trim().split(" ");
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);
  const text = args.join(" ");

  // --- 1. SETTING WAKTU ISTIRAHAT (LOOP) ---
  if (command === ".autojpmsettime" || command === ".setautojpm") {
      const menit = parseFloat(args[0]);
      if (isNaN(menit)) return sock.sendMessage(sender, { text: "⚠️ Masukkan angka menit!\nContoh: *.autojpmsettime 60*" });
      
      global.autojpm.delayMinutes = menit;
      return sock.sendMessage(sender, { text: `✅ Waktu istirahat diatur menjadi: *${menit} menit*.` });
  }

  // --- 2. FITUR UTAMA AUTOJPM ---
  if (command === ".autojpm") {
      // Tombol Stop
      if (text.toLowerCase() === "stop" || text.toLowerCase() === "off") {
          global.autojpmRunning = false;
          saveAutoJPMStatus(false);
          return sock.sendMessage(sender, { text: "🛑 Auto JPM Berhasil Dihentikan." });
      }

      // Cek apakah sudah berjalan
      if (global.autojpmRunning) {
          return sock.sendMessage(sender, { text: "⚠️ Auto JPM sedang berjalan! Ketik *.autojpm stop* untuk berhenti." });
      }

      global.autojpmRunning = true;
      let imgPath = null;
      let msgToSend = {};

      // [FIX CRASH] Ambil objek pesan dengan benar
      const msg = messageEvent; 

      // --- A. LOGIKA DOWNLOAD GAMBAR ---
      // Cek apakah pesan mengandung gambar (langsung atau reply)
      let msgToDownload = null;
      if (msg.message?.imageMessage) {
          msgToDownload = msg;
      } else if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage) {
          msgToDownload = { message: msg.message.extendedTextMessage.contextInfo.quotedMessage };
      }

      if (msgToDownload) {
          // Download gambar ke folder tmp
          if (await downloadAndSaveMedia(sock, msgToDownload, "jpm.jpg", "../tmp")) {
              imgPath = "./tmp/jpm.jpg";
          } else {
              return sock.sendMessage(sender, { text: "❌ Gagal mendownload gambar." });
          }
      }

      // --- B. DETEKSI LINK (UNTUK PREVIEW) ---
      const linkRegex = /chat.whatsapp.com\/([0-9A-Za-z]{20,24})/i;
      const linkMatch = text.match(linkRegex);

      saveAutoJPMStatus(true, text, imgPath);
      await sock.sendMessage(sender, { text: `🚀 *JPM DIMULAI*\n\n⏱️ Istirahat: ${global.autojpm.delayMinutes} menit\n🎯 Target: Semua Grup` });

      // --- C. LOOPING PENYEBARAN ---
      while (global.autojpmRunning) {
          const groups = await sock.groupFetchAllParticipating();
          const whitelist = readWhitelist(); //
          const targets = Object.values(groups).filter(g => !whitelist.includes(g.id));

          let successCount = 0;

          for (const g of targets) {
              if (!global.autojpmRunning) break;

              // MENYUSUN PESAN
              if (imgPath && fs.existsSync(imgPath)) {
                  // Opsi 1: Gambar + Caption
                  msgToSend = { image: fs.readFileSync(imgPath), caption: text };
              } else {
                  // Opsi 2: Teks (Cek apakah pakai Link Preview)
                  if (linkMatch) {
                      msgToSend = {
                          text: text,
                          contextInfo: {
                              externalAdReply: {
                                  title: "KLIK UNTUK GABUNG",
                                  body: "Undangan Grup WhatsApp",
                                  thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/WhatsApp.svg/1200px-WhatsApp.svg.png", // Logo WA Standar
                                  sourceUrl: linkMatch[0], // Link grup yang ditemukan
                                  mediaType: 1,
                                  renderLargerThumbnail: true
                              }
                          }
                      };
                  } else {
                      // Opsi 3: Teks Biasa
                      msgToSend = { text: text };
                  }
              }

              // EKSEKUSI KIRIM
              try {
                  await sock.sendMessage(g.id, msgToSend);
                  successCount++;
                  // Delay aman 5 detik per grup
                  await new Promise(r => setTimeout(r, 5000));
              } catch (e) {
                  // Abaikan error (misal bot dikeluarkan)
              }
          }
          
          if (!global.autojpmRunning) break;

          // LAPORAN & ISTIRAHAT
          await sock.sendMessage(sender, { 
              text: `✅ *Selesai 1 Putaran*\n📨 Terkirim: ${successCount} Grup\n😴 Istirahat: ${global.autojpm.delayMinutes} Menit` 
          });

          // Timer Istirahat (Menit -> Milidetik)
          await new Promise(r => setTimeout(r, global.autojpm.delayMinutes * 60 * 1000));
      }
  }
}
export default autojpm;
