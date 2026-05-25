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
    static registerSoloRoom(roomId, difficulty, answers) {
        GameController_1.soloRooms.set(roomId, { difficulty, answers });
    }
    static removeSoloRoom(roomId) {
        GameController_1.soloRooms.delete(roomId);
    }
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
        let nextMessage = message;
        const soloConfig = gameRoom ? GameController_1.soloRooms.get(gameRoom) : null;
        if (soloConfig && gameRoom) {
            nextMessage = JSON.parse(JSON.stringify(message));
            const faseFromState = Number(nextMessage?.chances?.[5]?.[0]) || 0;
            if (faseFromState >= 0 && faseFromState < 5) {
                const playerAnswer = nextMessage?.chances?.[faseFromState]?.[0];
                const botAnswer = nextMessage?.chances?.[faseFromState]?.[1];
                if (playerAnswer !== null && playerAnswer !== undefined && botAnswer === null) {
                    const skill = soloConfig.difficulty === "easy" ? 0.2 : soloConfig.difficulty === "hard" ? 0.6 : 0.4;
                    const isCorrect = Math.random() < skill;
                    nextMessage.chances[faseFromState][1] = isCorrect ? soloConfig.answers[faseFromState] || "Passo" : "Passo";
                    const playerTime = Number(nextMessage?.times?.[faseFromState]?.[0]);
                    const botTimeBase = Number.isFinite(playerTime) && playerTime > 0 ? playerTime : 30;
                    const swing = soloConfig.difficulty === "easy" ? 12 : soloConfig.difficulty === "hard" ? 5 : 8;
                    const botTime = Math.max(3, Math.min(60, botTimeBase + (Math.floor(Math.random() * (2 * swing + 1)) - swing)));
                    nextMessage.times[faseFromState][1] = botTime;
                    const isCurrentRoundCompleted = nextMessage.chances[faseFromState].every((r) => r !== null);
                    if (isCurrentRoundCompleted)
                        nextMessage.chances[5][0] = faseFromState + 1;
                }
            }
            io.to(gameRoom).emit("on_game_update", nextMessage);
        }
        else {
            socket.to(gameRoom).emit("on_game_update", nextMessage);
        }
        const faseFromState = Number(nextMessage?.chances?.[5]?.[0]) || 0;
        const isLastRoundFinished = nextMessage?.chances?.[4]?.every((r) => r !== null) || false;
        const isGameFinished = faseFromState >= 5 || isLastRoundFinished;
        if (isGameFinished && gameRoom) {
            const payload = { chances: nextMessage.chances, times: nextMessage.times };
            io.to(gameRoom).emit("game_finished", payload);
            GameController_1.removeSoloRoom(gameRoom);
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
GameController.soloRooms = new Map();
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
