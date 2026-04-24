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
  const [whiteWin, setWhiteWin] = useState(50);
  const [blackWin, setBlackWin] = useState(50);
  const [turn, setTurn] = useState("White");

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
    setTurn(gameCopy.turn() === "w" ? "White" : "Black");
    setBoardFen(updatedFen);
    setFenInput(updatedFen);
    setMoves([]);
    setError("");

    analyzeMove(move);
    updateWinBar(gameCopy);

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
  function updateWinBar(currentGame) {
    const board = currentGame.board();
  
    const values = {
      p: 1,
      n: 3,
      b: 3,
      r: 5,
      q: 9,
      k: 0
    };
  
    let whiteScore = 0;
    let blackScore = 0;
  
    for (let row of board) {
      for (let piece of row) {
        if (piece) {
          if (piece.color === "w") {
            whiteScore += values[piece.type];
          } else {
            blackScore += values[piece.type];
          }
        }
      }
    }
  
    const total = whiteScore + blackScore;
  
    const whitePercent = Math.round((whiteScore / total) * 100);
    const blackPercent = 100 - whitePercent;
  
    setWhiteWin(whitePercent);
    setBlackWin(blackPercent);
  }
  const btn = {
    margin: "5px",
    padding: "10px 15px",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    backgroundColor: "#3b82f6",
    color: "white"
  };
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#121212",
        color: "white",
        padding: "30px",
        fontFamily: "Arial"
      }}
    >
      <h1 style={{ textAlign: "center" }}>
        AI Chess Move Predictor
      </h1>
      <h2 style={{ textAlign: "center" }}>
        Turn: {turn}
      </h2>
      <div
        style={{
          maxWidth: "700px",
          margin: "30px auto",
          backgroundColor: "#1e1e1e",
          padding: "25px",
          borderRadius: "12px",
          boxShadow: "0 0 15px rgba(0,0,0,0.4)"
        }}
      >
        <div style={{ width: "500px", margin: "auto" }}>
          <Chessboard
            key={boardFen}
            options={{
              position: boardFen,
              onPieceDrop: onDrop
            }}
          />
        </div>
  
        <div style={{ marginTop: "20px", textAlign: "center" }}>
          <input
            type="text"
            value={fenInput}
            onChange={(e) => setFenInput(e.target.value)}
            placeholder="Paste FEN here"
            style={{
              width: "420px",
              padding: "10px",
              borderRadius: "8px",
              border: "none"
            }}
          />
        </div>
  
        <div style={{ marginTop: "15px", textAlign: "center" }}>
          <button onClick={loadFen} style={btn}>
            Load FEN
          </button>
  
          <button onClick={predictMoves} style={btn}>
            Predict Moves
          </button>
  
          <button onClick={detectOpening} style={btn}>
            Detect Opening
          </button>
          <button
            onClick={() => {
              const freshGame = new Chess();
              setGame(freshGame);
              setBoardFen(freshGame.fen());
              setFenInput("");
              setMoves([]);
              setOpening("");
              setAnalysis("");
              setTurn("White");
              setWhiteWin(50);
              setBlackWin(50);
            }}
            style={btn}
          >
            Reset Game
          </button>
        </div>
          
        {error && (
          <p style={{ color: "#ff6b6b", textAlign: "center" }}>
            {error}
          </p>
        )}
  
        {opening && (
          <h2 style={{ textAlign: "center" }}>
            Opening: {opening}
          </h2>
        )}
  
        {analysis && (
          <h2 style={{ color: "#51cf66", textAlign: "center" }}>
            {analysis}
          </h2>
        )}
  
        <div style={{ marginTop: "20px" }}>
          {moves.map((item, index) => (
            <div
              key={index}
              style={{
                backgroundColor: "#2a2a2a",
                padding: "10px",
                borderRadius: "8px",
                marginBottom: "10px"
              }}
            >
              <h3>{item.move}</h3>
              <p>{item.reason}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
