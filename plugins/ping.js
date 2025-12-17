import { performance } from 'perf_hooks';

async function ping(sock, chatId, message, key, msg) {
    const text = message.toLowerCase();

    // Command: .ping atau .speed
    if (text === '.ping' || text === '.speed') {
        
        // 1. Hitung Latensi (Waktu Terima - Waktu Kirim)
        // msg.messageTimestamp adalah detik, jadi dikali 1000 biar jadi milidetik
        const messageTime = (msg.messageTimestamp * 1000); 
        const now = Date.now();
        const latensi = now - messageTime;

        // 2. Hitung Kecepatan Proses Kode (Internal Speed)
        const start = performance.now();
        const end = performance.now();
        const processTime = (end - start).toFixed(3);

        const response = `🚀 *SPEED TEST*\n\n📊 *Latensi*: ${latensi} ms\n⚡ *Proses*: ${processTime} ms`;

        await sock.sendMessage(chatId, { text: response }, { quoted: msg });
    }
}

export default ping;
