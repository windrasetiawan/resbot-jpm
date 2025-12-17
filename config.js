import fs from 'fs';

// Pastikan folder DATABASE ada
if (!fs.existsSync('./DATABASE')) {
    fs.mkdirSync('./DATABASE', { recursive: true });
}

const ownerPath = './DATABASE/owner.json';
let ownerData = ["6285246154386"]; // Ganti dengan nomormu jika perlu (format 628xxx)

// Load owner dari file jika ada
if (fs.existsSync(ownerPath)) {
    try {
        ownerData = JSON.parse(fs.readFileSync(ownerPath));
    } catch { console.error("Gagal baca database owner"); }
} else {
    fs.writeFileSync(ownerPath, JSON.stringify(ownerData));
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
