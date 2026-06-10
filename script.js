/* =========================================================
   QUICK KANBAN - TEACHING EDITION V2
   =========================================================
   This file is organized into learning sections:
   1) App configuration + state
   2) Startup sequence
   3) Form handling (add tasks)
   4) Rendering (show tasks on screen)
   5) Drag and drop lifecycle
   6) Data movement + ordering logic
   7) Persistence (localStorage)
   8) First-run sample data
   ========================================================= */

/* =========================================================
   LEARNING SECTION 1: APP CONFIGURATION + STATE
   ========================================================= */

/* localStorage key used to save/reload task data */
const STORAGE_KEY = "quick-kanban-data-v1";

/* Official column IDs used throughout the app */
const COLUMNS = ["todo", "in-progress", "done", "dropped"];

/*
  Main in-memory app state.
  Think of this as the "single source of truth".
*/
const state = {
  tasks: []
};

/* Cache important DOM elements so we can reuse them */
const taskForm = document.getElementById("task-form");
const titleInput = document.getElementById("task-title");
const descInput = document.getElementById("task-desc");
const cardTemplate = document.getElementById("task-card-template");

/* =========================================================
   LEARNING SECTION 2: STARTUP SEQUENCE
   ========================================================= */

/* Run initialization once when script loads */
init();

function init() {
  // Step 1: Try loading saved tasks
  loadState();

  // Step 2: If no saved tasks exist, seed sample tasks
  seedIfEmpty();

  // Step 3: Draw the board from current state
  renderAllColumns();

  // Step 4: Turn on user interactions
  wireForm();
  wireDropZones();
}

/* =========================================================
   LEARNING SECTION 3: FORM HANDLING (ADD TASKS)
   ========================================================= */

function wireForm() {
  taskForm.addEventListener("submit", (event) => {
    // Prevent browser default behavior (page reload)
    event.preventDefault();

    // Read and clean user input
    const title = titleInput.value.trim();
    const description = descInput.value.trim();

    // Do nothing if title is empty
    if (!title) return;

    // Add a new task object to state
    state.tasks.push({
      id: crypto.randomUUID(), // Unique identifier for drag/drop and updates
      title,
      description,
      columnId: "todo", // New tasks always start in To Do
      createdAt: Date.now()
    });

    // Save changes + redraw board
    saveState();
    renderAllColumns();

    // Reset form for next task entry
    taskForm.reset();
    titleInput.focus();
  });
}

/* =========================================================
   LEARNING SECTION 4: RENDERING (SHOW TASKS)
   ========================================================= */

function renderAllColumns() {
  COLUMNS.forEach((columnId) => {
    // Find this column's drop zone
    const zone = document.querySelector(`.drop-zone[data-column-id="${columnId}"]`);

    // Clear old cards from that zone
    zone.innerHTML = "";

    // Get tasks belonging to this column
    const tasksInColumn = state.tasks.filter((task) => task.columnId === columnId);

    // Create and append card DOM nodes
    tasksInColumn.forEach((task) => {
      const card = createCard(task);
      zone.appendChild(card);
    });
  });
}

function createCard(task) {
  // Clone one new card from template
  const cardNode = cardTemplate.content.firstElementChild.cloneNode(true);

  // Store IDs in data-attributes for later lookups
  cardNode.dataset.taskId = task.id;
  cardNode.dataset.columnId = task.columnId;

  // Fill card text
  cardNode.querySelector(".task-title").textContent = task.title;
  cardNode.querySelector(".task-description").textContent =
    task.description || "No description";

  // Drag lifecycle: start
  cardNode.addEventListener("dragstart", () => {
    cardNode.classList.add("dragging");
  });

  // Drag lifecycle: end
  cardNode.addEventListener("dragend", () => {
    cardNode.classList.remove("dragging");

    // Remove visual highlights from all zones
    document.querySelectorAll(".drop-zone").forEach((z) => z.classList.remove("drag-over"));
  });

  return cardNode;
}

/* =========================================================
   LEARNING SECTION 5: DRAG AND DROP LIFECYCLE
   ========================================================= */

function wireDropZones() {
  const zones = document.querySelectorAll(".drop-zone");

  zones.forEach((zone) => {
    zone.addEventListener("dragover", (event) => {
      /*
        Must prevent default so dropping is allowed.
        Without this, drop events may not fire.
      */
      event.preventDefault();

      // Visual highlight to show active drop target
      zone.classList.add("drag-over");

      // Find currently dragged card
      const draggedCard = document.querySelector(".task-card.dragging");
      if (!draggedCard) return;

      /*
        Find insertion point based on cursor vertical position
        so user can reorder cards inside the zone.
      */
      const afterElement = getInsertAfterElement(zone, event.clientY);

      if (!afterElement) {
        zone.appendChild(draggedCard); // put at end
      } else {
        zone.insertBefore(draggedCard, afterElement); // insert before target
      }
    });

    zone.addEventListener("dragleave", () => {
      zone.classList.remove("drag-over");
    });

    zone.addEventListener("drop", (event) => {
      event.preventDefault();
      zone.classList.remove("drag-over");

      const card = document.querySelector(".task-card.dragging");
      if (!card) return;

      const taskId = card.dataset.taskId;
      const newColumnId = zone.dataset.columnId;

      // Read final order from DOM after drop preview
      const reorderedTaskIds = Array.from(zone.querySelectorAll(".task-card")).map(
        (el) => el.dataset.taskId
      );

      // Commit this move/order into real app state
      moveTask(taskId, newColumnId, reorderedTaskIds);
    });
  });
}

/* =========================================================
   LEARNING SECTION 6: DATA MOVEMENT + ORDERING LOGIC
   ========================================================= */

function moveTask(taskId, newColumnId, reorderedTaskIdsInTarget) {
  // Find moved task object in current state
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return;

  // Update task's column (this is the actual move)
  task.columnId = newColumnId;

  /*
    Build lookup map for tasks in target column:
    key = task.id, value = full task object
  */
  const targetTasksById = new Map(
    state.tasks
      .filter((t) => t.columnId === newColumnId)
      .map((t) => [t.id, t])
  );

  // Reconstruct target column order exactly as seen in DOM
  const reorderedTargetTasks = reorderedTaskIdsInTarget
    .map((id) => targetTasksById.get(id))
    .filter(Boolean);

  /*
    Rebuild global state array column by column.
    Why rebuild? It keeps ordering stable and predictable.
  */
  const rebuilt = [];

  COLUMNS.forEach((columnId) => {
    if (columnId === newColumnId) {
      rebuilt.push(...reorderedTargetTasks);
    } else {
      rebuilt.push(...state.tasks.filter((t) => t.columnId === columnId));
    }
  });

  // Safety fallback: include any task missed during rebuild
  const seen = new Set(rebuilt.map((t) => t.id));
  state.tasks.forEach((t) => {
    if (!seen.has(t.id)) rebuilt.push(t);
  });

  // Replace old state with rebuilt state, then persist + render
  state.tasks = rebuilt;
  saveState();
  renderAllColumns();
}

/*
  Helper function:
  Given a drop zone and cursor Y coordinate, decide
  which existing card we should insert before.
*/
function getInsertAfterElement(zone, y) {
  const cards = [...zone.querySelectorAll(".task-card:not(.dragging)")];

  return cards.reduce(
    (closest, element) => {
      const box = element.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;

      // We want the nearest card above cursor centerline
      if (offset < 0 && offset > closest.offset) {
        return { offset, element };
      }

      return closest;
    },
    { offset: Number.NEGATIVE_INFINITY, element: null }
  ).element;
}

/* =========================================================
   LEARNING SECTION 7: PERSISTENCE (LOCAL STORAGE)
   ========================================================= */

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;

    /*
      Basic validation so malformed data does not break app.
      Only keep tasks with expected shape.
    */
    state.tasks = parsed.filter(
      (task) =>
        task &&
        typeof task.id === "string" &&
        typeof task.title === "string" &&
        typeof task.description === "string" &&
        COLUMNS.includes(task.columnId)
    );
  } catch {
    // If parsing fails, reset to empty state
    state.tasks = [];
  }
}

/* =========================================================
   LEARNING SECTION 8: FIRST-RUN SAMPLE DATA
   ========================================================= */

function seedIfEmpty() {
  if (state.tasks.length > 0) return;

  state.tasks = [
    {
      id: crypto.randomUUID(),
      title: "Define project scope",
      description: "Write MVP boundaries and success criteria.",
      columnId: "todo",
      createdAt: Date.now()
    },
    {
      id: crypto.randomUUID(),
      title: "Draft stakeholder list",
      description: "Identify owners, approvers, and collaborators.",
      columnId: "in-progress",
      createdAt: Date.now()
    },
    {
      id: crypto.randomUUID(),
      title: "Set kickoff meeting",
      description: "Invite team and align timeline.",
      columnId: "done",
      createdAt: Date.now()
    }
  ];

  saveState();
}