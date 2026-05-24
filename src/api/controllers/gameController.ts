import { ConnectedSocket, MessageBody, OnMessage, SocketController, SocketIO } from "socket-controllers";
import { Server, Socket } from "socket.io";
import { GameFinishedEvent, ReportMatchWinnerMessage, UpdateGameMessage } from "../../types/events";

@SocketController()
export class GameController {
	private static winners = new Map<string, { wins: number; points: number }>();
	private static processedMatches = new Set<string>();

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
		socket.to(gameRoom).emit("on_game_update", message);

		const faseFromState = Number(message?.chances?.[5]?.[0]) || 0;
		const isLastRoundFinished = message?.chances?.[4]?.every((r) => r !== null) || false;
		const isGameFinished = faseFromState >= 5 || isLastRoundFinished;
		if (isGameFinished && gameRoom) {
			const payload: GameFinishedEvent = { chances: message.chances, times: message.times };
			io.to(gameRoom).emit("game_finished", payload);
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
