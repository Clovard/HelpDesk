const API_URL =
"https://it-help-panel.andrejsarafonov.workers.dev";

const responsibleOptions = [
  "Андрей",
  "Тема",
  "Пентагон"
];

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

let kind = "ticket";
let rows = [];
let viewMode = "kanban";
let password =
sessionStorage.getItem("helpdesk_password") || "";

const board = document.getElementById("board");
const search = document.getElementById("search");
const refreshButton =
document.getElementById("refreshButton");
const ticketsButton =
document.getElementById("ticketsButton");
const ideasButton =
document.getElementById("ideasButton");
const listButton =
document.getElementById("listButton");
const kanbanButton =
document.querySelector(".view.active");

function clean(value) {
  return String(value || "")
  .replace(/\uFEFF/g, "")
  .replace(/\u00A0/g, " ")
  .trim();
}

function getHeaders() {
  if (!password) {
    password = prompt("Введите пароль HelpDesk:");

    if (!password) {
      throw new Error("Пароль не введён");
    }

    sessionStorage.setItem(
        "helpdesk_password",
        password
    );
  }

  return {
    "Content-Type": "application/json",
    "Authorization":
    "Basic " + btoa("admin:" + password)
  };
}

function field(row, ...names) {
  const keys = Object.keys(row || {});

  for (const name of names) {
    const wanted =
    clean(name).toLowerCase();

    const key = keys.find(item =>
    clean(item).toLowerCase() === wanted
    );

    if (key && clean(row[key])) {
      return clean(row[key]);
    }
  }

  const responsibleKey = keys.find(key => {
    const value =
    clean(key).toLowerCase();

    return (
      value.includes("ответствен") ||
      value.includes("оветствен")
    );
  });

  return responsibleKey
  ? clean(row[responsibleKey])
  : "";
}

function getId(row) {
  return field(row, "ID", "id");
}

function getResponsible(row) {
  return field(
      row,
      "Ответственный",
      "Оветственный",
      "responsible"
  );
}

function getLevel(row) {
  return field(
      row,
      "Уровень L1/L2/L3",
      "Уровень",
      "level"
  );
}

function getStatus(row) {
  return field(
      row,
      "Статус IT",
      "Статус идеи",
      "Статус",
      "status"
  ) || "Новая";
}

function getTitle(row) {
  return field(
      row,
      "Проблема / ситуация",
      "Проблема",
      "Идея / Тип предложения",
      "Идея"
  ) || "Без описания";
}

function getComment(row) {
  return field(
      row,
      "Комментарий IT",
      "Комментарий",
      "comment"
  );
}

function esc(value) {
  return String(value || "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");
}

function updateCounters() {
  const counts = {
    "Новая": 0,
    "На рассмотрении": 0,
    "В работе": 0,
    "Закрыта": 0
  };

  rows.forEach(row => {
    const current = getStatus(row);

    if (counts[current] !== undefined) {
      counts[current]++;
    }
  });

  document.getElementById("newCount")
  ?.replaceChildren(
      document.createTextNode(counts["Новая"])
  );

  document.getElementById("reviewCount")
  ?.replaceChildren(
      document.createTextNode(
          counts["На рассмотрении"]
      )
  );

  document.getElementById("workCount")
  ?.replaceChildren(
      document.createTextNode(
          counts["В работе"]
      )
  );

  document.getElementById("closedCount")
  ?.replaceChildren(
      document.createTextNode(
          counts["Закрыта"]
      )
  );

  const sideCounters =
  document.querySelectorAll(".menu em");

  if (sideCounters[0]) {
    sideCounters[0].textContent =
    rows.length;
  }
}

async function loadRows() {
  try {
    const response = await fetch(
        `${API_URL}/api/list?kind=${kind}`,
          {
          method: "GET",
          headers: getHeaders()
        }
    );

    if (response.status === 401) {
      sessionStorage.removeItem(
          "helpdesk_password"
      );

      password = "";

      throw new Error("Неверный пароль");
    }

    const result =
    await response.json();

    if (
      !response.ok ||
      result.ok === false
    ) {
      throw new Error(
          result.error || "Ошибка загрузки"
      );
    }

    rows = result.rows || [];
    updateCounters();
    render();

  } catch (error) {
    board.innerHTML = `
      <div class="empty">
        ${esc(error.message)}
      </div>
    `;
  }
}

function getVisibleRows() {
  const query =
  clean(search?.value || "")
  .toLowerCase();

  if (!query) {
    return rows;
  }

  return rows.filter(row =>
  JSON.stringify(row)
  .toLowerCase()
  .includes(query)
  );
}

function render() {
  if (viewMode === "list") {
    renderList();
  } else {
    renderKanban();
  }
}

function renderKanban() {
  board.innerHTML = "";

  const statuses =
  kind === "idea"
  ? ideaStatuses
  : ticketStatuses;

  const visibleRows =
  getVisibleRows();

  statuses.forEach(status => {
    const column =
    document.createElement("section");

    column.className = "column";
    column.dataset.status = status;

    column.innerHTML = `
      <h2>${esc(status)}</h2>
      <div class="cards"></div>
    `;

    const cards =
    column.querySelector(".cards");

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

          const id =
          event.dataTransfer.getData(
              "text/plain"
          );

          const row = rows.find(
              item => getId(item) === id
          );

          if (!row) {
            return;
          }

          const oldStatus =
          getStatus(row);

          if (oldStatus === status) {
            return;
          }

          if (kind === "idea") {
            row["Статус идеи"] = status;
          } else {
            row["Статус IT"] = status;
          }

          render();
          updateCounters();

          try {
            await saveRecord({
              id,
              kind,
              status,
              responsible:
              getResponsible(row),
              level: getLevel(row),
              comment: getComment(row)
            });
          } catch (error) {
            if (kind === "idea") {
              row["Статус идеи"] =
              oldStatus;
            } else {
              row["Статус IT"] =
              oldStatus;
            }

            render();
            updateCounters();
            alert(error.message);
          }
        }
    );

    const statusRows =
    visibleRows.filter(
        row => getStatus(row) === status
    );

    if (!statusRows.length) {
      cards.innerHTML =
      `<div class="empty">Пусто</div>`;
    } else {
      statusRows.forEach(row => {
        cards.appendChild(
            createCard(row)
        );
      });
    }

    board.appendChild(column);
  });
}

function createCard(row) {
  const card =
  document.createElement("article");

  card.className = "card";
  card.draggable = true;

  card.addEventListener(
      "dragstart",
      event => {
        event.dataTransfer.setData(
            "text/plain",
            getId(row)
        );

        card.classList.add("dragging");
      }
  );

  card.addEventListener(
      "dragend",
      () => {
        card.classList.remove(
            "dragging"
        );
      }
  );

  card.innerHTML = `
    <div class="card-id">
      ${esc(getId(row))}
    </div>

    <div class="muted">
      ${esc(field(row, "Дата"))}
      ·
      ${esc(field(row, "Сотрудник"))}
    </div>

    <div class="problem">
      ${esc(getTitle(row))}
    </div>

    <div class="muted">
      Уровень:
      <b>${esc(
      getLevel(row) || "Не указан"
  )}</b>
    </div>

    <div class="muted">
      Ответственный:
      <b>${esc(
      getResponsible(row) ||
      "Не назначен"
  )}</b>
    </div>

    <div class="muted">
      Комментарий:
      ${esc(getComment(row) || "нет")}
    </div>

    <div class="actions">
      <button type="button">
        Редактировать
      </button>
    </div>
  `;

  card.querySelector("button")
  .addEventListener(
      "click",
      () => openEditor(row)
  );

  return card;
}

function renderList() {
  const visibleRows =
  getVisibleRows();

  board.innerHTML = `
    <div class="list-wrapper">
      <table class="helpdesk-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Дата</th>
            <th>Сотрудник</th>
            <th>Проблема / идея</th>
            <th>Уровень</th>
            <th>Ответственный</th>
            <th>Статус</th>
            <th>Комментарий</th>
            <th></th>
          </tr>
        </thead>

        <tbody>
          ${visibleRows.map(row => `
            <tr>
              <td><b>${esc(getId(row))}</b></td>
              <td>${esc(field(row, "Дата"))}</td>
              <td>${esc(field(row, "Сотрудник"))}</td>
              <td class="table-problem">
                ${esc(getTitle(row))}
              </td>
              <td>${esc(getLevel(row) || "Не указан")}</td>
              <td>
                ${esc(
      getResponsible(row) ||
      "Не назначен"
  )}
              </td>
              <td>
                <span class="table-status">
                  ${esc(getStatus(row))}
                </span>
              </td>
              <td>${esc(getComment(row) || "нет")}</td>
              <td>
                <button
                  class="table-edit"
                  data-id="${esc(getId(row))}"
                >
                  Изменить
                </button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  document
  .querySelectorAll(".table-edit")
  .forEach(button => {
    button.onclick = () => {
      const row = rows.find(
          item =>
          getId(item) ===
          button.dataset.id
      );

      if (row) {
        openEditor(row);
      }
    };
  });
}

async function saveRecord(data) {
  const response = await fetch(
      `${API_URL}/api/update`,
        {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(data)
      }
  );

  const result =
  await response.json();

  if (
    !response.ok ||
    result.ok === false
  ) {
    throw new Error(
        result.error || "Ошибка сохранения"
    );
  }

  return result;
}

function openEditor(row) {
  const modal =
  document.createElement("div");

  modal.className = "modal";

  const selected =
  getResponsible(row);

  modal.innerHTML = `
    <div class="modal-window">
      <div class="modal-header">
        <h2>
          Редактирование ${esc(getId(row))}
        </h2>

        <button id="closeEditor">
          ×
        </button>
      </div>

      <label>
        Ответственный

        <select id="editResponsible">
          <option value="">Не назначен</option>

          ${[
    ...new Set([
      ...responsibleOptions,
      selected
    ])
  ]
  .filter(Boolean)
  .map(name => `
              <option
                value="${esc(name)}"
                ${
    name === selected
    ? "selected"
    : ""
  }
              >
                ${esc(name)}
              </option>
            `)
  .join("")}
        </select>
      </label>

      <label>
        Уровень

        <select id="editLevel">
          <option value="">Не указан</option>
          <option value="L1">L1</option>
          <option value="L2">L2</option>
          <option value="L3">L3</option>
        </select>
      </label>

      <label>
        Комментарий

        <textarea id="editComment">${esc(
      getComment(row)
  )}</textarea>
      </label>

      <div class="modal-actions">
        <button id="cancelEditor">
          Отмена
        </button>

        <button
          id="saveEditor"
          class="primary"
        >
          Сохранить
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById(
      "closeEditor"
  ).onclick = () => modal.remove();

  document.getElementById(
      "cancelEditor"
  ).onclick = () => modal.remove();

  document.getElementById(
      "saveEditor"
  ).onclick = async () => {
    try {
      await saveRecord({
        id: getId(row),
        kind,
        status: getStatus(row),

        responsible:
        document.getElementById(
            "editResponsible"
        ).value,

        level:
        document.getElementById(
            "editLevel"
        ).value,

        comment:
        document.getElementById(
            "editComment"
        ).value
      });

      modal.remove();
      await loadRows();

    } catch (error) {
      alert(error.message);
    }
  };
}

ticketsButton.onclick = () => {
  kind = "ticket";
  ticketsButton.classList.add("active");
  ideasButton.classList.remove("active");
  loadRows();
};

ideasButton.onclick = () => {
  kind = "idea";
  ideasButton.classList.add("active");
  ticketsButton.classList.remove("active");
  loadRows();
};

listButton.onclick = () => {
  viewMode = "list";
  listButton.classList.add("active");
  kanbanButton?.classList.remove("active");
  render();
};

kanbanButton.onclick = () => {
  viewMode = "kanban";
  kanbanButton.classList.add("active");
  listButton.classList.remove("active");
  render();
};

refreshButton.onclick = loadRows;
search.oninput = render;

loadRows();

setInterval(loadRows, 20000);