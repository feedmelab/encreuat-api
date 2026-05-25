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

	io.on("connection", (socket) => {
		mainController.onConnection(socket, io);

		socket.on("get_open_games", () => {
			roomController.getOpenGamesList(io, socket);
		});

		socket.on("create_game", async () => {
			await roomController.createGame(io, socket);
		});

		socket.on("join_game", async (message) => {
			await roomController.joinGame(io, socket, message);
		});

		socket.on("cancel_game", async (message) => {
			await roomController.cancelGame(io, socket, message);
		});

		socket.on("update_game", async (message) => {
			await gameController.updateGame(io, socket, message);
		});

		socket.on("report_match_winner", (message) => {
			gameController.reportMatchWinner(io, message);
		});

		socket.on("get_winners_board", () => {
			gameController.getWinnersBoard(io, socket);
		});
	});

	return io;
};
