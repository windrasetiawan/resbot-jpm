import fs from "fs";
import path from "path";
import { pathToFileURL, fileURLToPath } from "url";
import { writeFile, mkdir } from "fs/promises";
import { downloadMediaMessage } from "baileys";
import clc from "cli-color";
import P from "pino";
import { numberAllowed } from "../config.js"; // Pastikan config.js ada

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

// --- HELPER: READ WHITELIST (YANG ERROR TADI) ---
function readWhitelist() {
    try {
        const p = path.join(process.cwd(), "ADDTIONAL", "whitelist.json");
        if (!fs.existsSync(p)) return [];
        return JSON.parse(fs.readFileSync(p, "utf8"));
    } catch { return []; }
}

// --- IS OWNER CHECK ---
function isOwner(sender) {
    if (!sender) return false;
    const num = sender.replace(/\D/g, ""); 
    
    // 1. Cek Config.js (Hardcode)
    if (numberAllowed && numberAllowed.includes(num)) return true;

    // 2. Cek Database (Dynamic .addowner)
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
  fs.writeFileSync(filePath, status, "utf8");
}

function getStatus(basePath) {
  const filePath = path.join(basePath, "status.txt");
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
}

// --- HELPER LOGGING & UTILS LAIN ---
function logWithTime(message, color = "green") {
  const now = new Date();
  const time = `[${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}]`;
  const colors = { red: clc.red, yellow: clc.yellow, blue: clc.blue, green: clc.green };
  console.log((colors[color] || colors.green)(`${time} ${message}`));
}

function deleteFolderRecursive(basePath, folderName) {
  const folderPath = path.join(basePath, folderName);
  if (fs.existsSync(folderPath)) {
    fs.rmSync(folderPath, { recursive: true, force: true });
  }
}

// --- COMMAND HANDLER SYSTEM ---
let commandHandlers = {};

// Load semua plugin di folder plugins/
(async () => {
    const pluginDir = path.join(__dirname, "..", "plugins");
    if (fs.existsSync(pluginDir)) {
        const files = fs.readdirSync(pluginDir).filter(f => f.endsWith(".js"));
        for (const file of files) {
            try {
                // Import dinamis
                const module = await import(pathToFileURL(path.join(pluginDir, file)).href);
                // Simpan handler dengan key nama file (tanpa .js)
                // Contoh: menu.js -> commandHandlers['menu']
                commandHandlers[path.basename(file, ".js")] = module.default;
            } catch (e) {
                console.error(`Gagal load plugin ${file}:`, e);
            }
        }
    }
})();

async function handleCommand(sock, sender, command, key, senderNumber, msg, fromMe) {
    if (!command) return;

    // Bersihkan command
    const cleanCmd = command.trim();
    let firstWord = cleanCmd.split(" ")[0];
    
    // Hapus prefix jika ada (misal .menu -> menu, #menu -> menu)
    if (/^[./#]/.test(firstWord)) {
        firstWord = firstWord.substring(1);
    }
    firstWord = firstWord.toLowerCase();

    // Cari plugin yang sesuai nama command
    const handler = commandHandlers[firstWord];
    
    if (handler) {
        console.log(clc.yellow(`[CMD] ${firstWord} dari ${senderNumber}`));
        try {
            await handler(sock, sender, command, key, msg);
        } catch (err) {
            console.error(clc.red(`[ERROR] Plugin ${firstWord} crash:`), err);
        }
    }
}

// --- EXPORT SEMUA FUNGSI ---
export {
  readWhitelist,       // <-- INI YANG TADI ERROR (Sekarang sudah ada)
  downloadAndSaveMedia,
  ChangeStatus,
  getStatus,
  handleCommand,
  isOwner,
  logWithTime,
  deleteFolderRecursive
};
