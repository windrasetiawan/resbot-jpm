import fs from "fs";
import { downloadAndSaveMedia, readWhitelist } from "../lib/utils.js";
import { saveAutoJPMStatus } from "../lib/autojpmStatus.js";

// Global Variable
global.autojpm = global.autojpm || { delay: 60 };
global.autojpmRunning = false;

async function autojpm(sock, sender, message, key, messageEvent) {
  const parts = message.trim().split(" "); 
  const command = parts[0].toLowerCase();
  const subCommand = parts[1] ? parts[1].toLowerCase() : "";
  const args = parts.slice(1);
  const text = args.join(" "); 

  // ==========================================
  // ⚙️ SETTING (EDIT DISINI)
  // ==========================================
  const LINK_GRUP_UTAMA = "https://chat.whatsapp.com/IRaOCbFdgaO6Rmx0tsgyyb";
  
  // Masukkan link gambar jika ingin logo tetap. 
  // Jika dikosongkan (""), bot akan otomatis pakai FOTO PROFIL GRUP target.
  const LOGO_CUSTOM = ""; 
  // ==========================================


  // --- FITUR 1: SETTING WAKTU ---
  if (['time', 'timer', 'set'].includes(subCommand)) {
      const menit = parseFloat(parts[2]);
      if (isNaN(menit)) return sock.sendMessage(sender, { text: "⚠️ Masukkan angka menit!" });
      global.autojpm.delay = menit;
      return sock.sendMessage(sender, { text: `✅ Timer set: *${menit} menit*.` });
  }

  // --- FITUR 2: STOP JPM ---
  if (['stop', 'off'].includes(subCommand)) {
      global.autojpmRunning = false;
      saveAutoJPMStatus(false);
      return sock.sendMessage(sender, { text: "🛑 Auto JPM Berhasil Dihentikan." });
  }

  // --- FITUR 3: START JPM ---
  if (command === ".autojpm" && args.length > 0) {
      if (global.autojpmRunning) return sock.sendMessage(sender, { text: "⚠️ JPM sedang berjalan!" });

      global.autojpmRunning = true;
      let imgPath = null;
      
      // Cek Gambar Manual (File)
      const msg = messageEvent; 
      let msgToDownload = msg.message?.imageMessage ? msg : 
                          (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage ? 
                          { message: msg.message.extendedTextMessage.contextInfo.quotedMessage } : null);

      if (msgToDownload) {
          try {
              if (await downloadAndSaveMedia(sock, msgToDownload, "jpm.jpg", "../tmp")) {
                  imgPath = "./tmp/jpm.jpg";
              }
          } catch (e) { console.log(e); }
      }

      // --- MENYIAPKAN TOMBOL JOIN (PREVIEW) ---
      let linkPreviewData = null;

      if (!imgPath) {
          try {
              const inviteCodeMatch = LINK_GRUP_UTAMA.match(/chat.whatsapp.com\/([0-9A-Za-z]{20,24})/);
              
              if (inviteCodeMatch) {
                  const inviteCode = inviteCodeMatch[1];
                  
                  // Ambil Nama Grup
                  const groupInfo = await sock.groupGetInviteInfo(inviteCode);
                  const namaGrup = groupInfo.subject || "Join Group";
                  
                  // Logika Gambar (Logo Custom -> PP Grup -> Kosong)
                  let thumbnailGambar = LOGO_CUSTOM; 
                  
                  if (!thumbnailGambar) {
                      try {
                          thumbnailGambar = await sock.profilePictureUrl(groupInfo.id, 'image');
                      } catch {
                          thumbnailGambar = ""; // <--- DIBIARKAN KOSONG JIKA GAK ADA PP
                      }
                  }

                  linkPreviewData = {
                      title: namaGrup, 
                      body: `Grup di "${namaGrup}"`, 
                      thumbnailUrl: thumbnailGambar, // Bisa berisi URL atau string kosong
                      sourceUrl: LINK_GRUP_UTAMA,
                      mediaType: 1,
                      renderLargerThumbnail: true 
                  };
              }
          } catch (e) { 
              console.log("Gagal membuat preview:", e);
          }
      }

      saveAutoJPMStatus(true, text, imgPath);
      await sock.sendMessage(sender, { 
          text: `🚀 *JPM DIMULAI*\n🔗 *Link:* ${LINK_GRUP_UTAMA}\n⏱️ *Jeda:* ${global.autojpm.delay} menit` 
      });

      // --- LOOPING ---
      while (global.autojpmRunning) {
          const groups = await sock.groupFetchAllParticipating();
          const whitelist = readWhitelist();
          const targets = Object.values(groups).filter(g => !whitelist.includes(g.id));
          let successCount = 0;

          for (const g of targets) {
              if (!global.autojpmRunning) break;
              
              let msgToSend = {};
              
              if (imgPath && fs.existsSync(imgPath)) {
                  msgToSend = { image: fs.readFileSync(imgPath), caption: text };
              } 
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
              else {
                  msgToSend = { text: text };
              }

              try {
                  await sock.sendMessage(g.id, msgToSend);
                  successCount++;
                  await new Promise(r => setTimeout(r, Math.floor(Math.random() * 3000) + 5000));
              } catch (e) {}
          }
          
          if (!global.autojpmRunning) break;
          
          await sock.sendMessage(sender, { text: `✅ *Putaran Selesai*\n📨 Terkirim: ${successCount} Grup` });
          await new Promise(r => setTimeout(r, global.autojpm.delay * 60 * 1000));
      }
  } 
}
export default autojpm;
