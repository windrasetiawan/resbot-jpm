import fs from "fs";
import { downloadAndSaveMedia, readWhitelist } from "../lib/utils.js";
import { saveAutoJPMStatus } from "../lib/autojpmStatus.js";

// Inisialisasi Global Variable (Biar tidak reset saat file direload)
global.autojpm = global.autojpm || { running: false, delay: 60 }; 

async function autojpm(sock, sender, message, key, messageEvent) {
  const parts = message.trim().split(" ");
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);
  const text = args.join(" ");

  // --- 1. SETTING WAKTU (Opsi Tambahan) ---
  if (command === ".autojpmsettime" || command === ".setautojpm") {
      if (!args[0]) return sock.sendMessage(sender, { text: "⚠️ Masukkan angka menit!\nContoh: .autojpmsettime 60" });
      
      let menit = parseFloat(args[0]);
      if (isNaN(menit)) return sock.sendMessage(sender, { text: "⚠️ Format salah. Harus angka." });

      global.autojpm.delay = menit;
      return sock.sendMessage(sender, { text: `✅ Waktu jeda loop diatur: ${menit} menit.` });
  }

  // --- 2. LOGIKA UTAMA AUTO JPM ---
  if (command === ".autojpm") {
      // Fitur STOP
      if (text.toLowerCase() === "stop" || text.toLowerCase() === "off") {
          global.autojpm.running = false;
          saveAutoJPMStatus(false);
          return sock.sendMessage(sender, { text: "🛑 Auto JPM Diberhentikan." });
      }

      // Cek apakah sudah berjalan
      if (global.autojpm.running) {
          return sock.sendMessage(sender, { text: "⚠️ Auto JPM sedang berjalan! Ketik *.autojpm stop* untuk berhenti." });
      }

      // START
      global.autojpm.running = true;
      let imgPath = null;
      let msgToSend = {};

      // --- A. DOWNLOAD GAMBAR (Aman & Anti-Error) ---
      let msgToDownload = null;
      // Cek gambar langsung atau reply
      if (messageEvent.message?.imageMessage) {
          msgToDownload = messageEvent;
      } else if (messageEvent.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage) {
          // Bikin objek palsu agar utils.js bisa baca
          msgToDownload = {
              message: messageEvent.message.extendedTextMessage.contextInfo.quotedMessage
          };
      }

      if (msgToDownload) {
          let success = await downloadAndSaveMedia(sock, msgToDownload, "jpm.jpg", "../tmp");
          if (success) imgPath = "./tmp/jpm.jpg";
      }

      // --- B. DETEKSI LINK UNTUK PREVIEW ---
      // Regex aman: Mencegah crash jika text kosong
      const linkRegex = /chat.whatsapp.com\/([0-9A-Za-z]{20,24})/i;
      const linkMatch = text ? text.match(linkRegex) : null;

      saveAutoJPMStatus(true, text, imgPath);
      await sock.sendMessage(sender, { text: `🚀 JPM Dimulai...\n⏱️ Jeda Loop: ${global.autojpm.delay} menit\n🎯 Target: Semua Grup` });

      // --- C. LOOPING ---
      while (global.autojpm.running) {
          const groups = await sock.groupFetchAllParticipating();
          const whitelist = readWhitelist();
          const targets = Object.values(groups).filter(g => !whitelist.includes(g.id));

          let successCount = 0;

          for (const g of targets) {
              if (!global.autojpm.running) break;

              // Konstruksi Pesan
              if (imgPath && fs.existsSync(imgPath)) {
                  // Kirim Gambar + Caption
                  msgToSend = { image: fs.readFileSync(imgPath), caption: text };
              } else {
                  // Kirim Teks (Cek Link Preview)
                  if (linkMatch) {
                      msgToSend = {
                          text: text,
                          contextInfo: {
                              externalAdReply: {
                                  title: "GABUNG GRUP DISINI",
                                  body: "Klik Untuk Join",
                                  thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/WhatsApp.svg/1200px-WhatsApp.svg.png",
                                  sourceUrl: linkMatch[0],
                                  mediaType: 1,
                                  renderLargerThumbnail: true
                              }
                          }
                      };
                  } else {
                      // Teks Biasa
                      msgToSend = { text: text || "JPM Broadcast" };
                  }
              }

              // Eksekusi Kirim (Pake Try-Catch biar 1 error gak bikin bot mati)
              try {
                  await sock.sendMessage(g.id, msgToSend);
                  successCount++;
                  // Delay acak 3-6 detik per grup (Anti-Banned)
                  await new Promise(r => setTimeout(r, Math.floor(Math.random() * 3000) + 3000));
              } catch (e) {}
          }
          
          if (!global.autojpm.running) break;

          // Laporan Selesai 1 Putaran
          await sock.sendMessage(sender, { 
              text: `✅ *Putaran Selesai*\n📨 Terkirim: ${successCount} Grup\n😴 Istirahat: ${global.autojpm.delay} Menit` 
          });

          // Jeda Panjang (Looping Timer)
          await new Promise(r => setTimeout(r, global.autojpm.delay * 60 * 1000));
      }
  }
}

export default autojpm;
