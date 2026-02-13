# OCamShips (OCaml Battleship)

GUI Battleship game in OCaml using the `Graphics` library.
This repository now also includes a GitHub Pages web edition in `docs/`.

## Team

- Mostafa Osman (`mo379`)
- Joel Valerio (`jev66`)
- Stephen Syl-Akinwale (`sis33`)
- Tahmidul Ambia (`ta278`)

## Prerequisites

Install OCaml tooling and project dependencies:

```sh
opam install dune graphics ounit2 bisect_ppx
eval $(opam env)
```

Notes:

- `graphics` is required to run the GUI.
- On WSL/Linux, install fonts used by the UI:

```sh
sudo apt-get install -y xfonts-base
```

If `dune` is not found after install, run `eval $(opam env)` again (or open a new shell).

## Play On GitHub Pages

The native OCaml `Graphics` app cannot run directly in a browser, so this repo
includes a browser edition at:

- `docs/index.html`
- `docs/game.js`
- `docs/styles.css`

### Enable deployment

1. Push this repository to GitHub.
2. In GitHub, open `Settings` -> `Pages`.
3. Under `Build and deployment`, set `Source` to `GitHub Actions`.
4. Push to `main` or `master` to trigger `.github/workflows/pages.yml`.
5. Open your published URL:
   `https://<your-github-username>.github.io/<repo-name>/`

The workflow publishes the `docs/` directory as a static site.

### Local web preview

From the repo root:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000/docs/`.

## Usage Process

### 1. Build and run

```sh
make build
make play
```

`make play` launches the game window (`800x800`).

### 2. Start screen

- Click `Start Game` to continue.
- Click `Quit` to exit.

### 3. Instructions + difficulty

- Choose one: `Easy`, `Medium`, `Hard`, or `Impossible`.
- Click `Continue`.

AI behavior by difficulty:

- `Easy`: random firing.
- `Medium`: random + targets adjacent cells after a hit.
- `Hard`: weighted/probability-based targeting.
- `Impossible`: has full ship-position knowledge.

### 4. Place ships

Use the placement screen controls:

- `Length 5 ship`, `Length 4 ship`, `Length 3 ship`, `Length 2 ship` buttons.
- Click a board square to place the selected ship.
- `Rotate` toggles horizontal/vertical placement.
- `Auto-place` fills all remaining ships.
- Click an existing ship cell to remove that ship.
- `Reset` clears your board.
- `Ready` starts battle once all required ships are placed.

Required fleet:

- 1 carrier (length 5)
- 1 destroyer (length 4)
- 2 submarines (length 3)
- 1 patrol (length 2)

### 5. Battle phase

- Click cells on the AI board to fire.
- `Peek` shows your own board and the AI's last hit.
- `Quit` returns to the start screen.
- Game over screen gives `Play Again` or `Quit`.

Cell colors:

- Red: hit
- Yellow: sunk
- White: miss

Keyboard:

- `q` quits in most screens.

## Development Commands

- `make build`: build all targets
- `make test`: run OUnit tests (`test/test.exe`)
- `make utop`: open `dune utop src`
- `make doc`: build API docs
- `make opendoc`: open docs in a browser/file explorer
- `make bisect`: generate coverage report with `bisect_ppx`
- `make clean`: clean build artifacts and coverage output
- `make loc`: run `cloc` after cleaning

## Project Structure

- `bin/main.ml`: entry point, calls `Ships.State.start ()`
- `src/board.ml`: board representation and cell operations
- `src/battleship.ml`: game rules (placing ships, firing, game over)
- `src/ai.ml`: AI implementations and difficulty logic
- `src/draw.ml`: GUI drawing routines (`Graphics`)
- `src/state.ml`: UI event loop and game-state transitions
- `test/test.ml`: OUnit test suite

## Documentation

Build docs:

```sh
make doc
```

Open docs:

```sh
make opendoc
```
