import { Server } from "socket.io";
import { GameController } from "./api/controllers/gameController";
import { MainController } from "./api/controllers/mainController";
import { RoomController } from "./api/controllers/roomController";

export default (httpServer) => {
	const io = new Server(httpServer, {
		cors: {
			origin: "*",
		},
	});

	const roomController = new RoomController();
	const gameController = new GameController();
	const mainController = new MainController();
	const onlineUsers = new Map<string, { name: string; status: "idle" | "waiting" | "playing" }>();

	const emitOnlineUsers = () => {
		const users = Array.from(onlineUsers.values()).map((u) => ({ name: u.name, status: u.status }));
		const payload = {
			total: users.length,
			playing: users.filter((u) => u.status === "playing").length,
			users,
		};
		io.emit("online_users", payload);
	};

	const ensureSocketUser = (socketId: string) => {
		const current = onlineUsers.get(socketId);
		if (current) return current;
		const created = { name: "Anònim", status: "idle" as const };
		onlineUsers.set(socketId, created);
		return created;
	};

	const setSocketUserName = (socketId: string, playerName?: string) => {
		const user = ensureSocketUser(socketId);
		const nextName = String(playerName || "").trim();
		if (nextName) user.name = nextName;
		onlineUsers.set(socketId, user);
	};

	const setSocketStatus = (socketId: string, status: "idle" | "waiting" | "playing") => {
		const user = ensureSocketUser(socketId);
		user.status = status;
		onlineUsers.set(socketId, user);
	};

	const getRoomSocketIds = (roomId: string) => Array.from(io.sockets.adapter.rooms.get(roomId)?.values() || []);

	io.on("connection", (socket) => {
		console.log("[socket] connected", socket.id);
		onlineUsers.set(socket.id, { name: "Anònim", status: "idle" });
		emitOnlineUsers();
		mainController.onConnection(socket, io);
		const safe = async (fn: () => Promise<void> | void, eventName: string, ack?: (payload: any) => void) => {
			try {
				await fn();
			} catch (error: any) {
				console.error(`[socket] ${eventName}:error`, error);
				const genericError = "Error intern de servidor. Torna-ho a provar.";
				if (eventName === "join_game" || eventName === "create_game") {
					socket.emit("room_join_error", { error: genericError });
				}
				if (eventName === "cancel_game") {
					socket.emit("room_cancel_error", { error: genericError });
				}
				if (typeof ack === "function") ack({ ok: false, error: genericError });
			}
		};

		socket.on("get_open_games", () => {
			console.log("[socket] get_open_games", socket.id);
			roomController.getOpenGamesList(io, socket);
		});

		socket.on("get_online_users", () => {
			emitOnlineUsers();
		});

		socket.on("create_game", async () => {
			await safe(async () => {
				console.log("[socket] create_game", socket.id);
				await roomController.createGame(io, socket);
				setSocketStatus(socket.id, "waiting");
				emitOnlineUsers();
			}, "create_game");
		});

		socket.on("create_solo_game", async (message, ack) => {
			await safe(async () => {
				console.log("[socket] create_solo_game", socket.id, message);
				setSocketUserName(socket.id, message?.playerName);
				await roomController.createSoloGame(io, socket, message);
				setSocketStatus(socket.id, "playing");
				emitOnlineUsers();
				if (typeof ack === "function") ack({ ok: true });
			}, "create_game", ack);
		});

		socket.on("join_game", async (message, ack) => {
			await safe(async () => {
				console.log("[socket] join_game", socket.id, message);
				setSocketUserName(socket.id, message?.playerName);
				await roomController.joinGame(io, socket, message);
				const roomId = String(message?.roomId || "");
				const roomSize = io.sockets.adapter.rooms.get(roomId)?.size || 0;
				const nextStatus: "waiting" | "playing" = roomSize >= 2 ? "playing" : "waiting";
				for (const memberSocketId of getRoomSocketIds(roomId)) {
					setSocketStatus(memberSocketId, nextStatus);
				}
				emitOnlineUsers();
				if (typeof ack === "function") ack({ ok: true, roomId: message?.roomId || "" });
			}, "join_game", ack);
		});

		socket.on("cancel_game", async (message) => {
			await safe(async () => {
				console.log("[socket] cancel_game", socket.id, message);
				const roomId = String(message?.roomId || "");
				await roomController.cancelGame(io, socket, message);
				setSocketStatus(socket.id, "idle");
				for (const memberSocketId of getRoomSocketIds(roomId)) {
					setSocketStatus(memberSocketId, "idle");
				}
				emitOnlineUsers();
			}, "cancel_game");
		});

		socket.on("update_game", async (message) => {
			await safe(async () => {
				console.log("[socket] update_game", socket.id);
				await gameController.updateGame(io, socket, message);
				setSocketStatus(socket.id, "playing");
				emitOnlineUsers();
			}, "update_game");
		});

		socket.on("report_match_winner", (message) => {
			console.log("[socket] report_match_winner", socket.id, message);
			gameController.reportMatchWinner(io, message);
		});

		socket.on("get_winners_board", () => {
			console.log("[socket] get_winners_board", socket.id);
			gameController.getWinnersBoard(io, socket);
		});

		socket.on("disconnecting", () => {
			const joinedRooms = Array.from(socket.rooms.values()).filter((r) => r !== socket.id);
			roomController.handleSocketDisconnecting(io, socket);
			setTimeout(() => {
				for (const roomId of joinedRooms) {
					const roomMemberIds = getRoomSocketIds(roomId);
					if (roomMemberIds.length === 1) {
						setSocketStatus(roomMemberIds[0], "waiting");
					}
				}
				emitOnlineUsers();
			}, 0);
		});

		socket.on("disconnect", (reason) => {
			console.log("[socket] disconnect", socket.id, reason);
			onlineUsers.delete(socket.id);
			emitOnlineUsers();
		});
	});

	return io;
};
