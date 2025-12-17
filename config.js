import fs from 'fs';

// Pastikan folder DATABASE ada
if (!fs.existsSync('./DATABASE')) {
    fs.mkdirSync('./DATABASE', { recursive: true });
}

// Load Owner dari file
let ownerData = ["6285921645742"]; // Nomor default (GANTI DENGAN NOMORMU)
if (fs.existsSync('./DATABASE/owner.json')) {
    ownerData = JSON.parse(fs.readFileSync('./DATABASE/owner.json'));
} else {
    fs.writeFileSync('./DATABASE/owner.json', JSON.stringify(ownerData));
}

export const numberAllowed = ownerData; 

global.prefix = [".", "#"]; 
global.jeda = 15000; 
global.name_script = "Script Resbot Jpm V3";
global.version = "3.0";

global.autojpm = {
  hidetag: false, 
  jedaPutaran: 10000, 
  loopDelayHours: 1 // Default istirahat 1 jam
};

// Fungsi helper save owner
export function saveOwner(newNumber) {
    const clean = newNumber.replace(/\D/g, '');
    if (!ownerData.includes(clean)) {
        ownerData.push(clean);
        fs.writeFileSync('./DATABASE/owner.json', JSON.stringify(ownerData));
        return true;
    }
    return false;
}

export { ownerData };
