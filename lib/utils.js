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

// --- HELPER UTILS ---
function isImageMessage(messageEvent) {
    const msg = messageEvent.messages?.[0]?.message;
    return !!(msg?.imageMessage);
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

function isAllowed(senderNumber, fromMe) {
  const num = senderNumber.replace(/\D/g, "");
  if (!numberAllowed.includes(num) && !fromMe) {
    if (!loggedNumbers.has(num)) {
      console.log(clc.red(`[${displayTime()}] Akses ditolak: ${num}`));
      loggedNumbers.add(num);
    }
    return false;
  }
  return true;
}

function readWhitelist() {
  try {
    const p = path.join(process.cwd(), "ADDTIONAL", "whitelist.json");
    if (!fs.existsSync(p)) return [];
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch { return []; }
}

// --- COMMAND LOADER (ESM FIX) ---
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

async function handleCommand(sock, sender, command, key, senderNumber, messageEvent, fromMe) {
  const cleanCmd = command.trim();
  let firstWord = cleanCmd.split(" ")[0];
  if (global.prefix.some(p => firstWord.startsWith(p))) firstWord = firstWord.substring(1);

  const handler = commandHandlers[firstWord];
  if (handler) {
    console.log(clc.yellow(`[CMD] ${firstWord} dari ${senderNumber}`));
    if (!isAllowed(senderNumber, fromMe)) return false;
    await handler(sock, sender, command, key, messageEvent);
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
  logWithTime
};
