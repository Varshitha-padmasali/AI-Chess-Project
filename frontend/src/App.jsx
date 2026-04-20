import { useState } from "react";
import { Chessboard } from "react-chessboard";
import axios from "axios";

function App() {
  const [moves, setMoves] = useState([]);

  const predictMoves = async () => {
    const response = await axios.post(
      "http://127.0.0.1:5000/predict",
      {
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
      }
    );

    setMoves(response.data.best_moves || response.data);
  };

  return (
    <div style={{ textAlign: "center", marginTop: "20px" }}>
      <h1>AI Chess Move Predictor</h1>

      <div style={{ width: "500px", margin: "auto" }}>
        <Chessboard />
      </div>

      <button
        onClick={predictMoves}
        style={{
          marginTop: "20px",
          padding: "10px 20px",
          fontSize: "16px",
          cursor: "pointer"
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