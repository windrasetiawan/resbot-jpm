import fs from 'fs';

// Pastikan folder DATABASE ada
if (!fs.existsSync('./DATABASE')) {
    fs.mkdirSync('./DATABASE', { recursive: true });
}

const ownerPath = './DATABASE/owner.json';

// --- GANTI DENGAN NOMOR WA ANDA (Format 628xxx) ---
let ownerData = ["6285921645742"]; // <--- UBAH INI

// Load owner dari database jika ada
if (fs.existsSync(ownerPath)) {
    try {
        ownerData = JSON.parse(fs.readFileSync(ownerPath));
    } catch {
        console.error("Database owner rusak, menggunakan default.");
    }
}

export const numberAllowed = ownerData; 

global.prefix = [".", "#"]; 
global.jeda = 15000; 
global.name_script = "Resbot JPM V3";

global.autojpm = {
  hidetag: false, 
  jedaPutaran: 10000, 
  loopDelayHours: 1 
};

export function saveOwner(newNumber) {
    const clean = newNumber.replace(/\D/g, '');
    if (!ownerData.includes(clean)) {
        ownerData.push(clean);
        fs.writeFileSync(ownerPath, JSON.stringify(ownerData));
        return true;
    }
    return false;
}

export { ownerData };
