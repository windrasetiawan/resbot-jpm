import fs from 'fs';

// Pastikan folder DATABASE ada
if (!fs.existsSync('./DATABASE')) {
    fs.mkdirSync('./DATABASE', { recursive: true });
}

const ownerPath = './DATABASE/owner.json';

// --- MASUKKAN NOMOR OWNER DISINI ---
// Format: 628xxx (Tanpa spasi/plus)
let ownerData = [
    "6285921645742", 
    "49697553178765" 
]; 

// Load owner tambahan dari database (jika ada)
if (fs.existsSync(ownerPath)) {
    try {
        const dbOwners = JSON.parse(fs.readFileSync(ownerPath));
        if (Array.isArray(dbOwners)) {
            // Gabung dan hapus duplikat
            ownerData = [...new Set([...ownerData, ...dbOwners])];
        }
    } catch {
        console.error("Database owner corrupt, skip.");
    }
}

// Normalisasi nomor otomatis (08 -> 62)
ownerData = ownerData.map(num => {
    num = num.replace(/\D/g, '');
    if (num.startsWith('08')) return '62' + num.slice(1);
    return num;
});

// Export agar bisa dibaca oleh utils.js
export const numberAllowed = ownerData; 

// --- GLOBAL SETTINGS ---
global.prefix = [".", "#"]; 
global.jeda = 15000; // Delay dasar JPM
global.name_script = "Resbot JPM V4"; // Update Nama

// Settingan Default Auto JPM
global.autojpm = {
  hidetag: false, 
  jedaPutaran: 10000, 
  loopDelayHours: 1 
};
