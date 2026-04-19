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

if __name__ == "__main__":
    app.run(debug=True)