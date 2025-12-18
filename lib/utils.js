import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
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
    if (global.db && global.db.settings && global.db.settings.owners) {
        if (global.db.settings.owners.includes(num)) return true;
    }

    return false;
}

// --- HELPER LAINNYA ---
function ChangeStatus(basePath, status) {
  const filePath = path.join(basePath, "status.txt");
  // Buat folder jika belum ada (mencegah error ENOENT)
  if (!fs.existsSync(basePath)) fs.mkdirSync(basePath, { recursive: true });
  fs.writeFileSync(filePath, status, "utf8");
}

function getStatus(basePath) {
  const filePath = path.join(basePath, "status.txt");
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
}

// [FIX] FUNGSI YANG SEBELUMNYA HILANG
function readWhitelist() {
    try {
        const whitelistPath = "./ADDTIONAL/whitelist.json";
        // Jika file tidak ada, kembalikan array kosong
        if (!fs.existsSync(whitelistPath)) return [];
        return JSON.parse(fs.readFileSync(whitelistPath));
    } catch (e) {
        return [];
    }
}

// Export semua fungsi
export {
  isOwner,
  ChangeStatus,
  getStatus,
  readWhitelist // <--- INI PENTING AGAR TIDAK ERROR LAGI
};
