import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { downloadMediaMessage } from "baileys";
import { numberAllowed } from "../config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CEK OWNER ---
function isOwner(sender) {
    if (!sender) return false;
    const num = sender.replace(/\D/g, ""); 
    if (numberAllowed && numberAllowed.includes(num)) return true;
    if (global.db && global.db.settings && global.db.settings.owners) {
        if (global.db.settings.owners.includes(num)) return true;
    }
    return false;
}

// --- DOWNLOAD MEDIA (FIXED) ---
async function downloadAndSaveMedia(message, filename) {
    try {
        const buffer = await downloadMediaMessage(message, "buffer", {});
        const filePath = path.join(process.cwd(), "tmp", filename);
        if (!fs.existsSync(path.dirname(filePath))) fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, buffer);
        return filePath;
    } catch (e) {
        console.error("Gagal download media:", e);
        return null;
    }
}

// --- STATUS HELPERS ---
function ChangeStatus(basePath, status) {
  const filePath = path.join(basePath, "status.txt");
  if (!fs.existsSync(basePath)) fs.mkdirSync(basePath, { recursive: true });
  fs.writeFileSync(filePath, status, "utf8");
}

function getStatus(basePath) {
  const filePath = path.join(basePath, "status.txt");
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
}

// --- READ WHITELIST (FIXED) ---
function readWhitelist() {
    try {
        const whitelistPath = "./ADDTIONAL/whitelist.json";
        if (!fs.existsSync(whitelistPath)) return [];
        return JSON.parse(fs.readFileSync(whitelistPath));
    } catch (e) {
        return [];
    }
}

export {
  isOwner,
  ChangeStatus,
  getStatus,
  readWhitelist,
  downloadAndSaveMedia
};
