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


// UDP stuff
const sockets: Record<string, Deno.DatagramConn> = {}

const proxyInConn = Deno.listenDatagram({
    port: proxyIn.port,
    transport: "udp"
})

console.log(`Opened socket, waiting for packets`)
for await (const packet of proxyInConn) {
    const addr = packet[1] as Deno.NetAddr
    const origin = `${addr.hostname}:${addr.port}`

    // check for new socket
    if (!sockets[origin]) {
        // create and store socket
        console.log("opening socket")
        const socket = Deno.listenDatagram({
            port: 0,
            hostname: "0.0.0.0",
            transport: "udp"
        })

        sockets[origin] = socket;

        // detach async 
        (async () => {
            for await (const backPacket of socket) {
                //console.log("server -> client", backPacket)
                proxyInConn.send(backPacket[0], addr)
            }
        })()
    }

    const dest = {
        port: proxyOut.port,
        hostname: proxyOut.localIP,
        transport: "udp"
    } as Deno.NetAddr
    sockets[origin].send(packet[0], dest)

    //console.log("client -> server", packet)
}



/*
const socket = Deno.listenDatagram({
    port: 0,
    transport: "udp",
    hostname: "0.0.0.0"
})

socket.send(new Uint8Array(data), { transport: "udp", port, hostname });
*/
