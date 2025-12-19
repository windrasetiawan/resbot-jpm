import fs from 'fs';

// Memastikan folder DATABASE tersedia untuk menyimpan data owner
if (!fs.existsSync('./DATABASE')) {
    fs.mkdirSync('./DATABASE', { recursive: true });
}

const ownerPath = './DATABASE/owner.json';

// Nomor WhatsApp Owner utama (Ganti sesuai kebutuhan)
let ownerData = ["6285921645742"]; 

// Memuat data owner dari file jika tersedia
if (fs.existsSync(ownerPath)) {
    try {
        ownerData = JSON.parse(fs.readFileSync(ownerPath));
    } catch {
        console.error("Database owner rusak");
    }
}

export const numberAllowed = ownerData; 
global.prefix = [".", "#"]; 
global.jeda = 15000; 
global.name_script = "Resbot JPM V3";

// Pengaturan otomatis untuk fitur JPM
global.autojpm = {
  hidetag: false, 
  jedaPutaran: 10000, 
  loopDelayHours: 1 
};

/**
 * Fungsi untuk menambah nomor owner baru ke dalam database
 * @param {string} newNumber - Nomor WhatsApp baru
 */
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
