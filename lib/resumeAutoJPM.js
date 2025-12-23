import fs from "fs";
import path from "path";

const dbPath = path.join(process.cwd(), "DATABASE", "data_grub.json");

if (!fs.existsSync(dbPath)) {
    if (!fs.existsSync(path.dirname(dbPath))) fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    fs.writeFileSync(dbPath, "[]");
}

export function addGroupLinks(link) {
    try {
        let data = JSON.parse(fs.readFileSync(dbPath));
        if (!data.includes(link)) {
            data.push(link);
            fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
            return true;
        }
    } catch (e) { console.error("Database Link Error:", e); }
    return false;
}
