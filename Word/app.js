"use strict";

const WORD_COUNT = 18;
const $ = (selector) => document.querySelector(selector);
const elements = {
  inputPanel: $("#inputPanel"), wordInputs: $("#wordInputs"), wordCounter: $("#wordCounter"),
  inputError: $("#inputError"), startButton: $("#startButton"), workspace: $("#workspace"),
  wordGrid: $("#wordGrid"), resultCounter: $("#resultCounter"), emptyState: $("#emptyState"),
  historyList: $("#historyList"), historyEmpty: $("#historyEmpty"), historyCount: $("#historyCount"),
  undoButton: $("#undoButton"), resetButton: $("#resetButton"), resetDialog: $("#resetDialog"),
  confirmResetButton: $("#confirmResetButton"), matchDialog: $("#matchDialog"), matchForm: $("#matchForm"),
  selectedWord: $("#selectedWord"), matchInput: $("#matchInput"), dialogError: $("#dialogError"),
  decreaseButton: $("#decreaseButton"), increaseButton: $("#increaseButton"),
};
const state = { allWords: [], candidates: [], history: [], selectedWord: "" };

function createInputs() {
  for (let index = 0; index < WORD_COUNT; index += 1) {
    const input = document.createElement("input");
    input.className = "word-input";
    input.type = "text";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.placeholder = `Слово ${index + 1}`;
    input.setAttribute("aria-label", `Слово ${index + 1}`);
    input.dataset.index = String(index);
    elements.wordInputs.append(input);
  }
}

const inputs = () => [...elements.wordInputs.querySelectorAll(".word-input")];
const normalize = (value) => value.trim().toLocaleUpperCase("ru-RU");
const getWords = () => inputs().map((input) => normalize(input.value));

function updateInputState() {
  const filled = getWords().filter(Boolean).length;
  elements.wordCounter.textContent = `${filled} / ${WORD_COUNT}`;
  elements.startButton.disabled = filled !== WORD_COUNT;
  elements.inputError.textContent = "";
  inputs().forEach((input) => input.classList.remove("invalid"));
}

function validateWords(words) {
  const wordLength = Array.from(words[0]).length;
  const duplicate = words.find((word, index) => words.indexOf(word) !== index);
  const different = words.find((word) => Array.from(word).length !== wordLength);
  if (duplicate) return { message: `Слово «${duplicate}» повторяется`, word: duplicate };
  if (different) return { message: "Слова должны быть одной длины", word: different };
  return null;
}

function samePositions(first, second) {
  const letters = Array.from(first);
  const other = Array.from(second);
  return letters.reduce((sum, letter, index) => sum + (letter === other[index] ? 1 : 0), 0);
}

function renderWords() {
  elements.wordGrid.replaceChildren();
  state.candidates.forEach((word) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "word";
    button.dataset.word = word;
    button.textContent = word;
    if (state.candidates.length === 1) button.classList.add("answer");
    elements.wordGrid.append(button);
  });
  elements.resultCounter.textContent = String(state.candidates.length);
  elements.wordGrid.hidden = state.candidates.length === 0;
  elements.emptyState.hidden = state.candidates.length !== 0;
}

function renderHistory() {
  elements.historyList.replaceChildren();
  state.history.forEach((step) => {
    const item = document.createElement("li");
    const word = document.createElement("span");
    const match = document.createElement("span");
    word.className = "history-word";
    match.className = "history-match";
    word.textContent = step.word;
    match.textContent = `${step.matches} / ${Array.from(step.word).length}`;
    item.append(word, match);
    elements.historyList.append(item);
  });
  const hasHistory = state.history.length > 0;
  elements.historyEmpty.hidden = hasHistory;
  elements.historyList.hidden = !hasHistory;
  elements.undoButton.hidden = !hasHistory;
  elements.historyCount.textContent = String(state.history.length);
}

function render() {
  state.candidates = state.allWords.filter((candidate) =>
    state.history.every((step) => samePositions(candidate, step.word) === step.matches),
  );
  renderWords();
  renderHistory();
}

function start() {
  const words = getWords();
  const issue = validateWords(words);
  if (issue) {
    elements.inputError.textContent = issue.message;
    const badInput = inputs().find((input) => normalize(input.value) === issue.word);
    badInput?.classList.add("invalid");
    badInput?.focus();
    return;
  }
  state.allWords = words;
  state.history = [];
  elements.inputPanel.hidden = true;
  elements.workspace.hidden = false;
  render();
}

function openMatch(word) {
  state.selectedWord = word;
  elements.selectedWord.textContent = word;
  elements.matchInput.max = String(Array.from(word).length);
  elements.matchInput.value = "0";
  elements.dialogError.textContent = "";
  elements.matchDialog.showModal();
  requestAnimationFrame(() => elements.matchInput.select());
}

function adjustMatch(change) {
  const max = Number(elements.matchInput.max);
  const current = Number(elements.matchInput.value) || 0;
  elements.matchInput.value = String(Math.min(max, Math.max(0, current + change)));
}

function applyMatch() {
  const matches = Number(elements.matchInput.value);
  const max = Number(elements.matchInput.max);
  if (!Number.isInteger(matches) || matches < 0 || matches > max) {
    elements.dialogError.textContent = `Введите число от 0 до ${max}`;
    elements.matchInput.focus();
    return false;
  }
  state.history.push({ word: state.selectedWord, matches });
  render();
  return true;
}

function reset() {
  Object.assign(state, { allWords: [], candidates: [], history: [], selectedWord: "" });
  inputs().forEach((input) => { input.value = ""; });
  elements.workspace.hidden = true;
  elements.inputPanel.hidden = false;
  updateInputState();
  inputs()[0].focus();
}

createInputs();
updateInputState();
elements.wordInputs.addEventListener("input", updateInputState);
elements.wordInputs.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  const next = inputs()[Number(event.target.dataset.index) + 1];
  if (next) next.focus();
  else if (!elements.startButton.disabled) start();
});
elements.startButton.addEventListener("click", start);
elements.wordGrid.addEventListener("click", (event) => {
  const word = event.target.closest(".word");
  if (word) openMatch(word.dataset.word);
});
elements.decreaseButton.addEventListener("click", () => adjustMatch(-1));
elements.increaseButton.addEventListener("click", () => adjustMatch(1));
elements.matchForm.addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  if (applyMatch()) elements.matchDialog.close();
});
elements.undoButton.addEventListener("click", () => { state.history.pop(); render(); });
elements.resetButton.addEventListener("click", () => {
  if (getWords().some(Boolean) || state.allWords.length) elements.resetDialog.showModal();
});
elements.confirmResetButton.addEventListener("click", reset);
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && state.history.length && !elements.matchDialog.open) {
    event.preventDefault();
    state.history.pop();
    render();
  }
});
