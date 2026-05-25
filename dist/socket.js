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
    io.on("connection", (socket) => {
        console.log("[socket] connected", socket.id);
        mainController.onConnection(socket, io);
        const safe = async (fn, eventName) => {
            try {
                await fn();
            }
            catch (error) {
                console.error(`[socket] ${eventName}:error`, error);
                if (eventName === "join_game" || eventName === "create_game") {
                    socket.emit("room_join_error", { error: "Error intern de servidor. Torna-ho a provar." });
                }
                if (eventName === "cancel_game") {
                    socket.emit("room_cancel_error", { error: "Error intern de servidor. Torna-ho a provar." });
                }
            }
        };
        socket.on("get_open_games", () => {
            console.log("[socket] get_open_games", socket.id);
            roomController.getOpenGamesList(io, socket);
        });
        socket.on("create_game", async () => {
            await safe(async () => {
                console.log("[socket] create_game", socket.id);
                await roomController.createGame(io, socket);
            }, "create_game");
        });
        socket.on("join_game", async (message) => {
            await safe(async () => {
                console.log("[socket] join_game", socket.id, message);
                await roomController.joinGame(io, socket, message);
            }, "join_game");
        });
        socket.on("cancel_game", async (message) => {
            await safe(async () => {
                console.log("[socket] cancel_game", socket.id, message);
                await roomController.cancelGame(io, socket, message);
            }, "cancel_game");
        });
        socket.on("update_game", async (message) => {
            await safe(async () => {
                console.log("[socket] update_game", socket.id);
                await gameController.updateGame(io, socket, message);
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
        socket.on("disconnect", (reason) => {
            console.log("[socket] disconnect", socket.id, reason);
        });
    });
    return io;
};
