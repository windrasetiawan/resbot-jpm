import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { writeFile, mkdir } from "fs/promises";
import { downloadMediaMessage } from "baileys";
import P from "pino";
import { numberAllowed } from "../config.js"; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- HELPER DATABASE ---
function getSettings() {
    try {
        const dbPath = path.join(process.cwd(), "DATABASE", "settings.json");
        if (fs.existsSync(dbPath)) return JSON.parse(fs.readFileSync(dbPath));
    } catch (e) {}
    return { mode: 'public', owners: [] };
}

// --- HELPER: READ WHITELIST ---
function readWhitelist() {
    try {
        const p = path.join(process.cwd(), "ADDTIONAL", "whitelist.json");
        // Jika file tidak ada, return array kosong biar ga crash
        if (!fs.existsSync(p)) return [];
        return JSON.parse(fs.readFileSync(p, "utf8"));
    } catch { return []; }
}

// --- IS OWNER CHECK ---
function isOwner(sender) {
    if (!sender) return false;
    const num = sender.replace(/\D/g, ""); 
    
    // 1. Cek Config.js
    if (numberAllowed && numberAllowed.includes(num)) return true;

    // 2. Cek Database
    const settings = getSettings();
    if (settings.owners && settings.owners.includes(num)) return true;

    return false;
}

// --- DOWNLOADER ---
async function downloadAndSaveMedia(sock, message, filename, folder = "../tmp") {
  try {
    const tmpDir = path.join(process.cwd(), folder); 
    if (!fs.existsSync(tmpDir)) await mkdir(tmpDir, { recursive: true });

    const filePath = path.join(tmpDir, filename);
    const buffer = await downloadMediaMessage(
      message, "buffer", {}, 
      { logger: P({ level: "silent" }), reuploadRequest: sock.updateMediaMessage }
    );
    await writeFile(filePath, buffer);
    return true; 
  } catch (error) {
    console.error("Gagal download media:", error);
    return false; 
  }
}

// --- HELPER STATUS SESSION ---
function ChangeStatus(basePath, status) {
  const filePath = path.join(basePath, "status.txt");
  // Pastikan folder ada sebelum tulis
  if (!fs.existsSync(basePath)) fs.mkdirSync(basePath, { recursive: true });
  fs.writeFileSync(filePath, status, "utf8");
}

function getStatus(basePath) {
  const filePath = path.join(basePath, "status.txt");
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
}

// --- EXPORT ---
export {
  readWhitelist,
  downloadAndSaveMedia,
  ChangeStatus,
  getStatus,
  isOwner
};
