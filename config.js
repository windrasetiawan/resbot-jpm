import fs from 'fs';

// Pastikan folder DATABASE ada
if (!fs.existsSync('./DATABASE')) {
    fs.mkdirSync('./DATABASE', { recursive: true });
}

const ownerPath = './DATABASE/owner.json';

// --- BAGIAN INI SAYA UBAH SESUAI LOG KAMU ---
// Nomor 49697553178765 diambil dari log "Akses ditolak" yang kamu kirim
let ownerData = ["49697553178765"]; 

// Kita paksa tulis ulang database agar nomor ini langsung aktif
try {
    fs.writeFileSync(ownerPath, JSON.stringify(ownerData));
} catch (e) {
    console.error("Gagal menulis database owner:", e);
}
// --------------------------------------------

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
