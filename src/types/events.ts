export interface JoinGameMessage {
	roomId: string;
	playerName?: string;
	difficulty?: "easy" | "medium" | "hard";
}

export interface CancelGameMessage {
	roomId?: string;
}

export interface UpdateGameMessage {
	chances: Array<Array<string | number | null>>;
	times: Array<Array<string | number | null>>;
}

export interface GameFinishedEvent {
	chances: Array<Array<string | number | null>>;
	times: Array<Array<string | number | null>>;
}

export interface ReportMatchWinnerMessage {
	winnerName: string;
	matchId: string;
	winnerPoints?: number;
}
