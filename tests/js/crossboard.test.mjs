import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

globalThis.window = globalThis;
const moduleSource = await readFile(
  new URL("./ffish.js", import.meta.url),
  "utf8",
);
const moduleUrl = `data:text/javascript;base64,${Buffer.from(moduleSource).toString("base64")}`;
const initFfish = (await import(moduleUrl)).default;
const wasmBinary = await readFile(new URL("./ffish.wasm", import.meta.url));
const ffish = await initFfish({
  wasmBinary,
  locateFile: () => "ffish.wasm",
  print: () => {},
  printErr: () => {},
});
ffish.loadVariantConfig(
  await readFile(new URL("../../src/variants.ini", import.meta.url), "utf8"),
);
ffish.loadVariantConfig(`
[crossboard-convert:crossboard-pure]
capturesToHandAsBlack = q:g

[crossboard-remove:crossboard-pure]
capturesToHandRemoveBlack = q

[crossboard-open-files:crossboard-pure]
dropNoDoubled = f

[crossboard-fortress:crossboard-pure]
dropRegionBlackPawn = *5 *6 *7 *8 *9
dropRegionBlackKnight = *5 *6 *7 *8 *9
dropRegionBlackBishop = *5 *6 *7 *8 *9
dropRegionBlackRook = *5 *6 *7 *8 *9
dropRegionBlackQueen = *5 *6 *7 *8 *9

[crossboard-pawn-none:crossboard-pure]
promotionPieceTypesBlack = -
dropRegionBlackPawn = *3 *4 *5 *6 *7 *8 *9
`);

function afterMove(variant, fen, move) {
  const board = new ffish.Board(variant, fen);
  assert.equal(board.push(move), true, `${variant} should accept ${move}`);
  const result = board.fen();
  board.delete();
  return result;
}

assert.equal(
  afterMove(
    "crossboard-pure",
    "4k4/9/9/9/f8/9/9/9/R3K4[] w - - 0 1",
    "a1a5",
  ),
  "4k4/9/9/9/R8/9/9/9/4K4[] b - - 0 1",
  "chess captures must not create a dead white hand",
);

assert.match(
  afterMove(
    "crossboard-pure",
    "t3k4/9/9/9/P8/9/9/9/4K4[] b - - 0 1",
    "a9a5",
  ),
  /\[p\]/,
  "shogi captures must enter the black hand",
);

assert.match(
  afterMove(
    "crossboard-convert",
    "t3k4/9/9/9/Q8/9/9/9/4K4[] b - - 0 1",
    "a9a5",
  ),
  /\[g\]/,
  "captured queens must be convertible to gold",
);

assert.match(
  afterMove(
    "crossboard-remove",
    "t3k4/9/9/9/Q8/9/9/9/4K4[] b - - 0 1",
    "a9a5",
  ),
  /\[\]/,
  "captured queens must be removable",
);

{
  const board = new ffish.Board(
    "crossboard-fortress",
    "8k/9/9/9/9/9/9/9/K8[gp] b - - 0 1",
  );
  const moves = new Set(board.legalMoves().split(" "));
  assert.equal(
    moves.has("G@e4"),
    true,
    "native shogi and converted-gold drops must remain unrestricted",
  );
  assert.equal(moves.has("P@e4"), false, "chess drops must respect the preset zone");
  assert.equal(moves.has("P@e5"), true, "chess drops must enter on the preset boundary");
  board.delete();
}

{
  const board = new ffish.Board(
    "crossboard-pure",
    "8k/9/9/9/9/9/9/9/K8[p] b - - 0 1",
  );
  const moves = new Set(board.legalMoves().split(" "));
  assert.equal(moves.has("P@e2"), true, "promotable dropped pawns may land on rank 2");
  assert.equal(moves.has("P@e3"), true, "promotable dropped pawns may land on rank 3");
  board.delete();
}

{
  const board = new ffish.Board(
    "crossboard-pawn-none",
    "8k/9/9/9/9/9/9/9/K8[p] b - - 0 1",
  );
  const moves = new Set(board.legalMoves().split(" "));
  assert.equal(moves.has("P@e2"), false, "non-promoting dropped pawns cannot dead-drop");
  assert.equal(moves.has("P@e3"), true, "non-promoting dropped pawns may land on rank 3");
  board.delete();
}

{
  const board = new ffish.Board(
    "crossboard-pure",
    "8k/9/9/9/9/4p4/9/9/K8[] b - - 0 1",
  );
  const pawnMoves = board
    .legalMoves()
    .split(" ")
    .filter((move) => move.startsWith("e4"));
  assert.deepEqual(
    pawnMoves,
    ["e4e3"],
    "dropped chess pawns must not promote before rank 1",
  );
  board.delete();
}

{
  const board = new ffish.Board(
    "crossboard-pure",
    "4k4/9/9/9/9/pf7/9/9/4K4[pf] b - - 0 1",
  );
  const moves = new Set(board.legalMoves().split(" "));
  assert.equal(moves.has("P@a5"), false, "chess-pawn nifu must be enforced");
  assert.equal(moves.has("F@b5"), false, "shogi-pawn nifu must be enforced");
  assert.equal(moves.has("P@c5"), true);
  assert.equal(moves.has("F@c5"), true);
  board.delete();
}

{
  const board = new ffish.Board(
    "crossboard-open-files",
    "4k4/9/9/9/9/pf7/9/9/4K4[pf] b - - 0 1",
  );
  assert.equal(
    board.legalMoves().split(" ").includes("P@a5"),
    true,
    "chess-pawn nifu must be configurable independently",
  );
  board.delete();
}

{
  const nativeBoard = new ffish.Board(
    "crossboard-pure",
    "9/9/9/9/9/2a6/9/2k6/K8[f] b - - 0 1",
  );
  assert.equal(
    nativeBoard.legalMoves().split(" ").includes("F@a2"),
    false,
    "shogi pawn-drop mate must be illegal",
  );
  nativeBoard.delete();

  const chessBoard = new ffish.Board(
    "crossboard-open-files",
    "9/9/9/9/9/2a6/9/2k6/K8[p] b - - 0 1",
  );
  assert.equal(
    chessBoard.legalMoves().split(" ").includes("P@b2"),
    false,
    "chess pawn-drop mate must be illegal",
  );
  chessBoard.delete();
}

{
  const board = new ffish.Board("crossboard-pure");
  const move = board.bestMove(1, 0, -20);
  assert.ok(move);
  assert.equal(board.legalMoves().split(" ").includes(move), true);
  const candidates = board.candidateMoves(1, 0, 8).split("\n");
  assert.ok(candidates.length > 1, "candidate search must return alternatives");
  for (const candidate of candidates) {
    const [candidateMove, scoreType, score, ...extra] = candidate.split(" ");
    assert.equal(
      extra.length,
      0,
      "candidate rows must contain move, score type, and score",
    );
    assert.equal(
      board.legalMoves().split(" ").includes(candidateMove),
      true,
      `candidate must be legal: ${candidateMove}`,
    );
    assert.match(scoreType, /^(?:cp|mate)$/, "candidate score type must be UCI");
    assert.match(score, /^-?\d+$/, "candidate score must be an integer");
  }
  board.delete();
}

console.log("crossboard WASM engine tests passed");
