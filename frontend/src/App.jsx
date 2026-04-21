import { useState } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";

const INITIAL_GAME = new Chess();
const INITIAL_FEN = INITIAL_GAME.fen();
const DEFAULT_FEN_SUFFIX = " w - - 0 1";

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

function App() {
  const [game, setGame] = useState(() => new Chess());
  const [boardFen, setBoardFen] = useState(INITIAL_FEN);
  const [fenInput, setFenInput] = useState("");
  const [fenError, setFenError] = useState("");

  function onDrop({ sourceSquare, targetSquare }) {
    if (!targetSquare) return false;

    const gameCopy = new Chess(game.fen());

    const move = gameCopy.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: "q"
    });

    if (move === null) return false;

    setGame(gameCopy);
    setBoardFen(gameCopy.fen());
    setFenInput(gameCopy.fen());
    setFenError("");
    return true;
  }

  function loadFen() {
    const normalizedFen = normalizeFenInput(fenInput);
    const newGame = new Chess();

    if (!normalizedFen) {
      setFenError("Enter a valid FEN string.");
      return;
    }

    try {
      try {
        newGame.load(normalizedFen);
      } catch {
        newGame.load(normalizedFen, { skipValidation: true });
      }

      setGame(newGame);
      setBoardFen(normalizedFen);
      setFenInput(normalizedFen);
      setFenError("");
    } catch (error) {
      setFenError("Invalid FEN. Please check the string and try again.");
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
          onChange={(e) => setFenInput(e.target.value)}
          placeholder="Paste FEN here, for example rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR"
          style={{ width: "420px", padding: "8px" }}
        />

        <button onClick={loadFen}>
          Load FEN
        </button>

        {fenError ? (
          <p style={{ color: "#c1121f", marginTop: "10px" }}>
            {fenError}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default App;
