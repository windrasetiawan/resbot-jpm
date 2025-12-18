import fs from "fs";
import path from "path";
import { pathToFileURL, fileURLToPath } from "url";
import { writeFile, mkdir } from "fs/promises";
import { downloadMediaMessage } from "baileys";
import clc from "cli-color";
import P from "pino";
import { numberAllowed } from "../config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const loggedNumbers = new Set(); 

// --- HELPER: BACA DATABASE SETTINGS ---
// Kita butuh ini agar isOwner & isAllowed bisa membaca data owner baru
function getSettings() {
    try {
        const dbPath = path.join(process.cwd(), "DATABASE", "settings.json");
        if (fs.existsSync(dbPath)) {
            return JSON.parse(fs.readFileSync(dbPath));
        }
    } catch (e) {}
    return { mode: 'public', owners: [] };
}

// --- IS OWNER CHECK (UPDATED) ---
// Sekarang mengecek: Config.js (Owner Utama) ATAU Settings.json (Owner Tambahan)
function isOwner(sender) {
    if (!sender) return false;
    const num = sender.replace(/\D/g, ""); 
    
    // 1. Cek Owner Utama (dari config.js)
    if (numberAllowed.includes(num)) return true;

    // 2. Cek Owner Tambahan (dari .addowner / settings.json)
    const settings = getSettings();
    if (settings.owners && Array.isArray(settings.owners) && settings.owners.includes(num)) {
        return true;
    }

    return false;
}

// --- FUNGSI DOWNLOAD ---
async function downloadAndSaveMedia(sock, message, filename, folder = "../tmp") {
  try {
    const tmpDir = path.join(__dirname, folder);
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

// --- HELPER LAINNYA ---
function isImageMessage(msg) {
    const m = msg.message;
    return !!(m?.imageMessage);
}

function deleteFolderRecursive(basePath, folderName) {
  const folderPath = path.join(basePath, folderName);
  if (fs.existsSync(folderPath)) {
    fs.rmSync(folderPath, { recursive: true, force: true });
  }
}

function ChangeStatus(basePath, status) {
  const filePath = path.join(basePath, "status.txt");
  fs.writeFileSync(filePath, status, "utf8");
}

function getStatus(basePath) {
  const filePath = path.join(basePath, "status.txt");
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
}

function logWithTime(message, color = "green") {
  const now = new Date();
  const time = `[${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}]`;
  const colors = { red: clc.red, yellow: clc.yellow, blue: clc.blue, green: clc.green };
  console.log((colors[color] || colors.green)(`${time} ${message}`));
}

function displayTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

// --- [UPDATED] FUNGSI CEK AKSES (SELF / PUBLIC) ---
function isAllowed(senderNumber, fromMe) {
  const num = senderNumber.replace(/\D/g, "");
  
  // 1. Jika Pesan dari Bot Sendiri -> SELALU BOLEH
  if (fromMe) return true;

  // 2. Jika Owner (Utama atau Tambahan) -> SELALU BOLEH
  if (isOwner(senderNumber)) return true;

  // 3. Cek Mode Publik/Self
  const settings = getSettings();
  if (settings.mode === 'public') return true;

  // 4. Jika Mode SELF dan bukan owner -> TOLAK
  if (!loggedNumbers.has(num)) {
      console.log(clc.red(`[${displayTime()}] Akses Ditolak (Mode Self): ${num}`));
      loggedNumbers.add(num);
  }
  return false;
}

function readWhitelist() {
  try {
    const p = path.join(process.cwd(), "ADDTIONAL", "whitelist.json");
    if (!fs.existsSync(p)) return [];
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch { return []; }
}

// --- COMMAND LOADER ---
let commandHandlers = {};
(async () => {
    const pluginDir = path.join(__dirname, "..", "plugins");
    if (fs.existsSync(pluginDir)) {
        const files = fs.readdirSync(pluginDir).filter(f => f.endsWith(".js"));
        for (const file of files) {
            try {
                const module = await import(pathToFileURL(path.join(pluginDir, file)).href);
                commandHandlers[path.basename(file, ".js")] = module.default;
            } catch (e) {
                console.error(`Gagal load plugin ${file}:`, e.message);
            }
        }
    }
})();

async function handleCommand(sock, sender, command, key, senderNumber, msg, fromMe) {
  const cleanCmd = command.trim();
  let firstWord = cleanCmd.split(" ")[0];
  if (global.prefix.some(p => firstWord.startsWith(p))) firstWord = firstWord.substring(1);

  const handler = commandHandlers[firstWord];
  if (handler) {
    console.log(clc.yellow(`[CMD] ${firstWord} dari ${senderNumber}`));
    
    // Cek akses sebelum menjalankan command
    if (!isAllowed(senderNumber, fromMe)) return false; 
    
    // Jalankan plugin
    try {
        await handler(sock, sender, command, key, msg);
    } catch (err) {
        console.error(clc.red(`[ERROR] Plugin ${firstWord} crash:`), err);
        await sock.sendMessage(sender, { text: `❌ Terjadi kesalahan pada perintah: ${firstWord}\nLog: ${err.message}` }, { quoted: msg });
    }
  }
}

export {
  readWhitelist,
  deleteFolderRecursive,
  ChangeStatus,
  getStatus,
  handleCommand,
  displayTime,
  isImageMessage,
  downloadAndSaveMedia,
  logWithTime,
  isOwner
};
