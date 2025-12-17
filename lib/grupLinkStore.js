import fs from 'fs';
import path from 'path';

const dataPath = path.join(process.cwd(), 'DATABASE', 'data_grub.json');
if (!fs.existsSync(path.dirname(dataPath))) fs.mkdirSync(path.dirname(dataPath), { recursive: true });

let groupLinksSet = new Set();

if (fs.existsSync(dataPath)) {
    try {
        const json = JSON.parse(fs.readFileSync(dataPath));
        if (Array.isArray(json)) groupLinksSet = new Set(json);
    } catch {}
}

export function addGroupLinks(newLinks) {
    const links = Array.isArray(newLinks) ? newLinks : [newLinks];
    let added = false;
    links.forEach(l => {
        if (!groupLinksSet.has(l)) { groupLinksSet.add(l); added = true; }
    });
    if (added) fs.writeFileSync(dataPath, JSON.stringify([...groupLinksSet], null, 2));
}

export function extractGroupLinks(text) {
    return text?.match(/https?:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{20,}/g) || [];
}
