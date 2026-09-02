self.onmessage = ({ data }) => {
  const { tubes, capacity, maxNodes } = data;
  const result = solve(tubes, capacity, maxNodes);
  self.postMessage(result);
};

function solve(start, capacity, maxNodes) {
  if (isSolved(start, capacity)) return { type: "solved", moves: [], visited: 0 };

  const seen = new Map();
  const path = [];
  let visited = 0;
  let aborted = false;

  function search(state, previousMove) {
    visited += 1;
    if (visited > maxNodes) {
      aborted = true;
      return false;
    }
    if (isSolved(state, capacity)) return true;

    const key = canonicalKey(state);
    const depth = path.length;
    const bestDepth = seen.get(key);
    if (bestDepth !== undefined && bestDepth <= depth) return false;
    seen.set(key, depth);

    const moves = getMoves(state, capacity, previousMove);
    for (const move of moves) {
      const next = state.map((tube) => [...tube]);
      for (let n = 0; n < move.amount; n += 1) next[move.to].push(next[move.from].pop());
      path.push(move);
      if (search(next, move)) return true;
      path.pop();
      if (aborted) return false;
    }
    return false;
  }

  const solved = search(start.map((tube) => [...tube]), null);
  if (solved) return { type: "solved", moves: path, visited };
  return {
    type: "failed",
    visited,
    message: aborted
      ? "Раскладка слишком сложная для быстрого поиска. Проверьте цвета или попробуйте добавить пустую колбу."
      : "Для этой раскладки решение не найдено. Проверьте порядок цветов."
  };
}

function isSolved(tubes, capacity) {
  return tubes.every((tube) => {
    if (tube.length === 0) return true;
    if (tube.length !== capacity) return false;
    return tube.every((color) => color === tube[0]);
  });
}

function isUniform(tube) {
  return tube.length > 0 && tube.every((color) => color === tube[0]);
}

function canonicalKey(tubes) {
  // Колбы с одинаковым содержимым взаимозаменяемы. Сортировка резко уменьшает дерево поиска.
  return tubes.map((tube) => tube.join(".")).sort().join("|");
}

function getMoves(tubes, capacity, previousMove) {
  const moves = [];

  for (let from = 0; from < tubes.length; from += 1) {
    const source = tubes[from];
    if (!source.length) continue;
    if (source.length === capacity && isUniform(source)) continue;

    const color = source[source.length - 1];
    let run = 1;
    while (run < source.length && source[source.length - 1 - run] === color) run += 1;
    const destinationShapes = new Set();

    for (let to = 0; to < tubes.length; to += 1) {
      if (from === to) continue;
      const target = tubes[to];
      if (target.length >= capacity) continue;
      if (target.length && target[target.length - 1] !== color) continue;

      // Один представитель каждой группы одинаковых целей достаточен.
      const shape = target.join(".");
      if (destinationShapes.has(shape)) continue;
      destinationShapes.add(shape);

      // Перекладывание однородной колбы в пустую лишь переименовывает колбы.
      if (!target.length && isUniform(source)) continue;
      if (previousMove && previousMove.from === to && previousMove.to === from) continue;

      const amount = Math.min(run, capacity - target.length);
      const completesTarget = target.length + amount === capacity;
      const revealsSame = source.length > amount && source[source.length - 1 - amount] === color;
      let score = 0;
      if (target.length) score += 100;
      if (completesTarget) score += 35;
      if (amount === run) score += 12;
      if (source.length === amount) score += 8;
      if (revealsSame) score += 4;
      if (!target.length) score -= 10;

      moves.push({ from, to, amount, color, score });
    }
  }

  moves.sort((a, b) => b.score - a.score || b.amount - a.amount);
  return moves;
}
