const BOARD_SIZE = 10;

const FLEET = [
  { name: "Carrier", length: 5, count: 1 },
  { name: "Destroyer", length: 4, count: 1 },
  { name: "Submarine", length: 3, count: 2 },
  { name: "Patrol", length: 2, count: 1 }
];

const DIFF_LABEL = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  impossible: "Impossible"
};

const dom = {
  status: document.getElementById("status"),
  announce: document.getElementById("announce"),
  placementHint: document.getElementById("placement-hint"),
  newGame: document.getElementById("new-game"),
  difficulty: document.getElementById("difficulty"),
  rotateShip: document.getElementById("rotate-ship"),
  autoPlace: document.getElementById("auto-place"),
  undoPlace: document.getElementById("undo-place"),
  clearPlace: document.getElementById("clear-place"),
  startBattle: document.getElementById("start-battle"),
  playerBoard: document.getElementById("player-board"),
  enemyBoard: document.getElementById("enemy-board"),
  playerButtons: [],
  enemyButtons: []
};

const state = {
  difficulty: dom.difficulty.value,
  phase: "placement",
  playerBoard: null,
  enemyBoard: null,
  playerTurn: false,
  lockInput: false,
  gameOver: false,
  aiMemory: { queue: [] },
  orientationHorizontal: true,
  placementQueue: [],
  playerPlacements: [],
  announceTimer: null
};

function createPlacementQueue() {
  const queue = [];
  for (const spec of FLEET) {
    for (let i = 1; i <= spec.count; i += 1) {
      queue.push({
        name: spec.name,
        label: spec.count > 1 ? `${spec.name} ${i}` : spec.name,
        length: spec.length
      });
    }
  }
  return queue;
}

function createCell() {
  return {
    shipId: -1,
    shot: false,
    sunk: false
  };
}

function createBoard() {
  return {
    cells: Array.from({ length: BOARD_SIZE }, () =>
      Array.from({ length: BOARD_SIZE }, () => createCell())
    ),
    ships: []
  };
}

function inBounds(x, y) {
  return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;
}

function toKey(x, y) {
  return `${x},${y}`;
}

function randomItem(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function shipCells(startX, startY, length, horizontal) {
  const cells = [];
  for (let i = 0; i < length; i += 1) {
    cells.push({
      x: startX + (horizontal ? i : 0),
      y: startY + (horizontal ? 0 : i)
    });
  }
  return cells;
}

function canPlaceShip(board, cells) {
  for (const { x, y } of cells) {
    if (!inBounds(x, y)) {
      return false;
    }
    if (board.cells[y][x].shipId !== -1) {
      return false;
    }
  }
  return true;
}

function placeShip(board, label, length, cells, baseName = label) {
  const shipId = board.ships.length;
  board.ships.push({
    id: shipId,
    name: label,
    baseName,
    length,
    cells,
    hits: 0,
    sunk: false
  });
  for (const { x, y } of cells) {
    board.cells[y][x].shipId = shipId;
  }
}

function placeFleetRandom(board) {
  for (const spec of FLEET) {
    for (let i = 1; i <= spec.count; i += 1) {
      let placed = false;
      let tries = 0;
      const label = spec.count > 1 ? `${spec.name} ${i}` : spec.name;
      while (!placed && tries < 500) {
        tries += 1;
        const horizontal = Math.random() < 0.5;
        const maxX = horizontal ? BOARD_SIZE - spec.length : BOARD_SIZE - 1;
        const maxY = horizontal ? BOARD_SIZE - 1 : BOARD_SIZE - spec.length;
        const x = Math.floor(Math.random() * (maxX + 1));
        const y = Math.floor(Math.random() * (maxY + 1));
        const cells = shipCells(x, y, spec.length, horizontal);
        if (canPlaceShip(board, cells)) {
          placeShip(board, label, spec.length, cells, spec.name);
          placed = true;
        }
      }
      if (!placed) {
        throw new Error("Could not place fleet. Please restart.");
      }
    }
  }
}

function boardFromPlacements(placements) {
  const board = createBoard();
  for (const placement of placements) {
    placeShip(
      board,
      placement.label,
      placement.length,
      placement.cells,
      placement.name
    );
  }
  return board;
}

function fire(board, x, y) {
  if (!inBounds(x, y)) {
    return { ok: false };
  }

  const cell = board.cells[y][x];
  if (cell.shot) {
    return { ok: false, repeated: true };
  }

  cell.shot = true;

  if (cell.shipId === -1) {
    return {
      ok: true,
      type: "miss",
      coords: [{ x, y }]
    };
  }

  const ship = board.ships[cell.shipId];
  ship.hits += 1;

  if (ship.hits >= ship.length) {
    ship.sunk = true;
    for (const coord of ship.cells) {
      board.cells[coord.y][coord.x].sunk = true;
    }
    return {
      ok: true,
      type: "sunk",
      coords: [...ship.cells],
      shipName: ship.baseName
    };
  }

  return {
    ok: true,
    type: "hit",
    coords: [{ x, y }],
    shipName: ship.baseName
  };
}

function allShipsSunk(board) {
  return board.ships.every((ship) => ship.sunk);
}

function coordToHuman({ x, y }) {
  const row = String.fromCharCode("A".charCodeAt(0) + y);
  return `${row}${x + 1}`;
}

function buildGrid(container, onClick) {
  const buttons = [];
  container.innerHTML = "";
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cell water";
      btn.dataset.x = String(x);
      btn.dataset.y = String(y);
      btn.setAttribute("aria-label", `Row ${y + 1} Column ${x + 1}`);
      btn.addEventListener("click", onClick);
      container.appendChild(btn);
      buttons.push(btn);
    }
  }
  return buttons;
}

function idx(x, y) {
  return y * BOARD_SIZE + x;
}

function clearTileClasses(el) {
  el.classList.remove("water", "ship", "hit", "miss", "sunk", "flash");
}

function paintBoard(board, buttons, opts) {
  const { showShips, allowClicks } = opts;

  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      const cell = board.cells[y][x];
      const btn = buttons[idx(x, y)];
      clearTileClasses(btn);

      if (cell.shot && cell.sunk) {
        btn.classList.add("sunk");
      } else if (cell.shot && cell.shipId !== -1) {
        btn.classList.add("hit");
      } else if (cell.shot && cell.shipId === -1) {
        btn.classList.add("miss");
      } else if (showShips && cell.shipId !== -1) {
        btn.classList.add("ship");
      } else {
        btn.classList.add("water");
      }

      btn.disabled = !allowClicks || cell.shot;
    }
  }
}

function flashCoords(buttons, coords) {
  for (const { x, y } of coords) {
    const button = buttons[idx(x, y)];
    button.classList.add("flash");
    window.setTimeout(() => button.classList.remove("flash"), 420);
  }
}

function setStatus(text) {
  dom.status.textContent = text;
}

function setPlacementHint(text) {
  dom.placementHint.textContent = text;
}

function showAnnouncement(kind, text) {
  if (!dom.announce) {
    return;
  }

  dom.announce.className = `announce ${kind}`;
  dom.announce.textContent = text;

  void dom.announce.offsetWidth;
  dom.announce.classList.add("show");

  if (state.announceTimer) {
    window.clearTimeout(state.announceTimer);
  }

  state.announceTimer = window.setTimeout(() => {
    dom.announce.classList.remove("show");
  }, 1150);
}

function getNextPlacementSpec() {
  return state.placementQueue[state.playerPlacements.length] || null;
}

function placementComplete() {
  return state.playerPlacements.length === state.placementQueue.length;
}

function syncPlacementUi() {
  const inPlacement = state.phase === "placement" && !state.gameOver;
  const complete = placementComplete();

  dom.rotateShip.disabled = !inPlacement;
  dom.autoPlace.disabled = !inPlacement;
  dom.undoPlace.disabled = !inPlacement || state.playerPlacements.length === 0;
  dom.clearPlace.disabled = !inPlacement || state.playerPlacements.length === 0;
  dom.startBattle.disabled = !inPlacement || !complete;

  dom.rotateShip.textContent = `Rotate: ${state.orientationHorizontal ? "Horizontal" : "Vertical"}`;

  if (inPlacement) {
    const next = getNextPlacementSpec();
    if (next) {
      setPlacementHint(
        `Next ship: ${next.label} (${next.length} cells). Click your board to place.`
      );
    } else {
      setPlacementHint("Fleet ready. Press Start Battle.");
    }
  } else if (state.phase === "battle") {
    setPlacementHint("Battle mode active. Fire on enemy waters.");
  } else {
    setPlacementHint("Match complete. Start a new game to place a new fleet.");
  }
}

function getUnshotCoords(board) {
  const coords = [];
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      if (!board.cells[y][x].shot) {
        coords.push({ x, y });
      }
    }
  }
  return coords;
}

function unresolvedHitCoords(board) {
  const hits = [];
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      const cell = board.cells[y][x];
      if (cell.shot && cell.shipId !== -1 && !cell.sunk) {
        hits.push({ x, y });
      }
    }
  }
  return hits;
}

function adjacentCoords(x, y) {
  const list = [
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 }
  ];
  return list.filter((coord) => inBounds(coord.x, coord.y));
}

function queueContains(queue, coord) {
  return queue.some((item) => item.x === coord.x && item.y === coord.y);
}

function enqueueTargets(board, coords) {
  for (const coord of coords) {
    if (board.cells[coord.y][coord.x].shot) {
      continue;
    }
    if (!queueContains(state.aiMemory.queue, coord)) {
      state.aiMemory.queue.push(coord);
    }
  }
}

function pruneQueue(board) {
  state.aiMemory.queue = state.aiMemory.queue.filter(
    (coord) => !board.cells[coord.y][coord.x].shot
  );
}

function placementValidForHard(board, cells) {
  for (const { x, y } of cells) {
    const cell = board.cells[y][x];
    if (cell.sunk) {
      return false;
    }
    if (cell.shot && cell.shipId === -1) {
      return false;
    }
  }
  return true;
}

function hardWeightShot(board) {
  const unshot = getUnshotCoords(board);
  if (unshot.length === 0) {
    return null;
  }

  const remainingLengths = board.ships
    .filter((ship) => !ship.sunk)
    .map((ship) => ship.length);

  const weights = new Map();
  for (const coord of unshot) {
    weights.set(toKey(coord.x, coord.y), 1);
  }

  for (const len of remainingLengths) {
    for (let y = 0; y < BOARD_SIZE; y += 1) {
      for (let x = 0; x < BOARD_SIZE; x += 1) {
        for (const horizontal of [true, false]) {
          const cells = shipCells(x, y, len, horizontal);
          if (!cells.every((coord) => inBounds(coord.x, coord.y))) {
            continue;
          }
          if (!placementValidForHard(board, cells)) {
            continue;
          }
          const hitBonus =
            cells.filter((coord) => {
              const c = board.cells[coord.y][coord.x];
              return c.shot && c.shipId !== -1 && !c.sunk;
            }).length * 6;

          for (const coord of cells) {
            const c = board.cells[coord.y][coord.x];
            if (!c.shot) {
              const key = toKey(coord.x, coord.y);
              weights.set(key, (weights.get(key) || 0) + 1 + hitBonus);
            }
          }
        }
      }
    }
  }

  for (const hit of unresolvedHitCoords(board)) {
    for (const neighbor of adjacentCoords(hit.x, hit.y)) {
      const cell = board.cells[neighbor.y][neighbor.x];
      if (!cell.shot) {
        const key = toKey(neighbor.x, neighbor.y);
        weights.set(key, (weights.get(key) || 0) + 12);
      }
    }
  }

  let best = [];
  let maxWeight = -1;
  for (const coord of unshot) {
    const w = weights.get(toKey(coord.x, coord.y)) || 0;
    if (w > maxWeight) {
      maxWeight = w;
      best = [coord];
    } else if (w === maxWeight) {
      best.push(coord);
    }
  }

  return randomItem(best);
}

function chooseAiTarget() {
  const board = state.playerBoard;
  const unshot = getUnshotCoords(board);
  if (unshot.length === 0) {
    return null;
  }

  pruneQueue(board);

  if (state.difficulty === "impossible") {
    const shipCoords = unshot.filter(
      (coord) => board.cells[coord.y][coord.x].shipId !== -1
    );
    return shipCoords.length > 0 ? randomItem(shipCoords) : randomItem(unshot);
  }

  if (state.difficulty === "medium" || state.difficulty === "hard") {
    if (state.aiMemory.queue.length > 0) {
      return state.aiMemory.queue.shift();
    }
  }

  if (state.difficulty === "hard") {
    const weighted = hardWeightShot(board);
    if (weighted) {
      return weighted;
    }
  }

  return randomItem(unshot);
}

function render() {
  const inPlacement = state.phase === "placement";
  const inBattle = state.phase === "battle";

  paintBoard(state.playerBoard, dom.playerButtons, {
    showShips: true,
    allowClicks: inPlacement && !state.gameOver
  });

  paintBoard(state.enemyBoard, dom.enemyButtons, {
    showShips: false,
    allowClicks:
      inBattle && state.playerTurn && !state.gameOver && !state.lockInput
  });
}

function beginPlacementPhase() {
  state.phase = "placement";
  state.gameOver = false;
  state.playerTurn = false;
  state.lockInput = false;
  state.aiMemory = { queue: [] };
  state.orientationHorizontal = true;
  state.placementQueue = createPlacementQueue();
  state.playerPlacements = [];

  state.playerBoard = createBoard();
  state.enemyBoard = createBoard();
  placeFleetRandom(state.enemyBoard);

  render();
  syncPlacementUi();
  setStatus(
    "Placement phase: click your board to place ships, then start the battle."
  );
}

function maybeEndGame() {
  if (allShipsSunk(state.enemyBoard)) {
    state.gameOver = true;
    state.phase = "gameover";
    state.lockInput = false;
    state.playerTurn = false;
    setStatus("Victory. You destroyed the enemy fleet.");
    showAnnouncement("win", "Victory!");
    render();
    syncPlacementUi();
    return true;
  }

  if (allShipsSunk(state.playerBoard)) {
    state.gameOver = true;
    state.phase = "gameover";
    state.lockInput = false;
    state.playerTurn = false;
    setStatus(`Defeat on ${DIFF_LABEL[state.difficulty]} mode. Start a new game.`);
    showAnnouncement("lose", "Fleet Lost");
    render();
    syncPlacementUi();
    return true;
  }

  return false;
}

function handBackTurn(message) {
  if (state.gameOver || state.phase !== "battle") {
    return;
  }
  state.playerTurn = true;
  state.lockInput = false;
  setStatus(message);
  render();
}

function resolveAiShot() {
  if (state.gameOver || state.phase !== "battle") {
    return;
  }

  try {
    let target = null;
    let result = null;

    for (let attempt = 0; attempt < BOARD_SIZE * BOARD_SIZE; attempt += 1) {
      target = chooseAiTarget();
      if (!target) {
        break;
      }
      result = fire(state.playerBoard, target.x, target.y);
      if (result.ok) {
        break;
      }
    }

    if (!target || !result || !result.ok) {
      handBackTurn("Enemy move failed to resolve. Your turn.");
      return;
    }

    if (result.type === "hit") {
      enqueueTargets(state.playerBoard, adjacentCoords(target.x, target.y));
      showAnnouncement("hit", "Incoming Hit");
    }

    if (result.type === "sunk") {
      pruneQueue(state.playerBoard);
      showAnnouncement("sunk", `Your ${result.shipName} was sunk`);
    }

    flashCoords(dom.playerButtons, result.coords);
    render();

    if (maybeEndGame()) {
      return;
    }

    const suffix =
      result.type === "sunk"
        ? ` and sunk your ${result.shipName}.`
        : result.type === "hit"
          ? " and scored a hit."
          : " and missed.";
    handBackTurn(`Enemy fired at ${coordToHuman(target)}${suffix} Your turn.`);
  } catch (error) {
    console.error("AI turn failed:", error);
    handBackTurn("Enemy move encountered an error. Your turn.");
  }
}

function tryPlaceCurrentShip(x, y) {
  const nextSpec = getNextPlacementSpec();
  if (!nextSpec) {
    setStatus("All ships placed. Press Start Battle.");
    return;
  }

  const cells = shipCells(
    x,
    y,
    nextSpec.length,
    state.orientationHorizontal
  );

  if (!canPlaceShip(state.playerBoard, cells)) {
    setStatus("Invalid placement. Move ship or rotate and try again.");
    return;
  }

  state.playerPlacements.push({
    name: nextSpec.name,
    label: nextSpec.label,
    length: nextSpec.length,
    cells
  });

  state.playerBoard = boardFromPlacements(state.playerPlacements);
  render();
  syncPlacementUi();

  if (placementComplete()) {
    setStatus("Fleet deployed. Press Start Battle.");
    showAnnouncement("info", "Fleet Ready");
  } else {
    setStatus(`Placed ${nextSpec.label}.`);
  }
}

function autoPlaceRemaining() {
  if (state.phase !== "placement" || state.gameOver) {
    return;
  }

  const placements = [...state.playerPlacements];
  const board = boardFromPlacements(placements);

  for (let i = placements.length; i < state.placementQueue.length; i += 1) {
    const spec = state.placementQueue[i];
    let placed = false;

    for (let tries = 0; tries < 500 && !placed; tries += 1) {
      const horizontal = Math.random() < 0.5;
      const maxX = horizontal ? BOARD_SIZE - spec.length : BOARD_SIZE - 1;
      const maxY = horizontal ? BOARD_SIZE - 1 : BOARD_SIZE - spec.length;
      const x = Math.floor(Math.random() * (maxX + 1));
      const y = Math.floor(Math.random() * (maxY + 1));
      const cells = shipCells(x, y, spec.length, horizontal);

      if (canPlaceShip(board, cells)) {
        placeShip(board, spec.label, spec.length, cells, spec.name);
        placements.push({
          name: spec.name,
          label: spec.label,
          length: spec.length,
          cells
        });
        placed = true;
      }
    }

    if (!placed) {
      setStatus("Auto-place failed. Try again or clear and retry.");
      return;
    }
  }

  state.playerPlacements = placements;
  state.playerBoard = board;
  render();
  syncPlacementUi();
  setStatus("Fleet auto-deployed. Press Start Battle.");
  showAnnouncement("info", "Auto Deploy");
}

function undoPlacement() {
  if (state.phase !== "placement" || state.playerPlacements.length === 0) {
    return;
  }

  const removed = state.playerPlacements.pop();
  state.playerBoard = boardFromPlacements(state.playerPlacements);
  render();
  syncPlacementUi();
  setStatus(`Removed ${removed.label}. Place it again.`);
}

function clearPlacements() {
  if (state.phase !== "placement") {
    return;
  }

  state.playerPlacements = [];
  state.playerBoard = createBoard();
  render();
  syncPlacementUi();
  setStatus("Cleared your board. Place your fleet again.");
}

function startBattle() {
  if (state.phase !== "placement") {
    return;
  }

  if (!placementComplete()) {
    setStatus("Place all ships before starting battle.");
    return;
  }

  state.phase = "battle";
  state.playerTurn = true;
  state.lockInput = false;
  state.gameOver = false;
  state.aiMemory = { queue: [] };

  render();
  syncPlacementUi();
  setStatus(
    `Battle started. Difficulty: ${DIFF_LABEL[state.difficulty]}. Fire on enemy waters.`
  );
  showAnnouncement("info", "Battle Start");
}

function onPlayerCellClick(event) {
  if (state.phase !== "placement" || state.gameOver) {
    return;
  }

  const x = Number(event.currentTarget.dataset.x);
  const y = Number(event.currentTarget.dataset.y);
  tryPlaceCurrentShip(x, y);
}

function onEnemyCellClick(event) {
  if (state.phase !== "battle") {
    setStatus("Finish placement first, then start battle.");
    return;
  }

  if (!state.playerTurn || state.lockInput || state.gameOver) {
    return;
  }

  const x = Number(event.currentTarget.dataset.x);
  const y = Number(event.currentTarget.dataset.y);
  const result = fire(state.enemyBoard, x, y);

  if (!result.ok) {
    setStatus("That coordinate has already been fired on.");
    return;
  }

  if (result.type === "hit") {
    showAnnouncement("hit", "Direct Hit");
  } else if (result.type === "sunk") {
    showAnnouncement("sunk", `Enemy ${result.shipName} sunk`);
  }

  flashCoords(dom.enemyButtons, result.coords);
  render();

  if (maybeEndGame()) {
    return;
  }

  const playerLine =
    result.type === "sunk"
      ? `You fired at ${coordToHuman({ x, y })} and sunk an enemy ${result.shipName}.`
      : result.type === "hit"
        ? `You fired at ${coordToHuman({ x, y })} and hit a ship.`
        : `You fired at ${coordToHuman({ x, y })} and missed.`;

  state.playerTurn = false;
  state.lockInput = true;
  setStatus(`${playerLine} Enemy is thinking...`);
  render();
  window.setTimeout(resolveAiShot, 600);
}

function bindUI() {
  dom.playerButtons = buildGrid(dom.playerBoard, onPlayerCellClick);
  dom.enemyButtons = buildGrid(dom.enemyBoard, onEnemyCellClick);

  dom.newGame.addEventListener("click", () => {
    state.difficulty = dom.difficulty.value;
    beginPlacementPhase();
  });

  dom.rotateShip.addEventListener("click", () => {
    if (state.phase !== "placement") {
      return;
    }
    state.orientationHorizontal = !state.orientationHorizontal;
    syncPlacementUi();
  });

  dom.autoPlace.addEventListener("click", autoPlaceRemaining);
  dom.undoPlace.addEventListener("click", undoPlacement);
  dom.clearPlace.addEventListener("click", clearPlacements);
  dom.startBattle.addEventListener("click", startBattle);

  dom.difficulty.addEventListener("change", () => {
    state.difficulty = dom.difficulty.value;
    if (state.phase === "battle") {
      setStatus(`Difficulty switched to ${DIFF_LABEL[state.difficulty]} for AI turns.`);
    } else if (state.phase === "placement") {
      setStatus(`Difficulty set to ${DIFF_LABEL[state.difficulty]}.`);
    }
  });
}

bindUI();
beginPlacementPhase();
