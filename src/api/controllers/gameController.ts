import { ConnectedSocket, MessageBody, OnMessage, SocketController, SocketIO } from "socket-controllers";
import { Server, Socket } from "socket.io";
import { GameFinishedEvent, ReportMatchWinnerMessage, UpdateGameMessage } from "../../types/events";

@SocketController()
export class GameController {
	private static winners = new Map<string, { wins: number; points: number }>();
	private static processedMatches = new Set<string>();
	private static soloRooms = new Map<string, { difficulty: "easy" | "medium" | "hard"; answers: string[] }>();

	public static registerSoloRoom(roomId: string, difficulty: "easy" | "medium" | "hard", answers: string[]) {
		GameController.soloRooms.set(roomId, { difficulty, answers });
	}

	public static removeSoloRoom(roomId: string) {
		GameController.soloRooms.delete(roomId);
	}

	private emitWinnersBoard(io: Server) {
		const board = Array.from(GameController.winners.entries())
			.map(([name, data]) => ({ name, wins: data.wins, points: data.points }))
			.sort((a, b) => b.wins - a.wins || b.points - a.points || a.name.localeCompare(b.name));
		io.emit("winners_board", { board });
	}

	private getSocketGameRoom(socket: Socket): string {
		const socketRooms = Array.from(socket.rooms.values()).filter((r) => r !== socket.id);
		const gameRoom = socketRooms && socketRooms[0];

		return gameRoom;
	}

	@OnMessage("update_game")
	public async updateGame(@SocketIO() io: Server, @ConnectedSocket() socket: Socket, @MessageBody() message: UpdateGameMessage) {
		const gameRoom = this.getSocketGameRoom(socket);
		let nextMessage = message;
		const soloConfig = gameRoom ? GameController.soloRooms.get(gameRoom) : null;
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
					if (isCurrentRoundCompleted) nextMessage.chances[5][0] = faseFromState + 1;
				}
			}
			io.to(gameRoom).emit("on_game_update", nextMessage);
		} else {
			socket.to(gameRoom).emit("on_game_update", nextMessage);
		}

		const faseFromState = Number(nextMessage?.chances?.[5]?.[0]) || 0;
		const isLastRoundFinished = nextMessage?.chances?.[4]?.every((r) => r !== null) || false;
		const isGameFinished = faseFromState >= 5 || isLastRoundFinished;
		if (isGameFinished && gameRoom) {
			const payload: GameFinishedEvent = { chances: nextMessage.chances, times: nextMessage.times };
			io.to(gameRoom).emit("game_finished", payload);
			GameController.removeSoloRoom(gameRoom);
		}
	}

	@OnMessage("report_match_winner")
	public reportMatchWinner(@SocketIO() io: Server, @MessageBody() message: ReportMatchWinnerMessage) {
		const winnerName = String(message.winnerName || "").trim();
		const matchId = String(message.matchId || "").trim();
		const winnerPoints = Number(message.winnerPoints || 0);
		if (!winnerName || !matchId) return;
		if (GameController.processedMatches.has(matchId)) return;

		GameController.processedMatches.add(matchId);
		const current = GameController.winners.get(winnerName) || { wins: 0, points: 0 };
		GameController.winners.set(winnerName, {
			wins: current.wins + 1,
			points: current.points + Math.max(0, winnerPoints),
		});
		this.emitWinnersBoard(io);
	}

	@OnMessage("get_winners_board")
	public getWinnersBoard(@SocketIO() io: Server, @ConnectedSocket() socket: Socket) {
		const board = Array.from(GameController.winners.entries())
			.map(([name, data]) => ({ name, wins: data.wins, points: data.points }))
			.sort((a, b) => b.wins - a.wins || b.points - a.points || a.name.localeCompare(b.name));
		socket.emit("winners_board", { board });
	}
}
