/**
 * Xiangqi (Chinese Chess) AI Engine
 * Alpha-Beta Pruning + Quiescence Search + MVV-LVA Ordering + Xiangqi Piece-Square Tables
 */

import { RED, BLACK, PIECE_DEFS, hasCrossedRiver } from './xiangqi-engine.js';

// Positional bonus tables from RED's perspective (row 0 = enemy back rank, row 9 = Red back rank)
// For BLACK, mirror vertically: row -> 9 - row
const PST = {
  // Soldier (兵/卒): huge boost after crossing river (rows 0..4) especially near Palace
  p: [
    [10, 15, 20, 30, 35, 30, 20, 15, 10],
    [25, 35, 50, 75, 85, 75, 50, 35, 25],
    [25, 35, 50, 70, 80, 70, 50, 35, 25],
    [20, 30, 40, 55, 60, 55, 40, 30, 20],
    [15, 22, 28, 35, 40, 35, 28, 22, 15],
    [0,  0,  8,  0,  12, 0,  8,  0,  0],
    [0,  0,  0,  0,  0,  0,  0,  0,  0],
    [0,  0,  0,  0,  0,  0,  0,  0,  0],
    [0,  0,  0,  0,  0,  0,  0,  0,  0],
    [0,  0,  0,  0,  0,  0,  0,  0,  0],
  ],
  // Horse (傌/馬): strong in active forward/central outposts, weak on rim
  n: [
    [10, 15, 25, 20, 15, 20, 25, 15, 10],
    [15, 28, 42, 48, 30, 48, 42, 28, 15],
    [20, 35, 45, 52, 45, 52, 45, 35, 20],
    [18, 30, 38, 45, 42, 45, 38, 30, 18],
    [14, 24, 32, 36, 35, 36, 32, 24, 14],
    [10, 20, 28, 32, 30, 32, 28, 20, 10],
    [8,  16, 22, 24, 24, 24, 22, 16, 8],
    [5,  12, 18, 20, 15, 20, 18, 12, 5],
    [2,  8,  12, 10, 5,  10, 12, 8,  2],
    [0,  -5, 8,  8,  0,  8,  8,  -5, 0],
  ],
  // Chariot (俥/車): controls open files, river rank, and enemy palace ranks
  r: [
    [25, 30, 28, 38, 40, 38, 28, 30, 25],
    [28, 36, 35, 45, 48, 45, 35, 36, 28],
    [22, 30, 28, 35, 36, 35, 28, 30, 22],
    [20, 26, 25, 32, 32, 32, 25, 26, 20],
    [18, 24, 24, 30, 30, 30, 24, 24, 18],
    [15, 22, 20, 26, 26, 26, 20, 22, 15],
    [10, 16, 14, 20, 20, 20, 14, 16, 10],
    [10, 16, 14, 18, 18, 18, 14, 16, 10],
    [12, 18, 16, 20, 16, 20, 16, 18, 12],
    [-4, 14, 10, 18, 12, 18, 10, 14, -4],
  ],
  // Cannon (炮/砲): strong on central file (當頭炮) and controlling long lines
  c: [
    [18, 18, 15, 22, 28, 22, 15, 18, 18],
    [15, 18, 15, 20, 25, 20, 15, 18, 15],
    [14, 16, 18, 26, 32, 26, 18, 16, 14],
    [10, 12, 14, 22, 30, 22, 14, 12, 10],
    [8,  10, 12, 20, 28, 20, 12, 10, 8],
    [6,  8,  10, 18, 26, 18, 10, 8,  6],
    [4,  6,  8,  14, 22, 14, 8,  6,  4],
    [8,  10, 18, 16, 30, 16, 18, 10, 8],
    [4,  6,  6,  10, 16, 10, 6,  6,  4],
    [2,  4,  4,  8,  14, 8,  4,  4,  2],
  ],
  // Advisor (仕/士): best at center of Palace (row 8, col 4)
  a: [
    [0, 0, 0, 0,  0,  0, 0, 0, 0],
    [0, 0, 0, 0,  0,  0, 0, 0, 0],
    [0, 0, 0, 0,  0,  0, 0, 0, 0],
    [0, 0, 0, 0,  0,  0, 0, 0, 0],
    [0, 0, 0, 0,  0,  0, 0, 0, 0],
    [0, 0, 0, 0,  0,  0, 0, 0, 0],
    [0, 0, 0, 0,  0,  0, 0, 0, 0],
    [0, 0, 0, 12, 0,  12, 0, 0, 0],
    [0, 0, 0, 0,  22, 0, 0, 0, 0],
    [0, 0, 0, 10, 0,  10, 0, 0, 0],
  ],
  // Elephant (相/象): central river defense (row 7, col 4)
  b: [
    [0, 0, 0,  0, 0,  0, 0,  0, 0],
    [0, 0, 0,  0, 0,  0, 0,  0, 0],
    [0, 0, 0,  0, 0,  0, 0,  0, 0],
    [0, 0, 0,  0, 0,  0, 0,  0, 0],
    [0, 0, 0,  0, 0,  0, 0,  0, 0],
    [0, 0, 12, 0, 0,  0, 12, 0, 0],
    [0, 0, 0,  0, 0,  0, 0,  0, 0],
    [8, 0, 0,  0, 24, 0, 0,  0, 8],
    [0, 0, 0,  0, 0,  0, 0,  0, 0],
    [0, 0, 10, 0, 0,  0, 10, 0, 0],
  ],
  // General (帥/將): safest on bottom center rank
  k: [
    [0, 0, 0, 0,  0,  0,  0, 0, 0],
    [0, 0, 0, 0,  0,  0,  0, 0, 0],
    [0, 0, 0, 0,  0,  0,  0, 0, 0],
    [0, 0, 0, 0,  0,  0,  0, 0, 0],
    [0, 0, 0, 0,  0,  0,  0, 0, 0],
    [0, 0, 0, 0,  0,  0,  0, 0, 0],
    [0, 0, 0, 0,  0,  0,  0, 0, 0],
    [0, 0, 0, -8, -8, -8, 0, 0, 0],
    [0, 0, 0, 2,  6,  2,  0, 0, 0],
    [0, 0, 0, 10, 18, 10, 0, 0, 0],
  ],
};

export function evaluateBoard(engine, perspectiveColor = RED) {
  const board = engine.board;
  let score = 0;

  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const p = board[r][c];
      if (!p) continue;

      const baseVal = PIECE_DEFS[p.type].value;
      const pstRow = p.color === RED ? r : 9 - r;
      const posBonus = PST[p.type]?.[pstRow]?.[c] || 0;

      const total = baseVal + posBonus;
      if (p.color === perspectiveColor) {
        score += total;
      } else {
        score -= total;
      }
    }
  }

  return score;
}

function scoreMoveForOrdering(move) {
  let score = 0;
  if (move.captured) {
    // MVV-LVA: Most Valuable Victim - Least Valuable Attacker
    score += 1000 + PIECE_DEFS[move.captured.type].value * 10 - PIECE_DEFS[move.piece.type].value;
  }
  // Bonus for advancing across river or towards center
  const pstRow = move.piece.color === RED ? move.toRow : 9 - move.toRow;
  score += PST[move.piece.type]?.[pstRow]?.[move.toCol] || 0;
  return score;
}

export class XiangqiAI {
  constructor() {
    this.nodesSearched = 0;
  }

  /**
   * Finds the best move for `color` at the requested difficulty depth.
   * Difficulty levels:
   *  1 = Novice (初學, depth 2)
   *  2 = Club (棋社, depth 3)
   *  3 = Master (國手, depth 4)
   */
  async findBestMove(engine, difficulty = 2) {
    // Yield briefly so UI renders "AI Thinking" state smoothly
    await new Promise((resolve) => setTimeout(resolve, 40));

    const color = engine.turn;
    const legalMoves = engine.getAllLegalMoves(color, engine.board);
    if (legalMoves.length === 0) return null;
    if (legalMoves.length === 1) return legalMoves[0];

    const depth = difficulty === 1 ? 2 : difficulty === 2 ? 3 : 4;
    this.nodesSearched = 0;

    // Order root moves
    legalMoves.sort((a, b) => scoreMoveForOrdering(b) - scoreMoveForOrdering(a));

    let bestMove = legalMoves[0];
    let bestScore = -Infinity;
    let alpha = -Infinity;
    const beta = Infinity;

    const board = engine.board;

    for (const move of legalMoves) {
      const origFrom = board[move.fromRow][move.fromCol];
      const origTo = board[move.toRow][move.toCol];

      board[move.toRow][move.toCol] = origFrom;
      board[move.fromRow][move.fromCol] = null;

      // Immediate checkmate detection
      const oppColor = color === RED ? BLACK : RED;
      let score;
      const oppMoves = engine.getAllLegalMoves(oppColor, board);
      if (oppMoves.length === 0) {
        score = 99999;
      } else {
        score = -this.negamax(engine, depth - 1, -beta, -alpha, oppColor);
      }

      // Small slight jitter in Novice mode so it feels natural
      if (difficulty === 1) {
        score += (Math.random() - 0.5) * 14;
      }

      board[move.fromRow][move.fromCol] = origFrom;
      board[move.toRow][move.toCol] = origTo;

      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
      if (score > alpha) {
        alpha = score;
      }
    }

    return bestMove;
  }

  negamax(engine, depth, alpha, beta, color) {
    this.nodesSearched++;
    const board = engine.board;

    if (depth <= 0) {
      return this.quiescence(engine, alpha, beta, color, 2);
    }

    const moves = engine.getAllLegalMoves(color, board);
    if (moves.length === 0) {
      // In Xiangqi, both checkmate and stalemate (困斃) are losses for the side with no moves!
      return -90000 - depth * 100;
    }

    moves.sort((a, b) => scoreMoveForOrdering(b) - scoreMoveForOrdering(a));
    const oppColor = color === RED ? BLACK : RED;

    let maxScore = -Infinity;
    for (const move of moves) {
      const origFrom = board[move.fromRow][move.fromCol];
      const origTo = board[move.toRow][move.toCol];

      board[move.toRow][move.toCol] = origFrom;
      board[move.fromRow][move.fromCol] = null;

      const score = -this.negamax(engine, depth - 1, -beta, -alpha, oppColor);

      board[move.fromRow][move.fromCol] = origFrom;
      board[move.toRow][move.toCol] = origTo;

      if (score > maxScore) maxScore = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
    }

    return maxScore;
  }

  quiescence(engine, alpha, beta, color, qDepth) {
    const standPat = evaluateBoard(engine, color);
    if (standPat >= beta) return beta;
    if (standPat > alpha) alpha = standPat;
    if (qDepth <= 0) return standPat;

    const board = engine.board;
    const captureMoves = engine
      .getAllLegalMoves(color, board)
      .filter((m) => m.captured !== null)
      .sort((a, b) => scoreMoveForOrdering(b) - scoreMoveForOrdering(a));

    const oppColor = color === RED ? BLACK : RED;

    for (const move of captureMoves) {
      const origFrom = board[move.fromRow][move.fromCol];
      const origTo = board[move.toRow][move.toCol];

      board[move.toRow][move.toCol] = origFrom;
      board[move.fromRow][move.fromCol] = null;

      const score = -this.quiescence(engine, -beta, -alpha, oppColor, qDepth - 1);

      board[move.fromRow][move.fromCol] = origFrom;
      board[move.toRow][move.toCol] = origTo;

      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }

    return alpha;
  }
}
