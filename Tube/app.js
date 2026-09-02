const CAPACITY = 4;

const COLORS = [
  { id: "white", name: "Белый", hex: "#e8e9e1" },
  { id: "yellow", name: "Жёлтый", hex: "#f4d63b" },
  { id: "blue", name: "Синий", hex: "#336cdb" },
  { id: "red", name: "Красный", hex: "#dd4050" },
  { id: "pink", name: "Розовый", hex: "#e9a4c1" },
  { id: "orange", name: "Оранжевый", hex: "#f18a43" },
  { id: "cyan", name: "Бирюзовый", hex: "#68d7cc" },
  { id: "purple", name: "Фиолетовый", hex: "#8d55e9" },
  { id: "green", name: "Зелёный", hex: "#3ba85c" }
];

const colorById = Object.fromEntries(COLORS.map((color) => [color.id, color]));

const elements = {
  tubes: document.querySelector("#tubes"),
  palette: document.querySelector("#palette"),
  paletteWrap: document.querySelector("#paletteWrap"),
  eraser: document.querySelector("#eraserButton"),
  clear: document.querySelector("#clearButton"),
  solve: document.querySelector("#solveButton"),
  editorActions: document.querySelector("#editorActions"),
  solutionActions: document.querySelector("#solutionActions"),
  pourGuide: document.querySelector("#pourGuide"),
  sourceNumber: document.querySelector("#sourceNumber"),
  targetNumber: document.querySelector("#targetNumber"),
  moveCounter: document.querySelector("#moveCounter"),
  prev: document.querySelector("#prevButton"),
  next: document.querySelector("#nextButton"),
  backToEdit: document.querySelector("#backToEditButton"),
  toast: document.querySelector("#toast")
};

let tubes = createEmptyEditorTubes();
let editorSnapshot = Array.from({ length: 11 }, () => []);
let selectedColor = COLORS[0].id;
let editMode = "color";
let solution = [];
let moveIndex = 0;
let solutionMode = false;
let solving = false;
let worker = null;
let toastTimer = null;

function cloneTubes(value) {
  return value.map((tube) => [...tube]);
}

function toEditorTubes(value) {
  return value.map((tube) => Array.from({ length: CAPACITY }, (_, index) => tube[index] || null));
}

function createEmptyEditorTubes() {
  return Array.from({ length: 11 }, () => Array(CAPACITY).fill(null));
}

function renderPalette() {
  elements.palette.innerHTML = "";
  COLORS.forEach((color, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `color-swatch${selectedColor === color.id && editMode === "color" ? " is-active" : ""}`;
    button.style.setProperty("--color", color.hex);
    button.title = color.name;
    button.setAttribute("aria-label", `Выбрать цвет: ${color.name}`);
    button.setAttribute("aria-pressed", String(selectedColor === color.id && editMode === "color"));
    button.dataset.color = color.id;
    button.dataset.key = String(index + 1);
    elements.palette.append(button);
  });
  elements.eraser.classList.toggle("is-active", editMode === "erase");
}

function renderTubes() {
  elements.tubes.innerHTML = "";
  const activeMove = solution[moveIndex];

  tubes.forEach((tube, tubeIndex) => {
    const wrap = document.createElement("div");
    wrap.className = "tube-wrap";
    if (activeMove && tubeIndex === activeMove.from) wrap.classList.add("is-source");
    if (activeMove && tubeIndex === activeMove.to) wrap.classList.add("is-target");

    const tubeEl = document.createElement("div");
    tubeEl.className = "tube";
    tubeEl.dataset.tube = String(tubeIndex);
    tubeEl.setAttribute("aria-label", `Колба ${tubeIndex + 1}`);

    for (let slotIndex = 0; slotIndex < CAPACITY; slotIndex += 1) {
      const slot = document.createElement("button");
      const colorId = tube[slotIndex];
      slot.type = "button";
      slot.className = `tube-slot ${colorId ? "has-color" : "is-empty"}`;
      slot.dataset.tube = String(tubeIndex);
      slot.dataset.slot = String(slotIndex);
      slot.disabled = solutionMode || solving;
      if (colorId) {
        slot.style.setProperty("--color", colorById[colorId].hex);
        slot.setAttribute("aria-label", `Колба ${tubeIndex + 1}, слой ${slotIndex + 1}: ${colorById[colorId].name}`);
      } else {
        slot.setAttribute("aria-label", `Колба ${tubeIndex + 1}, пустой слой ${slotIndex + 1}`);
      }
      tubeEl.append(slot);
    }

    const number = document.createElement("span");
    number.className = "tube-number";
    number.textContent = String(tubeIndex + 1).padStart(2, "0");
    wrap.append(tubeEl, number);
    elements.tubes.append(wrap);
  });

}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  toastTimer = window.setTimeout(() => { elements.toast.hidden = true; }, 3200);
}

function applyEdit(tubeIndex, slotIndex) {
  const tube = tubes[tubeIndex];
  if (editMode === "erase") {
    tube[slotIndex] = null;
  } else {
    tube[slotIndex] = selectedColor;
  }
  renderTubes();
}

function validatePuzzle() {
  const counts = {};
  const normalizedTubes = [];
  let filled = 0;

  for (let tubeIndex = 0; tubeIndex < tubes.length; tubeIndex += 1) {
    const cells = Array.from({ length: CAPACITY }, (_, slotIndex) => tubes[tubeIndex][slotIndex] || null);
    const firstEmpty = cells.findIndex((color) => !color);
    if (firstEmpty !== -1 && cells.slice(firstEmpty + 1).some(Boolean)) {
      return {
        ok: false,
        message: `В колбе ${tubeIndex + 1} есть пустой промежуток. Заполните его или сотрите слои выше.`
      };
    }

    const compactTube = cells.filter(Boolean);
    normalizedTubes.push(compactTube);
    compactTube.forEach((color) => {
      counts[color] = (counts[color] || 0) + 1;
      filled += 1;
    });
  }

  if (filled === 0) return { ok: false, message: "Сначала заполните цветные колбы" };

  const wrong = Object.entries(counts).filter(([, count]) => count !== CAPACITY);
  if (wrong.length) {
    const details = wrong.map(([id, count]) => `${colorById[id].name.toLowerCase()} — ${count}`).join(", ");
    return { ok: false, message: `Каждый цвет должен встречаться 4 раза: ${details}` };
  }

  const emptySlots = tubes.length * CAPACITY - filled;
  if (emptySlots < CAPACITY) return { ok: false, message: "Оставьте хотя бы одну колбу пустой" };
  return { ok: true, tubes: normalizedTubes };
}

function startSolving() {
  const validation = validatePuzzle();
  if (!validation.ok) {
    showToast(validation.message);
    return;
  }

  if (worker) worker.terminate();
  worker = new Worker("solver-worker.js");
  solving = true;
  editorSnapshot = cloneTubes(validation.tubes);
  tubes = toEditorTubes(validation.tubes);
  elements.solve.disabled = true;
  elements.solve.querySelector("span:first-child").textContent = "Ищем…";
  renderTubes();

  worker.onmessage = ({ data }) => {
    solving = false;
    elements.solve.disabled = false;
    elements.solve.querySelector("span:first-child").textContent = "Найти решение";

    if (data.type === "solved") {
      try {
        enterSolution(data.moves);
      } catch (error) {
        solutionMode = false;
        solution = [];
        showToast("Решатель вернул некорректный шаг. Запустите поиск ещё раз.");
        renderTubes();
      }
    } else {
      showToast(data.message || "Решение не найдено. Проверьте раскладку.");
      renderTubes();
    }
    worker.terminate();
    worker = null;
  };

  worker.onerror = () => {
    solving = false;
    elements.solve.disabled = false;
    elements.solve.querySelector("span:first-child").textContent = "Найти решение";
    showToast("Не удалось запустить поиск. Обновите страницу и попробуйте снова.");
    renderTubes();
  };

  worker.postMessage({ tubes: cloneTubes(validation.tubes), capacity: CAPACITY, maxNodes: 1500000 });
}

function applyMoveChecked(state, move) {
  if (!move || !Number.isInteger(move.from) || !Number.isInteger(move.to)) {
    throw new Error("Некорректные номера колб");
  }
  if (move.from === move.to || !state[move.from] || !state[move.to]) {
    throw new Error("Ход выходит за пределы раскладки");
  }

  const source = state[move.from];
  const target = state[move.to];
  if (!source.length || target.length >= CAPACITY) throw new Error("Недопустимый перелив");

  const topColor = source[source.length - 1];
  if (target.length && target[target.length - 1] !== topColor) {
    throw new Error("Цвет назначения не совпадает");
  }

  let sameColorLayers = 1;
  while (sameColorLayers < source.length && source[source.length - 1 - sameColorLayers] === topColor) {
    sameColorLayers += 1;
  }
  const expectedAmount = Math.min(sameColorLayers, CAPACITY - target.length);
  if (move.color !== topColor || move.amount !== expectedAmount) {
    throw new Error("Количество или цвет перелива не совпадает с состоянием колб");
  }

  const next = cloneTubes(state);
  for (let i = 0; i < move.amount; i += 1) next[move.to].push(next[move.from].pop());
  return next;
}

function buildStateAfter(moveCount, moves = solution) {
  let state = cloneTubes(editorSnapshot);
  for (let index = 0; index < moveCount; index += 1) {
    state = applyMoveChecked(state, moves[index]);
  }
  return state;
}

function isSolvedState(state) {
  return state.every((tube) => {
    if (!tube.length) return true;
    return tube.length === CAPACITY && tube.every((color) => color === tube[0]);
  });
}

function enterSolution(moves) {
  if (!Array.isArray(moves)) throw new Error("Нет списка ходов");
  const finalState = buildStateAfter(moves.length, moves);
  if (!isSolvedState(finalState)) throw new Error("Последовательность не решает раскладку");

  solutionMode = true;
  solution = moves;
  moveIndex = 0;
  tubes = toEditorTubes(editorSnapshot);
  elements.paletteWrap.hidden = true;
  elements.editorActions.hidden = true;
  elements.solutionActions.hidden = false;
  updateSolutionView();
}

function updateSolutionView() {
  const completed = moveIndex >= solution.length;
  // Каждый экран заново строится из исходной раскладки. Так переходы назад и вперёд
  // не могут накопить ошибку или перенести цвет не в ту колбу.
  tubes = buildStateAfter(Math.min(moveIndex, solution.length));
  elements.pourGuide.hidden = completed || solution.length === 0;
  elements.prev.disabled = moveIndex === 0;
  elements.next.disabled = completed;
  elements.next.querySelector("span:first-child").textContent = completed ? "Готово" : "Следующий шаг";

  if (completed) {
    elements.moveCounter.textContent = `Готово · ${solution.length} ходов`;
  } else {
    const move = solution[moveIndex];
    elements.sourceNumber.textContent = String(move.from + 1);
    elements.targetNumber.textContent = String(move.to + 1);
    elements.pourGuide.setAttribute("aria-label", `Перелейте из колбы ${move.from + 1} в колбу ${move.to + 1}`);
    elements.moveCounter.textContent = `Ход ${moveIndex + 1} из ${solution.length}`;
  }
  renderTubes();
}

function exitSolution() {
  solutionMode = false;
  solution = [];
  moveIndex = 0;
  tubes = cloneTubes(editorSnapshot);
  elements.paletteWrap.hidden = false;
  elements.editorActions.hidden = false;
  elements.solutionActions.hidden = true;
  elements.pourGuide.hidden = true;
  renderTubes();
}

elements.palette.addEventListener("click", (event) => {
  const swatch = event.target.closest(".color-swatch");
  if (!swatch) return;
  selectedColor = swatch.dataset.color;
  editMode = "color";
  renderPalette();
});

elements.eraser.addEventListener("click", () => {
  editMode = "erase";
  renderPalette();
});

elements.tubes.addEventListener("click", (event) => {
  const slot = event.target.closest(".tube-slot");
  if (!slot || slot.disabled) return;
  applyEdit(Number(slot.dataset.tube), Number(slot.dataset.slot));
});

elements.clear.addEventListener("click", () => {
  tubes = createEmptyEditorTubes();
  renderTubes();
});

elements.solve.addEventListener("click", startSolving);
elements.backToEdit.addEventListener("click", exitSolution);

elements.prev.addEventListener("click", () => {
  if (moveIndex === 0) return;
  moveIndex -= 1;
  updateSolutionView();
});

elements.next.addEventListener("click", () => {
  if (moveIndex >= solution.length) return;
  moveIndex += 1;
  updateSolutionView();
});

document.addEventListener("keydown", (event) => {
  if (event.target.matches("button") && (event.key === "Enter" || event.key === " ")) return;
  if (solutionMode) {
    if (event.key === "ArrowRight") elements.next.click();
    if (event.key === "ArrowLeft") elements.prev.click();
    return;
  }
  const number = Number(event.key);
  if (number >= 1 && number <= 9) {
    selectedColor = COLORS[number - 1].id;
    editMode = "color";
    renderPalette();
  }
  if (event.key === "Backspace" || event.key === "Delete") {
    editMode = "erase";
    renderPalette();
  }
});

renderPalette();
renderTubes();
