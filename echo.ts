const conn = Deno.listenDatagram({
    port: 8777,
    hostname: "0.0.0.0",
    transport: "udp"
})

console.log("echo online")

for await (const packet of conn) {
    console.log("echo", packet)
    conn.send(packet[0], packet[1])
}
