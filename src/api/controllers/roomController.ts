import { ConnectedSocket, MessageBody, OnMessage, SocketController, SocketIO } from "socket-controllers";
import { Server, Socket } from "socket.io";
import axios from "axios";
import { CancelGameMessage, JoinGameMessage } from "../../types/events";
import { GameController } from "./gameController";

@SocketController()
export class RoomController {
	private readonly DEFAULT_DIFFICULTY: "easy" | "medium" | "hard" = "medium";
	private readonly DEF_CACHE_TTL_MS = 1000 * 60 * 30;
	private readonly WORD_POOL_CACHE_TTL_MS = 1000 * 60 * 60 * 24;
	private readonly DEF_FETCH_TIMEOUT_MS = 7000;
	private readonly DEF_FETCH_RETRIES = 2;
	private readonly WORD_POOL_SOURCE_URL =
		"https://raw.githubusercontent.com/Softcatala/catalan-dict-tools/master/frequencies/frequencies-dict-lemmas.txt";
	private readonly definitionCache = new Map<string, { nom: string; descripcio: string; expiresAt: number }>();
	private readonly roomPlayers = new Map<string, { A?: string; B?: string }>();
	private readonly roomPlayerSockets = new Map<string, { A?: string; B?: string }>();
	private readonly roomStatus = new Map<string, "waiting" | "started">();
	private readonly roomDifficulty = new Map<string, "easy" | "medium" | "hard">();
	private wordPoolCache: { words: string[]; expiresAt: number } | null = null;
	private readonly fallbackWords = [
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

	private readonly stopWords = new Set([
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

	private decodeHtmlEntities(value: string): string {
		return value
			.replace(/&nbsp;/gi, " ")
			.replace(/&amp;/gi, "&")
			.replace(/&quot;/gi, '"')
			.replace(/&#39;/gi, "'")
			.replace(/&apos;/gi, "'")
			.replace(/&lt;/gi, "<")
			.replace(/&gt;/gi, ">");
	}

	private sanitizeHtmlToText(value: string): string {
		return this.decodeHtmlEntities(
			String(value || "")
				.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
				.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
				.replace(/<a\b[^>]*>(.*?)<\/a>/gi, "$1")
				.replace(/javascript:[^"'\s>]*/gi, " ")
				.replace(/<\/?[^>]+(>|$)/g, " ")
				.replace(/\s+/g, " ")
		).trim();
	}

	private removeDefinitionNumbering(value: string): string {
		return String(value || "")
			.replace(/\(\s*\d+\s*\)/g, " ")
			.replace(/(^|[;:.!?]\s*)\d+\s*(?=[A-Za-zÀ-ÖØ-öø-ÿ])/gu, "$1")
			.replace(/\b\d+\b/g, " ")
			.replace(/\s+/g, " ")
			.trim();
	}

	private hasNumericMarkers(value: string): boolean {
		return /\b\d+\b/.test(String(value || ""));
	}

	private isDualGenderForm(word: string): boolean {
		const parts = String(word || "")
			.toLowerCase()
			.split("-")
			.map((p) => p.trim())
			.filter(Boolean);
		if (parts.length !== 2) return false;
		const [first, second] = parts;
		if (!/^[a-zà-ÿ·'’]+$/u.test(first) || !/^[a-zà-ÿ·'’]+$/u.test(second)) return false;
		return first.length >= 4 && second.length >= 4 && !first.endsWith("a") && second.endsWith("a");
	}

	private extractFieldFromHtml(html: string) {
		const afterLast = (value: string, delimiter: string) => {
			value = value || "";
			return delimiter === ""
				? value
				: value.split(delimiter)[3]
				? value.split(delimiter)[3].replace(/<span(.*?)>/gi, "")
				: value.split(delimiter)[2]?.replace(/<span(.*?)>/gi, "") || "";
		};

		const replaced = String(html).replace(/\ xmlns:fo="http:\/\/www\.w3\.org\/1999\/XSL\/Format"/g, "");

		const titleMatches = replaced.match(/<span class="title">(.*?)<\/span>/g) || [];
		const nom = String(
			titleMatches
				.map((val: string) =>
					val
						.replace(/<\/?span>/g, "")
						.replace(/<span class="title">/g, "")
						.replace(/<([^>]+?)([^>]*?)>(.*?)<\/\1>/gi, "")
						.trim()
				)
				.join(" ")
		)
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

	private async fetchDefinitionWithRetry(paraula: string) {
		const cacheKey = paraula.toLowerCase();
		const cached = this.definitionCache.get(cacheKey);
		if (cached && cached.expiresAt > Date.now()) return { nom: cached.nom, descripcio: cached.descripcio };

		let lastError: unknown = null;
		for (let attempt = 0; attempt <= this.DEF_FETCH_RETRIES; attempt++) {
			try {
				const url = "https://vilaweb.cat/paraulogic/?diec=" + encodeURIComponent(paraula);
				const response = await axios.get(url, { timeout: this.DEF_FETCH_TIMEOUT_MS });
				const htmlSource = typeof response?.data?.d === "string" ? response.data.d : typeof response?.data === "string" ? response.data : "";
				if (!htmlSource) throw new Error("Resposta sense HTML parsejable");

				const parsed = this.extractFieldFromHtml(htmlSource);
				if (!parsed.nom || !parsed.descripcio) throw new Error("No s'ha pogut extreure definició completa");

				this.definitionCache.set(cacheKey, {
					nom: parsed.nom,
					descripcio: parsed.descripcio,
					expiresAt: Date.now() + this.DEF_CACHE_TTL_MS,
				});
				return parsed;
			} catch (error) {
				lastError = error;
			}
		}

		throw lastError || new Error(`Error desconegut recuperant definició de ${paraula}`);
	}

	private getRoomsCatalog(io: Server): Array<{ roomId: string; status: "waiting" | "started"; players: number; difficulty: "easy" | "medium" | "hard" }> {
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

	private emitOpenGames(io: Server) {
		io.emit("open_games", { rooms: this.getRoomsCatalog(io) });
	}

	public handleSocketDisconnecting(io: Server, socket: Socket) {
		const joinedRooms = Array.from(socket.rooms.values()).filter((r) => r !== socket.id);
		if (joinedRooms.length === 0) return;

		setTimeout(() => {
			for (const roomId of joinedRooms) {
				const size = io.sockets.adapter.rooms.get(roomId)?.size || 0;
				if (size <= 0) {
				this.roomPlayers.delete(roomId);
				this.roomPlayerSockets.delete(roomId);
				this.roomStatus.delete(roomId);
				this.roomDifficulty.delete(roomId);
				GameController.removeSoloRoom(roomId);
				continue;
			}
			const playerSockets = this.roomPlayerSockets.get(roomId);
			if (playerSockets) {
				if (playerSockets.A === socket.id) delete playerSockets.A;
				if (playerSockets.B === socket.id) delete playerSockets.B;
				this.roomPlayerSockets.set(roomId, playerSockets);
			}
			if (size === 1) {
				this.roomStatus.set(roomId, "waiting");
			}
			}
			this.emitOpenGames(io);
		}, 0);
	}

	private async getAutoWordPool(): Promise<string[]> {
		if (this.wordPoolCache && this.wordPoolCache.expiresAt > Date.now()) return this.wordPoolCache.words;

		const response = await axios.get(this.WORD_POOL_SOURCE_URL, { timeout: this.DEF_FETCH_TIMEOUT_MS });
		const content = typeof response.data === "string" ? response.data : "";
		if (!content) throw new Error("No s'ha pogut carregar el corpus de paraules");

		const words = content
			.split(/\r?\n/)
			.map((line) => line.split(",")[0]?.trim().toLowerCase() || "")
			.filter((word) => /^[a-zà-ÿ·-]+$/i.test(word))
			.filter((word) => !word.includes(" "))
			.filter((word) => word.length >= 4 && word.length <= 12)
			.filter((word) => !this.stopWords.has(word))
			.filter((word, idx, arr) => arr.indexOf(word) === idx);

		if (words.length < 100) throw new Error("Corpus insuficient després del filtrat");

		this.wordPoolCache = {
			words,
			expiresAt: Date.now() + this.WORD_POOL_CACHE_TTL_MS,
		};

		return words;
	}

	private pickRandomWords(source: string[], size: number): string[] {
		const copy = [...source];
		for (let i = copy.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[copy[i], copy[j]] = [copy[j], copy[i]];
		}
		return copy.slice(0, size);
	}

	private buildCombinedWordPool(primary: string[], fallback: string[]) {
		return [...primary, ...fallback].filter((word, index, arr) => arr.indexOf(word) === index);
	}

	private getWordComplexity(word: string) {
		const normalized = String(word || "").trim().toLowerCase();
		if (!normalized) return 1;

		const lengthScore = Math.min(1, Math.max(0, (normalized.length - 4) / 8));
		const accentCount = (normalized.match(/[àèéíïòóúü]/g) || []).length;
		const accentScore = Math.min(1, accentCount / 2);
		const hasPuntVolat = normalized.includes("·") ? 1 : 0;
		const hasHyphenOrApostrophe = /[-’']/.test(normalized) ? 1 : 0;

		return Math.min(
			1,
			lengthScore * 0.55 + accentScore * 0.2 + hasPuntVolat * 0.15 + hasHyphenOrApostrophe * 0.1
		);
	}

	private getWordDifficultyScore(word: string, index: number, total: number) {
		const safeTotal = Math.max(total - 1, 1);
		const frequencyRankScore = index / safeTotal;
		const complexityScore = this.getWordComplexity(word);
		return frequencyRankScore * 0.65 + complexityScore * 0.35;
	}

	private isEasyDefinition(definition: { nom: string; descripcio: string }) {
		const nom = String(definition?.nom || "").trim().toLowerCase();
		const desc = String(definition?.descripcio || "").trim().toLowerCase();
		if (!nom || !desc) return false;

		if (nom.length > 8) return false;
		if (desc.length > 115) return false;
		if ((desc.match(/[;,():]/g) || []).length > 2) return false;
		if ((desc.match(/\d+/g) || []).length > 0) return false;

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

	private getWordsByDifficulty(pool: string[], difficulty: "easy" | "medium" | "hard") {
		const total = pool.length;
		if (total < 30) return pool;

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
		if (difficulty === "hard") return scored.slice(hardStart).map((item) => item.word);
		return scored.slice(mediumStart, mediumEnd).map((item) => item.word);
	}

	@OnMessage("get_open_games")
	public getOpenGamesList(@SocketIO() io: Server, @ConnectedSocket() socket: Socket) {
		socket.emit("open_games", { rooms: this.getRoomsCatalog(io) });
	}

	private generateRoomId(io: Server): string {
		const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
		let roomId = "";
		do {
			roomId = Array.from({ length: 6 })
				.map(() => alphabet[Math.floor(Math.random() * alphabet.length)])
				.join("");
		} while (io.sockets.adapter.rooms.has(roomId));
		return roomId;
	}

	@OnMessage("create_game")
	public async createGame(@SocketIO() io: Server, @ConnectedSocket() socket: Socket) {
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

	@OnMessage("create_solo_game")
	public async createSoloGame(
		@SocketIO() io: Server,
		@ConnectedSocket() socket: Socket,
		@MessageBody() message: { playerName?: string; difficulty?: "easy" | "medium" | "hard" }
	) {
		const socketRooms = Array.from(socket.rooms.values()).filter((r) => r !== socket.id);
		if (socketRooms.length > 0) {
			socket.emit("room_join_error", {
				error: "Ja estàs dins d'una sala. Surt-ne abans de crear-ne una altra.",
			});
			return;
		}

		const roomId = this.generateRoomId(io);
		const requestedDifficulty = message?.difficulty;
		const difficulty: "easy" | "medium" | "hard" =
			requestedDifficulty === "easy" || requestedDifficulty === "medium" || requestedDifficulty === "hard"
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
		} catch (error) {
			console.error("No s'ha pogut carregar el corpus automàtic. S'usarà el fallback local.", error);
		}
		const paraulesPerNivell = this.getWordsByDifficulty(paraules, difficulty);
		await this.getPreguntesFromAPI(paraulesPerNivell, roomId, socket, io, { solo: true, difficulty });
	}

	@OnMessage("join_game")
	public async joinGame(@SocketIO() io: Server, @ConnectedSocket() socket: Socket, @MessageBody() message: JoinGameMessage) {
		console.log("Nou jugador entrant a la sala: ", message);

		const connectedSockets = io.sockets.adapter.rooms.get(message.roomId);
		const socketRooms = Array.from(socket.rooms.values()).filter((r) => r !== socket.id);

		if (socketRooms.length > 0 || (connectedSockets && connectedSockets.size === 2)) {
			socket.emit("room_join_error", {
				error: `La sala ${message.roomId} ja esta plena, escull-ne una altra!`,
			});
		} else {
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
			const difficulty: "easy" | "medium" | "hard" =
				requestedDifficulty === "easy" || requestedDifficulty === "medium" || requestedDifficulty === "hard"
					? requestedDifficulty
					: this.DEFAULT_DIFFICULTY;
			const playerName = String(message.playerName || "Anònim").trim() || "Anònim";
			const currentPlayers = this.roomPlayers.get(message.roomId) || {};
			const currentPlayerSockets = this.roomPlayerSockets.get(message.roomId) || {};
			if (!currentPlayers.A) currentPlayers.A = playerName;
			else if (!currentPlayers.B) currentPlayers.B = playerName;

			if (currentPlayers.A === playerName && !currentPlayerSockets.A) currentPlayerSockets.A = socket.id;
			else if (currentPlayers.B === playerName && !currentPlayerSockets.B) currentPlayerSockets.B = socket.id;
			else if (!currentPlayerSockets.A) currentPlayerSockets.A = socket.id;
			else if (!currentPlayerSockets.B) currentPlayerSockets.B = socket.id;
			this.roomPlayers.set(message.roomId, currentPlayers);
			this.roomPlayerSockets.set(message.roomId, currentPlayerSockets);
			if (!this.roomDifficulty.has(message.roomId)) this.roomDifficulty.set(message.roomId, difficulty);
			this.roomStatus.set(message.roomId, roomSize >= 2 ? "started" : "waiting");
			socket.emit("room_joined", { roomId: message.roomId, players: roomSize });
			this.emitOpenGames(io);

			if (io.sockets.adapter.rooms.get(message.roomId).size === 2) {
				io.to(message.roomId).emit("game_preparing", { roomId: message.roomId });
				let paraules = this.fallbackWords;
				try {
					paraules = await this.getAutoWordPool();
				} catch (error) {
					console.error("No s'ha pogut carregar el corpus automàtic. S'usarà el fallback local.", error);
				}
				const roomDifficulty = this.roomDifficulty.get(message.roomId) || this.DEFAULT_DIFFICULTY;
				const paraulesPerNivell = this.getWordsByDifficulty(paraules, roomDifficulty);
				await this.getPreguntesFromAPI(paraulesPerNivell, message.roomId, socket, io);
			}
		}
	}

	@OnMessage("cancel_game")
	public async cancelGame(@SocketIO() io: Server, @ConnectedSocket() socket: Socket, @MessageBody() message: CancelGameMessage) {
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
		GameController.removeSoloRoom(roomId);
		socket.emit("room_cancelled", { roomId });
		this.emitOpenGames(io);
	}

	public async getPreguntesFromAPI(
		paraules: Array<string>,
		room: string,
		socket: Socket,
		io: Server,
		options?: { solo?: boolean; difficulty?: "easy" | "medium" | "hard" }
	) {
		const size = 5;
		const roomDifficulty = this.roomDifficulty.get(room) || this.DEFAULT_DIFFICULTY;
		const combinedPool = this.buildCombinedWordPool(paraules, this.fallbackWords);
		const pendingWords = this.pickRandomWords(combinedPool, combinedPool.length);
		const dades: Array<{ d: { nom: string; descripcio: string } }> = [];
		const maxAttempts = Math.min(pendingWords.length, roomDifficulty === "easy" ? 260 : 150);
		let attempts = 0;

		while (dades.length < size && attempts < maxAttempts) {
			const word = pendingWords[attempts];
			attempts += 1;
			try {
				const definition = await this.fetchDefinitionWithRetry(word);
				if (!definition?.nom || !definition?.descripcio) continue;
				if (/Definició temporalment no disponible/i.test(definition.descripcio)) continue;
				if (roomDifficulty === "easy" && !this.isEasyDefinition(definition)) continue;
				dades.push({ d: definition });
			} catch (error) {
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
			GameController.registerSoloRoom(
				room,
				options?.difficulty || this.roomDifficulty.get(room) || this.DEFAULT_DIFFICULTY,
				dades.map((item) => item?.d?.nom || "")
			);
		}

		if (playerSockets.A) {
			io.to(playerSockets.A).emit("start_game", { start: true, symbol: "A", room: room, dades, players, matchId });
		}
		if (playerSockets.B) {
			io.to(playerSockets.B).emit("start_game", { start: false, symbol: "B", room: room, dades, players, matchId });
		}
	}
}
