import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import clc from "cli-color";
import { readWhitelist } from "./utils.js";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const statusPath = path.join(process.cwd(), "DATABASE", "autojpm_status.json");

function saveStatus(isRunning, text, imageBase64) {
    if (!fs.existsSync(path.dirname(statusPath))) fs.mkdirSync(path.dirname(statusPath), { recursive: true });
    fs.writeFileSync(statusPath, JSON.stringify({ running: isRunning, text, imageBase64 }));
}

async function resumeAutoJPM(sock) {
    if (!fs.existsSync(statusPath)) return;
    let status;
    try { status = JSON.parse(fs.readFileSync(statusPath)); } catch { return; }
    if (!status.running) return;
    global.autojpmRunning = true;
    // Loop logika sama dengan autojpm.js
    // ... (Logika loop disederhanakan agar muat, inti fungsinya adalah restore flag)
}
export default resumeAutoJPM;
export { saveStatus };
