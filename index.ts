import { PlayfabManager } from "./playfab.ts"
import { sleep } from "./util.ts";

const proxyIn = {
    port: 59419,
    URL: "smart-table.auto.playit.gg",
    IP: ""
}
if (proxyIn.URL) {
    proxyIn.IP = (await Deno.resolveDns(proxyIn.URL, "A"))[0] ?? "0.0.0.0"
    console.log("got dns")
}
const proxyOut = {
    port: 8777,
    IP: "111.111.111.1",
    localIP: "127.0.0.1"
}

console.log(`Proxy Server:
in: ${proxyIn.IP}:${proxyIn.port}
out: ${proxyOut.localIP}:${proxyIn.port}, registered as ${proxyOut.IP}`)

const playfab = new PlayfabManager()
await playfab.ensureAuth()
sleep(500)

playfab.add(`${proxyIn.IP}:${proxyIn.port}`)
playfab.add(`${proxyOut.IP}:${proxyOut.port}`)


setInterval(async () => {
    await playfab.update()
    //console.log(playfab.serversData)

    const serverDataIn = playfab.get(`${proxyIn.IP}:${proxyIn.port}`)
    const serverDataOut = playfab.get(`${proxyOut.IP}:${proxyOut.port}`)
    if (serverDataIn && serverDataOut) {
        serverDataIn.Tags.publicSigningKey = serverDataOut.Tags.publicSigningKey

        playfab.heartbeatServer(serverDataIn)
    }
}, 5000)

await playfab.registerServer(proxyIn.IP, proxyIn.port)

const proxyInConn = Deno.listenDatagram({
    port: proxyIn.port,
    transport: "udp"
})

console.log(`Opened socket, waiting for packets`)
for await (const packet of proxyInConn) {
    console.log(packet)
}



/*
const socket = Deno.listenDatagram({
    port: 0,
    transport: "udp",
    hostname: "0.0.0.0"
})

socket.send(new Uint8Array(data), { transport: "udp", port, hostname });
*/
