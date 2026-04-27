import { useState } from "react";
import axios from "axios";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import "./App.css";

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

function getCheckedKingSquare(fen) {
  const currentGame = new Chess(fen);

  if (!currentGame.inCheck()) {
    return "";
  }

  const kingColor = currentGame.turn();
  const board = currentGame.board();

  for (let rowIndex = 0; rowIndex < board.length; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < board[rowIndex].length; columnIndex += 1) {
      const piece = board[rowIndex][columnIndex];

      if (piece && piece.type === "k" && piece.color === kingColor) {
        const file = String.fromCharCode(97 + columnIndex);
        const rank = 8 - rowIndex;
        return `${file}${rank}`;
      }
    }
  }

  return "";
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
  const [mode, setMode] = useState("");
  const [customArrows, setCustomArrows] = useState([]);
  const [selectedMove, setSelectedMove] = useState("");
  const [selectedSquare, setSelectedSquare] = useState("");
  const [highlightedSquares, setHighlightedSquares] = useState({});
  const checkedKingSquare = getCheckedKingSquare(boardFen);
  const boardSquareStyles = {
    ...highlightedSquares,
    ...(checkedKingSquare
      ? {
          [checkedKingSquare]: {
            ...(highlightedSquares[checkedKingSquare] || {}),
            background:
              "radial-gradient(circle, rgba(248, 113, 113, 0.42) 0%, rgba(127, 29, 29, 0.28) 70%)",
            boxShadow: "inset 0 0 0 3px rgba(248, 113, 113, 0.95), 0 0 20px rgba(220, 38, 38, 0.35)"
          }
        }
      : {})
  };

  function clearBoardHighlights() {
    setSelectedSquare("");
    setHighlightedSquares({});
  }

  function applyMove(sourceSquare, targetSquare) {
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
    setCustomArrows([]);
    setSelectedMove("");
    clearBoardHighlights();
    setError("");

    analyzeMove(move);
    updateWinBar(gameCopy);

    return true;
  }

  function showLegalMoves(square) {
    const currentGame = new Chess(game.fen());
    const piece = currentGame.get(square);

    if (!piece || piece.color !== currentGame.turn()) {
      clearBoardHighlights();
      return;
    }

    const legalMoves = currentGame.moves({
      square,
      verbose: true
    });

    if (legalMoves.length === 0) {
      clearBoardHighlights();
      return;
    }

    const nextHighlightedSquares = {
      [square]: {
        background:
          "radial-gradient(circle, rgba(96, 165, 250, 0.45) 0%, rgba(37, 99, 235, 0.2) 70%)",
        boxShadow: "inset 0 0 0 2px rgba(147, 197, 253, 0.9)"
      }
    };

    legalMoves.forEach((move) => {
      nextHighlightedSquares[move.to] = {
        background:
          "radial-gradient(circle, rgba(34, 197, 94, 0.38) 0%, rgba(34, 197, 94, 0.18) 35%, transparent 36%)"
      };
    });

    setSelectedSquare(square);
    setHighlightedSquares(nextHighlightedSquares);
  }

  function onPieceClick({ square }) {
    if (!square) {
      return;
    }

    if (selectedSquare === square) {
      clearBoardHighlights();
      return;
    }

    showLegalMoves(square);
  }

  function onSquareClick({ square }) {
    if (!square) {
      clearBoardHighlights();
      return;
    }

    if (selectedSquare) {
      const currentGame = new Chess(game.fen());
      const selectedMoves = currentGame.moves({
        square: selectedSquare,
        verbose: true
      });
      const chosenMove = selectedMoves.find((move) => move.to === square);

      if (chosenMove) {
        applyMove(selectedSquare, square);
        return;
      }
    }

    showLegalMoves(square);
  }

  function onDrop({ sourceSquare, targetSquare }) {
    if (!targetSquare) {
      return false;
    }

    return applyMove(sourceSquare, targetSquare);
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
      setCustomArrows([]);
      setSelectedMove("");
      clearBoardHighlights();
      setError("");
    } catch {
      setError("Invalid FEN. Please check the string and try again.");
    }
  }

  async function predictMoves() {
    try {
      const currentGame = new Chess(boardFen);
      const legalMoves = currentGame.moves({ verbose: true });
      const legalMovesBySan = new Map(
        legalMoves.map((move) => [
          `${move.from}${move.to}${move.promotion || ""}`,
          move
        ])
      );
      const response = await axios.post("http://127.0.0.1:5000/predict", {
        fen: boardFen,
        top_n: 3
      });
      const stockfishMoves = response.data.best_moves || [];
      const predictedMoves = stockfishMoves
        .map((item) => {
          const legalMove = legalMovesBySan.get(item.move);

          if (!legalMove) {
            return null;
          }

          return {
            move: legalMove.san,
            san: legalMove.san,
            from: legalMove.from,
            to: legalMove.to,
            reason: item.reason || "Recommended by Stockfish.",
            count: item.count || 0
          };
        })
        .filter(Boolean);

      if (predictedMoves.length === 0) {
        setMoves([]);
        setCustomArrows([]);
        setSelectedMove("");
        setError("Stockfish did not return usable legal moves for this position.");
        return;
      }

      setMoves(predictedMoves);
      setCustomArrows([]);
      setSelectedMove("");
      clearBoardHighlights();
      setError("");
    } catch {
      setMoves([]);
      setCustomArrows([]);
      setSelectedMove("");
      clearBoardHighlights();
      setError("Unable to fetch move predictions from Stockfish.");
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
      const response = await axios.post("http://127.0.0.1:5000/predict_opening", {
        moves: movesText
      });

      setOpening(response.data.opening);
    } catch (requestError) {
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

    for (const row of board) {
      for (const piece of row) {
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

  function resetGame() {
    const freshGame = new Chess();

    setGame(freshGame);
    setBoardFen(freshGame.fen());
    setFenInput("");
    setMoves([]);
    setOpening("");
    setAnalysis("");
    setCustomArrows([]);
    setSelectedMove("");
    clearBoardHighlights();
    setWhiteWin(50);
    setBlackWin(50);
    setTurn("White");
    setError("");
  }

  if (mode === "") {
    return (
      <div className="app-shell">
        <div className="app-bg-orb app-bg-orb-left" />
        <div className="app-bg-orb app-bg-orb-right" />

        <section className="landing-page fade-in">
          <div className="hero-header">
            <p className="hero-eyebrow">Premium Chess Intelligence</p>
            <h1 className="hero-title">AI Chess Platform</h1>
            <p className="hero-subtitle">
              Explore prediction, analysis, and multiplayer tools in one polished workspace.
            </p>
          </div>

          <div className="mode-grid">
            <button className="mode-card" onClick={() => setMode("predict")}>
              <span className="mode-badge">01</span>
              <h2>Predict Next Move</h2>
              <p>Get the top 3 best moves with clear explanations and arrow guidance.</p>
            </button>

            <button className="mode-card" onClick={() => setMode("analyzer")}>
              <span className="mode-badge">02</span>
              <h2>Move Analyzer</h2>
              <p>Review the strength of your moves and understand the position better.</p>
            </button>

            <button className="mode-card" onClick={() => setMode("twoPlayer")}>
              <span className="mode-badge">03</span>
              <h2>2 Player Game</h2>
              <p>Play on the same board with live AI insights and responsive visuals.</p>
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="app-bg-orb app-bg-orb-left" />
      <div className="app-bg-orb app-bg-orb-right" />

      <main className="chess-page fade-in">
        <div className="top-nav">
          <button className="back-arrow-button" onClick={() => setMode("")}>
            <span aria-hidden="true">←</span>
            <span>Menu</span>
          </button>
        </div>

        <header className="page-header">
          <p className="hero-eyebrow">Predict Best Moves with AI</p>
          <h1 className="page-title">AI Chess Move Predictor</h1>
          <p className="page-subtitle">
            Premium move suggestions, interactive arrows, and FEN-based position loading.
          </p>

          <div className="page-meta">
            <span className="page-meta-pill">{mode === "predict" && "Predict Best Moves"}</span>
            <span className="page-meta-pill">{mode === "analyzer" && "Move Analyzer"}</span>
            <span className="page-meta-pill">{mode === "twoPlayer" && "2 Player Game"}</span>
            {mode === "twoPlayer" && (
              <span className="page-meta-pill accent-pill">
                Turn: {turn}
              </span>
            )}
          </div>
        </header>

        <div className="controls-block controls-block-top">
          <div className="fen-wrapper">
            <input
              className="fen-input"
              type="text"
              value={fenInput}
              onChange={(event) => setFenInput(event.target.value)}
              placeholder="Paste FEN here"
            />
          </div>

          <div className="actions-row">
            <button className="action-button" onClick={loadFen}>
              Load FEN
            </button>
            {mode === "predict" && (
              <button className="action-button" onClick={predictMoves}>
                Predict Moves
              </button>
            )}
            {mode === "analyzer" && (
              <button className="action-button" onClick={detectOpening}>
                Analyze Position
              </button>
            )}
            {mode === "twoPlayer" && (
              <button className="action-button" onClick={resetGame}>
                Reset Game
              </button>
            )}
          </div>

          {error && <p className="status-message error-message">{error}</p>}
          {mode === "analyzer" && opening && <p className="status-message info-message">Opening: {opening}</p>}
          {mode === "analyzer" && analysis && <p className="status-message success-message">{analysis}</p>}
        </div>

        <section className={`workspace-card ${mode === "predict" ? "workspace-card-wide" : "workspace-card-compact"}`}>
          <div className={`workspace-grid ${mode === "predict" ? "workspace-grid-predict" : "workspace-grid-solo"}`}>
            <div className={`board-card ${mode === "predict" ? "" : "board-card-solo"}`}>
              <div className="board-card-header">
                <div>
                  <p className="section-label">Live Board</p>
                  <h2 className="section-title">Current Position</h2>
                </div>
                <div className="board-status">
                  <span>White {whiteWin}%</span>
                  <span>Black {blackWin}%</span>
                </div>
              </div>

              <div className="board-frame">
                <div className="board-glow" />
                <Chessboard
                  key={boardFen}
                  options={{
                    position: boardFen,
                    onPieceDrop: onDrop,
                    onPieceClick,
                    onSquareClick,
                    squareStyles: boardSquareStyles,
                    arrows: customArrows
                  }}
                />
              </div>
            </div>

            {mode === "predict" && (
              <aside className="moves-card">
                <div className="moves-card-header">
                  <div>
                    <p className="section-label">Move Suggestions</p>
                    <h2 className="section-title">Top 3 Best Moves</h2>
                  </div>
                  <span className="panel-chip">{moves.length}/3 Ready</span>
                </div>

                {moves.length === 0 ? (
                  <div className="empty-state">
                    <p>Click <strong>Predict Moves</strong> to generate the top 3 moves with explanations.</p>
                  </div>
                ) : (
                  <div className="moves-list">
                    {moves.map((move, index) => (
                      <button
                        key={`${move.san}-${index}`}
                        className={`move-card ${selectedMove === move.san ? "move-card-active" : ""}`}
                        onClick={() => {
                          setCustomArrows([{
                            startSquare: move.from,
                            endSquare: move.to,
                            color: "#22c55e"
                          }]);
                          setSelectedMove(move.san);
                        }}
                      >
                        <span className="move-rank">#{index + 1}</span>
                        <div className="move-content">
                          <div className="move-name">{move.san}</div>
                          <div className="move-reason">{move.reason}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </aside>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
