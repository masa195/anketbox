"use strict";

// Storage keys
const STORAGE_SURVEY = "anketbox:survey";
const STORAGE_RESPONSES = "anketbox:responses";

// DOM refs
const surveyNameInput = document.getElementById("surveyName");
const newQuestionInput = document.getElementById("newQuestion");
const addQuestionBtn = document.getElementById("addQuestionBtn");
const questionList = document.getElementById("questionList");
const saveSurveyBtn = document.getElementById("saveSurveyBtn");
const clearSurveyBtn = document.getElementById("clearSurveyBtn");
const newTypeSelect = document.getElementById("newType");
const newRequiredCheckbox = document.getElementById("newRequired");
const newOptionsInput = document.getElementById("newOptions");
const jsonExportBtn = document.getElementById("jsonExportBtn");
const jsonImportInput = document.getElementById("jsonImportInput");

const respondentInput = document.getElementById("respondent");
const answerForm = document.getElementById("answerForm");
const submitAnswerBtn = document.getElementById("submitAnswerBtn");

const exportCsvBtn = document.getElementById("exportCsvBtn");
const clearResponsesBtn = document.getElementById("clearResponsesBtn");
const responsesTable = document.getElementById("responsesTable");

/** Utils **/
function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

function createElement(tag, props = {}, children = []) {
  const el = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === "className") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") {
      el.addEventListener(k.substring(2).toLowerCase(), v);
    } else if (v !== undefined && v !== null) {
      el.setAttribute(k, String(v));
    }
  });
  children.forEach((c) => el.appendChild(c));
  return el;
}

/** State **/
/**
 * question: { id, label, type: 'text'|'textarea'|'single'|'multi', required, options?: string[] }
 */
let draftQuestions = [];

/** Rendering **/
function renderQuestionList() {
  questionList.innerHTML = "";
  draftQuestions.forEach((q, idx) => {
    const li = createElement("li", { class: "q-item", draggable: "true", "data-index": String(idx) });
    li.addEventListener("dragstart", onDragStart);
    li.addEventListener("dragover", onDragOver);
    li.addEventListener("dragleave", onDragLeave);
    li.addEventListener("drop", onDrop);
    li.addEventListener("dragend", onDragEnd);
    const handle = createElement("span", { class: "handle", text: "↕" });
    const labelInput = createElement("input", {
      value: q.label,
      placeholder: "質問文",
      oninput: (e) => (q.label = e.target.value),
    });
    const typeSelect = createElement(
      "select",
      {
        onchange: (e) => {
          q.type = e.target.value;
          renderQuestionList();
        },
      },
      [
        option("text", "短文", q.type === "text"),
        option("textarea", "長文", q.type === "textarea"),
        option("single", "単一選択", q.type === "single"),
        option("multi", "複数選択", q.type === "multi"),
      ]
    );
    const requiredBox = createElement("label", { class: "inline" }, [
      createElement("input", {
        type: "checkbox",
        checked: q.required ? "checked" : undefined,
        onchange: (e) => (q.required = e.target.checked),
      }),
      document.createTextNode("必須"),
    ]);
    const optionsInput = createElement("input", {
      placeholder: "選択肢（カンマ区切り）",
      value: (q.options || []).join(", "),
      style: q.type === "single" || q.type === "multi" ? "" : "display:none",
      oninput: (e) => (q.options = splitOptions(e.target.value)),
    });
    const upBtn = createElement("button", { class: "ghost", onclick: () => move(idx, -1) }, [
      document.createTextNode("↑"),
    ]);
    const downBtn = createElement("button", { class: "ghost", onclick: () => move(idx, 1) }, [
      document.createTextNode("↓"),
    ]);
    const del = createElement("button", { class: "ghost", onclick: () => removeAt(idx) }, [
      document.createTextNode("削除"),
    ]);

    li.appendChild(handle);
    li.appendChild(labelInput);
    li.appendChild(typeSelect);
    li.appendChild(requiredBox);
    li.appendChild(optionsInput);
    li.appendChild(upBtn);
    li.appendChild(downBtn);
    li.appendChild(del);
    questionList.appendChild(li);
  });
}

function renderAnswerForm(survey) {
  answerForm.innerHTML = "";
  (survey?.questions || []).forEach((q, i) => {
    let control;
    if (q.type === "textarea") {
      control = createElement("textarea", { id: `q_${i}`, placeholder: "回答" });
    } else if (q.type === "single") {
      control = createElement(
        "div",
        {},
        (q.options || []).map((opt, j) =>
          createElement("label", { class: "inline" }, [
            createElement("input", { type: "radio", name: `q_${i}`, value: opt }),
            document.createTextNode(opt),
          ])
        )
      );
    } else if (q.type === "multi") {
      control = createElement(
        "div",
        {},
        (q.options || []).map((opt) =>
          createElement("label", { class: "inline" }, [
            createElement("input", { type: "checkbox", value: opt, name: `q_${i}` }),
            document.createTextNode(opt),
          ])
        )
      );
    } else {
      control = createElement("input", { id: `q_${i}`, placeholder: "回答" });
    }
    const label = createElement("label", {}, [document.createTextNode(q.label), control]);
    if (q.required) label.querySelector("input,textarea")?.setAttribute("required", "true");
    answerForm.appendChild(label);
  });
}

function renderResponsesTable(survey, responses) {
  const thead = responsesTable.querySelector("thead");
  const tbody = responsesTable.querySelector("tbody");
  thead.innerHTML = "";
  tbody.innerHTML = "";

  if (!survey) return;

  const headers = ["回答者", ...survey.questions.map((q) => q.label)];
  const trh = createElement("tr");
  headers.forEach((h) => trh.appendChild(createElement("th", { text: h })));
  thead.appendChild(trh);

  responses.forEach((r) => {
    const tr = createElement("tr");
    const cols = [r.respondent, ...r.answers];
    cols.forEach((c) => tr.appendChild(createElement("td", { text: c ?? "" })));
    tbody.appendChild(tr);
  });
}

/** Actions **/
addQuestionBtn.addEventListener("click", () => {
  const v = (newQuestionInput.value || "").trim();
  if (!v) return;
  draftQuestions.push(v);
  newQuestionInput.value = "";
  renderQuestionList();
});

saveSurveyBtn.addEventListener("click", () => {
  const name = (surveyNameInput.value || "").trim();
  const questions = draftQuestions.map((q) => q.trim()).filter(Boolean);
  if (!name || questions.length === 0) {
    alert("アンケート名と質問を入力してください。");
    return;
  }
  const survey = { name, questions, updatedAt: Date.now() };
  saveJson(STORAGE_SURVEY, survey);
  renderAnswerForm(survey);
  renderResponsesTable(survey, loadJson(STORAGE_RESPONSES, []));
  alert("設計を保存しました。");
});

clearSurveyBtn.addEventListener("click", () => {
  if (!confirm("設計をリセットしますか？")) return;
  draftQuestions = [];
  surveyNameInput.value = "";
  renderQuestionList();
  answerForm.innerHTML = "";
  saveJson(STORAGE_SURVEY, null);
});

submitAnswerBtn.addEventListener("click", () => {
  const survey = loadJson(STORAGE_SURVEY, null);
  if (!survey) {
    alert("先にアンケート設計を保存してください。");
    return;
  }
  // validation & collect
  const answers = survey.questions.map((q, i) => {
    if (q.type === "single") {
      const checked = answerForm.querySelector(`input[name="q_${i}"]:checked`);
      const val = checked ? checked.value : "";
      if (q.required && !val) throw new Error(`${q.label} は必須です`);
      return val;
    } else if (q.type === "multi") {
      const all = Array.from(answerForm.querySelectorAll(`input[name="q_${i}"]:checked`));
      const vals = all.map((el) => el.value);
      if (q.required && vals.length === 0) throw new Error(`${q.label} は必須です`);
      return vals.join(";");
    } else {
      const el = document.getElementById(`q_${i}`);
      const val = el ? el.value : "";
      if (q.required && !val.trim()) throw new Error(`${q.label} は必須です`);
      return val;
    }
  });
  const record = {
    respondent: respondentInput.value || "",
    answers,
    createdAt: Date.now(),
  };
  const list = loadJson(STORAGE_RESPONSES, []);
  list.push(record);
  saveJson(STORAGE_RESPONSES, list);
  renderResponsesTable(survey, list);
  answerForm.reset();
  respondentInput.value = "";
});

clearResponsesBtn.addEventListener("click", () => {
  if (!confirm("回答を全削除しますか？")) return;
  saveJson(STORAGE_RESPONSES, []);
  renderResponsesTable(loadJson(STORAGE_SURVEY, null), []);
});

exportCsvBtn.addEventListener("click", () => {
  const survey = loadJson(STORAGE_SURVEY, null);
  const responses = loadJson(STORAGE_RESPONSES, []);
  if (!survey) {
    alert("アンケート設計がありません。");
    return;
  }
  const headers = ["respondent", ...survey.questions.map((q) => q.label)];
  const rows = responses.map((r) => [r.respondent, ...r.answers]);
  const csv = [headers, ...rows]
    .map((cols) => cols.map(csvEscape).join(","))
    .join("\r\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(survey.name || "survey").replace(/[^a-zA-Z0-9_-]+/g, "_")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

function csvEscape(v) {
  const s = v == null ? "" : String(v);
  if (/[",
]/.test(s)) {
    return '"' + s.replaceAll('"', '""') + '"';
  }
  return s;
}

// Bootstrap
(function init() {
  const survey = loadJson(STORAGE_SURVEY, null);
  if (survey) {
    surveyNameInput.value = survey.name;
    draftQuestions = [...survey.questions];
  }
  renderQuestionList();
  renderAnswerForm(survey);
  renderResponsesTable(survey, loadJson(STORAGE_RESPONSES, []));
})();

// helpers
function option(value, label, selected) {
  const el = document.createElement("option");
  el.value = value; el.textContent = label; if (selected) el.selected = true; return el;
}
function splitOptions(text) {
  return (text || "").split(",").map((s) => s.trim()).filter(Boolean);
}
function move(index, delta) {
  const to = index + delta;
  if (to < 0 || to >= draftQuestions.length) return;
  const tmp = draftQuestions[index];
  draftQuestions[index] = draftQuestions[to];
  draftQuestions[to] = tmp;
  renderQuestionList();
}
function removeAt(index) {
  draftQuestions.splice(index, 1);
  renderQuestionList();
}

// DnD logic
let dragFromIndex = null;
function onDragStart(e) {
  const li = e.currentTarget;
  dragFromIndex = Number(li.getAttribute("data-index"));
  li.classList.add("dragging");
  try { e.dataTransfer.setData("text/plain", String(dragFromIndex)); } catch {}
  e.dataTransfer.effectAllowed = "move";
}
function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  const li = e.currentTarget;
  li.classList.add("drag-over");
}
function onDragLeave(e) {
  const li = e.currentTarget;
  li.classList.remove("drag-over");
}
function onDrop(e) {
  e.preventDefault();
  const li = e.currentTarget;
  li.classList.remove("drag-over");
  const toIndex = Number(li.getAttribute("data-index"));
  if (dragFromIndex == null || isNaN(toIndex)) return;
  if (toIndex === dragFromIndex) return;
  const [moved] = draftQuestions.splice(dragFromIndex, 1);
  draftQuestions.splice(toIndex, 0, moved);
  dragFromIndex = null;
  renderQuestionList();
}
function onDragEnd(e) {
  const li = e.currentTarget;
  li.classList.remove("dragging");
}

// add new question
addQuestionBtn.addEventListener("click", () => {
  const label = (newQuestionInput.value || "").trim();
  const type = newTypeSelect.value;
  const required = newRequiredCheckbox.checked;
  const options = type === "single" || type === "multi" ? splitOptions(newOptionsInput.value) : [];
  if (!label) return;
  draftQuestions.push({ id: cryptoRandomId(), label, type, required, options });
  newQuestionInput.value = ""; newOptionsInput.value = ""; newRequiredCheckbox.checked = false; newTypeSelect.value = "text";
  renderQuestionList();
});

// JSON Export/Import
jsonExportBtn.addEventListener("click", () => {
  const survey = { name: surveyNameInput.value || "", questions: draftQuestions };
  const blob = new Blob([JSON.stringify(survey, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `survey_${Date.now()}.json`; a.click(); URL.revokeObjectURL(url);
});
jsonImportInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  try {
    const data = JSON.parse(text);
    if (!data || !Array.isArray(data.questions)) throw new Error();
    surveyNameInput.value = data.name || "";
    draftQuestions = data.questions.map((q) => ({
      id: q.id || cryptoRandomId(),
      label: String(q.label || "質問"),
      type: ["text","textarea","single","multi"].includes(q.type) ? q.type : "text",
      required: Boolean(q.required),
      options: Array.isArray(q.options) ? q.options.map(String) : [],
    }));
    renderQuestionList();
  } catch {
    alert("JSON の形式が不正です");
  } finally {
    e.target.value = "";
  }
});

function cryptoRandomId() {
  try {
    return crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
  } catch {
    return Math.random().toString(36).slice(2);
  }
}


