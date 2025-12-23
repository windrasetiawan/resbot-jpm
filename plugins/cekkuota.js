import axios from 'axios';
async function cekkuota(sock, chatId, message, key, msg) {
    if (!message.startsWith(".cekkuota") && !message.startsWith(".cekxl")) return;
    const num = message.split(" ")[1];
    if (!num) return sock.sendMessage(chatId, { text: "⚠️ Masukkan nomor!" });
    
    let msisdn = num.replace(/\D/g, '').replace(/^08/, '628');
    await sock.sendMessage(chatId, { text: "⏳ Sedang cek kouta..." }, { quoted: msg });

    try {
        const { data } = await axios.get(`https://apigw.kmsp-store.com/sidompul/v4/cek_kuota`, {
            params: { msisdn, isJSON: 'true' },
            headers: { 'Authorization': 'Basic c2lkb21wdWxhcGk6YXBpZ3drbXNw', 'X-API-Key': '60ef29aa-a648-4668-90ae-20951ef90c55' }
        });
        if (data.success || data.status) {
            let hasil = (data.data?.hasil || data.hasil || "Kosong").replace(/<[^>]*>/g, "\n");
            await sock.sendMessage(chatId, { text: `✅ *KUOTA XL/AXIS*\n\n${hasil}` }, { quoted: msg });
        } else throw new Error();
    } catch { await sock.sendMessage(chatId, { text: "❌ Gagal." }, { quoted: msg }); }
}
export default cekkuota;
