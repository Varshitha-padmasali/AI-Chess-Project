from flask import Flask, request, jsonify
from stockfish import Stockfish

app = Flask(__name__)

engine = Stockfish(
    path="./engine/stockfish/stockfish-macos-m1-apple-silicon"
)

@app.route("/")
def home():
    return "Chess API Running"

@app.route("/predict", methods=["POST"])
def predict():

    data = request.get_json()
    fen = data["fen"]

    engine.set_fen_position(fen)

    top_moves = engine.get_top_moves(3)

    return jsonify(top_moves)

if __name__ == "__main__":
    app.run(debug=True)