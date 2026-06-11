/* =========================================================
   QUICK KANBAN - TEACHING EDITION V4 (MULTI-BOARD + DUE DATES)
   ========================================================= */

const STORAGE_KEY = "quick-kanban-data-v4";
const COLUMNS = ["todo", "in-progress", "done", "dropped"];
const THEMES = ["dark", "ocean", "forest", "sunset"];
const DESCRIPTION_MAX = 500;

const state = {
  boards: [],
  activeBoardId: null
};

let activeEditTaskId = null;

const taskForm = document.getElementById("task-form");
const titleInput = document.getElementById("task-title");
const descInput = document.getElementById("task-desc");
const descCounter = document.getElementById("task-desc-counter");
const dueDateInput = document.getElementById("task-due-date");
const dueDateOpenBtn = document.getElementById("task-due-date-open");
const cardTemplate = document.getElementById("task-card-template");

const boardSelect = document.getElementById("board-select");
const newBoardBtn = document.getElementById("new-board-btn");
const renameBoardBtn = document.getElementById("rename-board-btn");
const deleteBoardBtn = document.getElementById("delete-board-btn");
const boardThemeSelect = document.getElementById("board-theme-select");

/* =========================================================
   Startup
   ========================================================= */
init();

function init() {
  loadState();
  seedIfEmpty();

  wireBoardControls();
  wireForm();
  wireDropZones();
  wireDescriptionCounter();
  wireDatePickers();

  renderBoardSelector();
  applyActiveBoardTheme();
  syncThemeDropdownToActiveBoard();
  renderAllColumns();
}

/* =========================================================
   Board management
   ========================================================= */
function getActiveBoard() {
  return state.boards.find((b) => b.id === state.activeBoardId) || null;
}

function wireBoardControls() {
  boardSelect.addEventListener("change", () => {
    state.activeBoardId = boardSelect.value;
    applyActiveBoardTheme();
    syncThemeDropdownToActiveBoard();
    saveState();
    renderAllColumns();
  });

  newBoardBtn.addEventListener("click", () => {
    const name = prompt("Enter a name for the new board:");
    if (!name || !name.trim()) return;

    const currentBoard = getActiveBoard();

    const board = {
      id: crypto.randomUUID(),
      name: name.trim(),
      theme: currentBoard?.theme || "dark",
      tasks: []
    };

    state.boards.push(board);
    state.activeBoardId = board.id;

    renderBoardSelector();
    applyActiveBoardTheme();
    syncThemeDropdownToActiveBoard();
    saveState();
    renderAllColumns();
  });

  renameBoardBtn.addEventListener("click", () => {
    const board = getActiveBoard();
    if (!board) return;

    const nextName = prompt("Enter a new board name:", board.name);
    if (!nextName || !nextName.trim()) return;

    board.name = nextName.trim();
    renderBoardSelector();
    saveState();
  });

  deleteBoardBtn.addEventListener("click", () => {
    if (state.boards.length <= 1) {
      alert("You must keep at least one board.");
      return;
    }

    const board = getActiveBoard();
    if (!board) return;

    const confirmed = confirm(`Delete board "${board.name}"?`);
    if (!confirmed) return;

    state.boards = state.boards.filter((b) => b.id !== board.id);
    state.activeBoardId = state.boards[0].id;

    renderBoardSelector();
    applyActiveBoardTheme();
    syncThemeDropdownToActiveBoard();
    saveState();
    renderAllColumns();
  });

  boardThemeSelect.addEventListener("change", () => {
    const board = getActiveBoard();
    if (!board) return;

    board.theme = THEMES.includes(boardThemeSelect.value)
      ? boardThemeSelect.value
      : "dark";

    applyActiveBoardTheme();
    saveState();
  });
}

function renderBoardSelector() {
  boardSelect.innerHTML = "";

  state.boards.forEach((board) => {
    const option = document.createElement("option");
    option.value = board.id;
    option.textContent = board.name;
    option.selected = board.id === state.activeBoardId;
    boardSelect.appendChild(option);
  });
}

function applyActiveBoardTheme() {
  const board = getActiveBoard();
  const theme = THEMES.includes(board?.theme) ? board.theme : "dark";
  document.body.dataset.theme = theme;
}

function syncThemeDropdownToActiveBoard() {
  const board = getActiveBoard();
  boardThemeSelect.value = THEMES.includes(board?.theme) ? board.theme : "dark";
}

/* =========================================================
   Task creation
   ========================================================= */
function wireForm() {
  taskForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const title = titleInput.value.trim();
    const description = descInput.value.trim();
    const dueDate = dueDateInput.value; // "YYYY-MM-DD" or ""

    if (!title) return;

    const board = getActiveBoard();
    if (!board) return;

    board.tasks.push({
      id: crypto.randomUUID(),
      title,
      description,
      dueDate: dueDate || "",
      columnId: "todo",
      createdAt: Date.now()
    });

    saveState();
    renderAllColumns();

    taskForm.reset();
    updateDescriptionCounter(descInput, descCounter);
    titleInput.focus();
  });
}

function wireDescriptionCounter() {
  if (!descInput || !descCounter) return;

  updateDescriptionCounter(descInput, descCounter);
  descInput.addEventListener("input", () => {
    updateDescriptionCounter(descInput, descCounter);
  });
}

function wireDatePickers() {
  if (!dueDateInput || !dueDateOpenBtn) return;
  dueDateOpenBtn.addEventListener("click", () => {
    openDatePicker(dueDateInput);
  });
}

/* =========================================================
   Rendering
   ========================================================= */
function renderAllColumns() {
  const board = getActiveBoard();
  const tasks = board ? board.tasks : [];

  COLUMNS.forEach((columnId) => {
    const zone = document.querySelector(`.drop-zone[data-column-id="${columnId}"]`);
    zone.innerHTML = "";

    tasks
      .filter((task) => task.columnId === columnId)
      .forEach((task) => zone.appendChild(createCard(task)));
  });
}

function createCard(task) {
  const cardNode = cardTemplate.content.firstElementChild.cloneNode(true);

  cardNode.dataset.taskId = task.id;
  cardNode.dataset.columnId = task.columnId;

  const titleNode = cardNode.querySelector(".task-title");
  const descNode = cardNode.querySelector(".task-description");
  const dueDateNode = cardNode.querySelector(".task-due-date");

  titleNode.textContent = task.title;
  descNode.textContent = task.description || "No description";

  if (task.dueDate) {
    dueDateNode.textContent = `Due: ${formatDueDate(task.dueDate)}`;
    dueDateNode.classList.remove("is-empty");

    if (isOverdue(task.dueDate, task.columnId)) {
      dueDateNode.classList.add("is-overdue");
    } else {
      dueDateNode.classList.remove("is-overdue");
    }
  } else {
    dueDateNode.textContent = "";
    dueDateNode.classList.add("is-empty");
    dueDateNode.classList.remove("is-overdue");
  }

  cardNode.addEventListener("dragstart", (event) => {
    if (cardNode.classList.contains("is-editing")) {
      event.preventDefault();
      return;
    }
    cardNode.classList.add("dragging");
  });

  cardNode.addEventListener("dragend", () => {
    cardNode.classList.remove("dragging");
    document.querySelectorAll(".drop-zone").forEach((z) => z.classList.remove("drag-over"));
  });

  cardNode.addEventListener("dblclick", (event) => {
    event.preventDefault();
    startInlineCardEdit(cardNode, task);
  });

  return cardNode;
}

function startInlineCardEdit(cardNode, task) {
  if (activeEditTaskId && activeEditTaskId !== task.id) return;
  if (cardNode.classList.contains("is-editing")) return;

  activeEditTaskId = task.id;
  cardNode.classList.add("is-editing");
  cardNode.setAttribute("draggable", "false");

  const body = cardNode.querySelector(".task-card-body");
  if (!body) return;

  const safeTitle = escapeHtml(task.title || "");
  const safeDescription = escapeHtml(task.description || "");
  const safeDueDate = escapeHtml(task.dueDate || "");

  body.innerHTML = `
    <form class="task-edit-form">
      <label>
        Title
        <input name="title" type="text" maxlength="80" value="${safeTitle}" required />
      </label>

      <label>
        Description
        <textarea name="description" rows="3" maxlength="500">${safeDescription}</textarea>
      </label>
      <div class="task-edit-char-counter">${DESCRIPTION_MAX - safeDescription.length} characters remaining</div>

      <label>
        Due Date (optional)
        <div class="task-edit-date-wrap">
          <input name="dueDate" type="date" value="${safeDueDate}" />
          <button type="button" class="date-open-btn task-edit-date-open" aria-label="Open calendar">Calendar</button>
        </div>
      </label>

      <div class="task-edit-actions">
        <button type="button" class="task-edit-delete">Delete Card</button>
        <button type="button" class="task-edit-cancel">Cancel</button>
        <button type="submit" class="task-edit-save">Save</button>
      </div>
    </form>
  `;

  const form = body.querySelector(".task-edit-form");
  const titleField = form.querySelector('input[name="title"]');
  const descriptionField = form.querySelector('textarea[name="description"]');
  const dueDateField = form.querySelector('input[name="dueDate"]');
  const inlineCounter = form.querySelector(".task-edit-char-counter");
  const inlineDateOpenButton = form.querySelector(".task-edit-date-open");
  const deleteButton = form.querySelector(".task-edit-delete");
  const cancelButton = form.querySelector(".task-edit-cancel");

  titleField.focus();
  titleField.select();
  updateDescriptionCounter(descriptionField, inlineCounter);

  descriptionField.addEventListener("input", () => {
    updateDescriptionCounter(descriptionField, inlineCounter);
  });

  inlineDateOpenButton.addEventListener("click", () => {
    openDatePicker(dueDateField);
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const nextTitle = form.title.value.trim();
    const nextDescription = form.description.value.trim();
    const nextDueDate = form.dueDate.value || "";

    if (!nextTitle) {
      alert("Title is required.");
      return;
    }

    task.title = nextTitle;
    task.description = nextDescription;
    task.dueDate = nextDueDate;

    activeEditTaskId = null;
    saveState();
    renderAllColumns();
  });

  cancelButton.addEventListener("click", () => {
    activeEditTaskId = null;
    renderAllColumns();
  });

  deleteButton.addEventListener("click", () => {
    task.columnId = "dropped";
    activeEditTaskId = null;
    saveState();
    renderAllColumns();
  });

  form.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      activeEditTaskId = null;
      renderAllColumns();
    }
  });
}

/* =========================================================
   Drag + drop lifecycle
   ========================================================= */
function wireDropZones() {
  const zones = document.querySelectorAll(".drop-zone");

  zones.forEach((zone) => {
    zone.addEventListener("dragover", (event) => {
      event.preventDefault();
      zone.classList.add("drag-over");

      const draggedCard = document.querySelector(".task-card.dragging");
      if (!draggedCard) return;

      const afterElement = getInsertAfterElement(zone, event.clientY);
      if (!afterElement) zone.appendChild(draggedCard);
      else zone.insertBefore(draggedCard, afterElement);
    });

    zone.addEventListener("dragleave", () => {
      zone.classList.remove("drag-over");
    });

    zone.addEventListener("drop", (event) => {
      event.preventDefault();
      zone.classList.remove("drag-over");

      const draggedCard = document.querySelector(".task-card.dragging");
      if (!draggedCard) return;

      const taskId = draggedCard.dataset.taskId;
      const newColumnId = zone.dataset.columnId;

      const reorderedTaskIds = Array.from(zone.querySelectorAll(".task-card")).map(
        (el) => el.dataset.taskId
      );

      moveTask(taskId, newColumnId, reorderedTaskIds);
    });
  });
}

/* =========================================================
   Task move + reorder
   ========================================================= */
function moveTask(taskId, newColumnId, reorderedTaskIdsInTarget) {
  const board = getActiveBoard();
  if (!board) return;

  const task = board.tasks.find((t) => t.id === taskId);
  if (!task) return;

  task.columnId = newColumnId;

  const targetTasksById = new Map(
    board.tasks
      .filter((t) => t.columnId === newColumnId)
      .map((t) => [t.id, t])
  );

  const reorderedTargetTasks = reorderedTaskIdsInTarget
    .map((id) => targetTasksById.get(id))
    .filter(Boolean);

  const rebuilt = [];
  COLUMNS.forEach((columnId) => {
    if (columnId === newColumnId) {
      rebuilt.push(...reorderedTargetTasks);
    } else {
      rebuilt.push(...board.tasks.filter((t) => t.columnId === columnId));
    }
  });

  const seen = new Set(rebuilt.map((t) => t.id));
  board.tasks.forEach((t) => {
    if (!seen.has(t.id)) rebuilt.push(t);
  });

  board.tasks = rebuilt;
  saveState();
  renderAllColumns();
}

function getInsertAfterElement(zone, y) {
  const cards = [...zone.querySelectorAll(".task-card:not(.dragging)")];

  return cards.reduce(
    (closest, element) => {
      const box = element.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;

      if (offset < 0 && offset > closest.offset) {
        return { offset, element };
      }

      return closest;
    },
    { offset: Number.NEGATIVE_INFINITY, element: null }
  ).element;
}

/* =========================================================
   Helpers for due date display/logic
   ========================================================= */
function formatDueDate(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;

  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function isOverdue(isoDate, columnId) {
  // Completed tasks are not shown as overdue
  if (columnId === "done") return false;

  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return false;

  const due = new Date(y, m - 1, d);
  due.setHours(23, 59, 59, 999);

  return new Date() > due;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function updateDescriptionCounter(inputEl, counterEl) {
  if (!inputEl || !counterEl) return;
  const remaining = DESCRIPTION_MAX - inputEl.value.length;
  counterEl.textContent = `${remaining} characters remaining`;
}

function openDatePicker(inputEl) {
  if (!inputEl) return;
  if (typeof inputEl.showPicker === "function") {
    inputEl.showPicker();
    return;
  }
  inputEl.focus();
  inputEl.click();
}

/* =========================================================
   Persistence
   ========================================================= */
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.boards)) return;

    const validBoards = parsed.boards
      .filter(
        (b) =>
          b &&
          typeof b.id === "string" &&
          typeof b.name === "string" &&
          Array.isArray(b.tasks)
      )
      .map((b) => ({
        id: b.id,
        name: b.name,
        theme: THEMES.includes(b.theme) ? b.theme : "dark",
        tasks: b.tasks
          .filter(
            (t) =>
              t &&
              typeof t.id === "string" &&
              typeof t.title === "string" &&
              typeof t.description === "string" &&
              (typeof t.dueDate === "string" || typeof t.dueDate === "undefined") &&
              COLUMNS.includes(t.columnId)
          )
          .map((t) => ({
            ...t,
            dueDate: typeof t.dueDate === "string" ? t.dueDate : ""
          }))
      }));

    if (validBoards.length === 0) return;

    state.boards = validBoards;
    state.activeBoardId = validBoards.some((b) => b.id === parsed.activeBoardId)
      ? parsed.activeBoardId
      : validBoards[0].id;
  } catch {
    state.boards = [];
    state.activeBoardId = null;
  }
}

/* =========================================================
   Seed data for first run
   ========================================================= */
function seedIfEmpty() {
  if (state.boards.length > 0) return;

  const firstBoard = {
    id: crypto.randomUUID(),
    name: "Main Board",
    theme: "dark",
    tasks: [
      {
        id: crypto.randomUUID(),
        title: "Define project scope",
        description: "Write MVP boundaries and success criteria.",
        dueDate: "",
        columnId: "todo",
        createdAt: Date.now()
      },
      {
        id: crypto.randomUUID(),
        title: "Draft stakeholder list",
        description: "Identify owners, approvers, and collaborators.",
        dueDate: "",
        columnId: "in-progress",
        createdAt: Date.now()
      },
      {
        id: crypto.randomUUID(),
        title: "Set kickoff meeting",
        description: "Invite team and align timeline.",
        dueDate: "",
        columnId: "done",
        createdAt: Date.now()
      }
    ]
  };

  state.boards = [firstBoard];
  state.activeBoardId = firstBoard.id;
  saveState();
}