import axios from 'axios';

async function cekkuota(sock, chatId, message, key, msg) {
    // [DEBUG] Cek apakah pesan masuk ke plugin
    // console.log(`CekKuota Plugin: Menerima pesan "${message}"`);

    const parts = message.trim().split(" ");
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    // Filter Command
    if (command === ".cekkuota" || command === ".cekxl") {
        console.log(`[INFO] Command .cekkuota terdeteksi dari ${chatId}`);
        
        // 1. Validasi Input
        if (!args[0]) {
            return sock.sendMessage(chatId, { text: "⚠️ Masukkan nomor XL/Axis!\nContoh: *.cekkuota 62878xxxx*" }, { quoted: msg });
        }

        const msisdn = args[0].replace(/[^0-9]/g, ''); 

        // 2. Loading
        await sock.sendMessage(chatId, { text: "⏳ Sedang menghubungi data" }, { quoted: msg });

        // 3. Config API (Timeout 10 Detik)
        const config = {
            method: 'get',
            url: `https://apigw.kmsp-store.com/sidompul/v4/cek_kuota`,
            params: { msisdn: msisdn, isJSON: 'true' },
            headers: { 
                'Authorization': 'Basic c2lkb21wdWxhcGk6YXBpZ3drbXNw', 
                'X-API-Key': '60ef29aa-a648-4668-90ae-20951ef90c55', 
                'X-App-Version': '4.0.0', 
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 10000 // Batas waktu 10 detik
        };

        try {
            const response = await axios(config);
            console.log("[INFO] Respon API diterima");
            const res = response.data;

            if (res.status === true) {
                let cleanHasil = (res.data.hasil || "Tidak ada info paket.")
                    .replace(/<br\s*\/?>/gi, '\n')
                    .replace(/<b>/gi, '*')
                    .replace(/<\/b>/gi, '*')
                    .replace(/<[^>]*>?/gm, '');

                await sock.sendMessage(chatId, { 
                    text: `✅ *DETAIL KUOTA XL/AXIS*\n*Nomor:* ${msisdn}\n\n${cleanHasil}` 
                }, { quoted: msg });

            } else {
                const errMsg = res.data?.keteranganError || res.message || "Gagal mengambil data.";
                await sock.sendMessage(chatId, { text: `❌ *GAGAL:*\n${errMsg}` }, { quoted: msg });
            }

        } catch (error) {
            console.error("[ERROR] Cek Kuota:", error.message);
            await sock.sendMessage(chatId, { text: "❌ *ERROR SERVER*\nAPI Sidompul tidak merespon/gangguan." }, { quoted: msg });
        }
    }
}

export default cekkuota;
