import { ConnectedSocket, MessageBody, OnMessage, SocketController, SocketIO } from "socket-controllers";
import { Server, Socket } from "socket.io";
import axios from "axios";

@SocketController()
export class RoomController {
	@OnMessage("join_game")
	public async joinGame(@SocketIO() io: Server, @ConnectedSocket() socket: Socket, @MessageBody() message: any) {
		console.log("Nou jugador entrant a la sala: ", message);

		const connectedSockets = io.sockets.adapter.rooms.get(message.roomId);
		const socketRooms = Array.from(socket.rooms.values()).filter((r) => r !== socket.id);
		const paraules = [
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
			"sotagola",
			"gos",
			"algutzir",
			"beneit",
			"ximple",
			"poca-solta",
		];

		if (socketRooms.length > 0 || (connectedSockets && connectedSockets.size === 2)) {
			socket.emit("room_join_error", {
				error: `La sala ${message.roomId} ja esta plena, escull-ne una altra!`,
			});
		} else {
			await socket.join(message.roomId);
			socket.emit("room_joined");

			if (io.sockets.adapter.rooms.get(message.roomId).size === 2) {
				const preguntes = await this.getPreguntesFromAPI(paraules, message.roomId, socket);
			}
		}
	}
	public async getPreguntesFromAPI(paraules: Array<string>, room: string, socket: Socket) {
		const size = 5;
		const VParaules = paraules.sort(() => Math.random() - Math.random()).slice(0, size);

		const PromiseArr = [];

		VParaules.forEach((paraula) => {
			var url = "https://vilaweb.cat/paraulogic/?diec=" + encodeURIComponent(paraula);
			PromiseArr.push(
				axios.get(url).then(
					(result) =>
						new Promise((resolve) => {
							const bolsa = result.data;

							const afterLast = (value: string, delimiter: string) => {
								value = value || "";
								return delimiter === ""
									? value
									: value.split(delimiter)[3]
									? value.split(delimiter)[3].replace(/<span(.*?)>/gi, "")
									: value.split(delimiter)[2].replace(/<span(.*?)>/gi, "");
							};
							let replaced = bolsa.d.replace(/\ xmlns:fo="http:\/\/www\.w3\.org\/1999\/XSL\/Format"/g, "");

							let nom = String(
								replaced.match(/<span class="title">(.*?)<\/span>/g).map((val: string) =>
									val
										.replace(/<\/?span>/g, "")
										.replace(/<span class="title">/g, "")

										.replace(/<([^>]+?)([^>]*?)>(.*?)<\/\1>/gi, "")
										.trim()
								)
							).replace(",", "");

							let descripcio: string = afterLast(replaced, 'body">')
								.split("</span>")[0]
								.replace(/['"]+/g, "")
								.replace(/<I>/g, "")
								.replace(/<\/I>/g, "");

							bolsa.d = { nom, descripcio };
							return resolve(bolsa);
						})
				)
			);
		});

		Promise.all(PromiseArr).then((res) => {
			socket.emit("start_game", { start: true, symbol: "A", room: room, dades: res });
			socket.to(room).emit("start_game", { start: false, symbol: "B", room: room, dades: res });
		});
	}
}
