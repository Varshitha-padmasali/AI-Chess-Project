import csv
from collections import Counter
from pathlib import Path

import joblib
from flask import Flask, jsonify, request

try:
    import chess
except ImportError:  # pragma: no cover - depends on local environment
    chess = None

app = Flask(__name__)

opening_model = joblib.load("../models/opening_model.pkl")
DATASET_PATH = Path(__file__).resolve().parent.parent / "dataset" / "chess_games.csv"
DATASET_GAMES = None

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

@app.route("/predict_opening", methods=["POST"])
def predict_opening():
    data = request.get_json()
    moves = data.get("moves", "")

    result = opening_model.predict([moves])[0]

    return jsonify({
        "opening": result
    })

@app.route("/predict", methods=["POST", "OPTIONS"])
def predict():
    if request.method == "OPTIONS":
        return add_cors_headers(jsonify({"ok": True}))

    payload = request.get_json(silent=True) or {}
    history = payload.get("history") or []
    top_n = int(payload.get("top_n") or 3)

    if isinstance(history, str):
        history_tokens = history.split()
    else:
        history_tokens = [str(move).strip() for move in history if str(move).strip()]

    best_moves, matched_prefix_length, support = get_best_moves_from_dataset(
        history_tokens, top_n=top_n
    )

    if not best_moves:
        return jsonify({
            "best_moves": [],
            "matched_prefix_length": matched_prefix_length,
            "support": support,
            "message": "No dataset matches found for this move history."
        })

    return jsonify({
        "best_moves": best_moves,
        "matched_prefix_length": matched_prefix_length,
        "support": support
    })


def load_dataset_games():
    global DATASET_GAMES

    if DATASET_GAMES is not None:
        return DATASET_GAMES

    games = []

    with DATASET_PATH.open(newline="", encoding="utf-8") as dataset_file:
        reader = csv.DictReader(dataset_file)

        for row in reader:
            moves = (row.get("moves") or "").split()
            if moves:
                games.append(moves)

    DATASET_GAMES = games
    return DATASET_GAMES


def get_best_moves_from_dataset(history_tokens, top_n=3):
    dataset_games = load_dataset_games()
    prefix_length = len(history_tokens)
    current_prefix = history_tokens[:]

    while prefix_length >= 0:
        counts = Counter()
        support = 0

        for game_moves in dataset_games:
            if len(game_moves) <= prefix_length:
                continue

            if game_moves[:prefix_length] == current_prefix:
                counts[game_moves[prefix_length]] += 1
                support += 1

        if counts:
            ranked_moves = counts.most_common(top_n)
            return [
                {
                    "move": move,
                    "reason": (
                        f"Seen {count} times in the Kaggle dataset after the first "
                        f"{prefix_length} half-moves."
                    ),
                    "count": count,
                }
                for move, count in ranked_moves
            ], prefix_length, support

        prefix_length -= 1
        current_prefix = history_tokens[:prefix_length]

    return [], 0, 0


if __name__ == "__main__":
    app.run(debug=True)
