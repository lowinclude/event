(() => {
  'use strict';

  const data = window.ALCHEMY_DATA;
  if (!data || !Array.isArray(data.elements)) {
    document.body.textContent = 'Не удалось загрузить список рецептов.';
    return;
  }

  // Единственный источник отображаемых русских названий — data.names.
  // Внутренние id элементов и рецептов при переименовании не меняются.
  const russianNames = data.names || {};
  const displayName = (id, fallback = id) => russianNames[id] || fallback;
  const elements = data.elements
    .map((element) => ({ ...element, name: displayName(element.id, element.name) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  const elementMap = new Map(elements.map((element) => [element.id, element]));
  const nameOf = (id) => displayName(id, elementMap.get(id)?.name);
  const baseIcons = { air: '💨', earth: '🌍', fire: '🔥', water: '💧', time: '⏳' };

  const searchInput = document.querySelector('#search-input');
  const clearSearch = document.querySelector('#clear-search');
  const stepMode = document.querySelector('#step-mode');
  const elementList = document.querySelector('#element-list');
  const recipeCard = document.querySelector('#recipe-card');
  const resultCount = document.querySelector('#result-count');

  let selectedId = elementMap.has('steam') ? 'steam' : elements[0].id;

  function normalize(value) {
    return value.toLocaleLowerCase('ru').replaceAll('ё', 'е').trim();
  }

  function markText(element) {
    return baseIcons[element.id] || element.name.slice(0, 1).toLocaleUpperCase('ru');
  }

  function mark(element, large = false) {
    const span = document.createElement('span');
    span.className = 'element-mark';
    if (large) span.classList.add('element-mark--large');
    span.textContent = markText(element);
    span.setAttribute('aria-hidden', 'true');
    return span;
  }

  function renderList() {
    const query = normalize(searchInput.value);
    const filtered = elements.filter((element) =>
      normalize(`${element.name} ${element.nameEn}`).includes(query),
    );

    resultCount.textContent = filtered.length;
    clearSearch.hidden = !searchInput.value;
    elementList.replaceChildren();

    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-list';
      empty.textContent = 'Ничего не нашлось. Попробуйте другое слово.';
      elementList.append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const element of filtered) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'element-item';
      button.dataset.id = element.id;
      button.setAttribute('role', 'option');
      button.setAttribute('aria-selected', String(element.id === selectedId));
      button.append(mark(element));

      const name = document.createElement('span');
      name.className = 'element-name';
      name.textContent = element.name;
      button.append(name);

      const check = document.createElement('span');
      check.className = 'selected-check';
      check.textContent = element.id === selectedId ? '✓' : '›';
      check.setAttribute('aria-hidden', 'true');
      button.append(check);
      fragment.append(button);
    }
    elementList.append(fragment);
  }

  function calculateBestRecipes() {
    const costs = new Map();
    const choices = new Map();

    for (const element of elements) {
      if (element.starting || element.special) costs.set(element.id, 0);
    }

    let changed = true;
    let passes = 0;
    while (changed && passes < elements.length) {
      changed = false;
      passes += 1;
      for (const element of elements) {
        for (const recipe of element.recipes) {
          const leftCost = costs.get(recipe[0]);
          const rightCost = costs.get(recipe[1]);
          if (leftCost === undefined || rightCost === undefined) continue;
          const candidate = leftCost + rightCost + 1;
          if (costs.get(element.id) === undefined || candidate < costs.get(element.id)) {
            costs.set(element.id, candidate);
            choices.set(element.id, recipe);
            changed = true;
          }
        }
      }
    }
    return choices;
  }

  const bestRecipes = calculateBestRecipes();

  function buildPlan(targetId) {
    const built = new Set(
      elements.filter((element) => element.starting || element.special).map((element) => element.id),
    );
    const steps = [];
    const active = new Set();

    function visit(id) {
      if (built.has(id)) return true;
      if (active.has(id)) return false;
      const recipe = bestRecipes.get(id);
      if (!recipe) return false;
      active.add(id);
      if (!visit(recipe[0]) || !visit(recipe[1])) return false;
      active.delete(id);
      if (!built.has(id)) {
        steps.push({ left: recipe[0], right: recipe[1], result: id });
        built.add(id);
      }
      return true;
    }

    return visit(targetId) ? steps : [];
  }

  function ingredientButton(id) {
    const known = elementMap.has(id);
    const node = document.createElement(known ? 'button' : 'span');
    node.className = 'ingredient';
    node.textContent = nameOf(id);
    if (known) {
      node.type = 'button';
      node.dataset.openElement = id;
      node.title = `Открыть: ${nameOf(id)}`;
    }
    return node;
  }

  function addEquation(container, left, right, result, number) {
    const row = document.createElement('li');
    row.className = number ? 'step-row' : 'recipe-row';
    if (number) {
      const badge = document.createElement('span');
      badge.className = 'step-number';
      badge.textContent = number;
      row.append(badge);
    }
    row.append(ingredientButton(left));
    const plus = document.createElement('span');
    plus.className = 'operator';
    plus.textContent = '+';
    row.append(plus, ingredientButton(right));
    const equals = document.createElement('span');
    equals.className = 'operator';
    equals.textContent = '=';
    const resultName = document.createElement('span');
    resultName.className = 'result-name';
    resultName.textContent = nameOf(result);
    row.append(equals, resultName);
    container.append(row);
  }

  function renderDirectRecipes(element) {
    const title = document.createElement('h2');
    title.className = 'section-title';
    title.textContent = `Все сочетания (${element.recipes.length})`;
    const note = document.createElement('p');
    note.className = 'section-note';
    note.textContent = 'Выберите любую пару. Нажмите на ингредиент, чтобы открыть его рецепт.';
    const list = document.createElement('ul');
    list.className = 'recipe-list';
    element.recipes.forEach(([left, right]) => addEquation(list, left, right, element.id));
    recipeCard.append(title, note, list);
  }

  function renderSteps(element) {
    const steps = buildPlan(element.id);
    if (!steps.length) {
      const notice = document.createElement('div');
      notice.className = 'notice';
      notice.textContent = 'Для этого элемента нет полной цепочки из базовых элементов. Ниже показаны прямые рецепты.';
      recipeCard.append(notice);
      renderDirectRecipes(element);
      return;
    }

    const title = document.createElement('h2');
    title.className = 'section-title';
    title.textContent = `Пошаговое создание (${steps.length} ${wordForStep(steps.length)})`;
    const note = document.createElement('p');
    note.className = 'section-note';
    note.textContent = 'Короткая цепочка от базовых стихий до нужного элемента.';
    const starts = document.createElement('div');
    starts.className = 'start-items';
    const used = new Set(steps.flatMap((step) => [step.left, step.right]));
    elements
      .filter((item) => (item.starting || item.special) && used.has(item.id))
      .forEach((item) => {
        const chip = document.createElement('span');
        chip.className = 'start-chip';
        chip.textContent = `${markText(item)} ${item.name}`;
        starts.append(chip);
      });
    const list = document.createElement('ol');
    list.className = 'step-list';
    steps.forEach((step, index) => addEquation(list, step.left, step.right, step.result, index + 1));
    recipeCard.append(title, note, starts, list);
  }

  function wordForStep(number) {
    const lastTwo = number % 100;
    const last = number % 10;
    if (last === 1 && lastTwo !== 11) return 'шаг';
    if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return 'шага';
    return 'шагов';
  }

  function renderRecipe() {
    const element = elementMap.get(selectedId);
    recipeCard.replaceChildren();

    const header = document.createElement('div');
    header.className = 'recipe-title';
    header.append(mark(element, true));
    const text = document.createElement('div');
    const eyebrow = document.createElement('p');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = element.starting ? 'Базовый элемент' : element.special ? 'Особый элемент' : 'Рецепт';
    const heading = document.createElement('h1');
    heading.textContent = element.name;
    const english = document.createElement('p');
    english.className = 'english-name';
    english.textContent = element.nameEn;
    text.append(eyebrow, heading, english);
    header.append(text);
    recipeCard.append(header);

    if (element.starting) {
      const notice = document.createElement('div');
      notice.className = 'notice';
      notice.textContent = 'Доступен с самого начала игры.';
      recipeCard.append(notice);
      if (element.recipes.length) renderDirectRecipes(element);
      return;
    }

    if (element.special) {
      const notice = document.createElement('div');
      notice.className = 'notice';
      notice.textContent = 'Время откроется, когда вы соберёте 100 элементов, включая четыре базовых.';
      recipeCard.append(notice);
      return;
    }

    if (stepMode.checked) renderSteps(element);
    else renderDirectRecipes(element);
  }

  function selectElement(id, scroll = false) {
    if (!elementMap.has(id)) return;
    selectedId = id;
    renderList();
    renderRecipe();
    if (scroll && window.innerWidth <= 820) recipeCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  searchInput.addEventListener('input', renderList);
  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      searchInput.value = '';
      renderList();
    }
  });
  clearSearch.addEventListener('click', () => {
    searchInput.value = '';
    searchInput.focus();
    renderList();
  });
  stepMode.addEventListener('change', renderRecipe);
  elementList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-id]');
    if (button) selectElement(button.dataset.id, true);
  });
  recipeCard.addEventListener('click', (event) => {
    const button = event.target.closest('[data-open-element]');
    if (button) selectElement(button.dataset.openElement);
  });

  renderList();
  renderRecipe();
})();
