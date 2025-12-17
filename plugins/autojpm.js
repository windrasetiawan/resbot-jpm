import fs from "fs";
import { downloadAndSaveMedia, readWhitelist } from "../lib/utils.js";
import { saveAutoJPMStatus } from "../lib/autojpmStatus.js";

// Global Variable (Default 60 menit)
global.autojpm = global.autojpm || { delay: 60 };
global.autojpmRunning = false;

async function autojpm(sock, sender, message, key, messageEvent) {
  const parts = message.trim().split(" ");
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);
  const text = args.join(" ");

  // --- 1. SETTING WAKTU ISTIRAHAT (FIXED) ---
  if (command === ".autojpmsettime" || command === ".setautojpm") {
      if (!args[0]) return sock.sendMessage(sender, { text: "⚠️ Masukkan angka menit!\nContoh: *.autojpmsettime 60*" });
      
      const menit = parseFloat(args[0]);
      if (isNaN(menit)) return sock.sendMessage(sender, { text: "⚠️ Format salah. Harus angka." });

      global.autojpm.delay = menit;
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

      // Ambil Pesan (Anti Crash)
      const msg = messageEvent; 

      // --- A. LOGIKA DOWNLOAD GAMBAR ---
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

      // --- B. DETEKSI LINK UNTUK PREVIEW (FIXED) ---
      // Mencari link grup WA pertama untuk dijadikan tombol
      const linkRegex = /chat.whatsapp.com\/([0-9A-Za-z]{20,24})/i;
      const linkMatch = text.match(linkRegex);

      saveAutoJPMStatus(true, text, imgPath);
      await sock.sendMessage(sender, { text: `🚀 *JPM DIMULAI*\n\n⏱️ Istirahat: ${global.autojpm.delay} menit\n🎯 Target: Semua Grup` });

      // --- C. LOOPING PENYEBARAN ---
      while (global.autojpmRunning) {
          const groups = await sock.groupFetchAllParticipating();
          const whitelist = readWhitelist(); //
          const targets = Object.values(groups).filter(g => !whitelist.includes(g.id));

          let successCount = 0;

          for (const g of targets) {
              if (!global.autojpmRunning) break;

              // --- LOGIKA PEMBUATAN PESAN ---
              if (imgPath && fs.existsSync(imgPath)) {
                  // KASUS 1: GAMBAR + CAPTION
                  msgToSend = { image: fs.readFileSync(imgPath), caption: text };
              } else {
                  // KASUS 2: TEXT SAJA (Cek Preview)
                  if (linkMatch) {
                      // Ada Link Grup -> Buat AdReply (Kartu)
                      msgToSend = {
                          text: text,
                          contextInfo: {
                              externalAdReply: {
                                  title: "GABUNG GRUP SEKARANG", // Judul besar
                                  body: "Klik di sini untuk bergabung", // Tulisan kecil
                                  thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/WhatsApp.svg/1200px-WhatsApp.svg.png", // Logo WA
                                  sourceUrl: linkMatch[0], // Link grup yang terdeteksi
                                  mediaType: 1,
                                  renderLargerThumbnail: true
                              }
                          }
                      };
                  } else {
                      // Tidak Ada Link -> Text Biasa
                      msgToSend = { text: text };
                  }
              }

              // KIRIM PESAN
              try {
                  await sock.sendMessage(g.id, msgToSend);
                  successCount++;
                  // Delay aman 3-6 detik per grup
                  await new Promise(r => setTimeout(r, Math.floor(Math.random() * 3000) + 3000));
              } catch (e) {}
          }
          
          if (!global.autojpmRunning) break;

          // LAPORAN & ISTIRAHAT
          await sock.sendMessage(sender, { 
              text: `✅ *Selesai 1 Putaran*\n📨 Terkirim: ${successCount} Grup\n😴 Istirahat: ${global.autojpm.delay} Menit` 
          });

          // Timer Istirahat (Menit -> Milidetik)
          await new Promise(r => setTimeout(r, global.autojpm.delay * 60 * 1000));
      }
  }
}
export default autojpm;
