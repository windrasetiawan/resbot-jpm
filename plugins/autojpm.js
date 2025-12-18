import fs from "fs";
import { downloadAndSaveMedia, readWhitelist } from "../lib/utils.js";
import { saveAutoJPMStatus } from "../lib/autojpmStatus.js";

// Global Variable (Default 60 menit)
global.autojpm = global.autojpm || { delay: 60 };
global.autojpmRunning = false;

async function autojpm(sock, sender, message, key, messageEvent) {
  // Parsing Command
  const parts = message.trim().split(" "); 
  const command = parts[0].toLowerCase();
  const subCommand = parts[1] ? parts[1].toLowerCase() : "";
  const args = parts.slice(1);
  const text = args.join(" "); // Text full promosi

  // ==========================================
  // 1. SETTING WAKTU (Contoh: .autojpm time 60)
  // ==========================================
  if (subCommand === "time" || subCommand === "timer" || subCommand === "set") {
      const menit = parseFloat(parts[2]);
      if (isNaN(menit)) return sock.sendMessage(sender, { text: "⚠️ Masukkan angka menit!\nContoh: *.autojpm time 60*" });
      
      global.autojpm.delay = menit;
      return sock.sendMessage(sender, { text: `✅ Waktu istirahat diatur menjadi: *${menit} menit*.` });
  }

  // ==========================================
  // 2. STOP JPM (Contoh: .autojpm stop)
  // ==========================================
  if (subCommand === "stop" || subCommand === "off") {
      global.autojpmRunning = false;
      saveAutoJPMStatus(false);
      return sock.sendMessage(sender, { text: "🛑 Auto JPM Berhasil Dihentikan." });
  }

  // ==========================================
  // 3. START JPM (Contoh: .autojpm Teks...)
  // ==========================================
  if (command === ".autojpm" && args.length > 0) {
      if (global.autojpmRunning) {
          return sock.sendMessage(sender, { text: "⚠️ Auto JPM sedang berjalan! Ketik *.autojpm stop* untuk berhenti." });
      }

      global.autojpmRunning = true;
      let imgPath = null;
      
      const msg = messageEvent; 

      // A. CEK DOWNLOAD GAMBAR (Jika user melampirkan gambar manual)
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

      // B. SIAPKAN DATA PREVIEW (NATIVE GROUP LOOK)
      let linkPreviewData = null;
      
      // Regex Link WA (Aman menangkap kode unik meski ada ?mode=...)
      const linkRegex = /chat.whatsapp.com\/([0-9A-Za-z]{20,24})/;
      const linkMatch = text.match(linkRegex);

      // Hanya buat preview jika tidak ada gambar manual
      if (linkMatch && !imgPath) {
          try {
              const inviteCode = linkMatch[1]; // Mengambil 'IRaOCbFdga...'
              
              // 1. Ambil Info Grup (Nama Grup)
              const groupInfo = await sock.groupGetInviteInfo(inviteCode);
              
              // 2. Ambil Foto Profil (Logika Smart Fallback)
              let ppUrl;
              try {
                   // Coba ambil PP Grup Target
                   ppUrl = await sock.profilePictureUrl(groupInfo.id, 'image');
              } catch {
                   // Jika Grup Gak Punya PP, Ambil PP Bot
                   try {
                       ppUrl = await sock.profilePictureUrl(sock.user.id, 'image');
                   } catch {
                       // Jika Bot Gak Punya PP, Pakai Gambar Default
                       ppUrl = "https://telegra.ph/file/0c32e7f8d68962d85196f.jpg";
                   }
              }

              // 3. Susun Tampilan Kartu
              linkPreviewData = {
                  title: groupInfo.subject || "Join WhatsApp Group", 
                  body: `Bergabunglah bersama kami!`, 
                  thumbnailUrl: ppUrl, 
                  sourceUrl: `https://chat.whatsapp.com/${inviteCode}`, // Link Bersih
                  mediaType: 1,
                  renderLargerThumbnail: true 
              };

          } catch (e) {
              console.log("Gagal fetch info grup:", e);
          }
      }

      saveAutoJPMStatus(true, text, imgPath);
      
      await sock.sendMessage(sender, { 
          text: `🚀 *JPM DIMULAI*\n\n📝 *Preview:* ${linkPreviewData ? "✅ NATIVE CARD" : "❌ TEKS BIASA"}\n⏱️ *Jeda:* ${global.autojpm.delay} menit` 
      });

      // C. LOOPING KIRIM PESAN
      while (global.autojpmRunning) {
          const groups = await sock.groupFetchAllParticipating();
          const whitelist = readWhitelist();
          const targets = Object.values(groups).filter(g => !whitelist.includes(g.id));

          let successCount = 0;

          for (const g of targets) {
              if (!global.autojpmRunning) break;

              let msgToSend = {};

              // Prioritas 1: Gambar Manual
              if (imgPath && fs.existsSync(imgPath)) {
                  msgToSend = { image: fs.readFileSync(imgPath), caption: text };
              } 
              // Prioritas 2: Kartu Native (Link Preview)
              else if (linkPreviewData) {
                  msgToSend = {
                      text: text,
                      contextInfo: {
                          externalAdReply: linkPreviewData,
                          forwardingScore: 999,
                          isForwarded: true
                      }
                  };
              } 
              // Prioritas 3: Teks Biasa
              else {
                  msgToSend = { text: text };
              }

              try {
                  await sock.sendMessage(g.id, msgToSend);
                  successCount++;
                  // Delay per pesan (5-8 detik) agar aman
                  await new Promise(r => setTimeout(r, Math.floor(Math.random() * 3000) + 5000));
              } catch (e) {}
          }
          
          if (!global.autojpmRunning) break;

          // LAPORAN & ISTIRAHAT
          await sock.sendMessage(sender, { 
              text: `✅ *Selesai 1 Putaran*\n📨 Terkirim: ${successCount} Grup\n😴 Istirahat ${global.autojpm.delay} menit.` 
          });

          await new Promise(r => setTimeout(r, global.autojpm.delay * 60 * 1000));
      }
  } else {
      return sock.sendMessage(sender, { text: "⚠️ *Cara Pakai:*\n.autojpm <kata-kata promosi + link grup>\n\nContoh:\n.autojpm Ayo join sini https://chat.whatsapp.com/IRaOCbFdgaO6Rmx0tsgyyb" });
  }
}
export default autojpm;
