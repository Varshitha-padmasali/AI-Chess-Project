import { Chessboard } from "react-chessboard";

function App() {
  return (
    <div style={{ textAlign: "center", marginTop: "20px" }}>
      <h1>AI Chess Move Predictor</h1>

      <div style={{ width: "500px", margin: "auto" }}>
        <Chessboard />
      </div>
    </div>
  );
}

export default App;