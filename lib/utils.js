import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { downloadMediaMessage } from "@whiskeysockets/baileys";
import P from "pino";
import { numberAllowed } from "../config.js"; 

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getSettings() {
    try {
        const p = path.join(process.cwd(), "DATABASE", "settings.json");
        return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p)) : { mode: 'public', owners: [] };
    } catch { return { mode: 'public', owners: [] }; }
}

function isOwner(sender) {
    if (!sender) return false;
    const num = sender.replace(/\D/g, ""); 
    if (numberAllowed.includes(num)) return true;
    const settings = getSettings();
    if (settings.owners && settings.owners.includes(num)) return true; 
    return false;
}

function readWhitelist() {
    try {
        const p = path.join(process.cwd(), "ADDTIONAL", "whitelist.json");
        return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p)) : [];
    } catch { return []; }
}

async function downloadAndSaveMedia(sock, message, filename) {
  try {
    const tmpDir = path.join(process.cwd(), "tmp"); 
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    
    // Perbaikan logic download agar kompatibel dengan quoted message
    const msg = message.message || message; 
    const buffer = await downloadMediaMessage(
      { message: msg }, "buffer", {}, 
      { logger: P({ level: "silent" }), reuploadRequest: sock.updateMediaMessage }
    );
    const filePath = path.join(tmpDir, filename);
    fs.writeFileSync(filePath, buffer);
    return filePath; 
  } catch (e) { 
      console.error("Download Error:", e);
      return null; 
  }
}

function ChangeStatus(basePath, status) {
  const p = path.join(basePath, "status.txt");
  if (!fs.existsSync(basePath)) fs.mkdirSync(basePath, { recursive: true });
  fs.writeFileSync(p, status, "utf8");
}
function getStatus(basePath) {
  const p = path.join(basePath, "status.txt");
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
}

const spintax = (text) => {
    return text.replace(/{([^{}]+)}/g, (match, choices) => {
        const options = choices.split("|");
        return options[Math.floor(Math.random() * options.length)];
    });
};

export { isOwner, readWhitelist, downloadAndSaveMedia, ChangeStatus, getStatus, spintax };
