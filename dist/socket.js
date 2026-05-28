"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const socket_io_1 = require("socket.io");
const gameController_1 = require("./api/controllers/gameController");
const mainController_1 = require("./api/controllers/mainController");
const roomController_1 = require("./api/controllers/roomController");
exports.default = (httpServer) => {
    const io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: "*",
        },
    });
    const roomController = new roomController_1.RoomController();
    const gameController = new gameController_1.GameController();
    const mainController = new mainController_1.MainController();
    const onlineUsers = new Map();
    const emitOnlineUsers = () => {
        const users = Array.from(onlineUsers.values()).map((u) => ({ name: u.name, status: u.status }));
        const payload = {
            total: users.length,
            playing: users.filter((u) => u.status === "playing").length,
            users,
        };
        io.emit("online_users", payload);
    };
    const buildGuestName = (socketId) => `Convidat-${String(socketId || "").slice(0, 4).toUpperCase()}`;
    const ensureSocketUser = (socketId) => {
        const current = onlineUsers.get(socketId);
        if (current)
            return current;
        const created = { name: buildGuestName(socketId), status: "idle" };
        onlineUsers.set(socketId, created);
        return created;
    };
    const setSocketUserName = (socketId, playerName) => {
        const user = ensureSocketUser(socketId);
        const nextName = String(playerName || "").trim();
        if (nextName)
            user.name = nextName;
        onlineUsers.set(socketId, user);
    };
    const setSocketStatus = (socketId, status) => {
        const user = ensureSocketUser(socketId);
        user.status = status;
        onlineUsers.set(socketId, user);
    };
    const getRoomSocketIds = (roomId) => Array.from(io.sockets.adapter.rooms.get(roomId)?.values() || []);
    io.on("connection", (socket) => {
        console.log("[socket] connected", socket.id);
        onlineUsers.set(socket.id, { name: buildGuestName(socket.id), status: "idle" });
        emitOnlineUsers();
        mainController.onConnection(socket, io);
        const safe = async (fn, eventName, ack) => {
            try {
                await fn();
            }
            catch (error) {
                console.error(`[socket] ${eventName}:error`, error);
                const genericError = "Error intern de servidor. Torna-ho a provar.";
                if (eventName === "join_game" || eventName === "create_game") {
                    socket.emit("room_join_error", { error: genericError });
                }
                if (eventName === "cancel_game") {
                    socket.emit("room_cancel_error", { error: genericError });
                }
                if (typeof ack === "function")
                    ack({ ok: false, error: genericError });
            }
        };
        socket.on("get_open_games", () => {
            console.log("[socket] get_open_games", socket.id);
            roomController.getOpenGamesList(io, socket);
        });
        socket.on("get_online_users", () => {
            emitOnlineUsers();
        });
        socket.on("set_online_user", (message) => {
            setSocketUserName(socket.id, message?.playerName);
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
                if (typeof ack === "function")
                    ack({ ok: true });
            }, "create_game", ack);
        });
        socket.on("join_game", async (message, ack) => {
            await safe(async () => {
                console.log("[socket] join_game", socket.id, message);
                setSocketUserName(socket.id, message?.playerName);
                await roomController.joinGame(io, socket, message);
                const roomId = String(message?.roomId || "");
                const roomSize = io.sockets.adapter.rooms.get(roomId)?.size || 0;
                const nextStatus = roomSize >= 2 ? "playing" : "waiting";
                for (const memberSocketId of getRoomSocketIds(roomId)) {
                    setSocketStatus(memberSocketId, nextStatus);
                }
                emitOnlineUsers();
                if (typeof ack === "function")
                    ack({ ok: true, roomId: message?.roomId || "" });
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
