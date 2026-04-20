import { useState } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import axios from "axios";

function App() {
  const [game, setGame] = useState(new Chess());
  const [moves, setMoves] = useState([]);

  function makeMove(move) {
    const gameCopy = new Chess(game.fen());
    const result = gameCopy.move(move);

    if (result) {
      setGame(gameCopy);
      return true;
    }

    return false;
  }

  function onDrop(sourceSquare, targetSquare) {
    return makeMove({
      from: sourceSquare,
      to: targetSquare,
      promotion: "q"
    });
  }

  const predictMoves = async () => {
    const fen = game.fen();

    const response = await axios.post(
      "http://127.0.0.1:5000/predict",
      { fen: fen }
    );

    setMoves(response.data.best_moves || response.data);
  };

  return (
    <div style={{ textAlign: "center", marginTop: "20px" }}>
      <h1>AI Chess Move Predictor</h1>

      <div style={{ width: "500px", margin: "auto" }}>
        <Chessboard
          position={game.fen()}
          onPieceDrop={onDrop}
        />
      </div>

      <button
        onClick={predictMoves}
        style={{
          marginTop: "20px",
          padding: "10px 20px",
          fontSize: "16px"
        }}
      >
        Predict Best Moves
      </button>

      <div style={{ marginTop: "20px" }}>
        {moves.map((item, index) => (
          <div key={index}>
            <h3>{item.move || item.Move}</h3>
            <p>{item.reason}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;