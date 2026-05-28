"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomController = void 0;
const socket_controllers_1 = require("socket-controllers");
const socket_io_1 = require("socket.io");
const axios_1 = __importDefault(require("axios"));
const gameController_1 = require("./gameController");
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
        this.roomPlayerSockets = new Map();
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
            .replace(/<\/?a\b[^>]*>/gi, " ")
            .replace(/<\s*href\s*=\s*[^>]+>/gi, " ")
            .replace(/javascript:[^"'\s>]*/gi, " ")
            .replace(/getFullAccepcio\s*\([^)]*\)/gi, " ")
            .replace(/&lt;[^&]*&gt;/gi, " ")
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
    normalizeForHintCheck(value) {
        return String(value || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[’']/g, "")
            .replace(/[^a-z0-9· -]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }
    isSingleWordDescription(value) {
        const words = this
            .normalizeForHintCheck(value)
            .split(" ")
            .filter(Boolean);
        return words.length <= 1;
    }
    containsAnswerInDescription(answer, description) {
        const answerNorm = this.normalizeForHintCheck(answer);
        const descNorm = this.normalizeForHintCheck(description);
        if (!answerNorm || !descNorm)
            return false;
        if (descNorm.includes(answerNorm))
            return true;
        const descWords = new Set(descNorm.split(" ").map((w) => w.trim()).filter(Boolean));
        const answerWords = answerNorm
            .split(/[ -]/)
            .map((p) => p.trim())
            .filter((p) => p.length >= 2);
        return answerWords.some((word) => descWords.has(word));
    }
    cleanDescriptionCandidate(raw) {
        let value = this.sanitizeHtmlToText(raw);
        value = this.removeDefinitionNumbering(value);
        return value.trim();
    }
    hasNumericMarkers(value) {
        return /\b\d+\b/.test(String(value || ""));
    }
    extractSynonymReference(description) {
        const desc = String(description || "").trim();
        if (!desc)
            return null;
        const cleaned = desc
            .replace(/[.;:!?]+$/g, "")
            .replace(/\s+/g, " ")
            .trim();
        const synonymPrefix = cleaned.match(/^(sin[oò]nim(?:a)?(?:\s+de)?|veg(?:eu)?\.?)\s+(.+)$/i);
        if (synonymPrefix?.[2]) {
            const candidate = synonymPrefix[2]
                .replace(/^de\s+/i, "")
                .replace(/^la\s+|^el\s+|^l['’]/i, "")
                .replace(/\s+/g, " ")
                .trim()
                .toLowerCase();
            return /^[a-zà-ÿ·'’ -]{2,}$/iu.test(candidate) ? candidate : null;
        }
        return null;
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
    extractGrammarType(rawDescription, fullHtml) {
        const html = String(fullHtml || "");
        const descHtml = String(rawDescription || "");
        const rawCandidates = `${html} ${descHtml}`.toLowerCase();
        const rawHtmlPatterns = [
            { pattern: /\bverb\b|\bv\./i, label: "Verb" },
            { pattern: /\badjectiu\b|\badj\./i, label: "Adjectiu" },
            { pattern: /\bsubstantiu\b|\bnom\b|\bn\./i, label: "Nom" },
            { pattern: /\badverbi\b|\badv\./i, label: "Adverbi" },
            { pattern: /\bpronom\b|\bpron\./i, label: "Pronom" },
            { pattern: /\bpreposici[oó]\b|\bprep\./i, label: "Preposició" },
            { pattern: /\bconjunci[oó]\b|\bconj\./i, label: "Conjunció" },
            { pattern: /\binterjecci[oó]\b|\binterj\./i, label: "Interjecció" },
        ];
        const rawLabels = rawHtmlPatterns.filter((item) => item.pattern.test(rawCandidates)).map((item) => item.label);
        if (rawLabels.length > 0) {
            const unique = Array.from(new Set(rawLabels));
            if (unique.includes("Adjectiu") && unique.includes("Nom"))
                return "Adjectiu i nom";
            return unique[0];
        }
        const head = this
            .sanitizeHtmlToText(rawDescription)
            .toLowerCase()
            .trim()
            .slice(0, 80);
        const grammarMap = [
            { pattern: /\b(v\.|verb|verb transitiu|verb intransitiu)\b/i, label: "Verb" },
            { pattern: /\b(adj\.|adjectiu)\b/i, label: "Adjectiu" },
            { pattern: /\b(adj\. i n\.|adjectiu i nom)\b/i, label: "Adjectiu i nom" },
            { pattern: /\b(nom|substantiu|n\.)\b/i, label: "Nom" },
            { pattern: /\b(adv\.|adverbi)\b/i, label: "Adverbi" },
            { pattern: /\b(pron\.|pronom)\b/i, label: "Pronom" },
            { pattern: /\b(prep\.|preposici[oó])\b/i, label: "Preposició" },
            { pattern: /\b(conj\.|conjunci[oó])\b/i, label: "Conjunció" },
            { pattern: /\b(interj\.|interjecci[oó])\b/i, label: "Interjecció" },
        ];
        const labels = grammarMap.filter((item) => item.pattern.test(head)).map((item) => item.label);
        const unique = Array.from(new Set(labels));
        if (unique.includes("Adjectiu i nom"))
            return "Adjectiu i nom";
        if (unique.includes("Adjectiu") && unique.includes("Nom"))
            return "Adjectiu i nom";
        return unique[0];
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
        const bodyMatches = Array.from(replaced.matchAll(/class="body"[^>]*>([\s\S]*?)<\/span>/gi)).map((m) => m?.[1] || "");
        const fallbackDescription = afterLast(replaced, 'body">')
            .split("</span>")[0]
            .trim();
        const rawCandidates = [...bodyMatches, fallbackDescription].filter(Boolean);
        const nomNet = this.sanitizeHtmlToText(nom)
            .replace(",", "")
            .replace(/\d+/g, "")
            .replace(/\s*-\s*/g, "-")
            .trim();
        const sensePattern = /<span class="tagline"[^>]*>([\s\S]*?)<\/span>\s*(?:<span class="body"[^>]*>[\s\S]*?<\/span>\s*)?<span class="body"[^>]*>([\s\S]*?)<\/span>/gi;
        const senseCandidates = [];
        for (const match of Array.from(replaced.matchAll(sensePattern))) {
            const rawTagline = match?.[1] || "";
            const rawBody = match?.[2] || "";
            const descripcio = this.cleanDescriptionCandidate(rawBody);
            if (!descripcio)
                continue;
            if (/Definició temporalment no disponible/i.test(descripcio))
                continue;
            const tipus = this.extractGrammarType(rawTagline, rawTagline);
            senseCandidates.push({ tipus, descripcio });
        }
        const cleanedCandidates = rawCandidates
            .map((candidate) => this.cleanDescriptionCandidate(candidate))
            .filter(Boolean)
            .filter((candidate) => !/Definició temporalment no disponible/i.test(candidate))
            .filter((candidate) => candidate.length >= 10);
        const primarySense = senseCandidates.find((item) => item.descripcio.length >= 10);
        let descripcio = primarySense?.descripcio || cleanedCandidates[0] || this.cleanDescriptionCandidate(fallbackDescription);
        let tipus = primarySense?.tipus || this.extractGrammarType(rawCandidates.join(" "), replaced);
        if (this.isDualGenderForm(nomNet) && !this.hasNumericMarkers(descripcio)) {
            descripcio = `${descripcio} Escriu la resposta amb les dues formes de gènere.`;
        }
        return { nom: nomNet, descripcio, tipus };
    }
    async fetchDefinitionWithRetry(paraula, depth = 0, visited = new Set()) {
        const cacheKey = paraula.toLowerCase();
        const cached = this.definitionCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now())
            return { nom: cached.nom, descripcio: cached.descripcio, tipus: cached.tipus };
        if (visited.has(cacheKey))
            throw new Error(`Bucle de sinònims detectat amb ${paraula}`);
        visited.add(cacheKey);
        let lastError = null;
        for (let attempt = 0; attempt <= this.DEF_FETCH_RETRIES; attempt++) {
            try {
                const url = "https://vilaweb.cat/paraulogic/?diec=" + encodeURIComponent(paraula);
                const response = await axios_1.default.get(url, { timeout: this.DEF_FETCH_TIMEOUT_MS });
                const htmlSource = typeof response?.data?.d === "string" ? response.data.d : typeof response?.data === "string" ? response.data : "";
                if (!htmlSource)
                    throw new Error("Resposta sense HTML parsejable");
                const parsed = this.extractFieldFromHtml(htmlSource);
                if (!parsed.nom || !parsed.descripcio)
                    throw new Error("No s'ha pogut extreure definició completa");
                const synonymRef = this.extractSynonymReference(parsed.descripcio);
                if (synonymRef && synonymRef !== cacheKey && depth < 2) {
                    try {
                        const synonymDefinition = await this.fetchDefinitionWithRetry(synonymRef, depth + 1, visited);
                        if (synonymDefinition?.descripcio && synonymDefinition.descripcio.length > 8) {
                            parsed.descripcio = synonymDefinition.descripcio;
                        }
                    }
                    catch (error) {
                        console.warn(`No s'ha pogut resoldre el sinònim "${synonymRef}" per "${paraula}"`, error);
                    }
                }
                this.definitionCache.set(cacheKey, {
                    nom: parsed.nom,
                    descripcio: parsed.descripcio,
                    tipus: parsed.tipus,
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
    handleSocketDisconnecting(io, socket) {
        const joinedRooms = Array.from(socket.rooms.values()).filter((r) => r !== socket.id);
        if (joinedRooms.length === 0)
            return;
        setTimeout(() => {
            for (const roomId of joinedRooms) {
                const size = io.sockets.adapter.rooms.get(roomId)?.size || 0;
                if (size <= 0) {
                    this.roomPlayers.delete(roomId);
                    this.roomPlayerSockets.delete(roomId);
                    this.roomStatus.delete(roomId);
                    this.roomDifficulty.delete(roomId);
                    gameController_1.GameController.removeSoloRoom(roomId);
                    continue;
                }
                const playerSockets = this.roomPlayerSockets.get(roomId);
                if (playerSockets) {
                    if (playerSockets.A === socket.id)
                        delete playerSockets.A;
                    if (playerSockets.B === socket.id)
                        delete playerSockets.B;
                    this.roomPlayerSockets.set(roomId, playerSockets);
                }
                if (size === 1) {
                    this.roomStatus.set(roomId, "waiting");
                }
            }
            this.emitOpenGames(io);
        }, 0);
    }
    async getAutoWordPool() {
        if (this.wordPoolCache && this.wordPoolCache.expiresAt > Date.now())
            return this.wordPoolCache.words;
        const response = await axios_1.default.get(this.WORD_POOL_SOURCE_URL, { timeout: this.DEF_FETCH_TIMEOUT_MS });
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
    getWordComplexity(word) {
        const normalized = String(word || "").trim().toLowerCase();
        if (!normalized)
            return 1;
        const lengthScore = Math.min(1, Math.max(0, (normalized.length - 4) / 8));
        const accentCount = (normalized.match(/[àèéíïòóúü]/g) || []).length;
        const accentScore = Math.min(1, accentCount / 2);
        const hasPuntVolat = normalized.includes("·") ? 1 : 0;
        const hasHyphenOrApostrophe = /[-’']/.test(normalized) ? 1 : 0;
        return Math.min(1, lengthScore * 0.55 + accentScore * 0.2 + hasPuntVolat * 0.15 + hasHyphenOrApostrophe * 0.1);
    }
    getWordDifficultyScore(word, index, total) {
        const safeTotal = Math.max(total - 1, 1);
        const frequencyRankScore = index / safeTotal;
        const complexityScore = this.getWordComplexity(word);
        return frequencyRankScore * 0.65 + complexityScore * 0.35;
    }
    isEasyDefinition(definition) {
        const nom = String(definition?.nom || "").trim().toLowerCase();
        const desc = String(definition?.descripcio || "").trim().toLowerCase();
        if (!nom || !desc)
            return false;
        if (nom.length > 8)
            return false;
        if (desc.length > 115)
            return false;
        if ((desc.match(/[;,():]/g) || []).length > 2)
            return false;
        if ((desc.match(/\d+/g) || []).length > 0)
            return false;
        const technicalKeywords = [
            "química",
            "químic",
            "molècula",
            "atòmic",
            "enzim",
            "isòtop",
            "biologia",
            "física",
            "matemàtica",
            "geologia",
            "gramàtica",
            "lingüística",
            "anatomia",
            "farmacol",
            "patologia",
            "jurídic",
            "dret",
            "teol",
            "filosof",
            "botànic",
            "zool",
            "mineralogia",
        ];
        return !technicalKeywords.some((k) => desc.includes(k));
    }
    getWordsByDifficulty(pool, difficulty) {
        const total = pool.length;
        if (total < 30)
            return pool;
        const scored = pool
            .map((word, index) => ({
            word,
            score: this.getWordDifficultyScore(word, index, total),
        }))
            .sort((a, b) => a.score - b.score);
        const easyEnd = Math.max(1200, Math.floor(total * 0.15));
        const mediumStart = Math.floor(total * 0.25);
        const mediumEnd = Math.floor(total * 0.75);
        const hardStart = Math.floor(total * 0.65);
        if (difficulty === "easy") {
            const easyCandidates = scored.slice(0, easyEnd).map((item) => item.word);
            const easyShort = easyCandidates.filter((word) => String(word || "").length <= 7);
            return easyShort.length >= 50 ? easyShort : easyCandidates;
        }
        if (difficulty === "hard")
            return scored.slice(hardStart).map((item) => item.word);
        return scored.slice(mediumStart, mediumEnd).map((item) => item.word);
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
        this.roomPlayerSockets.set(roomId, { A: socket.id });
        this.roomStatus.set(roomId, "waiting");
        this.roomDifficulty.set(roomId, this.DEFAULT_DIFFICULTY);
        socket.emit("room_joined", { roomId, players: 1 });
        this.emitOpenGames(io);
    }
    async createSoloGame(io, socket, message) {
        const socketRooms = Array.from(socket.rooms.values()).filter((r) => r !== socket.id);
        if (socketRooms.length > 0) {
            socket.emit("room_join_error", {
                error: "Ja estàs dins d'una sala. Surt-ne abans de crear-ne una altra.",
            });
            return;
        }
        const roomId = this.generateRoomId(io);
        const requestedDifficulty = message?.difficulty;
        const difficulty = requestedDifficulty === "easy" || requestedDifficulty === "medium" || requestedDifficulty === "hard"
            ? requestedDifficulty
            : this.DEFAULT_DIFFICULTY;
        const playerName = String(message?.playerName || "Anònim").trim() || "Anònim";
        await socket.join(roomId);
        this.roomPlayers.set(roomId, { A: playerName, B: "Màquina" });
        this.roomPlayerSockets.set(roomId, { A: socket.id });
        this.roomStatus.set(roomId, "started");
        this.roomDifficulty.set(roomId, difficulty);
        socket.emit("room_joined", { roomId, players: 1 });
        this.emitOpenGames(io);
        let paraules = this.fallbackWords;
        try {
            paraules = await this.getAutoWordPool();
        }
        catch (error) {
            console.error("No s'ha pogut carregar el corpus automàtic. S'usarà el fallback local.", error);
        }
        const paraulesPerNivell = this.getWordsByDifficulty(paraules, difficulty);
        await this.getPreguntesFromAPI(paraulesPerNivell, roomId, socket, io, { solo: true, difficulty });
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
            const canRejoinStartedRoom = roomState === "started" && (connectedSockets?.size || 0) < 2;
            if (roomState === "started" && !canRejoinStartedRoom) {
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
            const currentPlayerSockets = this.roomPlayerSockets.get(message.roomId) || {};
            if (!currentPlayers.A)
                currentPlayers.A = playerName;
            else if (!currentPlayers.B)
                currentPlayers.B = playerName;
            if (currentPlayers.A === playerName && !currentPlayerSockets.A)
                currentPlayerSockets.A = socket.id;
            else if (currentPlayers.B === playerName && !currentPlayerSockets.B)
                currentPlayerSockets.B = socket.id;
            else if (!currentPlayerSockets.A)
                currentPlayerSockets.A = socket.id;
            else if (!currentPlayerSockets.B)
                currentPlayerSockets.B = socket.id;
            this.roomPlayers.set(message.roomId, currentPlayers);
            this.roomPlayerSockets.set(message.roomId, currentPlayerSockets);
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
                await this.getPreguntesFromAPI(paraulesPerNivell, message.roomId, socket, io);
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
        this.roomPlayerSockets.delete(roomId);
        this.roomStatus.delete(roomId);
        this.roomDifficulty.delete(roomId);
        gameController_1.GameController.removeSoloRoom(roomId);
        socket.emit("room_cancelled", { roomId });
        this.emitOpenGames(io);
    }
    async getPreguntesFromAPI(paraules, room, socket, io, options) {
        const size = 5;
        const roomDifficulty = this.roomDifficulty.get(room) || this.DEFAULT_DIFFICULTY;
        const combinedPool = this.buildCombinedWordPool(paraules, this.fallbackWords);
        const pendingWords = this.pickRandomWords(combinedPool, combinedPool.length);
        const dades = [];
        const maxAttempts = Math.min(pendingWords.length, roomDifficulty === "easy" ? 260 : 150);
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
                if (this.isSingleWordDescription(definition.descripcio))
                    continue;
                if (this.containsAnswerInDescription(definition.nom, definition.descripcio))
                    continue;
                if (roomDifficulty === "easy" && !this.isEasyDefinition(definition))
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
        const playerSockets = this.roomPlayerSockets.get(room) || {};
        const isSolo = !!options?.solo;
        if (isSolo) {
            gameController_1.GameController.registerSoloRoom(room, options?.difficulty || this.roomDifficulty.get(room) || this.DEFAULT_DIFFICULTY, dades.map((item) => item?.d?.nom || ""));
        }
        if (playerSockets.A) {
            io.to(playerSockets.A).emit("start_game", { start: true, symbol: "A", room: room, dades, players, matchId });
        }
        if (playerSockets.B) {
            io.to(playerSockets.B).emit("start_game", { start: false, symbol: "B", room: room, dades, players, matchId });
        }
    }
};
__decorate([
    socket_controllers_1.OnMessage("get_open_games"),
    __param(0, socket_controllers_1.SocketIO()),
    __param(1, socket_controllers_1.ConnectedSocket()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Server, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], RoomController.prototype, "getOpenGamesList", null);
__decorate([
    socket_controllers_1.OnMessage("create_game"),
    __param(0, socket_controllers_1.SocketIO()),
    __param(1, socket_controllers_1.ConnectedSocket()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Server, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], RoomController.prototype, "createGame", null);
__decorate([
    socket_controllers_1.OnMessage("create_solo_game"),
    __param(0, socket_controllers_1.SocketIO()),
    __param(1, socket_controllers_1.ConnectedSocket()),
    __param(2, socket_controllers_1.MessageBody()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Server,
        socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], RoomController.prototype, "createSoloGame", null);
__decorate([
    socket_controllers_1.OnMessage("join_game"),
    __param(0, socket_controllers_1.SocketIO()),
    __param(1, socket_controllers_1.ConnectedSocket()),
    __param(2, socket_controllers_1.MessageBody()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Server, socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], RoomController.prototype, "joinGame", null);
__decorate([
    socket_controllers_1.OnMessage("cancel_game"),
    __param(0, socket_controllers_1.SocketIO()),
    __param(1, socket_controllers_1.ConnectedSocket()),
    __param(2, socket_controllers_1.MessageBody()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Server, socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], RoomController.prototype, "cancelGame", null);
RoomController = __decorate([
    socket_controllers_1.SocketController()
], RoomController);
exports.RoomController = RoomController;
