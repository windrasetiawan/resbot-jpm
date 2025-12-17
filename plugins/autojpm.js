import fs from "fs";
import { downloadAndSaveMedia, readWhitelist } from "../lib/utils.js";
import { saveAutoJPMStatus } from "../lib/autojpmStatus.js";

// Inisialisasi Global Variable agar tidak reset saat file direload
global.autojpm = global.autojpm || { running: false, delay: 60 }; 

async function autojpm(sock, sender, message, key, messageEvent) {
  const parts = message.trim().split(" ");
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);
  const text = args.join(" ");

  // --- COMMAND: SET WAKTU LOOPING ---
  if (command === ".autojpmsettime" || command === ".setautojpm") {
      if (!args[0]) return sock.sendMessage(sender, { text: "⚠️ Masukkan waktu dalam menit.\nContoh: .autojpmsettime 60" });
      
      let menit = parseFloat(args[0]);
      if (isNaN(menit)) return sock.sendMessage(sender, { text: "⚠️ Format waktu salah!" });

      global.autojpm.delay = menit;
      return sock.sendMessage(sender, { text: `✅ Waktu istirahat (loop) diatur ke: ${menit} menit.` });
  }

  // --- COMMAND: AUTO JPM ---
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

      global.autojpm.running = true;
      let imgPath = null;
      let msgToSend = {};

      // --- LOGIKA DOWNLOAD GAMBAR (FIXED) ---
      // Membuat objek pesan palsu agar fungsi download di utils.js bisa membacanya
      let msgToDownload = null;

      // 1. Cek apakah pesan utama adalah gambar
      if (messageEvent.message?.imageMessage) {
          msgToDownload = messageEvent;
      } 
      // 2. Cek apakah ini reply gambar (Quoted)
      else if (messageEvent.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage) {
          msgToDownload = {
              message: messageEvent.message.extendedTextMessage.contextInfo.quotedMessage
          };
      }

      // Lakukan Download jika ada gambar
      if (msgToDownload) {
          // Simpan sebagai jpm.jpg di folder tmp
          let success = await downloadAndSaveMedia(sock, msgToDownload, "jpm.jpg", "../tmp");
          if (success) {
              imgPath = "./tmp/jpm.jpg"; 
          } else {
              return sock.sendMessage(sender, { text: "❌ Gagal mendownload gambar." });
          }
      }

      // Cek Link Grup untuk Preview (Ad-Reply)
      const linkRegex = /chat.whatsapp.com\/([0-9A-Za-z]{20,24})/i;
      const linkMatch = text.match(linkRegex);

      saveAutoJPMStatus(true, text, imgPath);
      await sock.sendMessage(sender, { text: `🚀 JPM Dimulai...\n⏱️ Delay Loop: ${global.autojpm.delay} menit\n🎯 Target: Semua Grup` });

      // --- LOOPING UTAMA ---
      while (global.autojpm.running) {
          // Ambil daftar grup terbaru setiap putaran
          const groups = await sock.groupFetchAllParticipating();
          const whitelist = readWhitelist(); 
          const targets = Object.values(groups).filter(g => !whitelist.includes(g.id));

          let successCount = 0;

          for (const g of targets) {
              if (!global.autojpm.running) break;

              // KONSTRUKSI PESAN
              if (imgPath && fs.existsSync(imgPath)) {
                  // --- OPSI A: GAMBAR + TEXT ---
                  msgToSend = { 
                      image: fs.readFileSync(imgPath), 
                      caption: text 
                  };
              } else {
                  // --- OPSI B: TEXT SAJA / LINK PREVIEW ---
                  if (linkMatch) {
                      let groupLink = linkMatch[0];
                      msgToSend = {
                          text: text,
                          contextInfo: {
                              externalAdReply: {
                                  title: "KLIK DISINI UNTUK GABUNG",
                                  body: "Undangan Grup WhatsApp",
                                  thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/WhatsApp.svg/1200px-WhatsApp.svg.png",
                                  sourceUrl: groupLink,
                                  mediaType: 1,
                                  renderLargerThumbnail: true
                              }
                          }
                      };
                  } else {
                      msgToSend = { text: text };
                  }
              }

              try {
                  await sock.sendMessage(g.id, msgToSend);
                  successCount++;
                  // Delay acak 3-7 detik per grup (Anti-Ban)
                  const delayPerGrup = Math.floor(Math.random() * 4000) + 3000; 
                  await new Promise(r => setTimeout(r, delayPerGrup));
              } catch (e) {
                  // Silent fail jika gagal kirim ke satu grup
              }
          }
          
          if (!global.autojpm.running) break;

          // LAPORAN & ISTIRAHAT
          await sock.sendMessage(sender, { 
              text: `✅ *Selesai 1 Putaran*\n📨 Terkirim: ${successCount} Grup\n😴 Istirahat: ${global.autojpm.delay} Menit` 
          });

          // Jeda Loop (Menit -> Milidetik)
          await new Promise(r => setTimeout(r, global.autojpm.delay * 60 * 1000));
      }
  }
}

export default autojpm;
