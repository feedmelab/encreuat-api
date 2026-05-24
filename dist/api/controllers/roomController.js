var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { ConnectedSocket, MessageBody, OnMessage, SocketController, SocketIO } from "socket-controllers";
import { Server, Socket } from "socket.io";
import axios from "axios";
let RoomController = class RoomController {
    constructor() {
        this.DEF_CACHE_TTL_MS = 1000 * 60 * 30;
        this.DEF_FETCH_TIMEOUT_MS = 7000;
        this.DEF_FETCH_RETRIES = 2;
        this.definitionCache = new Map();
        this.roomPlayers = new Map();
        this.roomStatus = new Map();
    }
    extractFieldFromHtml(html) {
        const afterLast = (value, delimiter) => {
            value = value || "";
            return delimiter === ""
                ? value
                : value.split(delimiter)[3]
                    ? value.split(delimiter)[3].replace(/<span(.*?)>/gi, "")
                    : value.split(delimiter)[2]?.replace(/<span(.*?)>/gi, "") || "";
        };
        const replaced = String(html).replace(/\ xmlns:fo="http:\/\/www\.w3\.org\/1999\/XSL\/Format"/g, "");
        const titleMatches = replaced.match(/<span class="title">(.*?)<\/span>/g) || [];
        const nom = String(titleMatches
            .map((val) => val
            .replace(/<\/?span>/g, "")
            .replace(/<span class="title">/g, "")
            .replace(/<([^>]+?)([^>]*?)>(.*?)<\/\1>/gi, "")
            .trim())
            .join(" "))
            .replace(",", "")
            .trim();
        const descripcio = afterLast(replaced, 'body">')
            .split("</span>")[0]
            .replace(/['"]+/g, "")
            .replace(/<I>/g, "")
            .replace(/<\/I>/g, "")
            .trim();
        return { nom, descripcio };
    }
    async fetchDefinitionWithRetry(paraula) {
        const cacheKey = paraula.toLowerCase();
        const cached = this.definitionCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now())
            return { nom: cached.nom, descripcio: cached.descripcio };
        let lastError = null;
        for (let attempt = 0; attempt <= this.DEF_FETCH_RETRIES; attempt++) {
            try {
                const url = "https://vilaweb.cat/paraulogic/?diec=" + encodeURIComponent(paraula);
                const response = await axios.get(url, { timeout: this.DEF_FETCH_TIMEOUT_MS });
                const htmlSource = typeof response?.data?.d === "string" ? response.data.d : typeof response?.data === "string" ? response.data : "";
                if (!htmlSource)
                    throw new Error("Resposta sense HTML parsejable");
                const parsed = this.extractFieldFromHtml(htmlSource);
                if (!parsed.nom || !parsed.descripcio)
                    throw new Error("No s'ha pogut extreure definició completa");
                this.definitionCache.set(cacheKey, {
                    nom: parsed.nom,
                    descripcio: parsed.descripcio,
                    expiresAt: Date.now() + this.DEF_CACHE_TTL_MS,
                });
                return parsed;
            }
            catch (error) {
                lastError = error;
            }
        }
        throw lastError || new Error(`Error desconegut recuperant definició de ${paraula}`);
    }
    getRoomsCatalog(io) {
        for (const roomId of Array.from(this.roomStatus.keys())) {
            if (!io.sockets.adapter.rooms.has(roomId)) {
                this.roomStatus.delete(roomId);
                this.roomPlayers.delete(roomId);
            }
        }
        return Array.from(this.roomStatus.entries())
            .filter(([roomId]) => io.sockets.adapter.rooms.has(roomId))
            .map(([roomId, status]) => ({
            roomId,
            status,
            players: io.sockets.adapter.rooms.get(roomId)?.size || 0,
        }))
            .sort();
    }
    emitOpenGames(io) {
        io.emit("open_games", { rooms: this.getRoomsCatalog(io) });
    }
    getOpenGamesList(io, socket) {
        socket.emit("open_games", { rooms: this.getRoomsCatalog(io) });
    }
    generateRoomId(io) {
        const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let roomId = "";
        do {
            roomId = Array.from({ length: 6 })
                .map(() => alphabet[Math.floor(Math.random() * alphabet.length)])
                .join("");
        } while (io.sockets.adapter.rooms.has(roomId));
        return roomId;
    }
    async createGame(io, socket) {
        const socketRooms = Array.from(socket.rooms.values()).filter((r) => r !== socket.id);
        if (socketRooms.length > 0) {
            socket.emit("room_join_error", {
                error: "Ja estàs dins d'una sala. Surt-ne abans de crear-ne una altra.",
            });
            return;
        }
        const roomId = this.generateRoomId(io);
        await socket.join(roomId);
        this.roomPlayers.set(roomId, { A: "Anònim" });
        this.roomStatus.set(roomId, "waiting");
        socket.emit("room_joined", { roomId, players: 1 });
        this.emitOpenGames(io);
    }
    async joinGame(io, socket, message) {
        console.log("Nou jugador entrant a la sala: ", message);
        const connectedSockets = io.sockets.adapter.rooms.get(message.roomId);
        const socketRooms = Array.from(socket.rooms.values()).filter((r) => r !== socket.id);
        const paraules = [
            "camí",
            "rossinyol",
            "conill",
            "porró",
            "repercutir",
            "emmirallar",
            "organisme",
            "setrill",
            "mussol",
            "colze",
            "mànec",
            "atzucac",
            "rèmora",
            "cendrer",
            "cotó",
            "esquirol",
            "esquella",
            "paràsit",
            "guerrer",
            "préssec",
            "cirera",
            "insecte",
            "tropical",
            "comarca",
            "tractat",
            "corona",
            "reguitzell",
            "municipi",
            "localitat",
            "pantà",
            "ecumènic",
            "musical",
            "reflexionar",
            "anagrama",
            "mantell",
            "república",
            "vapor",
            "barretina",
            "edifici",
            "cosir",
            "frustrar",
            "lleuger",
            "pregunta",
            "ametlla",
            "encens",
            "sucre",
            "dolor",
            "radi",
            "poma",
            "genoll",
            "llebre",
            "pop",
            "crustaci",
            "anell",
            "cambra",
            "copular",
            "gerani",
            "capsa",
            "camell",
            "embarbussament",
            "rovellola",
            "espurna",
            "guisat",
            "olivada",
            "vesicant",
            "esplendor",
            "taronjada",
            "sotagola",
            "gos",
            "algutzir",
            "beneit",
            "ximple",
            "poca-solta",
        ];
        if (socketRooms.length > 0 || (connectedSockets && connectedSockets.size === 2)) {
            socket.emit("room_join_error", {
                error: `La sala ${message.roomId} ja esta plena, escull-ne una altra!`,
            });
        }
        else {
            const roomState = this.roomStatus.get(message.roomId);
            if (roomState === "started") {
                socket.emit("room_join_error", {
                    error: `La sala ${message.roomId} ja ha començat la partida.`,
                });
                return;
            }
            await socket.join(message.roomId);
            const roomSize = io.sockets.adapter.rooms.get(message.roomId)?.size || 1;
            const playerName = String(message.playerName || "Anònim").trim() || "Anònim";
            const currentPlayers = this.roomPlayers.get(message.roomId) || {};
            if (!currentPlayers.A)
                currentPlayers.A = playerName;
            else if (!currentPlayers.B)
                currentPlayers.B = playerName;
            this.roomPlayers.set(message.roomId, currentPlayers);
            this.roomStatus.set(message.roomId, roomSize >= 2 ? "started" : "waiting");
            socket.emit("room_joined", { roomId: message.roomId, players: roomSize });
            this.emitOpenGames(io);
            if (io.sockets.adapter.rooms.get(message.roomId).size === 2) {
                await this.getPreguntesFromAPI(paraules, message.roomId, socket);
            }
        }
    }
    async cancelGame(io, socket, message) {
        const socketRooms = Array.from(socket.rooms.values()).filter((r) => r !== socket.id);
        const roomId = message?.roomId || socketRooms[0];
        if (!roomId || !socket.rooms.has(roomId)) {
            socket.emit("room_cancel_error", { error: "No hi ha cap sala activa per eliminar." });
            return;
        }
        await socket.leave(roomId);
        this.roomPlayers.delete(roomId);
        this.roomStatus.delete(roomId);
        socket.emit("room_cancelled", { roomId });
        this.emitOpenGames(io);
    }
    async getPreguntesFromAPI(paraules, room, socket) {
        const size = 5;
        const VParaules = paraules.sort(() => Math.random() - Math.random()).slice(0, size);
        const settled = await Promise.allSettled(VParaules.map((paraula) => this.fetchDefinitionWithRetry(paraula)));
        const dades = settled.map((result, index) => {
            if (result.status === "fulfilled") {
                return { d: result.value };
            }
            const fallbackWord = VParaules[index];
            console.error(`[room:${room}] Definició no disponible per "${fallbackWord}"`, result.reason);
            return {
                d: {
                    nom: fallbackWord,
                    descripcio: `Definició temporalment no disponible per a «${fallbackWord}».`,
                },
            };
        });
        const players = this.roomPlayers.get(room) || { A: "Jugador A", B: "Jugador B" };
        const matchId = `${room}-${Date.now()}`;
        socket.emit("start_game", { start: true, symbol: "A", room: room, dades, players, matchId });
        socket.to(room).emit("start_game", { start: false, symbol: "B", room: room, dades, players, matchId });
    }
};
__decorate([
    OnMessage("get_open_games"),
    __param(0, SocketIO()),
    __param(1, ConnectedSocket()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Server, Socket]),
    __metadata("design:returntype", void 0)
], RoomController.prototype, "getOpenGamesList", null);
__decorate([
    OnMessage("create_game"),
    __param(0, SocketIO()),
    __param(1, ConnectedSocket()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Server, Socket]),
    __metadata("design:returntype", Promise)
], RoomController.prototype, "createGame", null);
__decorate([
    OnMessage("join_game"),
    __param(0, SocketIO()),
    __param(1, ConnectedSocket()),
    __param(2, MessageBody()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Server, Socket, Object]),
    __metadata("design:returntype", Promise)
], RoomController.prototype, "joinGame", null);
__decorate([
    OnMessage("cancel_game"),
    __param(0, SocketIO()),
    __param(1, ConnectedSocket()),
    __param(2, MessageBody()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Server, Socket, Object]),
    __metadata("design:returntype", Promise)
], RoomController.prototype, "cancelGame", null);
RoomController = __decorate([
    SocketController()
], RoomController);
export { RoomController };
