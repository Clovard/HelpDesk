const API_URL =
  "https://it-help-panel.andrejsarafonov.workers.dev";

let kind = "ticket";
let rows = [];
let currentView = "kanban";
let draggedId = null;

const ticketStatuses = [
  "Новая",
  "На рассмотрении",
  "В работе",
  "Закрыта"
];

const ideaStatuses = [
  "Новая",
  "На рассмотрении",
  "Запланирована",
  "В работе",
  "Реализована",
  "Отклонена"
];

const RESPONSIBLES = [
  "Андрей",
  "Тема",
  "Пентагон"
];

let password = sessionStorage.getItem("helpdesk_password");

if (!password) {
  password = prompt("Введите пароль панели");

  if (password) {
    sessionStorage.setItem(
      "helpdesk_password",
      password
    );
  }
}

function authHeader() {
  return "Basic " + btoa("admin:" + password);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getValue(row, names) {
  for (const name of names) {
    if (
      row &&
      row[name] !== undefined &&
      row[name] !== null &&
      row[name] !== ""
    ) {
      return row[name];
    }
  }

  return "";
}

function getId(row) {
  return getValue(row, ["ID", "id"]);
}

function getStatus(row) {
  return (
    getValue(row, [
      "Статус IT",
      "Статус идеи",
      "Статус",
      "status"
    ]) || "Новая"
  );
}

function getResponsible(row) {
  return getValue(row, [
    "Ответственный",
    "Оветственный",
    "responsible"
  ]);
}

function getLevel(row) {
  return getValue(row, [
    "Уровень L1/L2/L3",
    "Уровень",
    "level"
  ]);
}

function getComment(row) {
  return getValue(row, [
    "Комментарий IT",
    "Комментарий",
    "comment"
  ]);
}

function getProblem(row) {
  return getValue(row, [
    "Проблема / ситуация",
    "Идея / Тип предложения",
    "Идея / предложение",
    "Проблема",
    "problem"
  ]);
}

async function load() {
  try {
    const response = await fetch(
      API_URL + "/api/list?kind=" + kind,
      {
        method: "GET",
        headers: {
          Authorization: authHeader()
        },
        cache: "no-store"
      }
    );

    if (response.status === 401) {
      sessionStorage.removeItem(
        "helpdesk_password"
      );

      alert("Неверный пароль панели");
      location.reload();
      return;
    }

    if (!response.ok) {
      throw new Error(
        "Ошибка HTTP: " + response.status
      );
    }

    const data = await response.json();

    rows = Array.isArray(data)
      ? data
      : Array.isArray(data.rows)
        ? data.rows
        : [];

    updateCounters();
    render();
  } catch (error) {
    console.error(error);
    alert("Не удалось загрузить заявки");
  }
}

function getFilteredRows() {
  const searchElement =
    document.getElementById("search");

  const search = (
    searchElement?.value || ""
  ).toLowerCase().trim();

  if (!search) {
    return rows;
  }

  return rows.filter(row =>
    JSON.stringify(row)
      .toLowerCase()
      .includes(search)
  );
}

function render() {
  const board =
    document.getElementById("board");

  if (!board) {
    console.error(
      "Не найден элемент #board"
    );
    return;
  }

  if (currentView === "list") {
    renderList(board);
  } else {
    renderKanban(board);
  }
}

function renderKanban(board) {
  const statuses =
    kind === "idea"
      ? ideaStatuses
      : ticketStatuses;

  const filteredRows =
    getFilteredRows();

  board.className = "board kanban-board";

  board.innerHTML = statuses
    .map(status => {
      const statusRows =
        filteredRows.filter(
          row => getStatus(row) === status
        );

      return `
        <section
          class="column"
          data-status="${escapeHtml(status)}"
        >
          <div class="column-header">
            <h2>${escapeHtml(status)}</h2>
            <span class="column-count">
              ${statusRows.length}
            </span>
          </div>

          <div class="cards">
            ${
              statusRows.length
                ? statusRows
                    .map(renderCard)
                    .join("")
                : `<div class="empty">
                    Нет заявок
                   </div>`
            }
          </div>
        </section>
      `;
    })
    .join("");

  enableDragAndDrop();
  enableCardButtons();
}

function renderCard(row) {
  const id = getId(row);
  const problem = getProblem(row);
  const responsible =
    getResponsible(row) || "Не назначен";
  const level =
    getLevel(row) || "Не указан";
  const comment =
    getComment(row) || "нет";

  return `
    <article
      class="card"
      draggable="true"
      data-id="${escapeHtml(id)}"
    >
      <div class="card-top">
        <strong class="card-id">
          ${escapeHtml(id)}
        </strong>

        <button
          class="edit-card"
          data-edit-id="${escapeHtml(id)}"
          type="button"
        >
          Редактировать
        </button>
      </div>

      <div class="muted">
        ${escapeHtml(
          getValue(row, ["Дата"])
        )}
        ${escapeHtml(
          getValue(row, ["Время"])
        )}
      </div>

      <div class="muted">
        ${escapeHtml(
          getValue(row, ["Сотрудник"])
        )}
        ·
        ${escapeHtml(
          getValue(row, ["Город"])
        )}
      </div>

      <div class="muted">
        ${escapeHtml(
          getValue(row, ["Подразделение"])
        )}
        ·
        ${escapeHtml(
          getValue(row, ["Система"])
        )}
      </div>

      <div class="problem">
        ${escapeHtml(problem)}
      </div>

      <div class="card-info">
        <div>
          Уровень:
          <b>${escapeHtml(level)}</b>
        </div>

        <div>
          Ответственный:
          <b>${escapeHtml(responsible)}</b>
        </div>

        <div>
          Комментарий:
          ${escapeHtml(comment)}
        </div>
      </div>
    </article>
  `;
}

function renderList(board) {
  const filteredRows =
    getFilteredRows();

  board.className = "board list-board";

  const headers =
    kind === "idea"
      ? [
          ["ID", ["ID"]],
          ["Дата", ["Дата"]],
          ["Время", ["Время"]],
          ["Сотрудник", ["Сотрудник"]],
          ["Город", ["Город"]],
          ["Подразделение", ["Подразделение"]],
          ["Система", ["Система"]],
          [
            "Идея",
            [
              "Идея / Тип предложения",
              "Идея / предложение"
            ]
          ],
          [
            "Ожидаемый результат",
            ["Ожидаемый результат"]
          ],
          ["Приоритет", ["Приоритет"]],
          [
            "Статус",
            ["Статус IT", "Статус идеи"]
          ],
          [
            "Ответственный",
            [
              "Ответственный",
              "Оветственный"
            ]
          ],
          [
            "Комментарий",
            [
              "Комментарий IT",
              "Комментарий"
            ]
          ]
        ]
      : [
          ["ID", ["ID"]],
          ["Дата", ["Дата"]],
          ["Время", ["Время"]],
          ["Сотрудник", ["Сотрудник"]],
          ["Город", ["Город"]],
          ["Подразделение", ["Подразделение"]],
          ["Система", ["Система"]],
          ["Тип", ["Тип"]],
          [
            "Проблема",
            [
              "Проблема / ситуация",
              "Проблема"
            ]
          ],
          [
            "Ожидаемый результат",
            ["Ожидаемый результат"]
          ],
          ["Статус", ["Статус IT", "Статус"]],
          [
            "Уровень",
            ["Уровень L1/L2/L3", "Уровень"]
          ],
          [
            "Ответственный",
            [
              "Ответственный",
              "Оветственный"
            ]
          ],
          [
            "Комментарий",
            [
              "Комментарий IT",
              "Комментарий"
            ]
          ]
        ];

  board.innerHTML = `
    <div class="list-wrapper">
      <table class="full-list-table">
        <thead>
          <tr>
            ${headers
              .map(([title]) =>
                `<th>${escapeHtml(title)}</th>`
              )
              .join("")}
          </tr>
        </thead>

        <tbody>
          ${
            filteredRows.length
              ? filteredRows
                  .map(row => `
                    <tr
                      data-id="${escapeHtml(
                        getId(row)
                      )}"
                    >
                      ${headers
                        .map(([, names]) => `
                          <td>
                            ${escapeHtml(
                              getValue(
                                row,
                                names
                              ) || "—"
                            )}
                          </td>
                        `)
                        .join("")}
                    </tr>
                  `)
                  .join("")
              : `
                <tr>
                  <td
                    colspan="${headers.length}"
                    class="empty"
                  >
                    Заявок нет
                  </td>
                </tr>
              `
          }
        </tbody>
      </table>
    </div>
  `;

  board
    .querySelectorAll("tbody tr[data-id]")
    .forEach(row => {
      row.addEventListener(
        "dblclick",
        () => {
          openEditor(row.dataset.id);
        }
      );
    });
}

function enableDragAndDrop() {
  document
    .querySelectorAll(".card")
    .forEach(card => {
      card.addEventListener(
        "dragstart",
        () => {
          draggedId = card.dataset.id;
          card.classList.add("dragging");
        }
      );

      card.addEventListener(
        "dragend",
        () => {
          draggedId = null;
          card.classList.remove(
            "dragging"
          );
        }
      );
    });

  document
    .querySelectorAll(".column")
    .forEach(column => {
      column.addEventListener(
        "dragover",
        event => {
          event.preventDefault();
          column.classList.add("drag-over");
        }
      );

      column.addEventListener(
        "dragleave",
        () => {
          column.classList.remove(
            "drag-over"
          );
        }
      );

      column.addEventListener(
        "drop",
        async event => {
          event.preventDefault();

          column.classList.remove(
            "drag-over"
          );

          if (!draggedId) {
            return;
          }

          const status =
            column.dataset.status;

          await updateTicket(
            draggedId,
            {
              status
            }
          );
        }
      );
    });
}

function enableCardButtons() {
  document
    .querySelectorAll("[data-edit-id]")
    .forEach(button => {
      button.addEventListener(
        "click",
        event => {
          event.stopPropagation();
          openEditor(
            button.dataset.editId
          );
        }
      );
    });
}

async function updateTicket(id, data) {
  try {
    const response = await fetch(
      API_URL + "/api/update",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          Authorization: authHeader()
        },
        body: JSON.stringify({
          kind,
          id,
          ...data
        })
      }
    );

    if (!response.ok) {
      throw new Error(
        "Ошибка сохранения"
      );
    }

    const result =
      await response.json();

    if (result.ok === false) {
      throw new Error(
        result.error || "Ошибка API"
      );
    }

    await load();
  } catch (error) {
    console.error(error);
    alert("Изменение не сохранено");
  }
}

async function openEditor(id) {
  const row = rows.find(
    item => String(getId(item)) === String(id)
  );

  if (!row) {
    return;
  }

  const oldResponsible =
    getResponsible(row);

  const oldLevel =
    getLevel(row);

  const oldComment =
    getComment(row);

  const responsible =
    prompt(
      "Ответственный:\nАндрей, Тема, Пентагон",
      oldResponsible
    );

  if (responsible === null) {
    return;
  }

  const level =
    prompt(
      "Уровень: L1, L2 или L3",
      oldLevel
    );

  if (level === null) {
    return;
  }

  const comment =
    prompt(
      "Комментарий IT",
      oldComment
    );

  if (comment === null) {
    return;
  }

  await updateTicket(id, {
    responsible: responsible.trim(),
    level: level.trim(),
    comment: comment.trim()
  });
}

function updateCounters() {
  const statuses =
    kind === "idea"
      ? ideaStatuses
      : ticketStatuses;

  for (const status of statuses) {
    const count =
      rows.filter(
        row => getStatus(row) === status
      ).length;

    const selectors = [
      `[data-status-count="${status}"]`,
      `[data-count-status="${status}"]`
    ];

    for (const selector of selectors) {
      document
        .querySelectorAll(selector)
        .forEach(element => {
          element.textContent = count;
        });
    }
  }

  const counter =
    document.getElementById("counter");

  if (counter) {
    counter.textContent =
      `${rows.length} записей`;
  }
}

function findButton(id, text) {
  const byId =
    document.getElementById(id);

  if (byId) {
    return byId;
  }

  return [...document.querySelectorAll(
    "button"
  )].find(button =>
    button.textContent
      .trim()
      .toLowerCase()
      .includes(text.toLowerCase())
  );
}

function setupButtons() {
  const ticketsButton =
    findButton(
      "ticketsButton",
      "Заявки"
    );

  const ideasButton =
    findButton(
      "ideasButton",
      "Идеи"
    );

  const refreshButton =
    findButton(
      "refreshButton",
      "Обновить"
    );

  const kanbanButton =
    findButton(
      "kanbanButton",
      "Канбан"
    );

  const listButton =
    findButton(
      "listButton",
      "Список"
    );

  ticketsButton?.addEventListener(
    "click",
    () => {
      kind = "ticket";
      currentView = "kanban";
      load();
    }
  );

  ideasButton?.addEventListener(
    "click",
    () => {
      kind = "idea";
      currentView = "kanban";
      load();
    }
  );

  refreshButton?.addEventListener(
    "click",
    load
  );

  kanbanButton?.addEventListener(
    "click",
    () => {
      currentView = "kanban";
      render();
    }
  );

  listButton?.addEventListener(
    "click",
    () => {
      currentView = "list";
      render();
    }
  );

  document
    .getElementById("search")
    ?.addEventListener(
      "input",
      render
    );
}

setupButtons();
load();