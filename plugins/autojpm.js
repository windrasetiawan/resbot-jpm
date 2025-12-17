import fs from "fs";
import { downloadAndSaveMedia, readWhitelist } from "../lib/utils.js";
import { saveAutoJPMStatus } from "../lib/autojpmStatus.js";

// Global Variable (Default 60 menit)
global.autojpm = global.autojpm || { delay: 60 };
global.autojpmRunning = false;

async function autojpm(sock, sender, message, key, messageEvent) {
  // Parsing Command yang lebih rapi
  const parts = message.trim().split(" "); 
  const command = parts[0].toLowerCase();
  const subCommand = parts[1] ? parts[1].toLowerCase() : "";
  const args = parts.slice(1);
  const text = args.join(" "); // Text full

  // ==========================================
  // 1. SETTING WAKTU (Cara Pakai: .autojpm time 60)
  // ==========================================
  if (subCommand === "time" || subCommand === "timer" || subCommand === "set") {
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
  if (command === ".autojpm" && args.length > 0) {
      if (global.autojpmRunning) {
          return sock.sendMessage(sender, { text: "⚠️ Auto JPM sedang berjalan! Ketik *.autojpm stop* untuk berhenti." });
      }

      global.autojpmRunning = true;
      let imgPath = null;
      
      // Object Pesan (Anti Crash)
      const msg = messageEvent; 

      // A. DOWNLOAD GAMBAR (Jika ada)
      let msgToDownload = null;
      if (msg.message?.imageMessage) {
          msgToDownload = msg;
      } else if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage) {
          msgToDownload = { message: msg.message.extendedTextMessage.contextInfo.quotedMessage };
      }

      if (msgToDownload) {
          if (await downloadAndSaveMedia(sock, msgToDownload, "jpm.jpg", "../tmp")) {
              imgPath = "./tmp/jpm.jpg";
          }
      }

      // B. SIAPKAN DATA PREVIEW (NATIVE LOOK)
      let linkPreviewData = null;
      const linkRegex = /chat.whatsapp.com\/([0-9A-Za-z]{20,24})/i;
      const linkMatch = text.match(linkRegex);

      if (linkMatch) {
          try {
              // 1. Ambil Kode Grup
              const inviteCode = linkMatch[1];
              // 2. Fetch Info Grup dari WA (Nama & ID)
              const groupInfo = await sock.groupGetInviteInfo(inviteCode);
              // 3. Fetch Foto Profil Grup (Resolusi Tinggi)
              let ppUrl;
              try {
                   ppUrl = await sock.profilePictureUrl(groupInfo.id, 'image');
              } catch {
                   // Fallback ke logo WA jika grup tidak punya foto
                   ppUrl = "https://chat.whatsapp.com/IRaOCbFdgaO6Rmx0tsgyyb?mode=ems_copy_t";
              }

              // 4. Susun Data Preview agar mirip asli
              linkPreviewData = {
                  title: groupInfo.subject || "WINTUNELING VPN", // Nama Grup Asli
                  body: "Ketuk untuk bergabung", // Tulisan kecil bawaan WA
                  thumbnailUrl: ppUrl, // Foto Grup Asli
                  sourceUrl: linkMatch[0],
                  mediaType: 1,
                  renderLargerThumbnail: true // Tampilan kartu besar (Invite Card)
              };

          } catch (e) {
              console.log("Gagal fetch info grup untuk preview:", e);
              // Jika gagal, biarkan kosong (nanti jadi teks biasa)
          }
      }

      saveAutoJPMStatus(true, text, imgPath);
      await sock.sendMessage(sender, { text: `🚀 *JPM DIMULAI*\n\n⏱️ Istirahat: ${global.autojpm.delay} menit\n🎯 Target: Semua Grup` });

      // C. LOOPING
      while (global.autojpmRunning) {
          const groups = await sock.groupFetchAllParticipating();
          const whitelist = readWhitelist();
          const targets = Object.values(groups).filter(g => !whitelist.includes(g.id));

          let successCount = 0;

          for (const g of targets) {
              if (!global.autojpmRunning) break;

              let msgToSend = {};

              // KASUS 1: ADA GAMBAR
              if (imgPath && fs.existsSync(imgPath)) {
                  msgToSend = { image: fs.readFileSync(imgPath), caption: text };
              } 
              // KASUS 2: TEKS + LINK PREVIEW (Native Look)
              else if (linkPreviewData) {
                  msgToSend = {
                      text: text,
                      contextInfo: {
                          externalAdReply: linkPreviewData
                      }
                  };
              } 
              // KASUS 3: TEKS BIASA
              else {
                  msgToSend = { text: text };
              }

              try {
                  await sock.sendMessage(g.id, msgToSend);
                  successCount++;
                  // Delay Random 4-8 Detik
                  await new Promise(r => setTimeout(r, Math.floor(Math.random() * 4000) + 4000));
              } catch (e) {}
          }
          
          if (!global.autojpmRunning) break;

          // LAPORAN
          await sock.sendMessage(sender, { 
              text: `✅ *Putaran Selesai*\n📨 Terkirim: ${successCount} Grup\n😴 Istirahat: ${global.autojpm.delay} Menit` 
          });

          await new Promise(r => setTimeout(r, global.autojpm.delay * 60 * 1000));
      }
  } else {
      // Halaman Help Jika Salah Ketik
      return sock.sendMessage(sender, { text: "⚠️ Format Salah!\n\n*Cara Pakai:*\n.autojpm <teks_promosi>\n.autojpm time 60\n.autojpm stop" });
  }
}
export default autojpm;
