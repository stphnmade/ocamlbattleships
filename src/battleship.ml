(* Implement functions from battleship.mli *)
open Consts
open Board

type player = {
  name : string;
  board : board;
}

type game = {
  players : player * player;
  mutable current_player : bool;
}

let init_player name = { name; board = init_board () }
let get_player g b = if b then fst g.players else snd g.players
let get_player_board p = p.board
let make_game p1 p2 curr = { players = (p1, p2); current_player = curr }

(** [pp l] is the string representation of a list of coordinates. *)
let pp l = "[" ^ String.concat ";" (List.map string_of_coord l) ^ "]"

(** [is_adjacent lst x a] is whether the element at position [x] in the matrix
    is adjacent, including diagonals, to the element at position [a]. *)
let rec is_adjacent (x : int * int) (a : int * int) : bool =
  if fst x < 0 || fst x >= board_size || snd x < 0 || snd x >= board_size then
    raise (InvalidPosition (string_of_coord x))
  else if fst a < 0 || fst a >= board_size || snd a < 0 || snd a >= board_size
  then raise (InvalidPosition (string_of_coord a))
  else
    let dx = abs (fst x - fst a) in
    let dy = abs (snd x - snd a) in
    dx <= 1 && dy <= 1

(** [pos_of_ship board ship x y dir] is all the coordinates which [ship] will
    occupy when placed on grid position ([x],[y]) facing direction [dir]. Raises
    InvalidPosition if any coordinates are out of bounds *)
let pos_of_ship ship x y dir =
  let rec check_bounds acc lst =
    match lst with
    | [] -> acc
    | h :: t ->
        if fst h < 0 || fst h >= board_size || snd h < 0 || snd h >= board_size
        then raise (InvalidPosition (string_of_coord h))
        else check_bounds (h :: acc) t
  in
  begin
    (match ship.length with
    | 5 ->
        if dir then List.init 5 (fun i -> (x + (-2 + i), y))
        else List.init 5 (fun i -> (x, y + (-2 + i)))
    | 4 | 3 ->
        if dir then List.init ship.length (fun i -> (x + (-1 + i), y))
        else List.init ship.length (fun i -> (x, y - (-1 + i)))
    | 2 -> if dir then [ (x, y); (x + 1, y) ] else [ (x, y); (x, y - 1) ]
    | _ -> [])
    |> check_bounds []
  end

(** [is_valid_position b s] is whether all in [s] are empty.*)
let rec is_valid_position (board : board) (ship_spots : (int * int) list) =
  match ship_spots with
  | [] -> true
  | (x, y) :: t -> begin
      match find (x, y) board with
      | None -> raise (InvalidPosition (string_of_coord (x, y)))
      | Some c -> c = Empty && is_valid_position board t
    end

(** [get_adjacents s] is all coordinates that are adjacent to the coordinates in
    [s] within the board's bounds. *)
let get_adjacents spots =
  let get_adjacents_of_point (x, y) =
    let top = (x, y + 1) in
    let left = (x - 1, y) in
    let bottom = (x, y - 1) in
    let right = (x + 1, y) in
    let top_left = (x - 1, y + 1) in
    let bottom_left = (x - 1, y - 1) in
    let top_right = (x + 1, y + 1) in
    let bottom_right = (x + 1, y - 1) in
    [ top; left; bottom; right; top_left; bottom_left; top_right; bottom_right ]
  in
  List.map get_adjacents_of_point spots
  |> List.flatten |> List.sort_uniq compare
  |> List.filter (fun (x, y) ->
         (not (List.mem (x, y) spots))
         && x >= 0 && x < board_size && y >= 0 && y < board_size)

(** [pred b c] is true if the coordinate c is a non-ship cell in board [b].
    Raises: InvalidPosition otherwise.*)
let pred board c =
  match get_cell board c with
  | Empty | Hit | Miss -> true
  | Ship _ ->
      raise (InvalidPosition (string_of_coord c ^ " is an adjacent ship"))

(** [placer b s sp] is the board after the ship [s] which occupies the positions
    in [sp] is placed on board [b]. *)
let placer board ship ship_spots =
  let ship = ref ship in
  let rec helper s acc =
    match s with
    | [] -> acc
    | (x, y) :: t -> helper t (insert (x, y) (Ship { ship }) acc)
  in
  helper ship_spots board

let place_ship player ship x y dir =
  let update_board board ship ship_spots =
    let adjacency_list = get_adjacents ship_spots in
    if
      is_valid_position board ship_spots
      && List.for_all (pred board) adjacency_list
    then
      ( ship_spots,
        placer board { ship with adjacents = adjacency_list } ship_spots )
    else raise (InvalidPosition "")
  in
  let ship_spots = pos_of_ship ship x y dir in
  let lst, board = update_board player.board ship ship_spots in
  (lst, { player with board })

let num_placed player i =
  let get_ship_cell i cell =
    match cell with
    | Empty | Hit | Miss -> false
    | Ship t -> if !(t.ship).length = i then true else false
  in
  let get_unique_ship_refs acc x =
    match x with
    | Empty | Hit | Miss -> acc
    | Ship t -> if List.memq t.ship acc then acc else t.ship :: acc
  in
  let b = player.board in
  fold
    (fun (x, y) v acc ->
      if get_ship_cell i (get_cell b (x, y)) then v :: acc else acc)
    [] b
  |> List.fold_left get_unique_ship_refs []
  |> List.length

(** [get_same_refs b s] is all the cells on board [b] that share a memory
    location with [s]. *)
let get_same_refs board ship =
  fold
    (fun (x, y) cell acc ->
      if
        match get_cell board (x, y) with
        | Empty | Hit | Miss -> false
        | Ship { ship = s } -> s == ship
      then cell :: acc
      else acc)
    [] board

(** [adjacent_transform b s coord] is the board [b] after all cells adjacent to
    [s] become a Miss and the cell at [coord] becomes a Hit. *)
let adjacent_transform board ship (x, y) =
  let rec helper lst acc =
    match lst with
    | [] -> acc
    | (a, b) :: t -> helper t (insert (a, b) Miss acc)
  in
  helper ship.adjacents (insert (x, y) Hit board)

let fire p x y =
  let fire_helper board x y =
    match get_cell board (x, y) with
    | Empty -> insert (x, y) Miss board
    | Ship { ship } ->
        let same_refs = List.length (get_same_refs board ship) in
        if same_refs = 1 then adjacent_transform board !ship (x, y)
        else insert (x, y) Hit board
    | _ -> raise (InvalidPosition (string_of_coord (x, y)))
  in
  { p with board = fire_helper p.board x y }

let placed_ready player =
  if carrier_num <> num_placed player carrier then false
  else if destroyer_num <> num_placed player destroyer then false
  else if submarine_num <> num_placed player submarine then false
  else if patrol_num <> num_placed player patrol then false
  else true

let is_game_over player =
  if num_placed player carrier <> 0 then false
  else if num_placed player destroyer <> 0 then false
  else if num_placed player submarine <> 0 then false
  else if num_placed player patrol <> 0 then false
  else true
