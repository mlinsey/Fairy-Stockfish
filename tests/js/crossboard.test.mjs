import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import initFfish from "./ffish.js";

const ffish = await initFfish({ print: () => {}, printErr: () => {} });
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
  const board = new ffish.Board(
    "crossboard-pure",
    "3tkt3/9/9/9/7i1/9/9/9/4K4[pf] b - - 0 1",
  );
  const moves = new Set(board.legalMoves().split(" "));
  assert.equal(moves.has("F@e2"), false, "shogi pawn-drop mate must be illegal");
  assert.equal(moves.has("P@e2"), false, "chess pawn-drop mate must be illegal");
  board.delete();
}

{
  const board = new ffish.Board("crossboard-pure");
  const move = board.bestMove(1, 0, -20);
  assert.ok(move);
  assert.equal(board.legalMoves().split(" ").includes(move), true);
  board.delete();
}

console.log("crossboard WASM engine tests passed");
