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
var GameController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameController = void 0;
const socket_controllers_1 = require("socket-controllers");
const socket_io_1 = require("socket.io");
let GameController = GameController_1 = class GameController {
    emitWinnersBoard(io) {
        const board = Array.from(GameController_1.winners.entries())
            .map(([name, data]) => ({ name, wins: data.wins, points: data.points }))
            .sort((a, b) => b.wins - a.wins || b.points - a.points || a.name.localeCompare(b.name));
        io.emit("winners_board", { board });
    }
    getSocketGameRoom(socket) {
        const socketRooms = Array.from(socket.rooms.values()).filter((r) => r !== socket.id);
        const gameRoom = socketRooms && socketRooms[0];
        return gameRoom;
    }
    async updateGame(io, socket, message) {
        const gameRoom = this.getSocketGameRoom(socket);
        socket.to(gameRoom).emit("on_game_update", message);
        const faseFromState = Number(message?.chances?.[5]?.[0]) || 0;
        const isLastRoundFinished = message?.chances?.[4]?.every((r) => r !== null) || false;
        const isGameFinished = faseFromState >= 5 || isLastRoundFinished;
        if (isGameFinished && gameRoom) {
            const payload = { chances: message.chances, times: message.times };
            io.to(gameRoom).emit("game_finished", payload);
        }
    }
    reportMatchWinner(io, message) {
        const winnerName = String(message.winnerName || "").trim();
        const matchId = String(message.matchId || "").trim();
        const winnerPoints = Number(message.winnerPoints || 0);
        if (!winnerName || !matchId)
            return;
        if (GameController_1.processedMatches.has(matchId))
            return;
        GameController_1.processedMatches.add(matchId);
        const current = GameController_1.winners.get(winnerName) || { wins: 0, points: 0 };
        GameController_1.winners.set(winnerName, {
            wins: current.wins + 1,
            points: current.points + Math.max(0, winnerPoints),
        });
        this.emitWinnersBoard(io);
    }
    getWinnersBoard(io, socket) {
        const board = Array.from(GameController_1.winners.entries())
            .map(([name, data]) => ({ name, wins: data.wins, points: data.points }))
            .sort((a, b) => b.wins - a.wins || b.points - a.points || a.name.localeCompare(b.name));
        socket.emit("winners_board", { board });
    }
};
GameController.winners = new Map();
GameController.processedMatches = new Set();
__decorate([
    socket_controllers_1.OnMessage("update_game"),
    __param(0, socket_controllers_1.SocketIO()),
    __param(1, socket_controllers_1.ConnectedSocket()),
    __param(2, socket_controllers_1.MessageBody()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Server, socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], GameController.prototype, "updateGame", null);
__decorate([
    socket_controllers_1.OnMessage("report_match_winner"),
    __param(0, socket_controllers_1.SocketIO()),
    __param(1, socket_controllers_1.MessageBody()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Server, Object]),
    __metadata("design:returntype", void 0)
], GameController.prototype, "reportMatchWinner", null);
__decorate([
    socket_controllers_1.OnMessage("get_winners_board"),
    __param(0, socket_controllers_1.SocketIO()),
    __param(1, socket_controllers_1.ConnectedSocket()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Server, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GameController.prototype, "getWinnersBoard", null);
GameController = GameController_1 = __decorate([
    socket_controllers_1.SocketController()
], GameController);
exports.GameController = GameController;
