import fs from "fs";
import path from "path";
import clc from "cli-color";
import { saveAutoJPMStatus, readAutoJPMStatus } from "./autojpmStatus.js";
import { readWhitelist } from "./utils.js";

async function resumeAutoJPM(sock) {
  const status = readAutoJPMStatus();
  if (!status.running || !status.text) return;

  const tmpPath = path.join(process.cwd(), "tmp", "autojpm_resume.jpeg");
  let hasImage = false;

  if (status.imageBase64) {
    try {
      const buf = Buffer.from(status.imageBase64.split(",").pop(), "base64");
      if (!fs.existsSync(path.dirname(tmpPath))) fs.mkdirSync(path.dirname(tmpPath), { recursive: true });
      fs.writeFileSync(tmpPath, buf);
      hasImage = true;
    } catch (e) { console.error("Gagal restore gambar JPM"); }
  }

  console.log(clc.cyan("🔁 MELANJUTKAN AUTOJPM..."));
  global.autojpmRunning = true;
  saveAutoJPMStatus(true, status.text, status.imageBase64);

  let putaran = 1;
  while (global.autojpmRunning) {
    const groups = await sock.groupFetchAllParticipating();
    const whitelist = readWhitelist();
    const targets = Object.values(groups).filter(g => !whitelist.includes(g.id));

    if (!targets.length) {
      console.log("⚠️ Tidak ada target grup.");
      break;
    }

    for (let i = 0; i < targets.length; i++) {
      if (!global.autojpmRunning) break;
      const g = targets[i];
      console.log(clc.green(`[Putaran ${putaran}] Mengirim ke ${g.subject}`));
      
      try {
        await sock.sendMessage(g.id, hasImage 
            ? { image: fs.readFileSync(tmpPath), caption: status.text } 
            : { text: status.text }
        );
      } catch {}
      
      await new Promise(r => setTimeout(r, global.jeda || 5000));
    }

    if (!global.autojpmRunning) break;
    
    const delayJam = global.autojpm?.loopDelayHours || 1;
    console.log(clc.yellow(`🔁 Putaran ${putaran} selesai. Istirahat ${delayJam} jam...`));
    await new Promise(r => setTimeout(r, delayJam * 3600000));
    putaran++;
  }
}

export default resumeAutoJPM;
