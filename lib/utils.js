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

function getSettings() {
    try {
        const dbPath = path.join(process.cwd(), "DATABASE", "settings.json");
        if (fs.existsSync(dbPath)) return JSON.parse(fs.readFileSync(dbPath));
    } catch (e) {}
    return { mode: 'public', owners: [] };
}

function isOwner(sender) {
    if (!sender) return false;
    const num = sender.replace(/\D/g, ""); 
    
    // Cek Config.js
    if (numberAllowed.includes(num)) return true;

    // Cek Database (.addowner)
    const settings = getSettings();
    if (settings.owners && settings.owners.includes(num)) return true;

    return false;
}

async function downloadAndSaveMedia(sock, message, filename, folder = "../tmp") {
  try {
    const tmpDir = path.join(process.cwd(), folder); // Pake process.cwd() biar path aman
    if (!fs.existsSync(tmpDir)) await mkdir(tmpDir, { recursive: true });

    const filePath = path.join(tmpDir, filename);
    const buffer = await downloadMediaMessage(
      message, "buffer", {}, 
      { logger: P({ level: "silent" }), reuploadRequest: sock.updateMediaMessage }
    );
    await writeFile(filePath, buffer);
    return true; 
  } catch (error) {
    console.error("Gagal download:", error);
    return false; 
  }
}

// ... Sisanya helper standard (ChangeStatus, getStatus, logWithTime, dll) ...
// (Jika Anda punya helper lain, biarkan saja. Yang penting isOwner & downloadAndSaveMedia diupdate)
// Kode di bawah ini standard minimal:

function ChangeStatus(basePath, status) {
  const filePath = path.join(basePath, "status.txt");
  fs.writeFileSync(filePath, status, "utf8");
}

function getStatus(basePath) {
  const filePath = path.join(basePath, "status.txt");
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
}

// Command Handler
let commandHandlers = {};
(async () => {
    const pluginDir = path.join(__dirname, "..", "plugins");
    if (fs.existsSync(pluginDir)) {
        const files = fs.readdirSync(pluginDir).filter(f => f.endsWith(".js"));
        for (const file of files) {
            try {
                const module = await import(pathToFileURL(path.join(pluginDir, file)).href);
                commandHandlers[path.basename(file, ".js")] = module.default;
            } catch (e) {}
        }
    }
})();

async function handleCommand(sock, sender, command, key, senderNumber, msg, fromMe) {
  // Logic eksekusi command
}

export {
  downloadAndSaveMedia,
  ChangeStatus,
  getStatus,
  handleCommand,
  isOwner
};
