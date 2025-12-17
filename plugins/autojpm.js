import fs from "fs";
import { downloadAndSaveMedia, readWhitelist } from "../lib/utils.js";
import { saveAutoJPMStatus } from "../lib/autojpmStatus.js";

global.autojpmRunning = false;

async function autojpm(sock, sender, message, key, messageEvent) {
  const parts = message.trim().split(" ");
  const text = parts.slice(1).join(" ");

  if (parts[0] === ".autojpmsettime") {
      global.autojpm.loopDelayHours = parseFloat(parts[1]) || 1;
      return sock.sendMessage(sender, { text: `✅ Jeda loop: ${global.autojpm.loopDelayHours} jam` });
  }

  if (parts[0] === ".autojpm") {
      if (text === "stop") {
          global.autojpmRunning = false;
          saveAutoJPMStatus(false);
          return sock.sendMessage(sender, { text: "🛑 Berhenti." });
      }

      global.autojpmRunning = true;
      let imgPath = null;
      // Cek gambar
      const msg = messageEvent.messages[0];
      if (msg.message?.imageMessage) {
          if (await downloadAndSaveMedia(sock, msg, "jpm.jpg", "../tmp")) imgPath = "./tmp/jpm.jpg";
      }

      saveAutoJPMStatus(true, text, imgPath);
      await sock.sendMessage(sender, { text: "🚀 JPM Dimulai..." });

      while (global.autojpmRunning) {
          const groups = await sock.groupFetchAllParticipating();
          const whitelist = readWhitelist();
          const targets = Object.values(groups).filter(g => !whitelist.includes(g.id));

          for (const g of targets) {
              if (!global.autojpmRunning) break;
              try {
                  await sock.sendMessage(g.id, imgPath 
                    ? { image: fs.readFileSync(imgPath), caption: text } 
                    : { text });
              } catch {}
              await new Promise(r => setTimeout(r, 5000));
          }
          
          if (!global.autojpmRunning) break;
          await sock.sendMessage(sender, { text: `✅ Selesai 1 putaran. Istirahat ${global.autojpm.loopDelayHours} jam.` });
          await new Promise(r => setTimeout(r, global.autojpm.loopDelayHours * 3600000));
      }
  }
}
export default autojpm;
