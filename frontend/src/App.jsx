import { useState } from "react";
import axios from "axios";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";

const INITIAL_GAME = new Chess();
const INITIAL_FEN = INITIAL_GAME.fen();
const DEFAULT_FEN_SUFFIX = " w - - 0 1";
const PIECE_VALUES = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0
};
const CENTER_SQUARES = new Set(["d4", "e4", "d5", "e5"]);

function normalizeFenInput(value) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return "";
  }

  const fenParts = trimmedValue.split(/\s+/);

  if (fenParts.length === 1) {
    return `${fenParts[0]}${DEFAULT_FEN_SUFFIX}`;
  }

  return trimmedValue;
}

function buildMoveReason(move) {
  const reasons = [];

  if (move.isCapture()) {
    reasons.push(`wins material by taking a ${move.captured}`);
  }

  if (move.isPromotion()) {
    reasons.push(`promotes to a ${move.promotion}`);
  }

  if (move.san.includes("+")) {
    reasons.push("gives check");
  }

  if (CENTER_SQUARES.has(move.to)) {
    reasons.push("improves central control");
  }

  if (move.isKingsideCastle() || move.isQueensideCastle()) {
    reasons.push("improves king safety by castling");
  }

  if (reasons.length === 0) {
    reasons.push("develops the position and keeps legal options open");
  }

  return reasons.join(", ");
}

function scoreMove(move) {
  let score = 0;

  if (move.isCapture()) {
    score += 20 + (PIECE_VALUES[move.captured] || 0);
  }

  if (move.isPromotion()) {
    score += 30 + (PIECE_VALUES[move.promotion] || 0);
  }

  if (move.san.includes("+")) {
    score += 10;
  }

  if (CENTER_SQUARES.has(move.to)) {
    score += 4;
  }

  if (move.isKingsideCastle() || move.isQueensideCastle()) {
    score += 6;
  }

  if (["n", "b"].includes(move.piece) && ["c3", "f3", "c6", "f6"].includes(move.to)) {
    score += 3;
  }

  return score;
}

function getPredictedMoves(fen) {
  const game = new Chess(fen);
  const legalMoves = game.moves({ verbose: true });

  return legalMoves
    .map((move) => ({
      move: move.san,
      reason: buildMoveReason(move),
      score: scoreMove(move)
    }))
    .sort((left, right) => right.score - left.score || left.move.localeCompare(right.move))
    .slice(0, 3)
    .map(({ score, ...move }) => move);
}

function App() {
  const [game, setGame] = useState(() => new Chess());
  const [boardFen, setBoardFen] = useState(INITIAL_FEN);
  const [fenInput, setFenInput] = useState("");
  const [moves, setMoves] = useState([]);
  const [error, setError] = useState("");
  const [opening, setOpening] = useState("");
  const [analysis, setAnalysis] = useState("");

  function onDrop({ sourceSquare, targetSquare }) {
    if (!targetSquare) {
      return false;
    }

    const gameCopy = new Chess(game.fen());
    const move = gameCopy.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: "q"
    });

    if (move === null) {
      return false;
    }

    const updatedFen = gameCopy.fen();

    setGame(gameCopy);
    setBoardFen(updatedFen);
    setFenInput(updatedFen);
    setMoves([]);
    setError("");

    analyzeMove(move);

    return true;
  }

  function loadFen() {
    const normalizedFen = normalizeFenInput(fenInput);
    const nextGame = new Chess();

    if (!normalizedFen) {
      setError("Enter a valid FEN string.");
      return;
    }

    try {
      try {
        nextGame.load(normalizedFen);
      } catch {
        nextGame.load(normalizedFen, { skipValidation: true });
      }

      setGame(nextGame);
      setBoardFen(normalizedFen);
      setFenInput(normalizedFen);
      setMoves([]);
      setError("");
    } catch {
      setError("Invalid FEN. Please check the string and try again.");
    }
  }

  function predictMoves() {
    try {
      const predictedMoves = getPredictedMoves(boardFen);

      if (predictedMoves.length === 0) {
        setMoves([]);
        setError("No legal moves available for this position.");
        return;
      }

      setMoves(predictedMoves);
      setError("");
    } catch {
      setMoves([]);
      setError("Unable to predict moves for this FEN.");
    }
  }

  function analyzeMove(move) {
    let label = "Good Move";
  
    if (move.san.includes("+")) {
      label = "Brilliant Move";
    } else if (move.captured) {
      label = "Strong Move";
    } else if (["e4", "d4", "Nf3", "Nc3"].includes(move.san)) {
      label = "Good Opening Move";
    }
  
    setAnalysis(label);
  }

  async function detectOpening() {
    try {
      const movesText = game.history().slice(0, 6).join(" ");
  
      const response = await axios.post(
        "http://127.0.0.1:5000/predict_opening",
        {
          moves: movesText
        }
      );
  
      setOpening(response.data.opening);
    } catch (error) {
      setOpening("Unable to detect opening");
    }
  }

  return (
    <div style={{ textAlign: "center", marginTop: "20px" }}>
      <h1>AI Chess Move Predictor</h1>

      <div style={{ width: "500px", margin: "auto" }}>
        <Chessboard
          key={boardFen}
          options={{
            position: boardFen,
            onPieceDrop: onDrop
          }}
        />
      </div>

      <div style={{ marginTop: "20px" }}>
        <input
          type="text"
          value={fenInput}
          onChange={(event) => setFenInput(event.target.value)}
          placeholder="Paste FEN here, for example 4k3/8/8/8/8/8/8/4K3"
          style={{ width: "420px", padding: "8px" }}
        />

        <button onClick={loadFen}>
          Load FEN
        </button>

        <button
          onClick={predictMoves}
          style={{ marginLeft: "10px" }}
        >
          Predict Best Moves
        </button>

        <button
          onClick={detectOpening}
          style={{ marginLeft: "10px" }}
        >
          Detect Opening
        </button>
      </div>

      {error ? (
        <p style={{ color: "red", marginTop: "10px" }}>
          {error}
        </p>
      ) : null}

      {opening && (
        <h2 style={{ marginTop: "20px" }}>
          Opening: {opening}
        </h2>
      )}
      
      {analysis && (
        <h2 style={{ color: "green", marginTop: "15px" }}>
          {analysis}
        </h2>
      )}

      <div style={{ marginTop: "20px" }}>
        {moves.map((item, index) => (
          <div key={`${item.move}-${index}`}>
            <h3>{item.move}</h3>
            <p>{item.reason}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
