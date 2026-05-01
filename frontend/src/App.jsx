import { useEffect, useState } from "react";
import axios from "axios";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import "./App.css";

const INITIAL_GAME = new Chess();
const INITIAL_FEN = INITIAL_GAME.fen();
const DEFAULT_FEN_SUFFIX = " w - - 0 1";
const DEFAULT_TIMER_MINUTES = 5;
const DEFAULT_PLAYER_ONE_NAME = "Player 1";
const DEFAULT_PLAYER_TWO_NAME = "Player 2";

function formatClock(seconds) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

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

function formatEngineScore(scoreType, scoreValue) {
  if (scoreType === "mate") {
    if (scoreValue > 0) {
      return `Mate in ${scoreValue}`;
    }

    if (scoreValue < 0) {
      return `Mated in ${Math.abs(scoreValue)}`;
    }

    return "Mate";
  }

  const pawnScore = scoreValue / 100;
  const sign = pawnScore > 0 ? "+" : "";
  return `${sign}${pawnScore.toFixed(1)}`;
}

function convertPrincipalVariationToSan(fen, pvMoves) {
  const pvGame = new Chess(fen);
  const sanMoves = [];

  for (const uciMove of pvMoves) {
    const move = pvGame.move({
      from: uciMove.slice(0, 2),
      to: uciMove.slice(2, 4),
      promotion: uciMove.slice(4) || "q"
    });

    if (!move) {
      break;
    }

    sanMoves.push(move.san);
  }

  return sanMoves.join(" ");
}

function buildMoveHistoryRows(moveHistory) {
  const rows = [];

  for (let index = 0; index < moveHistory.length; index += 2) {
    rows.push({
      moveNumber: index / 2 + 1,
      whiteMove: moveHistory[index] || "",
      blackMove: moveHistory[index + 1] || ""
    });
  }

  return rows;
}

function getCheckedKingSquare(currentGame) {
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
  const [mode, setMode] = useState("");
  const [customArrows, setCustomArrows] = useState([]);
  const [selectedMove, setSelectedMove] = useState("");
  const [selectedSquare, setSelectedSquare] = useState("");
  const [highlightedSquares, setHighlightedSquares] = useState({});
  const [timerMinutes, setTimerMinutes] = useState(DEFAULT_TIMER_MINUTES);
  const [whiteTimeLeft, setWhiteTimeLeft] = useState(DEFAULT_TIMER_MINUTES * 60);
  const [blackTimeLeft, setBlackTimeLeft] = useState(DEFAULT_TIMER_MINUTES * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [engineSummary, setEngineSummary] = useState(null);
  const [playerOneName, setPlayerOneName] = useState(DEFAULT_PLAYER_ONE_NAME);
  const [playerTwoName, setPlayerTwoName] = useState(DEFAULT_PLAYER_TWO_NAME);
  const [playerOneColor, setPlayerOneColor] = useState("white");
  const [isTwoPlayerStarted, setIsTwoPlayerStarted] = useState(false);
  const moveHistoryRows = buildMoveHistoryRows(game.history());
  const whitePlayerName = playerOneColor === "white" ? playerOneName : playerTwoName;
  const blackPlayerName = playerOneColor === "black" ? playerOneName : playerTwoName;
  const checkedKingSquare = getCheckedKingSquare(game);
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

  function clearBoardUiState() {
    setCustomArrows([]);
    setSelectedMove("");
    clearBoardHighlights();
    setError("");
  }

  function clearEngineSummary() {
    setEngineSummary(null);
  }

  useEffect(() => {
    if (mode !== "twoPlayer" || !isTwoPlayerStarted || !isTimerRunning) {
      return undefined;
    }

    const activeColor = game.turn();
    const timerId = window.setInterval(() => {
      if (activeColor === "w") {
        setWhiteTimeLeft((currentTime) => {
          if (currentTime <= 1) {
            window.clearInterval(timerId);
            setIsTimerRunning(false);
            setError("White ran out of time.");
            return 0;
          }

          return currentTime - 1;
        });
      } else {
        setBlackTimeLeft((currentTime) => {
          if (currentTime <= 1) {
            window.clearInterval(timerId);
            setIsTimerRunning(false);
            setError("Black ran out of time.");
            return 0;
          }

          return currentTime - 1;
        });
      }
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [game, isTimerRunning, isTwoPlayerStarted, mode]);

  function resetTimer(minutes = timerMinutes, shouldRun = false) {
    setTimerMinutes(minutes);
    setWhiteTimeLeft(minutes * 60);
    setBlackTimeLeft(minutes * 60);
    setIsTimerRunning(shouldRun);
  }

  function initializeBoardState(shouldRunTimer = false, minutes = timerMinutes) {
    const freshGame = new Chess();

    setGame(freshGame);
    setBoardFen(freshGame.fen());
    setFenInput("");
    setOpening("");
    setAnalysis("");
    setWhiteWin(50);
    setBlackWin(50);
    setMoves([]);
    clearBoardUiState();
    clearEngineSummary();
    resetTimer(minutes, shouldRunTimer);
  }

  function applyMove(sourceSquare, targetSquare) {
    if (mode === "twoPlayer" && !isTwoPlayerStarted) {
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
    clearBoardUiState();
    clearEngineSummary();
    if (mode === "twoPlayer" && isTwoPlayerStarted) {
      setIsTimerRunning(true);
    }

    analyzeMove(move);
    updateWinBar(gameCopy);

    return true;
  }

  function showLegalMoves(square) {
    if (mode === "twoPlayer" && !isTwoPlayerStarted) {
      clearBoardHighlights();
      return;
    }

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
      clearBoardUiState();
      clearEngineSummary();
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
            evaluation: formatEngineScore(item.score_type, item.score),
            principalVariation: convertPrincipalVariationToSan(boardFen, item.pv || []),
            rank: item.rank || 0,
            scoreType: item.score_type,
            score: item.score
          };
        })
        .filter(Boolean);

      if (predictedMoves.length === 0) {
        setMoves([]);
        clearBoardUiState();
        clearEngineSummary();
        setError("Stockfish did not return usable legal moves for this position.");
        return;
      }

      setMoves(predictedMoves);
      setEngineSummary({
        bestMove: predictedMoves[0].san,
        evaluation: predictedMoves[0].evaluation,
        principalVariation: predictedMoves[0].principalVariation
      });
      clearBoardUiState();
    } catch {
      setMoves([]);
      clearBoardUiState();
      clearEngineSummary();
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
    } catch {
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

  function resetGame(shouldRunTimer = mode === "twoPlayer") {
    initializeBoardState(shouldRunTimer, timerMinutes);
    if (mode === "twoPlayer") {
      setIsTwoPlayerStarted(false);
    }
  }

  function openMode(nextMode) {
    setMode(nextMode);
    initializeBoardState(false, timerMinutes);
    setIsTwoPlayerStarted(false);
  }

  function goToMenu() {
    initializeBoardState(false, timerMinutes);
    setMode("");
    setIsTimerRunning(false);
    setIsTwoPlayerStarted(false);
  }

  function startTwoPlayerGame() {
    initializeBoardState(true, timerMinutes);
    setIsTwoPlayerStarted(true);
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
            <button className="mode-card" onClick={() => openMode("predict")}>
              <span className="mode-badge">01</span>
              <h2>Predict Next Move</h2>
              <p>Get the top 3 best moves with clear explanations and arrow guidance.</p>
            </button>

            <button className="mode-card" onClick={() => openMode("analyzer")}>
              <span className="mode-badge">02</span>
              <h2>Move Analyzer</h2>
              <p>Review the strength of your moves and understand the position better.</p>
            </button>

            <button className="mode-card" onClick={() => openMode("twoPlayer")}>
              <span className="mode-badge">03</span>
              <h2>2 Player Game</h2>
              <p>Play on the same board with live AI insights and responsive visuals.</p>
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (mode === "twoPlayer" && !isTwoPlayerStarted) {
    return (
      <div className="app-shell">
        <div className="app-bg-orb app-bg-orb-left" />
        <div className="app-bg-orb app-bg-orb-right" />

        <main className="chess-page fade-in">
          <div className="top-nav">
            <button className="back-arrow-button" onClick={goToMenu}>
              <span aria-hidden="true">←</span>
              <span>Menu</span>
            </button>
          </div>

          <section className="setup-page-card">
            <div className="setup-card-header">
              <p className="section-label">Match Setup</p>
              <h1 className="page-title">2 Player Game Setup</h1>
              <p className="page-subtitle">
                Enter player names, choose Player 1 color, and select the time control before starting.
              </p>
            </div>

            <div className="setup-grid">
              <label className="setup-field">
                <span className="setup-label">Player 1 Name</span>
                <input
                  className="setup-input"
                  type="text"
                  value={playerOneName}
                  onChange={(event) => setPlayerOneName(event.target.value)}
                  placeholder="Player 1"
                />
              </label>

              <label className="setup-field">
                <span className="setup-label">Player 2 Name</span>
                <input
                  className="setup-input"
                  type="text"
                  value={playerTwoName}
                  onChange={(event) => setPlayerTwoName(event.target.value)}
                  placeholder="Player 2"
                />
              </label>
            </div>

            <div className="setup-row">
              <div className="setup-option-group">
                <span className="setup-label">Player 1 Color</span>
                <div className="setup-choice-row">
                  {["white", "black"].map((color) => (
                    <button
                      key={color}
                      className={`setup-choice-button ${playerOneColor === color ? "setup-choice-button-active" : ""}`}
                      onClick={() => setPlayerOneColor(color)}
                    >
                      {color === "white" ? "White" : "Black"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="setup-option-group">
                <span className="setup-label">Time Control</span>
                <div className="setup-choice-row">
                  {[1, 5, 10].map((minutes) => (
                    <button
                      key={minutes}
                      className={`setup-choice-button ${timerMinutes === minutes ? "setup-choice-button-active" : ""}`}
                      onClick={() => resetTimer(minutes, false)}
                    >
                      {minutes} min
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="setup-actions">
              <button className="action-button" onClick={startTwoPlayerGame}>
                Start Game
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (mode === "twoPlayer") {
    return (
      <div className="app-shell">
        <div className="app-bg-orb app-bg-orb-left" />
        <div className="app-bg-orb app-bg-orb-right" />

        <main className="chess-page fade-in">
          <div className="top-nav">
            <button className="back-arrow-button" onClick={goToMenu}>
              <span aria-hidden="true">←</span>
              <span>Menu</span>
            </button>
          </div>

          <div className="timer-panel">
            <div className="timer-clocks">
              <div className={`clock-card ${game.turn() === "w" && isTimerRunning ? "clock-card-active" : ""}`}>
                <span className="clock-label">{whitePlayerName || DEFAULT_PLAYER_ONE_NAME}</span>
                <span className="clock-time">{formatClock(whiteTimeLeft)}</span>
              </div>
              <div className={`clock-card ${game.turn() === "b" && isTimerRunning ? "clock-card-active" : ""}`}>
                <span className="clock-label">{blackPlayerName || DEFAULT_PLAYER_TWO_NAME}</span>
                <span className="clock-time">{formatClock(blackTimeLeft)}</span>
              </div>
            </div>
          </div>

          {error && <p className="status-message error-message">{error}</p>}

          <section className="workspace-card workspace-card-compact">
            <div className="workspace-grid workspace-grid-solo">
              <div className="board-card board-card-solo">
                <div className="board-frame">
                  <div className="board-glow" />
                  <Chessboard
                    key={boardFen}
                    options={{
                      position: boardFen,
                      boardOrientation: playerOneColor,
                      onPieceDrop: onDrop,
                      onPieceClick,
                      onSquareClick,
                      allowDragging: isTwoPlayerStarted,
                      squareStyles: boardSquareStyles,
                      arrows: customArrows
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="actions-row">
              <button className="action-button" onClick={resetGame}>
                Reset Game
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="app-bg-orb app-bg-orb-left" />
      <div className="app-bg-orb app-bg-orb-right" />

      <main className="chess-page fade-in">
        <div className="top-nav">
          <button className="back-arrow-button" onClick={goToMenu}>
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
                Turn: {game.turn() === "w" ? whitePlayerName : blackPlayerName}
              </span>
            )}
          </div>
        </header>

        {mode === "twoPlayer" && (
          <>
            <div className="setup-card">
              <div className="setup-card-header">
                <p className="section-label">Match Setup</p>
                <h2 className="section-title">2 Player Game Setup</h2>
              </div>

              <div className="setup-grid">
                <label className="setup-field">
                  <span className="setup-label">Player 1 Name</span>
                  <input
                    className="setup-input"
                    type="text"
                    value={playerOneName}
                    onChange={(event) => setPlayerOneName(event.target.value)}
                    placeholder="Player 1"
                  />
                </label>

                <label className="setup-field">
                  <span className="setup-label">Player 2 Name</span>
                  <input
                    className="setup-input"
                    type="text"
                    value={playerTwoName}
                    onChange={(event) => setPlayerTwoName(event.target.value)}
                    placeholder="Player 2"
                  />
                </label>
              </div>

              <div className="setup-row">
                <div className="setup-option-group">
                  <span className="setup-label">Player 1 Color</span>
                  <div className="setup-choice-row">
                    {["white", "black"].map((color) => (
                      <button
                        key={color}
                        className={`setup-choice-button ${playerOneColor === color ? "setup-choice-button-active" : ""}`}
                        onClick={() => setPlayerOneColor(color)}
                      >
                        {color === "white" ? "White" : "Black"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="setup-option-group">
                  <span className="setup-label">Time Control</span>
                  <div className="setup-choice-row">
                    {[1, 5, 10].map((minutes) => (
                      <button
                        key={minutes}
                        className={`setup-choice-button ${timerMinutes === minutes ? "setup-choice-button-active" : ""}`}
                        onClick={() => resetTimer(minutes, false)}
                      >
                        {minutes} min
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="setup-actions">
                <button className="action-button" onClick={startTwoPlayerGame}>
                  Start Game
                </button>
              </div>
            </div>

            <div className="timer-panel">
              <div className="timer-clocks">
                <div className={`clock-card ${game.turn() === "w" && isTimerRunning ? "clock-card-active" : ""}`}>
                  <span className="clock-label">{whitePlayerName || DEFAULT_PLAYER_ONE_NAME}</span>
                  <span className="clock-time">{formatClock(whiteTimeLeft)}</span>
                </div>
                <div className={`clock-card ${game.turn() === "b" && isTimerRunning ? "clock-card-active" : ""}`}>
                  <span className="clock-label">{blackPlayerName || DEFAULT_PLAYER_TWO_NAME}</span>
                  <span className="clock-time">{formatClock(blackTimeLeft)}</span>
                </div>
              </div>
            </div>
          </>
        )}

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

        {mode === "predict" && engineSummary && (
          <section className="engine-summary-card">
            <div className="engine-summary-item">
              <span className="engine-summary-label">Best Move</span>
              <span className="engine-summary-value">{engineSummary.bestMove}</span>
            </div>
            <div className="engine-summary-item">
              <span className="engine-summary-label">Evaluation</span>
              <span className="engine-summary-value">{engineSummary.evaluation}</span>
            </div>
            <div className="engine-summary-item engine-summary-line">
              <span className="engine-summary-label">Top Line</span>
              <span className="engine-summary-line-text">{engineSummary.principalVariation}</span>
            </div>
          </section>
        )}

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
                    boardOrientation: mode === "twoPlayer" ? playerOneColor : "white",
                    onPieceDrop: onDrop,
                    onPieceClick,
                    onSquareClick,
                    allowDragging: mode !== "twoPlayer" || isTwoPlayerStarted,
                    squareStyles: boardSquareStyles,
                    arrows: customArrows
                  }}
                />
              </div>

              <div className="history-card">
                <div className="history-card-header">
                  <p className="section-label">Game Record</p>
                  <h3 className="history-title">Move History</h3>
                </div>

                {moveHistoryRows.length === 0 ? (
                  <div className="history-empty">
                    No moves yet.
                  </div>
                ) : (
                  <div className="history-list">
                    {moveHistoryRows.map((row) => (
                      <div key={row.moveNumber} className="history-row">
                        <span className="history-move-number">{row.moveNumber}.</span>
                        <span className="history-move">{row.whiteMove}</span>
                        <span className="history-move">{row.blackMove || "-"}</span>
                      </div>
                    ))}
                  </div>
                )}
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
                          <div className="move-header-row">
                            <div className="move-name">{move.san}</div>
                            <div className="move-evaluation">{move.evaluation}</div>
                          </div>
                          <div className="move-reason">{move.reason}</div>
                          <div className="move-line-label">Principal variation</div>
                          <div className="move-line-text">{move.principalVariation}</div>
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
