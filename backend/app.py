import re
import subprocess
from pathlib import Path

from flask import Flask, jsonify, request

try:
    import joblib
except ImportError:  # pragma: no cover - depends on local environment
    joblib = None

app = Flask(__name__)

BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR.parent / "models"
OPENING_MODEL_PATH = MODELS_DIR / "opening_model.pkl"
STOCKFISH_BINARY = BASE_DIR / "engine" / "stockfish" / "stockfish-macos-m1-apple-silicon"
DEFAULT_STOCKFISH_DEPTH = 14
DEFAULT_TOP_N = 3

OPENING_MODEL = None
MULTIPV_PATTERN = re.compile(r"\bmultipv\s+(\d+)\b")
SCORE_CP_PATTERN = re.compile(r"\bscore cp (-?\d+)\b")
SCORE_MATE_PATTERN = re.compile(r"\bscore mate (-?\d+)\b")
PV_PATTERN = re.compile(r"\bpv\s+(.+)$")


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
    model = get_opening_model()
    if model is None:
        return jsonify({
            "error": "Opening model is unavailable because joblib is not installed."
        }), 500

    data = request.get_json(silent=True) or {}
    moves = data.get("moves", "")
    result = model.predict([moves])[0]

    return jsonify({"opening": result})


@app.route("/predict", methods=["POST", "OPTIONS"])
def predict():
    if request.method == "OPTIONS":
        return add_cors_headers(jsonify({"ok": True}))

    payload = request.get_json(silent=True) or {}
    fen = (payload.get("fen") or "").strip()
    top_n = int(payload.get("top_n") or DEFAULT_TOP_N)
    depth = int(payload.get("depth") or DEFAULT_STOCKFISH_DEPTH)

    if not fen:
      return jsonify({"error": "FEN is required."}), 400

    if not STOCKFISH_BINARY.exists():
        return jsonify({
            "error": f"Stockfish binary not found at {STOCKFISH_BINARY}"
        }), 500

    try:
        best_moves = query_stockfish(fen=fen, top_n=top_n, depth=depth)
    except RuntimeError as error:
        return jsonify({"error": str(error)}), 500

    return jsonify({
        "best_moves": best_moves,
        "engine": "Stockfish 18",
        "depth": depth,
    })


def get_opening_model():
    global OPENING_MODEL

    if OPENING_MODEL is not None:
        return OPENING_MODEL

    if joblib is None or not OPENING_MODEL_PATH.exists():
        return None

    OPENING_MODEL = joblib.load(OPENING_MODEL_PATH)
    return OPENING_MODEL


def query_stockfish(fen, top_n=DEFAULT_TOP_N, depth=DEFAULT_STOCKFISH_DEPTH):
    process = subprocess.Popen(
        [str(STOCKFISH_BINARY)],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )

    if process.stdin is None or process.stdout is None:
        raise RuntimeError("Failed to start Stockfish process.")

    lines_to_send = [
        "uci",
        f"setoption name MultiPV value {top_n}",
        "isready",
        "ucinewgame",
        f"position fen {fen}",
        f"go depth {depth}",
    ]

    for line in lines_to_send:
        process.stdin.write(f"{line}\n")
    process.stdin.flush()

    move_data = {}
    ready_seen = False

    for raw_line in process.stdout:
        line = raw_line.strip()

        if line == "readyok":
            ready_seen = True
            continue

        if not ready_seen:
            continue

        if line.startswith("info") and " pv " in line and " multipv " in line:
            parsed = parse_stockfish_info(line)
            if parsed is not None:
                move_data[parsed["rank"]] = parsed

        if line.startswith("bestmove"):
            break

    process.stdin.write("quit\n")
    process.stdin.flush()
    stdout, stderr = process.communicate(timeout=2)

    if process.returncode not in (0, None):
        raise RuntimeError(f"Stockfish exited unexpectedly: {stderr or stdout}")

    ranked_moves = [move_data[key] for key in sorted(move_data.keys())[:top_n]]

    if not ranked_moves:
        raise RuntimeError("Stockfish did not return any moves for this position.")

    return [
        {
            "move": item["move"],
            "pv": item["pv"],
            "reason": build_stockfish_reason(item, depth),
            "score": item["score"],
            "score_type": item["score_type"],
            "rank": item["rank"],
        }
        for item in ranked_moves
    ]


def parse_stockfish_info(line):
    multipv_match = MULTIPV_PATTERN.search(line)
    pv_match = PV_PATTERN.search(line)

    if multipv_match is None or pv_match is None:
        return None

    pv_moves = pv_match.group(1).split()
    if not pv_moves:
        return None

    mate_match = SCORE_MATE_PATTERN.search(line)
    cp_match = SCORE_CP_PATTERN.search(line)

    if mate_match is not None:
        score_value = int(mate_match.group(1))
        score_type = "mate"
    elif cp_match is not None:
        score_value = int(cp_match.group(1))
        score_type = "cp"
    else:
        score_value = 0
        score_type = "cp"

    return {
        "rank": int(multipv_match.group(1)),
        "move": pv_moves[0],
        "pv": pv_moves,
        "score": score_value,
        "score_type": score_type,
    }


def build_stockfish_reason(item, depth):
    if item["score_type"] == "mate":
        if item["score"] > 0:
            evaluation = f"finds mate in {item['score']}"
        else:
            evaluation = f"avoids a line losing by mate in {abs(item['score'])}"
    else:
        sign = "+" if item["score"] >= 0 else ""
        evaluation = f"evaluates the position at {sign}{item['score'] / 100:.2f}"

    return (
        f"Stockfish choice #{item['rank']} at depth {depth}; "
        f"it {evaluation}."
    )


if __name__ == "__main__":
    app.run(debug=True)
