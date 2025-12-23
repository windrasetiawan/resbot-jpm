import axios from 'axios';
async function cekkuota(sock, chatId, text, key, msg) {
    const cmd = text.split(" ")[0].toLowerCase();
    if (cmd !== ".cekxl" && cmd !== ".cekkuota") return;
    
    const num = text.split(" ")[1];
    if (!num) return sock.sendMessage(chatId, { text: "⚠️ Contoh: .cekxl 0878xxx" });

    sock.sendMessage(chatId, { text: "⏳ Cek server..." });
    const msisdn = num.replace(/\D/g, '').replace(/^08/, '628');

    try {
        const { data } = await axios.get(`https://apigw.kmsp-store.com/sidompul/v4/cek_kuota`, {
            params: { msisdn, isJSON: 'true' },
            headers: { 'Authorization': 'Basic c2lkb21wdWxhcGk6YXBpZ3drbXNw', 'X-API-Key': '60ef29aa-a648-4668-90ae-20951ef90c55' }
        });
        const hasil = data.data?.hasil?.replace(/<[^>]*>/g, "\n") || "No Data.";
        sock.sendMessage(chatId, { text: `✅ *KUOTA XL/AXIS*\n${hasil}` });
    } catch {
        sock.sendMessage(chatId, { text: "❌ Server Error." });
    }
}
export default cekkuota;
