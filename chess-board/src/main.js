/**
 * Main Application Controller for 3D Chinese Chess (Xiangqi / 楚漢爭霸)
 */

import {
  XiangqiEngine,
  RED,
  BLACK,
  PIECE_DEFS,
  PRESET_POSITIONS,
  getPieceChar,
} from './xiangqi-engine.js';
import { XiangqiAI } from './xiangqi-ai.js';
import { SoundFX } from './sound-fx.js';
import { XiangqiScene3D } from './scene-3d.js';

const PIECE_RULES_TEXT = {
  k: {
    subtitle: 'Nine-Point Palace Commander (九宮統帥)',
    rule: 'Moves 1 step orthogonally within the 3×3 Palace (九宮格). The two Generals may never face each other along an open file with no intervening pieces (飛將 / 王不見王).',
  },
  a: {
    subtitle: 'Palace Royal Guard (貼身護衛)',
    rule: 'Moves 1 step diagonally within the Nine-Point Palace (九宮斜行). Protects the General and forms linked defensive formations (連環仕).',
  },
  b: {
    subtitle: 'River Guardian Minister (護河相象)',
    rule: 'Moves exactly 2 points diagonally (象飛田) and cannot cross the Chu River (不能過河). Blocked if the midpoint ("Elephant Eye" / 塞象眼) is occupied.',
  },
  n: {
    subtitle: 'Cavalry Jumper (八面威風)',
    rule: 'Moves 1 step orthogonally then 1 step diagonally outward (馬走日). Blocked if the adjacent orthogonal point ("Horse Leg" / 蹩馬腿) is occupied.',
  },
  r: {
    subtitle: 'Heavy War Chariot (縱橫千里)',
    rule: 'Moves and captures any distance orthogonally along unobstructed files and ranks (車行直路). The most powerful piece on the board.',
  },
  c: {
    subtitle: 'Siege Artillery (隔山打牛)',
    rule: 'Moves like a Chariot when not capturing, but to capture an enemy piece it must jump over exactly one intervening piece ("Cannon Mount" / 炮架).',
  },
  p: {
    subtitle: 'Vanguard Foot Soldier (勇往直前)',
    rule: 'Moves 1 step forward before crossing the river. Once across the Chu River (過河兵), it may move 1 step forward or horizontally, never backward.',
  },
};

class XiangqiApp {
  constructor() {
    this.engine = new XiangqiEngine(PRESET_POSITIONS[0].fen);
    this.ai = new XiangqiAI();
    this.sound = new SoundFX();

    this.gameMode = 'ai-black'; // 'ai-black' (Human=Red, AI=Black), 'ai-red' (Human=Black, AI=Red), 'pvp'
    this.aiDifficulty = 2;      // 1=Novice, 2=Club, 3=Master
    this.isAiThinking = false;

    this.selectedSquare = null;
    this.currentLegalMoves = [];
    this.currentBlockedMoves = [];
    this.hintMove = null;
    this.checkToastTimer = null;

    this.initDOM();

    const container = document.getElementById('canvas-container');
    this.scene3d = new XiangqiScene3D(container, {
      onSquareClick: (r, c) => this.handleSquareClick(r, c),
      onSquareHover: (sq) => this.handleSquareHover(sq),
    });

    this.startNewGame(PRESET_POSITIONS[0].fen);
  }

  initDOM() {
    // Populate preset selector
    this.presetSelect = document.getElementById('preset-select');
    PRESET_POSITIONS.forEach((preset) => {
      const opt = document.createElement('option');
      opt.value = preset.id;
      opt.textContent = `${preset.title} · ${preset.subtitle}`;
      this.presetSelect.appendChild(opt);
    });

    this.presetSelect.addEventListener('change', () => {
      const chosen = PRESET_POSITIONS.find((p) => p.id === this.presetSelect.value);
      if (chosen) {
        document.getElementById('preset-desc').textContent = chosen.description;
        document.getElementById('preset-subtitle').textContent = `${chosen.title} · ${chosen.subtitle}`;
        this.startNewGame(chosen.fen);
      }
    });

    // Game mode selector
    this.modeSelect = document.getElementById('mode-select');
    this.modeSelect.addEventListener('change', () => {
      this.gameMode = this.modeSelect.value;
      const aiRow = document.getElementById('ai-level-row');
      aiRow.style.opacity = this.gameMode === 'pvp' ? '0.4' : '1';

      if (this.gameMode === 'ai-red') {
        this.setActiveCameraButton('black');
        this.scene3d.setCameraView('black');
      } else if (this.gameMode === 'ai-black') {
        this.setActiveCameraButton('red');
        this.scene3d.setCameraView('red');
      }
      this.checkAndTriggerAI();
    });

    // AI difficulty buttons
    document.querySelectorAll('#difficulty-group .seg-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document
          .querySelectorAll('#difficulty-group .seg-btn')
          .forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.aiDifficulty = parseInt(btn.dataset.diff, 10);
      });
    });

    // Camera preset buttons
    document.querySelectorAll('[data-cam]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.cam;
        this.setActiveCameraButton(view);
        this.scene3d.setCameraView(view);
      });
    });

    // Piece 3D style selector (Cartoon Figurines vs Classic Wooden Discs)
    const pieceStyleSelect = document.getElementById('piece-style-select');
    if (pieceStyleSelect) {
      pieceStyleSelect.addEventListener('change', () => {
        this.scene3d.setPieceStyle(pieceStyleSelect.value, this.engine);
        this.refresh3DHighlights();
      });
    }

    // Material theme selector
    const themeSelect = document.getElementById('theme-select');
    themeSelect.addEventListener('change', () => {
      this.scene3d.setTheme(themeSelect.value, this.engine);
      this.refresh3DHighlights();
    });

    // Sound toggle
    const soundBtn = document.getElementById('sound-btn');
    soundBtn.addEventListener('click', () => {
      const on = this.sound.toggle();
      document.getElementById('sound-icon').textContent = on ? '🔊' : '🔇';
    });

    // Zen / Immersive mode toggle
    const zenBtn = document.getElementById('zen-btn');
    zenBtn.addEventListener('click', () => {
      document.body.classList.toggle('zen-mode');
    });

    // Action buttons
    document.getElementById('new-game-btn').addEventListener('click', () => {
      const chosen =
        PRESET_POSITIONS.find((p) => p.id === this.presetSelect.value) || PRESET_POSITIONS[0];
      this.startNewGame(chosen.fen);
    });

    document.getElementById('undo-btn').addEventListener('click', () => {
      this.handleUndo();
    });

    document.getElementById('hint-btn').addEventListener('click', () => {
      this.handleHint();
    });

    // Modal buttons
    document.getElementById('modal-rematch-btn').addEventListener('click', () => {
      document.getElementById('gameover-modal').classList.add('hidden');
      const chosen =
        PRESET_POSITIONS.find((p) => p.id === this.presetSelect.value) || PRESET_POSITIONS[0];
      this.startNewGame(chosen.fen);
    });

    document.getElementById('modal-review-btn').addEventListener('click', () => {
      document.getElementById('gameover-modal').classList.add('hidden');
    });
  }

  setActiveCameraButton(view) {
    document.querySelectorAll('[data-cam]').forEach((b) => {
      b.classList.toggle('active', b.dataset.cam === view);
    });
  }

  startNewGame(fen) {
    this.isAiThinking = false;
    this.selectedSquare = null;
    this.currentLegalMoves = [];
    this.currentBlockedMoves = [];
    this.hintMove = null;
    document.getElementById('gameover-modal').classList.add('hidden');

    this.engine.reset(fen);
    this.scene3d.syncWithEngine(this.engine);
    this.refresh3DHighlights();
    this.updateHUD();

    this.checkAndTriggerAI();
  }

  isHumanTurn() {
    if (this.engine.status.gameOver || this.isAiThinking) return false;
    if (this.gameMode === 'pvp') return true;
    if (this.gameMode === 'ai-black') return this.engine.turn === RED;
    if (this.gameMode === 'ai-red') return this.engine.turn === BLACK;
    return true;
  }

  handleSquareClick(row, col) {
    if (!this.isHumanTurn()) return;

    // 1. If a piece is already selected and user clicked one of its legal destination squares, execute move!
    if (this.selectedSquare) {
      const targetMove = this.currentLegalMoves.find(
        (m) => m.toRow === row && m.toCol === col
      );
      if (targetMove) {
        this.executeMove(
          this.selectedSquare.row,
          this.selectedSquare.col,
          row,
          col
        );
        return;
      }
    }

    // 2. Otherwise, check if the clicked square contains a friendly piece of the active side
    const clickedPiece = this.engine.getPiece(row, col);
    if (clickedPiece && clickedPiece.color === this.engine.turn) {
      this.sound.playSelect();
      this.selectedSquare = { row, col };
      const { moves, blocked } = this.engine.getLegalMovesForSquare(row, col);
      this.currentLegalMoves = moves;
      this.currentBlockedMoves = blocked;
      this.hintMove = null;

      this.updatePieceInspector(clickedPiece, blocked);
      this.refresh3DHighlights();
    } else {
      // Clicked empty non-legal square or enemy piece not reachable: clear selection
      this.selectedSquare = null;
      this.currentLegalMoves = [];
      this.currentBlockedMoves = [];
      this.refresh3DHighlights();
      if (clickedPiece) {
        this.updatePieceInspector(clickedPiece, []);
      }
    }
  }

  handleSquareHover(sq) {
    if (!sq || this.selectedSquare) return;
    const p = this.engine.getPiece(sq.row, sq.col);
    if (p) {
      this.updatePieceInspector(p, []);
    }
  }

  executeMove(fromRow, fromCol, toRow, toCol) {
    const moveRecord = this.engine.makeMove(fromRow, fromCol, toRow, toCol);
    if (!moveRecord) return;

    this.selectedSquare = null;
    this.currentLegalMoves = [];
    this.currentBlockedMoves = [];
    this.hintMove = null;

    // Sound feedback
    if (this.engine.status.gameOver) {
      this.sound.playCapture();
      this.sound.playVictory();
    } else if (this.engine.status.inCheck) {
      if (moveRecord.captured) this.sound.playCapture();
      else this.sound.playMove();
      this.sound.playCheck();
      this.showCheckToast();
    } else if (moveRecord.captured) {
      this.sound.playCapture();
    } else {
      this.sound.playMove();
    }

    this.scene3d.syncWithEngine(this.engine, moveRecord);
    this.refresh3DHighlights();
    this.updateHUD();

    if (this.engine.status.gameOver) {
      setTimeout(() => this.showGameOverModal(), 650);
    } else {
      this.checkAndTriggerAI();
    }
  }

  async checkAndTriggerAI() {
    if (this.engine.status.gameOver) return;
    const aiTurn =
      (this.gameMode === 'ai-black' && this.engine.turn === BLACK) ||
      (this.gameMode === 'ai-red' && this.engine.turn === RED);

    if (!aiTurn) return;

    this.isAiThinking = true;
    this.updateHUD();

    // Wait slightly so player can watch their own piece land before AI responds
    await new Promise((r) => setTimeout(r, 340));

    if (!this.isAiThinking || this.engine.status.gameOver) return;

    const bestMove = await this.ai.findBestMove(this.engine, this.aiDifficulty);
    this.isAiThinking = false;

    if (bestMove) {
      this.executeMove(
        bestMove.fromRow,
        bestMove.fromCol,
        bestMove.toRow,
        bestMove.toCol
      );
    } else {
      this.updateHUD();
    }
  }

  handleUndo() {
    if (this.isAiThinking || this.engine.moveHistory.length === 0) return;

    if (this.gameMode === 'pvp') {
      this.engine.undoMove();
    } else {
      // Undo both AI move and human move to return to human's turn
      this.engine.undoMove();
      if (
        (this.gameMode === 'ai-black' && this.engine.turn === BLACK) ||
        (this.gameMode === 'ai-red' && this.engine.turn === RED)
      ) {
        this.engine.undoMove();
      }
    }

    this.selectedSquare = null;
    this.currentLegalMoves = [];
    this.currentBlockedMoves = [];
    this.hintMove = null;
    this.sound.playSelect();

    this.scene3d.syncWithEngine(this.engine);
    this.refresh3DHighlights();
    this.updateHUD();
  }

  async handleHint() {
    if (!this.isHumanTurn()) return;
    const hintBtn = document.getElementById('hint-btn');
    hintBtn.disabled = true;

    const best = await this.ai.findBestMove(this.engine, 2);
    hintBtn.disabled = false;

    if (best) {
      this.sound.playSelect();
      this.hintMove = best;
      this.selectedSquare = { row: best.fromRow, col: best.fromCol };
      const { moves, blocked } = this.engine.getLegalMovesForSquare(
        best.fromRow,
        best.fromCol
      );
      this.currentLegalMoves = moves;
      this.currentBlockedMoves = blocked;
      this.refresh3DHighlights();
    }
  }

  refresh3DHighlights() {
    const lastMove =
      this.engine.moveHistory.length > 0
        ? this.engine.moveHistory[this.engine.moveHistory.length - 1]
        : null;

    const checkingSquares = [];
    if (this.engine.status.inCheck) {
      const threatenedKing = this.engine.findKing(this.engine.turn);
      if (threatenedKing) {
        checkingSquares.push({ row: threatenedKing.row, col: threatenedKing.col });
      }
      for (const atk of this.engine.status.checkingPieces) {
        checkingSquares.push({ row: atk.row, col: atk.col });
      }
    }

    this.scene3d.updateHighlights({
      selectedSquare: this.selectedSquare,
      legalMoves: this.currentLegalMoves,
      blockedMoves: this.currentBlockedMoves,
      lastMove,
      hintMove: this.hintMove,
      checkingSquares,
    });
  }

  updatePieceInspector(piece, blockedMoves = []) {
    if (!piece) return;
    const def = PIECE_DEFS[piece.type];
    const info = PIECE_RULES_TEXT[piece.type];
    const charEl = document.getElementById('inspector-char');
    charEl.textContent = getPieceChar(piece);
    charEl.classList.toggle('black-piece', piece.color === BLACK);

    document.getElementById('inspector-title').textContent = `${def.redChar} / ${def.blackChar} · ${def.enName}`;
    document.getElementById('inspector-pinyin').textContent = info.subtitle;

    let ruleText = info.rule;
    if (blockedMoves.length > 0) {
      const reasons = [...new Set(blockedMoves.map((b) => b.reason))].join(', ');
      ruleText += ` [Note: ${blockedMoves.length} direction(s) currently blocked by ${reasons}]`;
    }
    document.getElementById('inspector-rule').textContent = ruleText;
  }

  showCheckToast() {
    const toast = document.getElementById('check-toast');
    toast.classList.add('visible');
    if (this.checkToastTimer) clearTimeout(this.checkToastTimer);
    this.checkToastTimer = setTimeout(() => {
      toast.classList.remove('visible');
    }, 2100);
  }

  showGameOverModal() {
    const { gameOver, winner, titleCn, titleEn } = this.engine.status;
    if (!gameOver) return;

    const seal = document.getElementById('gameover-seal');
    seal.textContent = winner === RED ? '紅勝' : '黑勝';
    document.getElementById('gameover-title').textContent = titleCn;
    document.getElementById('gameover-subtitle').textContent = titleEn;
    document.getElementById('gameover-modal').classList.remove('hidden');
  }

  updateHUD() {
    const isRed = this.engine.turn === RED;
    const banner = document.getElementById('turn-banner');
    const disc = document.getElementById('turn-disc');
    const label = document.getElementById('turn-label');
    const meta = document.getElementById('turn-meta');

    banner.dataset.turn = this.engine.turn;
    disc.textContent = isRed ? '帥' : '將';

    if (this.engine.status.gameOver) {
      label.textContent = this.engine.status.titleCn;
      meta.textContent = this.engine.status.titleEn;
    } else if (this.isAiThinking) {
      label.textContent = isRed ? '紅方 AI 思考中…' : '黑方 AI 思考中…';
      meta.textContent = 'Computing tactical lines…';
    } else {
      label.textContent = isRed ? '紅方行棋 · Red to Move' : '黑方行棋 · Black to Move';
      meta.textContent = this.engine.status.inCheck
        ? '⚠️ 將軍！必須應將 (King is in Check!)'
        : 'Click a piece on the 3D board to move';
    }

    // Undo button state
    document.getElementById('undo-btn').disabled =
      this.isAiThinking || this.engine.moveHistory.length === 0;

    // Captured pieces chips
    this.renderCapturedChips('captured-by-red', this.engine.capturedByRed);
    this.renderCapturedChips('captured-by-black', this.engine.capturedByBlack);

    // Move log
    this.renderMoveLog();
  }

  renderCapturedChips(containerId, list) {
    const el = document.getElementById(containerId);
    if (list.length === 0) {
      el.innerHTML = '<span class="empty-cap">尚無吃子</span>';
      return;
    }
    el.innerHTML = list
      .map((p) => {
        const cls = p.color === RED ? 'red' : 'black';
        return `<span class="cap-chip ${cls}" title="${PIECE_DEFS[p.type].enName}">${getPieceChar(p)}</span>`;
      })
      .join('');
  }

  renderMoveLog() {
    const container = document.getElementById('move-log');
    const badge = document.getElementById('move-count-badge');
    const history = this.engine.moveHistory;

    const bouts = Math.ceil(history.length / 2);
    badge.textContent = `${bouts} 回合`;

    if (history.length === 0) {
      container.innerHTML =
        '<div class="move-log-empty">點擊紅方棋子開始行棋…<br/>Select any Red piece to make the opening move.</div>';
      return;
    }

    let html = '';
    for (let i = 0; i < history.length; i += 2) {
      const redMove = history[i];
      const blackMove = history[i + 1];
      const roundNum = Math.floor(i / 2) + 1;
      const isRedLatest = i === history.length - 1;
      const isBlackLatest = i + 1 === history.length - 1;

      html += `
        <div class="move-pair-row">
          <span class="move-num">${roundNum}.</span>
          <span class="move-ply red-ply ${isRedLatest ? 'latest' : ''}">
            ${redMove.notation}${redMove.causedCheck ? ' (將)' : ''}
          </span>
          <span class="move-ply black-ply ${isBlackLatest ? 'latest' : ''}">
            ${blackMove ? `${blackMove.notation}${blackMove.causedCheck ? ' (將)' : ''}` : ''}
          </span>
        </div>
      `;
    }

    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.xiangqiApp = new XiangqiApp();
});
