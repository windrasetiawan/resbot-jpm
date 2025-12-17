import fs from 'fs';

// Ubah fungsi agar bisa di-export default
async function autoreply(sock, sender, message, key, messageEvent) {
    // Logika autoreply kamu disini
    // Contoh sederhana:
    if (message === 'ping') {
        await sock.sendMessage(sender, { text: 'Pong!' });
    }
}

export default autoreply;
