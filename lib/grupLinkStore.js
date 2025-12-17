import fs from 'fs';
import path from 'path';

// Tentukan path ke database
const dataPath = path.join(process.cwd(), 'DATABASE', 'data_grub.json');

// Pastikan folder DATABASE ada
const dirPath = path.dirname(dataPath);
if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
}

let groupLinksSet = new Set();
let saveTimeout = null;

// Fungsi Load Database
function loadGroupLinks() {
    if (fs.existsSync(dataPath)) {
        try {
            const raw = fs.readFileSync(dataPath, 'utf8');
            const json = JSON.parse(raw);
            if (Array.isArray(json)) {
                groupLinksSet = new Set(json);
            }
        } catch (err) {
            console.error('❌ Gagal membaca data_grub.json:', err.message);
        }
    }
}

// Fungsi Simpan (Debounce)
function scheduleSave() {
    if (saveTimeout) return;
    saveTimeout = setTimeout(() => {
        const data = Array.from(groupLinksSet);
        try {
            fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
        } catch (e) {
            console.error("Gagal menyimpan database grup:", e);
        }
        saveTimeout = null;
    }, 5000);
}

// --- EXPORT FUNCTION SECARA LANGSUNG ---

export function addGroupLinks(newLinks) {
    let added = false;
    const links = Array.isArray(newLinks) ? newLinks : [newLinks];
    
    for (const link of links) {
        if (typeof link === 'string' && !groupLinksSet.has(link)) {
            groupLinksSet.add(link);
            added = true;
        }
    }
    if (added) scheduleSave();
}

export function extractGroupLinks(text) {
    if (!text) return [];
    const regex = /https?:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{20,}/g;
    return text.match(regex) || [];
}

// Init Load
loadGroupLinks();
