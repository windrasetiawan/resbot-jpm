import fs from "fs";
import path from "path";
import { pathToFileURL, fileURLToPath } from "url";
import { writeFile, mkdir } from "fs/promises";
import { downloadMediaMessage } from "baileys";
import clc from "cli-color";
import P from "pino";

// Import config untuk numberAllowed
import { numberAllowed } from "../config.js";
import { extractGroupLinks, addGroupLinks } from "./grupLinkStore.js";

// Setup __dirname untuk ES Module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set untuk log nomor yang ditolak
const loggedNumbers = new Set(); 

// --- FUNGSI DOWNLOAD MEDIA ---
async function downloadAndSaveMedia(sock, message, filename) {
  try {
    // Default simpan ke folder tmp
    const tmpDir = path.join(__dirname, "..", "tmp");
    
    // Pastikan folder tmp ada
    if (!fs.existsSync(tmpDir)) {
      await mkdir(tmpDir, { recursive: true });
    }

    const filePath = path.join(tmpDir, filename);

    // Download media
    const buffer = await downloadMediaMessage(
      message,
      "buffer",
      {},
      {
        logger: P({ level: "silent" }),
        reuploadRequest: sock.updateMediaMessage,
      }
    );

    // Tulis file
    await writeFile(filePath, buffer);
    return true; 
  } catch (error) {
    console.error("Gagal download media:", error);
    return false; 
  }
}

// --- HELPER LAINNYA ---
function isImageMessage(messageEvent) {
  if (messageEvent.messages && messageEvent.messages.length > 0) {
    const msg = messageEvent.messages[0].message;
    return !!(msg && msg.imageMessage);
  }
  return false;
}

function deleteFolderRecursive(basePath, folderName) {
  const folderPath = path.join(basePath, folderName);
  if (fs.existsSync(folderPath)) {
    fs.readdirSync(folderPath).forEach((file) => {
      const curPath = path.join(folderPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        deleteFolderRecursive(folderPath, file);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(folderPath);
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
  
  const colors = {
    red: clc.red,
    yellow: clc.yellow,
    blue: clc.blue,
    green: clc.green
  };
  
  console.log((colors[color] || colors.green)(`${time} ${message}`));
}

function displayTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function extractNumber(raw) {
  return raw?.split("@")[0].replace(/\D/g, "") || "unknown";
}

function isAllowed(senderNumber, fromMe) {
  const numericSender = extractNumber(senderNumber);
  
  // Cek apakah nomor ada di list numberAllowed
  if (!numberAllowed.includes(numericSender) && !fromMe) {
    if (!loggedNumbers.has(numericSender)) {
      console.log(clc.red(`[${displayTime()}] Akses ditolak: ${senderNumber}`));
      loggedNumbers.add(numericSender);
    }
    return false;
  }
  return true;
}

// Load Whitelist
function readWhitelist() {
  try {
    const filePath = path.join(process.cwd(), "ADDTIONAL", "whitelist.json");
    if (!fs.existsSync(filePath)) return [];
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return [];
  }
}

// Load Commands Dinamis
let commandHandlers = {};
(async () => {
    try {
        const pluginDir = path.join(__dirname, "..", "plugins");
        if (fs.existsSync(pluginDir)) {
            const files = fs.readdirSync(pluginDir).filter(f => f.endsWith(".js"));
            for (const file of files) {
                const module = await import(pathToFileURL(path.join(pluginDir, file)).href);
                commandHandlers[path.basename(file, ".js")] = module.default || module;
            }
        }
    } catch (e) {
        console.error("Gagal load plugins:", e);
    }
})();

// --- HANDLE COMMAND ---
async function handleCommand(sock, sender, command, key, senderNumber, messageEvent, fromMe) {
  // Parsing command
  const cleanCommand = command.trim();
  let firstWord = cleanCommand.split(" ")[0];
  
  // Hapus prefix jika ada
  if (global.prefix.some(p => firstWord.startsWith(p))) {
    firstWord = firstWord.substring(1);
  }

  // Cek handler plugin
  const handler = commandHandlers[firstWord];
  if (handler) {
    console.log(clc.yellow(`[${displayTime()}] CMD: ${firstWord} dari ${senderNumber}`));
    if (!isAllowed(senderNumber, fromMe)) return false;
    await handler(sock, sender, command, key, messageEvent);
  }
}

// --- EXPORT HARUS LENGKAP ---
export {
  readWhitelist,
  deleteFolderRecursive,
  ChangeStatus,
  getStatus,
  handleCommand,
  displayTime,
  isImageMessage,
  downloadAndSaveMedia, // <--- Pastikan ini ada!
  logWithTime
};
