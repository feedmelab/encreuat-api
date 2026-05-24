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
import { ConnectedSocket, OnConnect, SocketController, SocketIO } from "socket-controllers";
import { Socket, Server } from "socket.io";
let MainController = class MainController {
    onConnection(socket, io) {
        console.log("Nou Socket conectat: ", socket.id);
        socket.on("custom_event", (data) => {
            console.log("Data: ", data);
        });
    }
};
__decorate([
    OnConnect(),
    __param(0, ConnectedSocket()),
    __param(1, SocketIO()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Socket, Server]),
    __metadata("design:returntype", void 0)
], MainController.prototype, "onConnection", null);
MainController = __decorate([
    SocketController()
], MainController);
export { MainController };
