async function ping(sock, sender, message) {
    await sock.sendMessage(sender, { text: 'Pong! 🏓' });
}
export default ping;
