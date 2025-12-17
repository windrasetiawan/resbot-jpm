import clc from "cli-color";
import fs from "fs";
import { isImageMessage, downloadAndSaveMedia, readWhitelist } from "../lib/utils.js";
import { saveAutoJPMStatus } from "../lib/autojpmStatus.js";

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

global.autojpmRunning = false;

async function getAllGroups(sock) {
  try {
    const groups = await sock.groupFetchAllParticipating();
    return Object.values(groups).map((group) => ({
      id: group.id,
      name: group.subject,
      participants: group.participants,
    }));
  } catch (error) {
    console.error(clc.red("❌ Gagal mengambil grup:"), error);
    return [];
  }
}

async function autojpm(sock, sender, messages, key, messageEvent) {
  const parts = messages.trim().split(" ");
  const text = parts.slice(1).join(" ").trim(); 

  // --- SET TIMER ---
  if (messages.toLowerCase().startsWith("autojpmsettime")) {
      const hours = parseFloat(parts[1]);
      if (isNaN(hours)) return sock.sendMessage(sender, { text: "⚠️ Masukkan angka jam. Contoh: .autojpmsettime 1.5" });
      global.autojpm.loopDelayHours = hours;
      return sock.sendMessage(sender, { text: `✅ Waktu istirahat AutoJPM diset ke ${hours} jam.` });
  }

  // --- STOP ---
  if (text === "stop") {
    if (!global.autojpmRunning) return sock.sendMessage(sender, { text: "❌ AutoJPM tidak sedang berjalan." });
    global.autojpmRunning = false;
    saveAutoJPMStatus(false); 
    return sock.sendMessage(sender, { text: "🛑 AutoJPM telah dihentikan." });
  }

  if (global.autojpmRunning) return sock.sendMessage(sender, { text: "⚠️ AutoJPM sudah berjalan." });

  if (!text) {
    return sock.sendMessage(sender, {
      text: `*AUTOJPM MENU*\n\n➽ *.autojpm pesan*\n➽ *.autojpmsettime 1* (Set jeda 1 jam)\n➽ *.autojpm stop*`,
    });
  }

  global.autojpmRunning = true;
  let imagePath = null;

  if (isImageMessage(messageEvent)) {
    try {
      const filename = `jpm_${Date.now()}.jpeg`;
      if (await downloadAndSaveMedia(sock, messageEvent.messages?.[0], filename)) {
        imagePath = `./tmp/${filename}`;
      }
    } catch (error) { console.error(error); }
  }

  saveAutoJPMStatus(true, text, imagePath);
  await sock.sendMessage(sender, { text: `🚀 AutoJPM dimulai! Bot akan istirahat ${global.autojpm.loopDelayHours} jam setelah setiap putaran.` });

  let putaran = 1;
  while (global.autojpmRunning) {
    const allGroups = await getAllGroups(sock);
    const whitelist = readWhitelist();
    const targetGroups = whitelist ? allGroups.filter((g) => !whitelist.includes(g.id)) : allGroups;

    if (!targetGroups.length) {
      await sock.sendMessage(sender, { text: "⚠️ Tidak ada grup target." });
      break;
    }

    let groupCount = 1;
    for (const group of targetGroups) {
      if (!global.autojpmRunning) break;
      
      const mentions = global.autojpm.hidetag ? group.participants.map(p => p.id) : [];
      console.log(clc.green(`[Putaran ${putaran}] Mengirim ke: ${group.name}`));

      try {
        await sock.sendMessage(group.id, imagePath 
            ? { image: fs.readFileSync(imagePath), caption: text, mentions } 
            : { text, mentions });
      } catch (e) { console.log(clc.red(`Gagal: ${group.name}`)); }

      await sleep(global.jeda || 5000);
      groupCount++;
    }

    if (!global.autojpmRunning) break;

    // --- DELAY JAM ---
    const delayMs = global.autojpm.loopDelayHours * 60 * 60 * 1000;
    await sock.sendMessage(sender, { text: `✅ Putaran ${putaran} selesai. Bot istirahat ${global.autojpm.loopDelayHours} jam.` });
    
    console.log(clc.yellow(`Istirahat ${global.autojpm.loopDelayHours} jam...`));
    await sleep(delayMs); 
    putaran++;
  }

  global.autojpmRunning = false;
  await sock.sendMessage(sender, { text: "✅ AutoJPM selesai." });
}

export default autojpm;
