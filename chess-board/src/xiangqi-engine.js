/**
 * Authentic Chinese Chess (Xiangqi / 中國象棋) Rules & Notation Engine
 * Supports full legal move generation, Flying General (飛將), Horse-leg blocking (蹩馬腿),
 * Elephant-eye blocking (塞象眼), Cannon screen jumping (炮打隔子), Check/Checkmate/Stalemate (困斃),
 * traditional 4-character Chinese notation (炮二平五), and classical endgame presets (殘局).
 */

export const RED = 'r';
export const BLACK = 'b';

export const PIECE_DEFS = {
  k: {
    type: 'k',
    enName: 'General',
    redChar: '帥',
    blackChar: '將',
    pinyin: 'Shuài / Jiàng',
    value: 10000,
  },
  a: {
    type: 'a',
    enName: 'Advisor',
    redChar: '仕',
    blackChar: '士',
    pinyin: 'Shì',
    value: 120,
  },
  b: {
    type: 'b',
    enName: 'Elephant',
    redChar: '相',
    blackChar: '象',
    pinyin: 'Xiàng',
    value: 120,
  },
  n: {
    type: 'n',
    enName: 'Horse',
    redChar: '傌',
    blackChar: '馬',
    pinyin: 'Mǎ',
    value: 270,
  },
  r: {
    type: 'r',
    enName: 'Chariot',
    redChar: '俥',
    blackChar: '車',
    pinyin: 'Jū',
    value: 600,
  },
  c: {
    type: 'c',
    enName: 'Cannon',
    redChar: '炮',
    blackChar: '砲',
    pinyin: 'Pào',
    value: 285,
  },
  p: {
    type: 'p',
    enName: 'Soldier',
    redChar: '兵',
    blackChar: '卒',
    pinyin: 'Bīng / Zú',
    value: 70,
  },
};

export const PRESET_POSITIONS = [
  {
    id: 'standard',
    title: '標準開局',
    subtitle: 'Standard Full Game (32 Pieces)',
    description: 'Traditional starting battle formation across Chu River & Han Border.',
    fen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r',
  },
  {
    id: 'double-horses',
    title: '雙馬飲泉',
    subtitle: 'Two Horses Drinking at the Spring',
    description: 'Classical tactical endgame: weave a mating net with dual Horses and Chariot.',
    fen: '3ak4/4a4/4b4/9/9/2B6/9/3ABA2N/2n1r4/3K1R1N1 r',
  },
  {
    id: 'heaven-earth-cannon',
    title: '天地炮殺法',
    subtitle: 'Heaven & Earth Cannons',
    description: 'Combine the central Cannon and bottom-rank Cannon with your Chariot to break the Palace.',
    fen: '2bak4/4a4/4b4/9/4C4/9/9/4C4/4A4/1R2KAB2 r',
  },
  {
    id: 'horse-cannon-mate',
    title: '馬後炮絕殺',
    subtitle: 'Horse-Backed Cannon Classic',
    description: 'Use the Horse to lock the General and serve as the Cannon mount (炮架).',
    fen: '3ak4/4a4/9/5N3/9/9/9/4C4/4r4/3K1R3 r',
  },
  {
    id: 'seven-stars',
    title: '千里獨行',
    subtitle: 'A Thousand Miles Alone',
    description: 'Advanced endgame study: guide the crossed-river Soldier and Chariot to victory.',
    fen: '3k5/4a4/3ab4/4P4/9/2B6/9/3A1A3/5K3/1r4R2 r',
  },
];

const RED_NUMERALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const BLACK_NUMERALS = ['１', '２', '３', '４', '５', '６', '７', '８', '９'];

export function getPieceChar(piece) {
  if (!piece) return '';
  const def = PIECE_DEFS[piece.type];
  return piece.color === RED ? def.redChar : def.blackChar;
}

export function getPieceName(piece) {
  if (!piece) return '';
  return PIECE_DEFS[piece.type]?.enName || '';
}

export function inBounds(row, col) {
  return row >= 0 && row < 10 && col >= 0 && col < 9;
}

export function inPalace(row, col, color) {
  if (col < 3 || col > 5) return false;
  if (color === RED) return row >= 7 && row <= 9;
  return row >= 0 && row <= 2;
}

export function hasCrossedRiver(row, color) {
  return color === RED ? row <= 4 : row >= 5;
}

export class XiangqiEngine {
  constructor(fen = PRESET_POSITIONS[0].fen) {
    this.initialFen = fen;
    this.reset(fen);
  }

  reset(fen = this.initialFen) {
    this.initialFen = fen;
    this.board = Array.from({ length: 10 }, () => Array(9).fill(null));
    this.turn = RED;
    this.moveHistory = [];
    this.redoStack = [];
    this.capturedByRed = [];   // Black pieces captured by Red
    this.capturedByBlack = []; // Red pieces captured by Black
    this.nextPieceUid = 1;
    this.loadFen(fen);
    this.status = this.evaluateGameStatus();
  }

  loadFen(fen) {
    const parts = fen.trim().split(/\s+/);
    const rows = parts[0].split('/');
    this.turn = parts[1] === 'b' ? BLACK : RED;

    for (let r = 0; r < 10; r++) {
      let c = 0;
      const rowStr = rows[r] || '';
      for (const ch of rowStr) {
        if (ch >= '1' && ch <= '9') {
          c += parseInt(ch, 10);
        } else {
          const isRed = ch === ch.toUpperCase();
          const type = ch.toLowerCase();
          if (PIECE_DEFS[type] && c < 9) {
            this.board[r][c] = {
              uid: `p_${this.nextPieceUid++}`,
              type,
              color: isRed ? RED : BLACK,
              row: r,
              col: c,
            };
          }
          c++;
        }
      }
    }
  }

  exportFen() {
    const rows = [];
    for (let r = 0; r < 10; r++) {
      let empty = 0;
      let rowStr = '';
      for (let c = 0; c < 9; c++) {
        const p = this.board[r][c];
        if (!p) {
          empty++;
        } else {
          if (empty > 0) {
            rowStr += empty;
            empty = 0;
          }
          rowStr += p.color === RED ? p.type.toUpperCase() : p.type;
        }
      }
      if (empty > 0) rowStr += empty;
      rows.push(rowStr);
    }
    return `${rows.join('/')} ${this.turn}`;
  }

  cloneBoard(board = this.board) {
    return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
  }

  getPiece(row, col, board = this.board) {
    if (!inBounds(row, col)) return null;
    return board[row][col];
  }

  findKing(color, board = this.board) {
    const rStart = color === RED ? 7 : 0;
    const rEnd = color === RED ? 9 : 2;
    for (let r = rStart; r <= rEnd; r++) {
      for (let c = 3; c <= 5; c++) {
        const p = board[r][c];
        if (p && p.color === color && p.type === 'k') {
          return { row: r, col: c, piece: p };
        }
      }
    }
    // Fallback full scan
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const p = board[r][c];
        if (p && p.color === color && p.type === 'k') {
          return { row: r, col: c, piece: p };
        }
      }
    }
    return null;
  }

  /**
   * Generates pseudo-legal moves for a piece at (row, col) on the given board.
   * Also records blocked moves (蹩馬腿 / 塞象眼) in `blockedMoves` if requested.
   */
  getPseudoMoves(row, col, board = this.board) {
    const piece = board[row][col];
    if (!piece) return { moves: [], blocked: [] };

    const { type, color } = piece;
    const moves = [];
    const blocked = [];

    const addIfValid = (toRow, toCol, extra = {}) => {
      if (!inBounds(toRow, toCol)) return false;
      const target = board[toRow][toCol];
      if (!target) {
        moves.push({
          fromRow: row,
          fromCol: col,
          toRow,
          toCol,
          piece,
          captured: null,
          ...extra,
        });
        return true;
      } else if (target.color !== color) {
        moves.push({
          fromRow: row,
          fromCol: col,
          toRow,
          toCol,
          piece,
          captured: target,
          ...extra,
        });
        return false;
      }
      return false;
    };

    switch (type) {
      case 'k': {
        const dirs = [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ];
        for (const [dr, dc] of dirs) {
          const nr = row + dr;
          const nc = col + dc;
          if (inPalace(nr, nc, color)) {
            addIfValid(nr, nc);
          }
        }
        break;
      }

      case 'a': {
        const dirs = [
          [-1, -1],
          [-1, 1],
          [1, -1],
          [1, 1],
        ];
        for (const [dr, dc] of dirs) {
          const nr = row + dr;
          const nc = col + dc;
          if (inPalace(nr, nc, color)) {
            addIfValid(nr, nc);
          }
        }
        break;
      }

      case 'b': {
        const dirs = [
          [-2, -2],
          [-2, 2],
          [2, -2],
          [2, 2],
        ];
        for (const [dr, dc] of dirs) {
          const nr = row + dr;
          const nc = col + dc;
          if (!inBounds(nr, nc)) continue;
          // Elephant cannot cross the river
          if (hasCrossedRiver(nr, color)) continue;
          const eyeRow = row + dr / 2;
          const eyeCol = col + dc / 2;
          if (board[eyeRow][eyeCol]) {
            blocked.push({
              toRow: nr,
              toCol: nc,
              blockerRow: eyeRow,
              blockerCol: eyeCol,
              reason: '塞象眼 (Elephant Eye Blocked)',
            });
            continue;
          }
          addIfValid(nr, nc);
        }
        break;
      }

      case 'n': {
        const horseJumps = [
          { leg: [-1, 0], dests: [[-2, -1], [-2, 1]] },
          { leg: [1, 0], dests: [[2, -1], [2, 1]] },
          { leg: [0, -1], dests: [[-1, -2], [1, -2]] },
          { leg: [0, 1], dests: [[-1, 2], [1, 2]] },
        ];
        for (const { leg, dests } of horseJumps) {
          const legRow = row + leg[0];
          const legCol = col + leg[1];
          if (!inBounds(legRow, legCol)) continue;
          const blocker = board[legRow][legCol];
          for (const [dr, dc] of dests) {
            const nr = row + dr;
            const nc = col + dc;
            if (!inBounds(nr, nc)) continue;
            if (blocker) {
              blocked.push({
                toRow: nr,
                toCol: nc,
                blockerRow: legRow,
                blockerCol: legCol,
                reason: '蹩馬腿 (Horse Leg Blocked)',
              });
            } else {
              addIfValid(nr, nc, { isJump: true });
            }
          }
        }
        break;
      }

      case 'r': {
        const dirs = [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ];
        for (const [dr, dc] of dirs) {
          let nr = row + dr;
          let nc = col + dc;
          while (inBounds(nr, nc)) {
            const cont = addIfValid(nr, nc);
            if (!cont) break;
            nr += dr;
            nc += dc;
          }
        }
        break;
      }

      case 'c': {
        const dirs = [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ];
        for (const [dr, dc] of dirs) {
          let nr = row + dr;
          let nc = col + dc;
          let screenPos = null;
          while (inBounds(nr, nc)) {
            const target = board[nr][nc];
            if (!screenPos) {
              if (!target) {
                moves.push({
                  fromRow: row,
                  fromCol: col,
                  toRow: nr,
                  toCol: nc,
                  piece,
                  captured: null,
                });
              } else {
                screenPos = { row: nr, col: nc, piece: target };
              }
            } else {
              if (target) {
                if (target.color !== color) {
                  moves.push({
                    fromRow: row,
                    fromCol: col,
                    toRow: nr,
                    toCol: nc,
                    piece,
                    captured: target,
                    screenPos,
                    isJump: true,
                  });
                }
                break;
              }
            }
            nr += dr;
            nc += dc;
          }
        }
        break;
      }

      case 'p': {
        const forward = color === RED ? -1 : 1;
        addIfValid(row + forward, col);
        if (hasCrossedRiver(row, color)) {
          addIfValid(row, col - 1);
          addIfValid(row, col + 1);
        }
        break;
      }
    }

    return { moves, blocked };
  }

  /**
   * Checks whether the two Generals face each other directly on the same file with no pieces between.
   */
  areKingsFacing(board = this.board) {
    const redKing = this.findKing(RED, board);
    const blackKing = this.findKing(BLACK, board);
    if (!redKing || !blackKing) return false;
    if (redKing.col !== blackKing.col) return false;

    const col = redKing.col;
    const minR = Math.min(redKing.row, blackKing.row);
    const maxR = Math.max(redKing.row, blackKing.row);
    for (let r = minR + 1; r < maxR; r++) {
      if (board[r][col]) return false;
    }
    return true;
  }

  /**
   * Checks if `color`'s General is currently under attack (in Check / 將軍) or facing the enemy General.
   */
  isKingInCheck(color, board = this.board) {
    const king = this.findKing(color, board);
    if (!king) return true;
    if (this.areKingsFacing(board)) return true;

    const enemyColor = color === RED ? BLACK : RED;
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const p = board[r][c];
        if (p && p.color === enemyColor) {
          const { moves } = this.getPseudoMoves(r, c, board);
          for (const m of moves) {
            if (m.toRow === king.row && m.toCol === king.col) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  /**
   * Returns all pieces of `enemyColor` that are currently checking `color`'s King.
   */
  getCheckingPieces(color, board = this.board) {
    const king = this.findKing(color, board);
    if (!king) return [];
    const enemyColor = color === RED ? BLACK : RED;
    const attackers = [];
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const p = board[r][c];
        if (p && p.color === enemyColor) {
          const { moves } = this.getPseudoMoves(r, c, board);
          if (moves.some((m) => m.toRow === king.row && m.toCol === king.col)) {
            attackers.push({ row: r, col: c, piece: p });
          }
        }
      }
    }
    return attackers;
  }

  /**
   * Returns strictly legal moves for a piece at (row, col), filtering out moves that
   * leave the moving player's General in check or trigger the Flying General rule.
   */
  getLegalMovesForSquare(row, col, board = this.board) {
    const piece = board[row][col];
    if (!piece) return { moves: [], blocked: [] };

    const { moves: pseudoMoves, blocked } = this.getPseudoMoves(row, col, board);
    const legalMoves = [];

    for (const move of pseudoMoves) {
      // Simulate on board in-place for speed
      const origFrom = board[move.fromRow][move.fromCol];
      const origTo = board[move.toRow][move.toCol];

      board[move.toRow][move.toCol] = origFrom;
      board[move.fromRow][move.fromCol] = null;

      const inCheck = this.isKingInCheck(piece.color, board);

      // Restore
      board[move.fromRow][move.fromCol] = origFrom;
      board[move.toRow][move.toCol] = origTo;

      if (!inCheck) {
        legalMoves.push(move);
      }
    }

    return { moves: legalMoves, blocked };
  }

  /**
   * Returns all legal moves for `color` on `board`.
   */
  getAllLegalMoves(color = this.turn, board = this.board) {
    const allMoves = [];
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const p = board[r][c];
        if (p && p.color === color) {
          const { moves } = this.getLegalMovesForSquare(r, c, board);
          allMoves.push(...moves);
        }
      }
    }
    return allMoves;
  }

  /**
   * Formats a move in authentic 4-character Traditional Chinese Xiangqi Notation (e.g. 炮二平五, 馬８進７)
   */
  formatChineseNotation(move, boardBeforeMove = this.board) {
    const { piece, fromRow, fromCol, toRow, toCol } = move;
    const isRed = piece.color === RED;
    const char = getPieceChar(piece);

    const fileNum = (col) => (isRed ? RED_NUMERALS[8 - col] : BLACK_NUMERALS[col]);

    // Check if another same-type piece of the same color exists on the same file
    let sameFilePeers = [];
    for (let r = 0; r < 10; r++) {
      const p = boardBeforeMove[r][fromCol];
      if (p && p.color === piece.color && p.type === piece.type) {
        sameFilePeers.push(r);
      }
    }

    let prefix = `${char}${fileNum(fromCol)}`;
    if (sameFilePeers.length === 2) {
      const frontRow = isRed ? Math.min(...sameFilePeers) : Math.max(...sameFilePeers);
      const posLabel = fromRow === frontRow ? '前' : '後';
      prefix = `${posLabel}${char}`;
    }

    let action = '平';
    let targetLabel = '';

    if (fromRow === toRow) {
      action = '平';
      targetLabel = fileNum(toCol);
    } else {
      const advancing = isRed ? toRow < fromRow : toRow > fromRow;
      action = advancing ? '進' : '退';
      // Diagonal pieces (Horse, Elephant, Advisor) use destination file; linear pieces use step count
      if (piece.type === 'n' || piece.type === 'b' || piece.type === 'a') {
        targetLabel = fileNum(toCol);
      } else {
        const steps = Math.abs(toRow - fromRow);
        targetLabel = isRed ? RED_NUMERALS[steps - 1] : BLACK_NUMERALS[steps - 1];
      }
    }

    return `${prefix}${action}${targetLabel}`;
  }

  /**
   * Executes a validated move on the engine state.
   */
  makeMove(fromRow, fromCol, toRow, toCol) {
    const piece = this.board[fromRow]?.[fromCol];
    if (!piece || piece.color !== this.turn) return null;

    const { moves } = this.getLegalMovesForSquare(fromRow, fromCol);
    const legal = moves.find((m) => m.toRow === toRow && m.toCol === toCol);
    if (!legal) return null;

    const notation = this.formatChineseNotation(legal, this.board);
    const captured = this.board[toRow][toCol];

    // Update board
    this.board[fromRow][fromCol] = null;
    this.board[toRow][toCol] = piece;
    piece.row = toRow;
    piece.col = toCol;

    if (captured) {
      if (piece.color === RED) {
        this.capturedByRed.push(captured);
      } else {
        this.capturedByBlack.push(captured);
      }
    }

    const nextTurn = this.turn === RED ? BLACK : RED;
    this.turn = nextTurn;
    this.redoStack = [];

    this.status = this.evaluateGameStatus();

    const moveRecord = {
      ...legal,
      notation,
      turnNumber: Math.floor(this.moveHistory.length / 2) + 1,
      causedCheck: this.status.inCheck,
      causedGameOver: this.status.gameOver,
      fenAfter: this.exportFen(),
    };

    this.moveHistory.push(moveRecord);
    return moveRecord;
  }

  /**
   * Undoes the last single ply move.
   */
  undoMove() {
    if (this.moveHistory.length === 0) return null;
    const last = this.moveHistory.pop();
    this.redoStack.push(last);

    const { piece, fromRow, fromCol, toRow, toCol, captured } = last;
    this.board[fromRow][fromCol] = piece;
    piece.row = fromRow;
    piece.col = fromCol;

    this.board[toRow][toCol] = captured || null;
    if (captured) {
      captured.row = toRow;
      captured.col = toCol;
      if (piece.color === RED) {
        this.capturedByRed.pop();
      } else {
        this.capturedByBlack.pop();
      }
    }

    this.turn = piece.color;
    this.status = this.evaluateGameStatus();
    return last;
  }

  /**
   * Redoes a previously undone ply move.
   */
  redoMove() {
    if (this.redoStack.length === 0) return null;
    const next = this.redoStack.pop();
    return this.makeMove(next.fromRow, next.fromCol, next.toRow, next.toCol);
  }

  /**
   * Evaluates current game state: Check (將軍), Checkmate (絕殺), Stalemate (困斃 - loss in Xiangqi!).
   */
  evaluateGameStatus() {
    const inCheck = this.isKingInCheck(this.turn, this.board);
    const legalMoves = this.getAllLegalMoves(this.turn, this.board);
    const checkingPieces = inCheck ? this.getCheckingPieces(this.turn, this.board) : [];

    if (legalMoves.length === 0) {
      const winner = this.turn === RED ? BLACK : RED;
      return {
        gameOver: true,
        inCheck,
        winner,
        reason: inCheck ? 'checkmate' : 'stalemate',
        titleCn: inCheck ? '絕殺 · 勝局已定' : '困斃 · 無子可動',
        titleEn: inCheck
          ? `Checkmate — ${winner === RED ? 'Red (紅方)' : 'Black (黑方)'} Wins!`
          : `Stalemate (困斃) — ${winner === RED ? 'Red (紅方)' : 'Black (黑方)'} Wins!`,
        checkingPieces,
      };
    }

    return {
      gameOver: false,
      inCheck,
      winner: null,
      reason: null,
      titleCn: inCheck ? '將軍！' : '',
      titleEn: inCheck ? 'Check!' : '',
      checkingPieces,
    };
  }
}
