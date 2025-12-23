import fs from "fs";
import path from "path";
const dbPath = path.join(process.cwd(), "DATABASE", "data_grub.json");
export function addGroupLinks(link) {
    if (!fs.existsSync(path.dirname(dbPath))) fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    let data = fs.existsSync(dbPath) ? JSON.parse(fs.readFileSync(dbPath)) : [];
    if (!data.includes(link)) { data.push(link); fs.writeFileSync(dbPath, JSON.stringify(data)); }
}
