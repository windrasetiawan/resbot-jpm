import fs from 'fs';

// Pastikan folder DATABASE ada
if (!fs.existsSync('./DATABASE')) {
    fs.mkdirSync('./DATABASE', { recursive: true });
}

const ownerPath = './DATABASE/owner.json';

// --- MASUKKAN NOMOR ANDA DISINI ---
// Gunakan format 628xxx (tanpa + atau spasi)
// Anda bisa memasukkan lebih dari satu nomor
let ownerData = [
    "6285921645742", 
    "49697553178765" 
]; 

// Load owner tambahan dari database (jika ada)
if (fs.existsSync(ownerPath)) {
    try {
        const dbOwners = JSON.parse(fs.readFileSync(ownerPath));
        if (Array.isArray(dbOwners)) {
            // Gabungkan nomor config dan database, hindari duplikat
            ownerData = [...new Set([...ownerData, ...dbOwners])];
        }
    } catch {
        console.error("Database owner rusak/kosong, menggunakan default config.");
    }
}

// Normalisasi nomor (Ubah 08 jadi 62 otomatis)
ownerData = ownerData.map(num => {
    num = num.replace(/\D/g, ''); // Hapus karakter non-angka
    if (num.startsWith('08')) return '62' + num.slice(1);
    return num;
});

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
    let clean = newNumber.replace(/\D/g, '');
    if (clean.startsWith('08')) clean = '62' + clean.slice(1);
    
    if (!ownerData.includes(clean)) {
        ownerData.push(clean);
        // Simpan hanya ke file JSON database, bukan merubah hardcode config.js
        if (fs.existsSync(ownerPath)) {
            let currentDb = [];
            try { currentDb = JSON.parse(fs.readFileSync(ownerPath)); } catch {}
            if (!currentDb.includes(clean)) {
                currentDb.push(clean);
                fs.writeFileSync(ownerPath, JSON.stringify(currentDb));
            }
        } else {
             fs.writeFileSync(ownerPath, JSON.stringify([clean]));
        }
        return true;
    }
    return false;
}

export { ownerData };
