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
let draftQuestions = [];

/** Rendering **/
function renderQuestionList() {
  questionList.innerHTML = "";
  draftQuestions.forEach((q, idx) => {
    const li = createElement("li");
    const input = createElement("input", {
      value: q,
      oninput: (e) => {
        draftQuestions[idx] = e.target.value;
      },
    });
    const del = createElement(
      "button",
      {
        class: "ghost",
        onclick: () => {
          draftQuestions.splice(idx, 1);
          renderQuestionList();
        },
      },
      [document.createTextNode("削除")]
    );
    li.appendChild(input);
    li.appendChild(del);
    questionList.appendChild(li);
  });
}

function renderAnswerForm(survey) {
  answerForm.innerHTML = "";
  (survey?.questions || []).forEach((q, i) => {
    const label = createElement("label", {}, [
      document.createTextNode(q),
      createElement("input", { id: `q_${i}`, placeholder: "回答" }),
    ]);
    answerForm.appendChild(label);
  });
}

function renderResponsesTable(survey, responses) {
  const thead = responsesTable.querySelector("thead");
  const tbody = responsesTable.querySelector("tbody");
  thead.innerHTML = "";
  tbody.innerHTML = "";

  if (!survey) return;

  const headers = ["回答者", ...survey.questions];
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
  const answers = survey.questions.map((_, i) => {
    const el = document.getElementById(`q_${i}`);
    return el ? el.value : "";
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
  const headers = ["respondent", ...survey.questions.map((_, i) => `q${i + 1}`)];
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


