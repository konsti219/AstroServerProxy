import { timeout } from "./util.ts";

const skdVersion = "UE4MKPL-1.49.201027"

interface PlayfabServerTags {
    maxPlayers: number
    numPlayers: number
    isFull: boolean
    gameId: string // IP + port
    gameBuild: string
    serverName: string
    category: string
    publicSigningKey: string
    requiresPassword: boolean
}
export interface PlayfabServer {
    Region: string
    LobbyID: string
    BuildVersion: string
    GameMode: string
    PlayerUserIds: string[]
    RunTime: number
    GameServerState: number
    GameServerStateEnum: string
    Tags: PlayfabServerTags
    LastHeartbeat: string
    ServerHostname: string
    ServerIPV4Address: string
    ServerPort: number
}


export class PlayfabManager {
    private servers: string[] = []
    public serversData: PlayfabServer[] = []
    private headers: Record<string, string> = {
        "Accept": "*/*",
        "Accept-Encoding": "none", //"deflate, gzip",
        "Content-Type": "application/json; charset=utf-8",
        "X-PlayFabSDK": skdVersion,
        "User-Agent":
            "Astro/++UE4+Release-4.23-CL-0 Windows/10.0.19041.1.768.64bit",
    }
    private lastSuccesfullQuery = 0
    private lastAuth = 0
    private accountId = "proxy"
    private deregisteredServers: Record<string, number> = {}

    constructor() {
        this.lastSuccesfullQuery = Date.now()
    }

    async update() {
        const fetchData = async () => {

            // generateXAUTH
            await this.ensureAuth()

            // fetch data from playfab
            const serverRes: {
                code: number
                status: string
                data: {
                    Games: {
                        Region: string
                        LobbyID: string
                        BuildVersion: string
                        GameMode: string
                        PlayerUserIds: string[]
                        RunTime: number
                        GameServerState: number
                        GameServerStateEnum: string
                        Tags: {
                            maxPlayers: string
                            numPlayers: string
                            isFull: string
                            gameId: string
                            gameBuild: string
                            serverName: string
                            category: string
                            publicSigningKey: string
                            requiresPassword: string
                        },
                        LastHeartbeat: string
                        ServerHostname: string
                        ServerIPV4Address: string
                        ServerPort: number
                    }[]
                    PlayerCount: number
                    GameCount: number
                }
            } = await (
                await fetch("https://5EA1.playfabapi.com/Client/GetCurrentGames?sdk=" + skdVersion, {
                    method: "POST",
                    body: JSON.stringify({
                        TagFilter: {
                            Includes: this.servers.map(s => ({ Data: { gameId: s } }))
                        },
                    }),
                    headers: this.headers,
                })
            ).json();

            // check if data is present (if anything is wrong this will throw)
            if (!serverRes.data.Games) {
                console.log(serverRes)
                throw "sth is undefined";
            }

            // remove old servers
            this.serversData = []

            // console.log(serverRes)
            // console.log(serverRes.data.Games.map(s => s.Tags.gameId))

            // read response data
            serverRes.data.Games.forEach(s => {
                if (this.deregisteredServers[s.Tags.gameId] > 0) {
                    this.deregisteredServers[s.Tags.gameId] -= 1
                    return
                } else {
                    delete this.deregisteredServers[s.Tags.gameId]
                }

                const tags: PlayfabServerTags = {
                    maxPlayers: parseInt(s.Tags.maxPlayers),
                    numPlayers: parseInt(s.Tags.maxPlayers),
                    isFull: s.Tags.isFull === "true",
                    gameId: s.Tags.gameId,
                    gameBuild: s.Tags.gameBuild,
                    serverName: s.Tags.serverName,
                    category: s.Tags.category,
                    publicSigningKey: s.Tags.publicSigningKey,
                    requiresPassword: s.Tags.requiresPassword === "true"
                }
                const server: PlayfabServer = {
                    Region: s.Region,
                    LobbyID: s.LobbyID,
                    BuildVersion: s.BuildVersion,
                    GameMode: s.GameMode,
                    PlayerUserIds: s.PlayerUserIds,
                    RunTime: s.RunTime,
                    GameServerState: s.GameServerState,
                    GameServerStateEnum: s.GameServerStateEnum,
                    Tags: tags,
                    LastHeartbeat: s.LastHeartbeat,
                    ServerHostname: s.ServerHostname,
                    ServerIPV4Address: s.ServerIPV4Address,
                    ServerPort: s.ServerPort
                }
                this.serversData.push(server)
            });

            this.lastSuccesfullQuery = Date.now()

        }

        try {
            await timeout(1000, fetchData())
        } catch (_) {
            console.warn("playfab failing")
        }
    }

    async ensureAuth() {
        // only refetch auth if it's older than one hour
        if (this.lastAuth + (3600 * 1000) < Date.now()) {
            // try to just login, don't create account
            const resXAUTH = await this.sendLoginAuth(false)
            if (resXAUTH.status === 400) {

                // if fails create account
                const resXAUTHCreate = await this.sendLoginAuth(true)
                this.headers["X-Authorization"] = (await resXAUTHCreate.json()).data.SessionTicket;
            } else {

                // else just use existing account
                this.headers["X-Authorization"] = (await resXAUTH.json()).data.SessionTicket;
            }
            this.lastAuth = Date.now()
        }
    }

    sendLoginAuth(createAccount: boolean) {
        return fetch("https://5EA1.playfabapi.com/Client/LoginWithCustomID?sdk=" + skdVersion, {
            method: "POST",
            body: JSON.stringify({
                CreateAccount: createAccount,
                CustomId: "astro-starter_" + this.accountId,
                TitleId: "5EA1",
            }),
            headers: this.headers,
        })
    }

    add(server: string) {
        this.servers.push(server)
    }

    get(server: string): PlayfabServer | undefined {
        return this.serversData.find(s => server === s.Tags.gameId)
    }

    async registerServer(ipAddress: string, port: number) {
        const res = await (
            await fetch("https://5EA1.playfabapi.com/Client/ExecuteCloudScript?sdk=" + skdVersion, {
                method: "POST",
                body: JSON.stringify({
                    "FunctionName": "registerDedicatedServer",
                    "FunctionParameter": {
                        "serverName": "testserver",
                        "buildVersion": "1.19.143.0",
                        "gameMode": "CoopStandard",
                        ipAddress,
                        port,
                        "matchmakerBuild": "8",
                        "maxPlayers": 8,
                        "numPlayers": 0,
                        "publicSigningKey": "",
                        "requiresPassword": false
                    },
                    "GeneratePlayStreamEvent": true
                }),
                headers: this.headers,
            })
        ).json();
        console.log(res)
    }

    deregisterServer(IP: string) {
        this.serversData.filter(s => IP === s.Tags.gameId).forEach(async server => {
            await (
                await fetch("https://5EA1.playfabapi.com/Client/ExecuteCloudScript?sdk=" + skdVersion, {
                    method: "POST",
                    body: JSON.stringify({
                        FunctionName: "deregisterDedicatedServer",
                        FunctionParameter: { lobbyId: server.LobbyID },
                        GeneratePlayStreamEvent: true
                    }),
                    headers: this.headers,
                })
            ).json();
        })
        // don't include this server for 4 requests
        this.deregisteredServers[IP] = 4
    }


    async heartbeatServer(serverData: PlayfabServer) {
        await (
            await fetch("https://5EA1.playfabapi.com/Client/ExecuteCloudScript?sdk=" + skdVersion, {
                method: "POST",
                body: JSON.stringify({
                    FunctionName: "heartbeatDedicatedServer",
                    FunctionParameter: {
                        serverName: serverData.Tags.serverName,
                        buildVersion: serverData.Tags.gameBuild,
                        gameMode: serverData.Tags.category,
                        ipAddress: serverData.ServerIPV4Address,
                        port: serverData.ServerPort,
                        matchmakerBuild: serverData.BuildVersion,
                        maxPlayers: serverData.Tags.maxPlayers,
                        numPlayers: serverData.PlayerUserIds.length.toString(),
                        lobbyId: serverData.LobbyID,
                        publicSigningKey: serverData.Tags.publicSigningKey,
                        requiresPassword: serverData.Tags.requiresPassword
                    },
                    GeneratePlayStreamEvent: true
                }),
                headers: this.headers,
            })
        ).json();
    }
}
