"use strict";
var __decorate =
	(this && this.__decorate) ||
	function (decorators, target, key, desc) {
		var c = arguments.length,
			r = c < 3 ? target : desc === null ? (desc = Object.getOwnPropertyDescriptor(target, key)) : desc,
			d;
		if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
		else
			for (var i = decorators.length - 1; i >= 0; i--)
				if ((d = decorators[i])) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
		return c > 3 && r && Object.defineProperty(target, key, r), r;
	};
var __metadata =
	(this && this.__metadata) ||
	function (k, v) {
		if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
	};
var __param =
	(this && this.__param) ||
	function (paramIndex, decorator) {
		return function (target, key) {
			decorator(target, key, paramIndex);
		};
	};
var __awaiter =
	(this && this.__awaiter) ||
	function (thisArg, _arguments, P, generator) {
		function adopt(value) {
			return value instanceof P
				? value
				: new P(function (resolve) {
						resolve(value);
				  });
		}
		return new (P || (P = Promise))(function (resolve, reject) {
			function fulfilled(value) {
				try {
					step(generator.next(value));
				} catch (e) {
					reject(e);
				}
			}
			function rejected(value) {
				try {
					step(generator["throw"](value));
				} catch (e) {
					reject(e);
				}
			}
			function step(result) {
				result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
			}
			step((generator = generator.apply(thisArg, _arguments || [])).next());
		});
	};
var __generator =
	(this && this.__generator) ||
	function (thisArg, body) {
		var _ = {
				label: 0,
				sent: function () {
					if (t[0] & 1) throw t[1];
					return t[1];
				},
				trys: [],
				ops: [],
			},
			f,
			y,
			t,
			g;
		return (
			(g = { next: verb(0), throw: verb(1), return: verb(2) }),
			typeof Symbol === "function" &&
				(g[Symbol.iterator] = function () {
					return this;
				}),
			g
		);
		function verb(n) {
			return function (v) {
				return step([n, v]);
			};
		}
		function step(op) {
			if (f) throw new TypeError("Generator is already executing.");
			while (_)
				try {
					if (
						((f = 1),
						y &&
							(t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) &&
							!(t = t.call(y, op[1])).done)
					)
						return t;
					if (((y = 0), t)) op = [op[0] & 2, t.value];
					switch (op[0]) {
						case 0:
						case 1:
							t = op;
							break;
						case 4:
							_.label++;
							return { value: op[1], done: false };
						case 5:
							_.label++;
							y = op[1];
							op = [0];
							continue;
						case 7:
							op = _.ops.pop();
							_.trys.pop();
							continue;
						default:
							if (!((t = _.trys), (t = t.length > 0 && t[t.length - 1])) && (op[0] === 6 || op[0] === 2)) {
								_ = 0;
								continue;
							}
							if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
								_.label = op[1];
								break;
							}
							if (op[0] === 6 && _.label < t[1]) {
								_.label = t[1];
								t = op;
								break;
							}
							if (t && _.label < t[2]) {
								_.label = t[2];
								_.ops.push(op);
								break;
							}
							if (t[2]) _.ops.pop();
							_.trys.pop();
							continue;
					}
					op = body.call(thisArg, _);
				} catch (e) {
					op = [6, e];
					y = 0;
				} finally {
					f = t = 0;
				}
			if (op[0] & 5) throw op[1];
			return { value: op[0] ? op[1] : void 0, done: true };
		}
	};
exports.__esModule = true;
exports.RoomController = void 0;
var socket_controllers_1 = require("socket-controllers");
var socket_io_1 = require("socket.io");
var axios_1 = require("axios");
var RoomController = /** @class */ (function () {
	function RoomController() {}
	RoomController.prototype.joinGame = function (io, socket, message) {
		return __awaiter(this, void 0, void 0, function () {
			var connectedSockets, socketRooms, paraules, preguntes;
			return __generator(this, function (_a) {
				switch (_a.label) {
					case 0:
						console.log("Nou jugador entrant a la sala: ", message);
						connectedSockets = io.sockets.adapter.rooms.get(message.roomId);
						socketRooms = Array.from(socket.rooms.values()).filter(function (r) {
							return r !== socket.id;
						});
						paraules = [
							"camí",
							"rossinyol",
							"conill",
							"porró",
							"repercutir",
							"emmirallar",
							"organisme",
							"setrill",
							"mussol",
							"colze",
							"mànec",
							"atzucac",
							"rèmora",
							"cendrer",
							"cotó",
							"esquirol",
							"esquella",
							"paràsit",
							"guerrer",
							"préssec",
							"cirera",
							"insecte",
							"tropical",
							"comarca",
							"tractat",
							"corona",
							"reguitzell",
							"municipi",
							"localitat",
							"pantà",
							"ecumènic",
							"musical",
							"reflexionar",
							"anagrama",
							"mantell",
							"república",
							"vapor",
							"barretina",
							"edifici",
							"cosir",
							"frustrar",
							"lleuger",
							"pregunta",
							"ametlla",
							"encens",
							"sucre",
							"dolor",
							"radi",
							"poma",
							"genoll",
							"llebre",
							"pop",
							"crustaci",
							"anell",
							"cambra",
							"copular",
							"gerani",
							"capsa",
							"camell",
							"embarbussament",
							"rovellola",
							"espurna",
							"guisat",
							"olivada",
							"vesicant",
							"esplendor",
							"taronjada",
							"mare",
							"garfi",
							"sotagola",
							"gos",
							"algutzir",
							"beneit",
							"ximple",
							"poca-solta",
						];
						if (!(socketRooms.length > 0 || (connectedSockets && connectedSockets.size === 2))) return [3 /*break*/, 1];
						socket.emit("room_join_error", {
							error: "La sala " + message.roomId + " ja esta plena, escull-ne una altra!",
						});
						return [3 /*break*/, 4];
					case 1:
						return [4 /*yield*/, socket.join(message.roomId)];
					case 2:
						_a.sent();
						socket.emit("room_joined");
						if (!(io.sockets.adapter.rooms.get(message.roomId).size === 2)) return [3 /*break*/, 4];
						return [4 /*yield*/, this.getPreguntesFromAPI(paraules, message.roomId, socket)];
					case 3:
						preguntes = _a.sent();
						_a.label = 4;
					case 4:
						return [2 /*return*/];
				}
			});
		});
	};
	RoomController.prototype.getPreguntesFromAPI = function (paraules, room, socket) {
		return __awaiter(this, void 0, void 0, function () {
			var size, VParaules, PromiseArr;
			return __generator(this, function (_a) {
				size = 5;
				VParaules = paraules
					.sort(function () {
						return Math.random() - Math.random();
					})
					.slice(0, size);
				PromiseArr = [];
				VParaules.forEach(function (paraula) {
					var url = "https://vilaweb.cat/paraulogic/?diec=" + encodeURIComponent(paraula);
					PromiseArr.push(
						axios_1["default"].get(url).then(function (result) {
							return new Promise(function (resolve) {
								var bolsa = result.data;
								var afterLast = function (value, delimiter) {
									value = value || "";
									return delimiter === ""
										? value
										: value.split(delimiter)[3]
										? value.split(delimiter)[3].replace(/<span(.*?)>/gi, "")
										: value.split(delimiter)[2].replace(/<span(.*?)>/gi, "");
								};
								var replaced = bolsa.d.replace(/\ xmlns:fo="http:\/\/www\.w3\.org\/1999\/XSL\/Format"/g, "");
								var nom = String(
									replaced.match(/<span class="title">(.*?)<\/span>/g).map(function (val) {
										return val
											.replace(/<\/?span>/g, "")
											.replace(/<span class="title">/g, "")
											.replace(/<([^>]+?)([^>]*?)>(.*?)<\/\1>/gi, "")
											.trim();
									})
								).replace(",", "");
								var descripcio = afterLast(replaced, 'body">')
									.split("</span>")[0]
									.replace(/['"]+/g, "")
									.replace(/<I>/g, "")
									.replace(/<\/I>/g, "");
								bolsa.d = { nom: nom, descripcio: descripcio };
								return resolve(bolsa);
							});
						})
					);
				});
				Promise.all(PromiseArr).then(function (res) {
					socket.emit("start_game", { start: true, symbol: "A", room: room, dades: res });
					socket.to(room).emit("start_game", { start: false, symbol: "B", room: room, dades: res });
				});
				return [2 /*return*/];
			});
		});
	};
	__decorate(
		[
			socket_controllers_1.OnMessage("join_game"),
			__param(0, socket_controllers_1.SocketIO()),
			__param(1, socket_controllers_1.ConnectedSocket()),
			__param(2, socket_controllers_1.MessageBody()),
			__metadata("design:type", Function),
			__metadata("design:paramtypes", [socket_io_1.Server, socket_io_1.Socket, Object]),
			__metadata("design:returntype", Promise),
		],
		RoomController.prototype,
		"joinGame"
	);
	RoomController = __decorate([socket_controllers_1.SocketController()], RoomController);
	return RoomController;
})();
exports.RoomController = RoomController;
