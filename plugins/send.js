async function send(sock, sender, message) {
    // Format: .send 628xxx pesan
    const parts = message.trim().split(" ");
    const target = parts[1];
    const text = parts.slice(2).join(" ");
    
    if (!target || !text) return sock.sendMessage(sender, { text: "⚠️ Format: .send 628xxx pesan" });

    const jid = target.includes('@') ? target : `${target.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
    
    await sock.sendMessage(jid, { text: text });
    await sock.sendMessage(sender, { text: `✅ Terkirim ke ${target}` });
}
export default send;
