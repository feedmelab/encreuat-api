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
        this.DEFAULT_DIFFICULTY = "medium";
        this.DEF_CACHE_TTL_MS = 1000 * 60 * 30;
        this.WORD_POOL_CACHE_TTL_MS = 1000 * 60 * 60 * 24;
        this.DEF_FETCH_TIMEOUT_MS = 7000;
        this.DEF_FETCH_RETRIES = 2;
        this.WORD_POOL_SOURCE_URL = "https://raw.githubusercontent.com/Softcatala/catalan-dict-tools/master/frequencies/frequencies-dict-lemmas.txt";
        this.definitionCache = new Map();
        this.roomPlayers = new Map();
        this.roomStatus = new Map();
        this.roomDifficulty = new Map();
        this.wordPoolCache = null;
        this.fallbackWords = [
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
        this.stopWords = new Set([
            "de",
            "la",
            "el",
            "els",
            "les",
            "que",
            "per",
            "amb",
            "una",
            "uns",
            "unes",
            "com",
            "molt",
            "més",
            "menys",
            "això",
            "aquest",
            "aquesta",
            "aquests",
            "aquestes",
            "ser",
            "haver",
            "tenir",
            "anar",
            "fer",
            "dir",
            "estar",
            "sóc",
            "som",
            "són",
            "era",
            "eren",
            "estat",
            "passar",
            "poder",
            "voler",
            "donar",
            "veure",
            "jo",
            "tu",
            "ell",
            "ella",
            "nosaltres",
            "vosaltres",
            "ells",
            "elles",
        ]);
    }
    decodeHtmlEntities(value) {
        return value
            .replace(/&nbsp;/gi, " ")
            .replace(/&amp;/gi, "&")
            .replace(/&quot;/gi, '"')
            .replace(/&#39;/gi, "'")
            .replace(/&apos;/gi, "'")
            .replace(/&lt;/gi, "<")
            .replace(/&gt;/gi, ">");
    }
    sanitizeHtmlToText(value) {
        return this.decodeHtmlEntities(String(value || "")
            .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
            .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
            .replace(/<a\b[^>]*>(.*?)<\/a>/gi, "$1")
            .replace(/javascript:[^"'\s>]*/gi, " ")
            .replace(/<\/?[^>]+(>|$)/g, " ")
            .replace(/\s+/g, " ")).trim();
    }
    removeDefinitionNumbering(value) {
        return String(value || "")
            .replace(/\(\s*\d+\s*\)/g, " ")
            .replace(/(^|[;:.!?]\s*)\d+\s*(?=[A-Za-zÀ-ÖØ-öø-ÿ])/gu, "$1")
            .replace(/\b\d+\b/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }
    hasNumericMarkers(value) {
        return /\b\d+\b/.test(String(value || ""));
    }
    isDualGenderForm(word) {
        const parts = String(word || "")
            .toLowerCase()
            .split("-")
            .map((p) => p.trim())
            .filter(Boolean);
        if (parts.length !== 2)
            return false;
        const [first, second] = parts;
        if (!/^[a-zà-ÿ·'’]+$/u.test(first) || !/^[a-zà-ÿ·'’]+$/u.test(second))
            return false;
        return first.length >= 4 && second.length >= 4 && !first.endsWith("a") && second.endsWith("a");
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
        const rawDescription = afterLast(replaced, 'body">')
            .split("</span>")[0]
            .trim();
        const nomNet = this.sanitizeHtmlToText(nom)
            .replace(",", "")
            .replace(/\d+/g, "")
            .replace(/\s*-\s*/g, "-")
            .trim();
        let descripcio = this.sanitizeHtmlToText(rawDescription);
        descripcio = this.removeDefinitionNumbering(descripcio);
        if (this.isDualGenderForm(nomNet) && !this.hasNumericMarkers(descripcio)) {
            descripcio = `${descripcio} Escriu la resposta amb les dues formes de gènere.`;
        }
        return { nom: nomNet, descripcio };
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
                this.roomDifficulty.delete(roomId);
            }
        }
        return Array.from(this.roomStatus.entries())
            .filter(([roomId]) => io.sockets.adapter.rooms.has(roomId))
            .map(([roomId, status]) => ({
            roomId,
            status,
            players: io.sockets.adapter.rooms.get(roomId)?.size || 0,
            difficulty: this.roomDifficulty.get(roomId) || this.DEFAULT_DIFFICULTY,
        }))
            .sort();
    }
    emitOpenGames(io) {
        io.emit("open_games", { rooms: this.getRoomsCatalog(io) });
    }
    async getAutoWordPool() {
        if (this.wordPoolCache && this.wordPoolCache.expiresAt > Date.now())
            return this.wordPoolCache.words;
        const response = await axios.get(this.WORD_POOL_SOURCE_URL, { timeout: this.DEF_FETCH_TIMEOUT_MS });
        const content = typeof response.data === "string" ? response.data : "";
        if (!content)
            throw new Error("No s'ha pogut carregar el corpus de paraules");
        const words = content
            .split(/\r?\n/)
            .map((line) => line.split(",")[0]?.trim().toLowerCase() || "")
            .filter((word) => /^[a-zà-ÿ·-]+$/i.test(word))
            .filter((word) => !word.includes(" "))
            .filter((word) => word.length >= 4 && word.length <= 12)
            .filter((word) => !this.stopWords.has(word))
            .filter((word, idx, arr) => arr.indexOf(word) === idx);
        if (words.length < 100)
            throw new Error("Corpus insuficient després del filtrat");
        this.wordPoolCache = {
            words,
            expiresAt: Date.now() + this.WORD_POOL_CACHE_TTL_MS,
        };
        return words;
    }
    pickRandomWords(source, size) {
        const copy = [...source];
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy.slice(0, size);
    }
    buildCombinedWordPool(primary, fallback) {
        return [...primary, ...fallback].filter((word, index, arr) => arr.indexOf(word) === index);
    }
    getWordsByDifficulty(pool, difficulty) {
        const total = pool.length;
        if (total < 30)
            return pool;
        if (difficulty === "easy")
            return pool.slice(0, Math.max(2000, Math.floor(total * 0.25)));
        if (difficulty === "hard")
            return pool.slice(Math.floor(total * 0.45));
        return pool.slice(Math.floor(total * 0.2), Math.floor(total * 0.65));
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
        this.roomDifficulty.set(roomId, this.DEFAULT_DIFFICULTY);
        socket.emit("room_joined", { roomId, players: 1 });
        this.emitOpenGames(io);
    }
    async joinGame(io, socket, message) {
        console.log("Nou jugador entrant a la sala: ", message);
        const connectedSockets = io.sockets.adapter.rooms.get(message.roomId);
        const socketRooms = Array.from(socket.rooms.values()).filter((r) => r !== socket.id);
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
            const requestedDifficulty = message?.difficulty;
            const difficulty = requestedDifficulty === "easy" || requestedDifficulty === "medium" || requestedDifficulty === "hard"
                ? requestedDifficulty
                : this.DEFAULT_DIFFICULTY;
            const playerName = String(message.playerName || "Anònim").trim() || "Anònim";
            const currentPlayers = this.roomPlayers.get(message.roomId) || {};
            if (!currentPlayers.A)
                currentPlayers.A = playerName;
            else if (!currentPlayers.B)
                currentPlayers.B = playerName;
            this.roomPlayers.set(message.roomId, currentPlayers);
            if (!this.roomDifficulty.has(message.roomId))
                this.roomDifficulty.set(message.roomId, difficulty);
            this.roomStatus.set(message.roomId, roomSize >= 2 ? "started" : "waiting");
            socket.emit("room_joined", { roomId: message.roomId, players: roomSize });
            this.emitOpenGames(io);
            if (io.sockets.adapter.rooms.get(message.roomId).size === 2) {
                io.to(message.roomId).emit("game_preparing", { roomId: message.roomId });
                let paraules = this.fallbackWords;
                try {
                    paraules = await this.getAutoWordPool();
                }
                catch (error) {
                    console.error("No s'ha pogut carregar el corpus automàtic. S'usarà el fallback local.", error);
                }
                const roomDifficulty = this.roomDifficulty.get(message.roomId) || this.DEFAULT_DIFFICULTY;
                const paraulesPerNivell = this.getWordsByDifficulty(paraules, roomDifficulty);
                await this.getPreguntesFromAPI(paraulesPerNivell, message.roomId, socket);
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
        this.roomDifficulty.delete(roomId);
        socket.emit("room_cancelled", { roomId });
        this.emitOpenGames(io);
    }
    async getPreguntesFromAPI(paraules, room, socket) {
        const size = 5;
        const combinedPool = this.buildCombinedWordPool(paraules, this.fallbackWords);
        const pendingWords = this.pickRandomWords(combinedPool, combinedPool.length);
        const dades = [];
        const maxAttempts = Math.min(pendingWords.length, 150);
        let attempts = 0;
        while (dades.length < size && attempts < maxAttempts) {
            const word = pendingWords[attempts];
            attempts += 1;
            try {
                const definition = await this.fetchDefinitionWithRetry(word);
                if (!definition?.nom || !definition?.descripcio)
                    continue;
                if (/Definició temporalment no disponible/i.test(definition.descripcio))
                    continue;
                dades.push({ d: definition });
            }
            catch (error) {
                console.error(`[room:${room}] Definició no disponible per "${word}"`, error);
            }
        }
        if (dades.length < size) {
            socket.emit("room_join_error", {
                error: "No s'han pogut carregar prou definicions vàlides. Torna-ho a provar.",
            });
            socket.to(room).emit("room_join_error", {
                error: "No s'han pogut carregar prou definicions vàlides. Torna-ho a provar.",
            });
            return;
        }
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
