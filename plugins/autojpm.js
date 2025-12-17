import fs from "fs";
import { downloadAndSaveMedia, readWhitelist } from "../lib/utils.js";
import { saveAutoJPMStatus } from "../lib/autojpmStatus.js";

// Pastikan global variabel terinisialisasi
global.autojpm = global.autojpm || { loopDelayHours: 1 };
global.autojpmRunning = false;

async function autojpm(sock, sender, message, key, messageEvent) {
  const parts = message.trim().split(" ");
  const text = parts.slice(1).join(" ");

  // --- COMMAND: SET WAKTU ---
  if (parts[0] === ".autojpmsettime") {
      global.autojpm.loopDelayHours = parseFloat(parts[1]) || 1;
      return sock.sendMessage(sender, { text: `✅ Jeda loop: ${global.autojpm.loopDelayHours} jam` });
  }

  // --- COMMAND: AUTOJPM ---
  if (parts[0] === ".autojpm") {
      // STOP
      if (text === "stop") {
          global.autojpmRunning = false;
          saveAutoJPMStatus(false);
          return sock.sendMessage(sender, { text: "🛑 Berhenti." });
      }

      global.autojpmRunning = true;
      let imgPath = null;
      
      // [PERBAIKAN DISINI]
      // messageEvent sudah berupa object message, jadi langsung pakai saja.
      const msg = messageEvent; 

      // Cek Gambar (Langsung atau Quoted)
      let msgToDownload = null;
      if (msg.message?.imageMessage) {
          msgToDownload = msg;
      } else if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage) {
          msgToDownload = { message: msg.message.extendedTextMessage.contextInfo.quotedMessage };
      }

      // Download jika ada gambar
      if (msgToDownload) {
          if (await downloadAndSaveMedia(sock, msgToDownload, "jpm.jpg", "../tmp")) {
              imgPath = "./tmp/jpm.jpg";
          }
      }

      saveAutoJPMStatus(true, text, imgPath);
      await sock.sendMessage(sender, { text: `🚀 JPM Dimulai...\nJeda Loop: ${global.autojpm.loopDelayHours} jam` });

      // LOOPING
      while (global.autojpmRunning) {
          const groups = await sock.groupFetchAllParticipating();
          const whitelist = readWhitelist();
          const targets = Object.values(groups).filter(g => !whitelist.includes(g.id));

          for (const g of targets) {
              if (!global.autojpmRunning) break;
              try {
                  if (imgPath && fs.existsSync(imgPath)) {
                      await sock.sendMessage(g.id, { image: fs.readFileSync(imgPath), caption: text });
                  } else {
                      await sock.sendMessage(g.id, { text: text });
                  }
              } catch {}
              // Jeda antar grup 5 detik
              await new Promise(r => setTimeout(r, 5000));
          }
          
          if (!global.autojpmRunning) break;
          
          // Laporan Selesai & Istirahat
          await sock.sendMessage(sender, { text: `✅ Selesai 1 putaran. Istirahat ${global.autojpm.loopDelayHours} jam.` });
          await new Promise(r => setTimeout(r, global.autojpm.loopDelayHours * 3600000));
      }
  }
}
export default autojpm;
