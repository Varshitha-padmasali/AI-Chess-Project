from flask import Flask, request, jsonify
from stockfish import Stockfish

app = Flask(__name__)

engine = Stockfish(
    path="./engine/stockfish/stockfish-macos-m1-apple-silicon"
)

def explain_move(move):

    if move in ["e2e4", "d2d4"]:
        return "Controls the center and creates space."

    elif move in ["g1f3", "b1c3"]:
        return "Develops a knight and supports center."

    elif move in ["e1g1", "e8g8"]:
        return "Improves king safety by castling."

    else:
        return "Strong engine-recommended move."

def get_win_percent(score):

    if score > 300:
        return 80, 20
    elif score > 150:
        return 65, 35
    elif score > 50:
        return 55, 45
    elif score < -300:
        return 20, 80
    elif score < -150:
        return 35, 65
    elif score < -50:
        return 45, 55
    else:
        return 50, 50

@app.route("/predict", methods=["POST"])
def predict():

    data = request.get_json()
    fen = data["fen"]

    engine.set_fen_position(fen)

    top_moves = engine.get_top_moves(3)

    eval_data = engine.get_evaluation()
    score = eval_data["value"]

    white, black = get_win_percent(score)

    result = []

    for item in top_moves:
        result.append({
            "move": item["Move"],
            "score": item.get("Centipawn", 0),
            "reason": explain_move(item["Move"])
        })

    return jsonify({
        "best_moves": result,
        "white_win": white,
        "black_win": black
    })

@app.route("/analyze_move", methods=["POST"])
def analyze_move():

    data = request.get_json()

    fen = data["fen"]
    user_move = data["move"]

    engine.set_fen_position(fen)

    best_move = engine.get_best_move()

    before_eval = engine.get_evaluation()["value"]

    engine.make_moves_from_current_position([user_move])

    after_eval = engine.get_evaluation()["value"]

    diff = after_eval - before_eval

    if diff >= 100:
        label = "Brilliant"
        reason = "Your move improved the position strongly."

    elif diff >= 0:
        label = "Good"
        reason = "Solid move that maintains advantage."

    elif diff > -100:
        label = "Inaccuracy"
        reason = "Playable, but stronger moves existed."

    elif diff > -250:
        label = "Mistake"
        reason = "This move weakened your position."

    else:
        label = "Blunder"
        reason = "Serious mistake causing major loss."

    white, black = get_win_percent(after_eval)

    return jsonify({
        "your_move": user_move,
        "best_move": best_move,
        "label": label,
        "reason": reason,
        "white_win": white,
        "black_win": black
    })

if __name__ == "__main__":
    app.run(debug=True)