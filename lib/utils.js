import fs from "fs";
import path from "path";
import { downloadMediaMessage } from "@whiskeysockets/baileys";
import { numberAllowed } from "../config.js"; 

export function isOwner(sender) {
    const num = sender.replace(/\D/g, ""); 
    const settings = JSON.parse(fs.readFileSync("./DATABASE/settings.json"));
    return numberAllowed.includes(num) || (settings.owners && settings.owners.includes(num));
}
export function readWhitelist() {
    const p = "./ADDTIONAL/whitelist.json";
    return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p)) : [];
}
export async function downloadAndSaveMedia(sock, message, filename) {
    const msg = message.message || message;
    const buffer = await downloadMediaMessage({ message: msg }, "buffer", {});
    const p = path.join("./tmp", filename);
    if (!fs.existsSync("./tmp")) fs.mkdirSync("./tmp");
    fs.writeFileSync(p, buffer);
    return p;
}
export const spintax = (text) => text.replace(/{([^{}]+)}/g, (match, choices) => choices.split("|")[Math.floor(Math.random() * choices.split("|").length)]);
export function ChangeStatus(p, s) {
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
    fs.writeFileSync(path.join(p, "status.txt"), s);
}
