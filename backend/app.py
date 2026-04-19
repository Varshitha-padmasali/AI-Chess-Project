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
        return "Develops a knight and supports center control."

    elif move in ["e1g1", "e8g8"]:
        return "Kingside castling improves king safety."

    elif move in ["c2c4"]:
        return "Challenges the center and gains queenside space."

    else:
        return "Strong engine-recommended move improving position."

@app.route("/")
def home():
    return "AI Chess Backend Running"

@app.route("/predict", methods=["POST"])
def predict():

    data = request.get_json()
    fen = data["fen"]

    engine.set_fen_position(fen)
    top_moves = engine.get_top_moves(3)

    result = []

    for item in top_moves:
        move = item["Move"]

        result.append({
            "move": move,
            "score": item.get("Centipawn", 0),
            "reason": explain_move(move)
        })

    return jsonify(result)

if __name__ == "__main__":
    app.run(debug=True)