"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const socket_controllers_1 = require("socket-controllers");
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
    socket_controllers_1.useSocketServer(io, { controllers: [gameController_1.GameController, mainController_1.MainController, roomController_1.RoomController] });
    return io;
};
