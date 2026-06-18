// Komplett in einer Datei: Schachlogik + UI + Bot (leicht/mittel/schwer).
// Anforderungen: Deutsch, Dark-Theme, keine Zeitbegrenzung, keine Speicherung,
// keine Zugrücknahme, keine Zug-Hervorhebung, keine Sounds.
// Regeln: Rochade und Bauernumwandlung implementiert, En passant nicht enthalten.

const views = document.querySelectorAll('.view');
const setupView = document.getElementById('view-chess-setup');
const boardEl = document.getElementById('board');
const turnIndicator = document.getElementById('turn-indicator');
const gameStateEl = document.getElementById('game-state');
const botOptionsEl = document.getElementById('bot-options');
const startBtn = document.getElementById('start-chess');

const promoteButtons = {
  q: document.getElementById('promote-queen'),
  r: document.getElementById('promote-rook'),
  b: document.getElementById('promote-bishop'),
  n: document.getElementById('promote-knight'),
};

// ---------- Schach-Engine (minimal) ----------
function initialBoard() {
  const rows = [
    "rnbqkbnr",
    "pppppppp",
    "........",
    "........",
    "........",
    "........",
    "PPPPPPPP",
    "RNBQKBNR",
  ];
  return rows.join("").split("");
}
function isWhite(piece) { return piece >= 'A' && piece <= 'Z'; }
function isBlack(piece) { return piece >= 'a' && piece <= 'z'; }
function cloneBoard(board) { return board.slice(); }
function square(r, f) { return r * 8 + f; }
function toRF(index) { return [Math.floor(index / 8), index % 8]; }
function inBounds(r, f) { return r >= 0 && r < 8 && f >= 0 && f < 8; }
function pieceColor(piece) { if (!piece || piece === '.') return null; return isWhite(piece) ? 'w' : 'b'; }
function pieceAt(board, r, f) { if (!inBounds(r,f)) return null; return board[square(r,f)]; }
function setPiece(board, r, f, p) { board[square(r,f)] = p; }
function opposite(color) { return color === 'w' ? 'b' : 'w'; }
function kingPositions(board) {
  let wk = -1, bk = -1;
  for (let i = 0; i < 64; i++) {
    if (board[i] === 'K') wk = i;
    if (board[i] === 'k') bk = i;
  }
  return { wk, bk };
}

function findLegalMoves(board, color, castling, enpassant = null) {
  const moves = [];
  function addMove(from, to, promo = null, special = null) { moves.push({ from, to, promo, special }); }

  const dirsKnight = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  const dirsBishop = [[-1,-1],[-1,1],[1,-1],[1,1]];
  const dirsRook = [[-1,0],[1,0],[0,-1],[0,1]];
  const dirsQueen = dirsBishop.concat(dirsRook);

  function isSquareAttacked(targetIndex, byColor) {
    const [tr, tf] = toRF(targetIndex);
    // Bauern
    if (byColor === 'w') {
      for (const df of [-1,1]) {
        const r = tr + 1, f = tf + df;
        if (inBounds(r,f)) {
          const p = pieceAt(board, r, f);
          if (p === 'P') return true;
        }
      }
    } else {
      for (const df of [-1,1]) {
        const r = tr - 1, f = tf + df;
        if (inBounds(r,f)) {
          const p = pieceAt(board, r, f);
          if (p === 'p') return true;
        }
      }
    }
    // Springer
    for (const [dr, df] of dirsKnight) {
      const r = tr + dr, f = tf + df;
      if (inBounds(r,f)) {
        const p = pieceAt(board, r, f);
        if (byColor === 'w' && p === 'N') return true;
        if (byColor === 'b' && p === 'n') return true;
      }
    }
    // Läufer/Dame diagonal
    for (const [dr, df] of dirsBishop) {
      let r = tr + dr, f = tf + df;
      while (inBounds(r,f)) {
        const p = pieceAt(board, r, f);
        if (p !== '.' && p != null) {
          if (byColor === 'w' && (p === 'B' || p === 'Q')) return true;
          if (byColor === 'b' && (p === 'b' || p === 'q')) return true;
          break;
        }
        r += dr; f += df;
      }
    }
    // Turm/Dame orthogonal
    for (const [dr, df] of dirsRook) {
      let r = tr + dr, f = tf + df;
      while (inBounds(r,f)) {
        const p = pieceAt(board, r, f);
        if (p !== '.' && p != null) {
          if (byColor === 'w' && (p === 'R' || p === 'Q')) return true;
          if (byColor === 'b' && (p === 'r' || p === 'q')) return true;
          break;
        }
        r += dr; f += df;
      }
    }
    // König nah
    for (let dr = -1; dr <= 1; dr++) {
      for (let df = -1; df <= 1; df++) {
        if (dr === 0 && df === 0) continue;
        const r = tr + dr, f = tf + df;
        if (inBounds(r,f)) {
          const p = pieceAt(board, r, f);
          if (byColor === 'w' && p === 'K') return true;
          if (byColor === 'b' && p === 'k') return true;
        }
      }
    }
    return false;
  }

  function kingInCheck(bd, clr) {
    const { wk, bk } = kingPositions(bd);
    const kIndex = clr === 'w' ? wk : bk;
    return isSquareAttacked(kIndex, opposite(clr));
  }

  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (!p || p === '.') continue;
    const pc = pieceColor(p);
    if (pc !== color) continue;

    const [r,f] = toRF(i);
    switch (p.toUpperCase()) {
      case 'P': {
        const forward = (pc === 'w') ? -1 : 1;
        const startRow = (pc === 'w') ? 6 : 1;
        const promRow = (pc === 'w') ? 0 : 7;

        const r1 = r + forward;
        if (inBounds(r1,f) && pieceAt(board, r1, f) === '.') {
          const to = square(r1,f);
          if (r1 === promRow) {
            for (const promo of ['Q','R','B','N']) addMove(i, to, promo);
          } else {
            addMove(i, to);
          }
          if (r === startRow) {
            const r2 = r + 2*forward;
            if (inBounds(r2,f) && pieceAt(board, r2,f) === '.') {
              addMove(i, square(r2,f));
            }
          }
        }
        for (const df of [-1,1]) {
          const rf = [r + forward, f + df];
          if (inBounds(rf[0], rf[1])) {
            const t = pieceAt(board, rf[0], rf[1]);
            if (t && t !== '.' && pieceColor(t) === opposite(pc)) {
              const to = square(rf[0], rf[1]);
              if (rf[0] === promRow) {
                for (const promo of ['Q','R','B','N']) addMove(i, to, promo);
              } else {
                addMove(i, to);
              }
            }
          }
        }
        break;
      }

      case 'N': {
        const dirs = dirsKnight;
        for (const [dr, df] of dirs) {
          const r2 = r + dr, f2 = f + df;
          if (!inBounds(r2,f2)) continue;
          const t = pieceAt(board, r2,f2);
          if (t === '.' || (t && pieceColor(t) === opposite(pc))) addMove(i, square(r2,f2));
        }
        break;
      }

      case 'B': {
        for (const [dr, df] of dirsBishop) {
          let r2 = r + dr, f2 = f + df;
          while (inBounds(r2,f2)) {
            const t = pieceAt(board, r2,f2);
            if (t === '.') addMove(i, square(r2,f2));
            else { if (pieceColor(t) === opposite(pc)) addMove(i, square(r2,f2)); break; }
            r2 += dr; f2 += df;
          }
        }
        break;
      }

      case 'R': {
        for (const [dr, df] of dirsRook) {
          let r2 = r + dr, f2 = f + df;
          while (inBounds(r2,f2)) {
            const t = pieceAt(board, r2,f2);
            if (t === '.') addMove(i, square(r2,f2));
            else { if (pieceColor(t) === opposite(pc)) addMove(i, square(r2,f2)); break; }
            r2 += dr; f2 += df;
          }
        }
        break;
      }

      case 'Q': {
        for (const [dr, df] of dirsQueen) {
          let r2 = r + dr, f2 = f + df;
          while (inBounds(r2,f2)) {
            const t = pieceAt(board, r2,f2);
            if (t === '.') addMove(i, square(r2,f2));
            else { if (pieceColor(t) === opposite(pc)) addMove(i, square(r2,f2)); break; }
            r2 += dr; f2 += df;
          }
        }
        break;
      }

      case 'K': {
        for (let dr=-1; dr<=1; dr++) {
          for (let df=-1; df<=1; df++) {
            if (dr===0 && df===0) continue;
            const r2 = r + dr, f2 = f + df;
            if (!inBounds(r2,f2)) continue;
            const t = pieceAt(board, r2,f2);
            if (t === '.' || (t && pieceColor(t) === opposite(pc))) addMove(i, square(r2,f2));
          }
        }
        // Rochade
        if (pc === 'w' && r === 7 && f === 4) {
          if (castling.wks) {
            if (pieceAt(board,7,5)==='.' && pieceAt(board,7,6)==='.') {
              const e1 = square(7,4), f1 = square(7,5), g1 = square(7,6);
              if (!isSquareAttacked(e1,'b') && !isSquareAttacked(f1,'b') && !isSquareAttacked(g1,'b')) {
                addMove(i, g1, null, {castle:'wks'});
              }
            }
          }
          if (castling.wqs) {
            if (pieceAt(board,7,3)==='.' && pieceAt(board,7,2)==='.' && pieceAt(board,7,1)==='.') {
              const e1 = square(7,4), d1 = square(7,3), c1 = square(7,2);
              if (!isSquareAttacked(e1,'b') && !isSquareAttacked(d1,'b') && !isSquareAttacked(c1,'b')) {
                addMove(i, c1, null, {castle:'wqs'});
              }
            }
          }
        }
        if (pc === 'b' && r === 0 && f === 4) {
          if (castling.bks) {
            if (pieceAt(board,0,5)==='.' && pieceAt(board,0,6)==='.') {
              const e8 = square(0,4), f8 = square(0,5), g8 = square(0,6);
              if (!isSquareAttacked(e8,'w') && !isSquareAttacked(f8,'w') && !isSquareAttacked(g8,'w')) {
                addMove(i, g8, null, {castle:'bks'});
              }
            }
          }
          if (castling.bqs) {
            if (pieceAt(board,0,3)==='.' && pieceAt(board,0,2)==='.' && pieceAt(board,0,1)==='.') {
              const e8 = square(0,4), d8 = square(0,3), c8 = square(0,2);
              if (!isSquareAttacked(e8,'w') && !isSquareAttacked(d8,'w') && !isSquareAttacked(c8,'w')) {
                addMove(i, c8, null, {castle:'bqs'});
              }
            }
          }
        }
        break;
      }
    }
  }

  // Nur Züge, die den eigenen König nicht im Schach lassen
  const legal = [];
  for (const m of moves) {
    const bd2 = cloneBoard(board);
    const piece = bd2[m.from];
    bd2[m.to] = m.promo ? (pieceColor(piece)==='w' ? m.promo : m.promo.toLowerCase()) : piece;
    bd2[m.from] = '.';
    if (m.special && m.special.castle) {
      if (m.special.castle === 'wks') { bd2[square(7,5)] = 'R'; bd2[square(7,7)] = '.'; }
      else if (m.special.castle === 'wqs') { bd2[square(7,3)] = 'R'; bd2[square(7,0)] = '.'; }
      else if (m.special.castle === 'bks') { bd2[square(0,5)] = 'r'; bd2[square(0,7)] = '.'; }
      else if (m.special.castle === 'bqs') { bd2[square(0,3)] = 'r'; bd2[square(0,0)] = '.'; }
    }
    if (!kingInCheck(bd2, color)) legal.push(m);
  }
  return legal;
}

function applyMove(board, move, castling) {
  const p = board[move.from];
  const pc = pieceColor(p);
  const [fr, ff] = toRF(move.from);
  const [tr, tf] = toRF(move.to);
  const newBoard = cloneBoard(board);

  newBoard[move.to] = move.promo ? (pc==='w' ? move.promo : move.promo.toLowerCase()) : p;
  newBoard[move.from] = '.';

  if (move.special && move.special.castle) {
    if (move.special.castle === 'wks') { newBoard[square(7,5)] = 'R'; newBoard[square(7,7)] = '.'; }
    else if (move.special.castle === 'wqs') { newBoard[square(7,3)] = 'R'; newBoard[square(7,0)] = '.'; }
    else if (move.special.castle === 'bks') { newBoard[square(0,5)] = 'r'; newBoard[square(0,7)] = '.'; }
    else if (move.special.castle === 'bqs') { newBoard[square(0,3)] = 'r'; newBoard[square(0,0)] = '.'; }
  }

  const c = { ...castling };
  if (p === 'K') { c.wks = false; c.wqs = false; }
  if (p === 'k') { c.bks = false; c.bqs = false; }
  if (fr === 7 && ff === 7) c.wks = false;
  if (fr === 7 && ff === 0) c.wqs = false;
  if (fr === 0 && ff === 7) c.bks = false;
  if (fr === 0 && ff === 0) c.bqs = false;

  if (tr === 7 && tf === 7 && board[square(7,7)] === 'R') c.wks = false;
  if (tr === 7 && tf === 0 && board[square(7,0)] === 'R') c.wqs = false;
  if (tr === 0 && tf === 7 && board[square(0,7)] === 'r') c.bks = false;
  if (tr === 0 && tf === 0 && board[square(0,0)] === 'r') c.bqs = false;

  return { board: newBoard, castling: c };
}

function gameStatus(board, colorToMove, castling) {
  const legal = findLegalMoves(board, colorToMove, castling);
  const { wk, bk } = kingPositions(board);
  const kIndex = colorToMove === 'w' ? wk : bk;

  function isSquareAttacked(targetIndex, byColor) {
    const pseudo = findLegalMoves(board, byColor, castling);
    for (const m of pseudo) if (m.to === targetIndex) return true;
    return false;
  }

  const check = isSquareAttacked(kIndex, opposite(colorToMove));
  if (legal.length === 0) {
    if (check) return { over: true, check: true, mate: true, stalemate: false };
    return { over: true, check: false, mate: false, stalemate: true };
  }
  return { over: false, check, mate: false, stalemate: false };
}

// ---------- UI/State ----------
let state = {
  board: initialBoard(),
  castling: { wks: true, wqs: true, bks: true, bqs: true },
  toMove: 'w',
  selected: null,
  opponent: 'human',      // 'human' | 'bot'
  difficulty: 'easy',     // 'easy' | 'medium' | 'hard'
  boardTheme: 'classic',  // 'classic' | 'pastel'
  playerColor: 'w',       // wer als Mensch spielt vs Bot
  pendingPromotion: null, // {from,to}
  busy: false
};

function switchView(id) {
  views.forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

document.querySelectorAll('.nav-back').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.target));
});

document.querySelectorAll('.menu-btn').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.target));
});

setupView.addEventListener('change', (e) => {
  if (e.target.name === 'opponent') {
    botOptionsEl.classList.toggle('hidden', e.target.value !== 'bot');
  }
});

startBtn.addEventListener('click', () => {
  const opponent = setupView.querySelector('input[name="opponent"]:checked').value;
  const boardTheme = setupView.querySelector('input[name="boardTheme"]:checked').value;
  const playerColor = setupView.querySelector('input[name="playerColor"]:checked').value;
  const difficulty = opponent === 'bot' ? setupView.querySelector('input[name="difficulty"]:checked').value : 'easy';

  state = {
    board: initialBoard(),
    castling: { wks: true, wqs: true, bks: true, bqs: true },
    toMove: 'w',
    selected: null,
    opponent,
    difficulty,
    boardTheme,
    playerColor,
    pendingPromotion: null,
    busy: false
  };

  renderBoard();
  updateStatus();
  switchView('view-chess');
  maybeBotMove();
});

// Rendering
function renderBoard() {
  boardEl.innerHTML = '';
  const themeClass = state.boardTheme === 'classic' ? 'classic' : 'pastel';

  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const i = r*8 + f;
      const isDark = (r + f) % 2 === 1;
      const squareEl = document.createElement('div');
      squareEl.className = `square ${isDark ? 'dark' : 'light'} ${themeClass}`;
      squareEl.setAttribute('role', 'gridcell');
      squareEl.setAttribute('data-index', i);

      const p = state.board[i];
      squareEl.textContent = (p && p !== '.') ? pieceToGlyph(p) : '';

      squareEl.addEventListener('click', onSquareClick);
      boardEl.appendChild(squareEl);
    }
  }
}

function pieceToGlyph(p) {
  switch (p) {
    case 'K': return '♔'; case 'Q': return '♕'; case 'R': return '♖';
    case 'B': return '♗'; case 'N': return '♘'; case 'P': return '♙';
    case 'k': return '♚'; case 'q': return '♛'; case 'r': return '♜';
    case 'b': return '♝'; case 'n': return '♞'; case 'p': return '♟';
    default: return '';
  }
}

function updateStatus() {
  const side = state.toMove === 'w' ? 'Weiß' : 'Schwarz';
  turnIndicator.textContent = `Am Zug: ${side}`;
  const gs = gameStatus(state.board, state.toMove, state.castling);
  if (gs.over) {
    if (gs.mate) gameStateEl.textContent = `Schachmatt! ${side} ist matt.`;
    else if (gs.stalemate) gameStateEl.textContent = 'Patt. Unentschieden.';
  } else if (gs.check) {
    gameStateEl.textContent = 'Schach!';
  } else {
    gameStateEl.textContent = '';
  }
}

function onSquareClick(e) {
  if (state.busy) return;
  const idx = parseInt(e.currentTarget.getAttribute('data-index'), 10);
  const p = state.board[idx];
  const pc = pieceColor(p);

  if (state.pendingPromotion) return;

  const humanTurn = (state.opponent === 'human') ||
                    (state.opponent === 'bot' && state.toMove === state.playerColor);
  if (!humanTurn) return;

  if (state.selected == null) {
    if (!p || p === '.') return;
    if ((state.toMove === 'w' && pc !== 'w') || (state.toMove === 'b' && pc !== 'b')) return;
    state.selected = idx;
  } else {
    const from = state.selected;
    const legal = findLegalMoves(state.board, state.toMove, state.castling);
    const move = legal.find(m => m.from === from && m.to === idx);

    if (move) {
      const [tr, tf] = toRF(move.to);
      const piece = state.board[from];
      const isPawn = piece.toUpperCase() === 'P';
      const promRow = (state.toMove === 'w') ? 0 : 7;
      if (isPawn && tr === promRow && !move.promo) {
        state.pendingPromotion = { from: move.from, to: move.to };
      } else {
        doMove(move);
      }
    }
    state.selected = null;
  }
}

function doMove(move) {
  const result = applyMove(state.board, move, state.castling);
  state.board = result.board;
  state.castling = result.castling;
  state.toMove = state.toMove === 'w' ? 'b' : 'w';
  renderBoard();
  updateStatus();
  maybeBotMove();
}

// Promotion-Buttons
Object.values(promoteButtons).forEach(btn => {
  btn.addEventListener('click', () => {
    if (!state.pendingPromotion) return;
    const piece = btn.dataset.piece; // 'q','r','b','n'
    const legal = findLegalMoves(state.board, state.toMove, state.castling);
    const chosen = legal.find(m => m.from === state.pendingPromotion.from && m.to === state.pendingPromotion.to && (m.promo || '').toLowerCase() === piece);
    if (chosen) {
      doMove(chosen);
      state.pendingPromotion = null;
    }
  });
});

// ---------- Bot ----------
function maybeBotMove() {
  if (state.opponent !== 'bot') return;
  if (state.toMove !== opposite(state.playerColor)) return;
  const gs = gameStatus(state.board, state.toMove, state.castling);
  if (gs.over) return;

  state.busy = true;
  setTimeout(() => {
    const move = chooseBotMove(state.board, state.toMove, state.castling, state.difficulty);
    state.busy = false;
    if (move) doMove(move);
  }, 200);
}

function chooseBotMove(board, color, castling, difficulty) {
  const legal = findLegalMoves(board, color, castling);
  if (legal.length === 0) return null;

  if (difficulty === 'easy') {
    const blunderChance = 0.30; // absichtlich Fehler machen
    if (Math.random() < blunderChance) return legal[Math.floor(Math.random() * legal.length)];
    const scored = legal.map(m => {
      const { board: b2 } = applyMove(board, m, castling);
      return { m, score: staticEval(b2) * (color === 'w' ? 1 : -1) + (Math.random() - 0.5) * 0.3 };
    });
    scored.sort((a,b) => b.score - a.score);
    const pickIndex = Math.random() < 0.4 && scored.length > 1 ? 1 : 0;
    return scored[pickIndex].m;
  }

  const depth = difficulty === 'medium' ? 2 : 3;
  return minimaxRoot(board, color, castling, depth);
}

function staticEval(board) {
  const vals = { p:1, n:3, b:3.1, r:5, q:9, k:0 };
  let score = 0;
  for (let i=0;i<64;i++) {
    const p = board[i];
    if (!p || p === '.') continue;
    const v = vals[p.toLowerCase()] || 0;
    const sign = (p === p.toUpperCase()) ? 1 : -1;
    score += sign * v;
    const r = Math.floor(i/8), f = i%8;
    const center = (r>=2 && r<=5 && f>=2 && f<=5) ? 0.05 : 0;
    score += sign * center;
  }
  return score;
}

function minimaxRoot(board, color, castling, depth) {
  const legal = findLegalMoves(board, color, castling);
  if (legal.length === 0) return null;
  let bestScore = -Infinity, bestMove = legal[0];

  const ordered = legal.slice().sort((a,b) => {
    const capA = board[a.to] && board[a.to] !== '.';
    const capB = board[b.to] && board[b.to] !== '.';
    return (capB?1:0) - (capA?1:0);
  });

  for (const m of ordered) {
    const { board: b2, castling: c2 } = applyMove(board, m, castling);
    const score = -negamax(b2, opposite(color), c2, depth-1, -Infinity, Infinity);
    if (score > bestScore) { bestScore = score; bestMove = m; }
  }
  return bestMove;
}

function negamax(board, color, castling, depth, alpha, beta) {
  if (depth === 0) return staticEval(board) * (color === 'w' ? 1 : -1);
  const legal = findLegalMoves(board, color, castling);
  if (legal.length === 0) {
    return -999 + Math.random()*2; // einfache Endbehandlung
  }
  legal.sort((a,b) => {
    const capA = board[a.to] && board[a.to] !== '.';
    const capB = board[b.to] && board[b.to] !== '.';
    return (capB?1:0) - (capA?1:0);
  });

  let best = -Infinity;
  for (const m of legal) {
    const { board: b2, castling: c2 } = applyMove(board, m, castling);
    const val = -negamax(b2, opposite(color), c2, depth-1, -beta, -alpha);
    if (val > best) best = val;
    if (val > alpha) alpha = val;
    if (alpha >= beta) break;
  }
  return best;
}

// ---------- Start ----------
renderBoard();
updateStatus();
