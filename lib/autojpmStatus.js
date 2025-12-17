import fs from 'fs';
import path from 'path';

// Tentukan path penyimpanan status
const statusPath = path.join(process.cwd(), 'ADDTIONAL', 'autojpm_status.json');

// Fungsi memastikan folder ada
export function ensureDirExists() {
    const dir = path.dirname(statusPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Helper: Deteksi apakah string adalah base64
function isBase64Image(str) {
    return typeof str === 'string' && (
        /^data:image\/[a-zA-Z]+;base64,/.test(str) || /^[A-Za-z0-9+/=]+\s*$/.test(str)
    );
}

// Helper: Ubah path gambar ke Base64
function resolveToBase64(imagePath) {
    if (!imagePath) return '';

    // Jika input sudah base64
    if (isBase64Image(imagePath)) {
        if (imagePath.startsWith('data:image/')) {
            return imagePath; 
        } else {
            return `data:image/png;base64,${imagePath}`;
        }
    }

    // Jika input adalah path file
    const resolvedPath = path.resolve(imagePath);
    if (fs.existsSync(resolvedPath)) {
        const buffer = fs.readFileSync(resolvedPath);
        const ext = path.extname(resolvedPath).substring(1).toLowerCase() || 'png';
        return `data:image/${ext};base64,${buffer.toString('base64')}`;
    } else {
        return '';
    }
}

// --- FUNGSI UTAMA YANG DI-EXPORT ---

export function saveAutoJPMStatus(isRunning, text = '', imagePath = '') {
    ensureDirExists();

    let imageBase64 = resolveToBase64(imagePath);

    try {
        fs.writeFileSync(statusPath, JSON.stringify({
            running: isRunning,
            text,
            imageBase64
        }, null, 2));
    } catch (e) {
        console.error("Gagal menyimpan status JPM:", e);
    }
}

export function readAutoJPMStatus() {
    try {
        if (!fs.existsSync(statusPath)) {
            return { running: false, text: '', imageBase64: '' };
        }
        const data = fs.readFileSync(statusPath, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        console.error("Gagal membaca status JPM:", err);
        return { running: false, text: '', imageBase64: '' };
    }
}
