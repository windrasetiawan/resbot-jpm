import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { writeFile, mkdir } from "fs/promises";
import { downloadMediaMessage } from "baileys";
import clc from "cli-color";
import P from "pino";
import { numberAllowed } from "../config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CEK OWNER (GLOBAL DB + CONFIG) ---
function isOwner(sender) {
    if (!sender) return false;
    const num = sender.replace(/\D/g, ""); 
    
    // 1. Cek Config.js (Hardcode)
    if (numberAllowed && numberAllowed.includes(num)) return true;

    // 2. Cek Database Global (Dynamic .addowner)
    // Kita gunakan global.db.settings agar sinkron
    if (global.db && global.db.settings && global.db.settings.owners) {
        if (global.db.settings.owners.includes(num)) return true;
    }

    return false;
}

// --- HELPER LAINNYA ---
function ChangeStatus(basePath, status) {
  const filePath = path.join(basePath, "status.txt");
  fs.writeFileSync(filePath, status, "utf8");
}

function getStatus(basePath) {
  const filePath = path.join(basePath, "status.txt");
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
}

export {
  isOwner,
  ChangeStatus,
  getStatus
};
