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
        socket.on("get_open_games", () => {
            console.log("[socket] get_open_games", socket.id);
            roomController.getOpenGamesList(io, socket);
        });
        socket.on("create_game", async () => {
            console.log("[socket] create_game", socket.id);
            await roomController.createGame(io, socket);
        });
        socket.on("join_game", async (message) => {
            console.log("[socket] join_game", socket.id, message);
            await roomController.joinGame(io, socket, message);
        });
        socket.on("cancel_game", async (message) => {
            console.log("[socket] cancel_game", socket.id, message);
            await roomController.cancelGame(io, socket, message);
        });
        socket.on("update_game", async (message) => {
            console.log("[socket] update_game", socket.id);
            await gameController.updateGame(io, socket, message);
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
