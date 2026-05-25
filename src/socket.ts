import { useSocketServer } from "socket-controllers";
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
	useSocketServer(io, { controllers: [GameController, MainController, RoomController] });
	return io;
};
