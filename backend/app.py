from flask import Flask, jsonify, request

try:
    import chess
except ImportError:  # pragma: no cover - depends on local environment
    chess = None

app = Flask(__name__)

PIECE_VALUES = {
    chess.PAWN if chess else 1: 1,
    chess.KNIGHT if chess else 2: 3,
    chess.BISHOP if chess else 3: 3,
    chess.ROOK if chess else 4: 5,
    chess.QUEEN if chess else 5: 9,
    chess.KING if chess else 6: 0,
}
CENTER_SQUARES = {"d4", "e4", "d5", "e5"}


def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    return response


@app.after_request
def after_request(response):
    return add_cors_headers(response)


@app.route("/", methods=["GET"])
def home():
    return "AI Chess Backend Running"


@app.route("/predict", methods=["POST", "OPTIONS"])
def predict():
    if request.method == "OPTIONS":
        return add_cors_headers(jsonify({"ok": True}))

    if chess is None:
        return jsonify({
            "error": "python-chess is not installed on the backend."
        }), 500

    payload = request.get_json(silent=True) or {}
    fen = (payload.get("fen") or "").strip()

    if not fen:
        return jsonify({"error": "FEN is required."}), 400

    try:
        board = chess.Board(fen)
    except ValueError as error:
        return jsonify({"error": f"Invalid FEN: {error}"}), 400

    best_moves = get_best_moves(board)
    return jsonify({"best_moves": best_moves})


def get_best_moves(board):
    scored_moves = []

    for move in board.legal_moves:
        score = 0
        reason_parts = []

        if board.is_capture(move):
            captured_piece = board.piece_at(move.to_square)
            if captured_piece is not None:
                score += 20 + PIECE_VALUES.get(captured_piece.piece_type, 0)
                reason_parts.append(
                    f"wins material by taking a {captured_piece.symbol().lower()}"
                )

        if move.promotion:
            score += 30 + PIECE_VALUES.get(move.promotion, 0)
            reason_parts.append(
                f"promotes to a {chess.piece_name(move.promotion)}"
            )

        if board.is_castling(move):
            score += 6
            reason_parts.append("improves king safety by castling")

        if chess.square_name(move.to_square) in CENTER_SQUARES:
            score += 4
            reason_parts.append("improves central control")

        next_board = board.copy(stack=False)
        next_board.push(move)
        san = board.san(move)

        if next_board.is_check():
            score += 10
            reason_parts.append("gives check")

        if not reason_parts:
            reason_parts.append("keeps the position flexible with a legal developing move")

        scored_moves.append({
            "move": san,
            "reason": ", ".join(reason_parts),
            "score": score,
        })

    scored_moves.sort(key=lambda item: (-item["score"], item["move"]))
    return [
        {"move": item["move"], "reason": item["reason"]}
        for item in scored_moves[:3]
    ]


if __name__ == "__main__":
    app.run(debug=True)
