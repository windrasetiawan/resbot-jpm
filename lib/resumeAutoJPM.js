import fs from "fs";
import path from "path";
import clc from "cli-color";
import { saveAutoJPMStatus, readAutoJPMStatus } from "./autojpmStatus.js";
import { readWhitelist } from "./utils.js";

// Helper: Ambil semua grup
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

// Helper: Sleep
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// FUNGSI UTAMA RESUME
async function resumeAutoJPM(sock) {
  const status = readAutoJPMStatus();

  // Jika tidak ada status running, stop
  if (!status.running || !status.text) {
    return;
  }

  const tmpDir = path.join(process.cwd(), "tmp");
  const tmpImagePath = path.join(tmpDir, "autojpm_resume.jpeg");

  // Pastikan folder ./tmp ada
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  // Restore gambar jika ada
  let imageBuffer = null;
  if (status.imageBase64) {
    try {
      const base64Data = status.imageBase64.split(",").pop();
      imageBuffer = Buffer.from(base64Data, "base64");
      fs.writeFileSync(tmpImagePath, imageBuffer);
    } catch (err) {
      console.error("❌ Gagal decode gambar dari base64:", err.message);
    }
  }

  console.log(clc.cyan("🔁 MELANJUTKAN AUTOJPM SETELAH RESTART..."));

  global.autojpmRunning = true;

  // Save lagi status (refresh)
  saveAutoJPMStatus(true, status.text, status.imageBase64);

  let putaran = 1;
  while (global.autojpmRunning) {
    const allGroups = await getAllGroups(sock);
    if (!allGroups.length) {
      console.log("❌ Tidak ada grup ditemukan.");
      break;
    }

    const whitelist = readWhitelist();
    const targetGroups = whitelist
      ? allGroups.filter((group) => !whitelist.includes(group.id))
      : allGroups;

    if (targetGroups.length === 0) {
      console.log("⚠️ Semua grup whitelist. AutoJPM berhenti.");
      break;
    }

    let groupCount = 1;
    for (const group of targetGroups) {
      if (!global.autojpmRunning) break;

      const participants = Array.isArray(group?.participants) ? group.participants : [];
      const mentions = global.autojpm && global.autojpm.hidetag ? participants.map((p) => p.id) : [];

      console.log(
        clc.green(
          `AUTOJPM [Putaran ${putaran}] [${groupCount}/${targetGroups.length}] -> ${group.name}`
        )
      );

      try {
        await sock.sendMessage(group.id, imageBuffer
            ? { image: fs.readFileSync(tmpImagePath), caption: status.text, mentions }
            : { text: status.text, mentions }
        );
      } catch (error) {
        console.error(clc.red(`❌ Gagal kirim ke ${group.name}`));
      }

      await sleep(global.jeda || 5000);
      groupCount++;
    }

    if (!global.autojpmRunning) break;

    // Jeda Waktu Loop (Mengambil dari config jika ada, default 1 jam)
    const delayJam = global.autojpm?.loopDelayHours || 1;
    const delayMs = delayJam * 60 * 60 * 1000;

    console.log(clc.yellow(`🔁 Putaran ${putaran} selesai. Istirahat ${delayJam} jam...`));
    
    // Tunggu (Sleep)
    await sleep(delayMs);
    putaran++;
  }
}

// --- BARIS INI WAJIB ADA ---
export default resumeAutoJPM;
