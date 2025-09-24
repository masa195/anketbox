"use strict";

// Storage keys
const STORAGE = {
  SURVEY: 'anketbox_premium_survey',
  RESPONSES: 'anketbox_premium_responses',
  DRAFTS: 'anketbox_premium_drafts',
  SETTINGS: 'anketbox_premium_settings'
};

// Global state
let currentSurvey = null;
let responses = [];
let currentTab = 'designer';
let draggedIndex = null;

// Utility functions
const $ = id => document.getElementById(id);
const $$ = selector => document.querySelectorAll(selector);

const storage = {
  get: (key, fallback = null) => {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : fallback;
    } catch {
      return fallback;
    }
  },
  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      showNotification('データの保存に失敗しました', 'error');
    }
  }
};

// Notification system
function showNotification(message, type = 'success') {
  const notification = $('notification');
  if (!notification) return;
  notification.textContent = message;
  notification.className = `notification ${type} show`;
  setTimeout(() => {
    notification.classList.remove('show');
  }, 3000);
}

// Tab navigation
function initTabs() {
  $$('.nav-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      const targetTab = tab.dataset.tab;
      switchTab(targetTab);
    });
  });
}

function switchTab(tabName) {
  // Update nav
  $$('.nav-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });
  // Update panels
  $$('.panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === tabName);
  });
  currentTab = tabName;
  // Load data for specific tabs
  if (tabName === 'analytics') {
    analytics.update();
  } else if (tabName === 'responses') {
    renderResponsesTable();
  } else if (tabName === 'responder') {
    responder.render();
  }
}

// Survey Designer
class SurveyDesigner {
  constructor() {
    this.questions = [];
    this.init();
  }
  init() {
    this.loadSurvey();
    this.bindEvents();
    this.render();
  }
  bindEvents() {
    $('addQuestion')?.addEventListener('click', () => this.addQuestion());
    $('saveDesign')?.addEventListener('click', () => this.saveSurvey());
    $('clearDesign')?.addEventListener('click', () => this.clearSurvey());
    $('exportJson')?.addEventListener('click', () => this.exportJson());
    $('importJson')?.addEventListener('change', (e) => this.importJson(e));
    $('previewSurvey')?.addEventListener('click', () => this.previewSurvey());
    $('surveyTitle')?.addEventListener('input', () => this.updatePreview());
    $('surveyDescription')?.addEventListener('input', () => this.updatePreview());
  }
  addQuestion() {
    const questionText = $('newQuestion').value.trim();
    const type = $('questionType').value;
    const options = $('questionOptions').value.trim();
    const required = $('questionRequired').checked;
    if (!questionText) {
      showNotification('質問文を入力してください', 'error');
      $('newQuestion').classList.add('shake');
      setTimeout(() => $('newQuestion').classList.remove('shake'), 500);
      return;
    }
    const question = {
      id: Date.now().toString(),
      text: questionText,
      type: type,
      required: required,
      options: options ? options.split(',').map(opt => opt.trim()).filter(Boolean) : [],
      validation: this.getValidationForType(type)
    };
    this.questions.push(question);
    this.render();
    this.clearForm();
    showNotification('質問を追加しました', 'success');
  }
  getValidationForType(type) {
    const validations = {
      email: { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: '有効なメールアドレスを入力してください' },
      tel: { pattern: /^[\d\-\+\(\)\s]+$/, message: '有効な電話番号を入力してください' },
      number: { pattern: /^\d+$/, message: '数値を入力してください' },
      date: { pattern: /^\d{4}-\d{2}-\d{2}$/, message: '有効な日付を入力してください' }
    };
    return validations[type] || null;
  }
  clearForm() {
    $('newQuestion').value = '';
    $('questionOptions').value = '';
    $('questionRequired').checked = false;
    $('questionType').value = 'text';
  }
  removeQuestion(index) {
    if (confirm('この質問を削除しますか？')) {
      this.questions.splice(index, 1);
      this.render();
      showNotification('質問を削除しました', 'success');
    }
  }
  moveQuestion(from, to) {
    if (to < 0 || to >= this.questions.length) return;
    const question = this.questions.splice(from, 1)[0];
    this.questions.splice(to, 0, question);
    this.render();
  }
  render() {
    const list = $('questionList');
    if (!list) return;
    list.innerHTML = '';
    this.questions.forEach((question, index) => {
      const item = document.createElement('li');
      item.className = 'question-item';
      item.draggable = true;
      item.dataset.index = index;
      item.innerHTML = `
        <div class="question-header">
          <span class="drag-handle">⋮⋮</span>
          <input class="input" value="${question.text}" style="flex: 1;" onchange="designer.updateQuestion(${index}, 'text', this.value)">
          <select class="select" onchange="designer.updateQuestion(${index}, 'type', this.value)">
            <option value="text" ${question.type === 'text' ? 'selected' : ''}>短文</option>
            <option value="textarea" ${question.type === 'textarea' ? 'selected' : ''}>長文</option>
            <option value="number" ${question.type === 'number' ? 'selected' : ''}>数値</option>
            <option value="email" ${question.type === 'email' ? 'selected' : ''}>メール</option>
            <option value="tel" ${question.type === 'tel' ? 'selected' : ''}>電話</option>
            <option value="date" ${question.type === 'date' ? 'selected' : ''}>日付</option>
            <option value="radio" ${question.type === 'radio' ? 'selected' : ''}>単一選択</option>
            <option value="checkbox" ${question.type === 'checkbox' ? 'selected' : ''}>複数選択</option>
            <option value="range" ${question.type === 'range' ? 'selected' : ''}>スケール</option>
            <option value="rating" ${question.type === 'rating' ? 'selected' : ''}>評価</option>
          </select>
          <label class="flex items-center gap-2">
            <input type="checkbox" ${question.required ? 'checked' : ''} onchange="designer.updateQuestion(${index}, 'required', this.checked)">必須
          </label>
          <button class="btn btn-ghost" onclick="designer.removeQuestion(${index})">🗑️</button>
        </div>
        ${this.renderQuestionOptions(question, index)}
      `;
      // DnD events
      item.addEventListener('dragstart', () => { draggedIndex = index; item.classList.add('dragging'); });
      item.addEventListener('dragover', (e) => { e.preventDefault(); item.classList.add('drag-over'); });
      item.addEventListener('dragleave', () => { item.classList.remove('drag-over'); });
      item.addEventListener('drop', (e) => { e.preventDefault(); item.classList.remove('drag-over'); if (draggedIndex !== null && draggedIndex !== index) { this.moveQuestion(draggedIndex, index); } });
      item.addEventListener('dragend', () => { item.classList.remove('dragging'); draggedIndex = null; });
      list.appendChild(item);
    });
    this.updateStats();
    this.updateProgress();
  }
  renderQuestionOptions(question, index) {
    if (['radio', 'checkbox'].includes(question.type)) {
      return `
        <div style="margin-top: 1rem;">
          <input class="input" placeholder="選択肢（カンマ区切り）" value="${question.options.join(', ')}" onchange="designer.updateQuestionOptions(${index}, this.value)">
        </div>
      `;
    } else if (question.type === 'range') {
      return `
        <div style="margin-top: 1rem; display: flex; gap: 1rem;">
          <input class="input" placeholder="最小値" value="${question.min || ''}" type="number" onchange="designer.updateQuestion(${index}, 'min', parseInt(this.value))">
          <input class="input" placeholder="最大値" value="${question.max || ''}" type="number" onchange="designer.updateQuestion(${index}, 'max', parseInt(this.value))">
          <input class="input" placeholder="ラベル（カンマ区切り）" value="${(question.labels || []).join(', ')}" onchange="designer.updateQuestionLabels(${index}, this.value)">
        </div>
      `;
    } else if (question.type === 'rating') {
      return `
        <div style="margin-top: 1rem;">
          <input class="input" placeholder="評価段階数（デフォルト: 5）" value="${question.scale || 5}" type="number" min="2" max="10" onchange="designer.updateQuestion(${index}, 'scale', parseInt(this.value))">
        </div>
      `;
    }
    return '';
  }
  updateQuestion(index, field, value) {
    this.questions[index][field] = value;
    if (field === 'type') this.render();
  }
  updateQuestionOptions(index, value) {
    this.questions[index].options = value.split(',').map(opt => opt.trim()).filter(Boolean);
  }
  updateQuestionLabels(index, value) {
    this.questions[index].labels = value.split(',').map(label => label.trim()).filter(Boolean);
  }
  updateStats() {
    $('questionCount').textContent = this.questions.length;
    const r = storage.get(STORAGE.RESPONSES, []);
    $('responseCount').textContent = r.length;
    const completionRate = r.length > 0 ? Math.round((r.filter(x => x.completed).length / r.length) * 100) : 0;
    $('completionRate').textContent = completionRate + '%';
  }
  updateProgress() {
    const progress = Math.min((this.questions.length / 10) * 100, 100);
    $('designProgress').style.width = progress + '%';
  }
  updatePreview() {
    const titleEl = $('surveyTitleDisplay');
    const descEl = $('surveyDescriptionDisplay');
    if (titleEl) titleEl.textContent = $('surveyTitle').value || 'アンケートタイトル';
    if (descEl) descEl.textContent = $('surveyDescription').value || '';
  }
  saveSurvey() {
    const title = $('surveyTitle').value.trim();
    const description = $('surveyDescription').value.trim();
    if (!title || this.questions.length === 0) {
      showNotification('タイトルと少なくとも1つの質問が必要です', 'error');
      return;
    }
    currentSurvey = {
      id: Date.now().toString(),
      title,
      description,
      questions: this.questions,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    storage.set(STORAGE.SURVEY, currentSurvey);
    this.updatePreview();
    showNotification('アンケートを保存しました！', 'success');
    // 保存後は回答タブへ進む
    switchTab('responder');
  }
  loadSurvey() {
    const saved = storage.get(STORAGE.SURVEY);
    if (saved) {
      currentSurvey = saved;
      $('surveyTitle') && ($('surveyTitle').value = saved.title || '');
      $('surveyDescription') && ($('surveyDescription').value = saved.description || '');
      this.questions = saved.questions || [];
      this.updatePreview();
    }
  }
  clearSurvey() {
    if (confirm('すべての設計データを削除しますか？この操作は元に戻せません。')) {
      this.questions = [];
      $('surveyTitle') && ($('surveyTitle').value = '');
      $('surveyDescription') && ($('surveyDescription').value = '');
      currentSurvey = null;
      storage.set(STORAGE.SURVEY, null);
      this.render();
      this.updatePreview();
      showNotification('設計をリセットしました', 'success');
    }
  }
  exportJson() {
    if (!currentSurvey) {
      showNotification('先にアンケートを保存してください', 'error');
      return;
    }
    const dataStr = JSON.stringify(currentSurvey, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentSurvey.title || 'survey'}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('JSONファイルをエクスポートしました', 'success');
  }
  importJson(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.questions && Array.isArray(data.questions)) {
          $('surveyTitle').value = data.title || '';
          $('surveyDescription').value = data.description || '';
          this.questions = data.questions;
          this.render();
          this.updatePreview();
          showNotification('JSONファイルをインポートしました', 'success');
        } else {
          throw new Error('Invalid format');
        }
      } catch (error) {
        showNotification('無効なJSONファイルです', 'error');
      }
    };
    reader.readAsText(file);
  }
  previewSurvey() {
    this.saveSurvey();
    switchTab('responder');
    showNotification('プレビューモードに切り替えました', 'success');
  }
}

// Survey Responder
class SurveyResponder {
  constructor() {
    this.currentResponse = {};
    this.startTime = null;
    this.init();
  }
  init() {
    this.bindEvents();
    this.render();
  }
  bindEvents() {
    $('submitResponse')?.addEventListener('click', () => this.submitResponse());
    $('saveDraft')?.addEventListener('click', () => this.saveDraft());
  }
  render() {
    if (!currentSurvey) {
      const form = $('surveyForm');
      if (form) form.innerHTML = '<p style="text-align: center; color: var(--text-muted);">アンケートが設定されていません。先に設計タブでアンケートを作成してください。</p>';
      return;
    }
    this.startTime = Date.now();
    const form = $('surveyForm');
    form.innerHTML = '';
    currentSurvey.questions.forEach((question, index) => {
      const fieldset = document.createElement('div');
      fieldset.className = 'form-group';
      const label = document.createElement('label');
      label.className = 'label';
      label.textContent = question.text + (question.required ? ' *' : '');
      fieldset.appendChild(label);
      const input = this.createInputElement(question, index);
      fieldset.appendChild(input);
      form.appendChild(fieldset);
    });
    this.updateResponseProgress();
  }
  createInputElement(question, index) {
    const container = document.createElement('div');
    switch (question.type) {
      case 'text':
      case 'email':
      case 'tel': {
        const textInput = document.createElement('input');
        textInput.type = question.type;
        textInput.className = 'input';
        textInput.name = `q_${index}`;
        textInput.required = question.required;
        textInput.addEventListener('input', () => this.updateResponseProgress());
        container.appendChild(textInput);
        break;
      }
      case 'textarea': {
        const textarea = document.createElement('textarea');
        textarea.className = 'textarea';
        textarea.name = `q_${index}`;
        textarea.required = question.required;
        textarea.addEventListener('input', () => this.updateResponseProgress());
        container.appendChild(textarea);
        break;
      }
      case 'number': {
        const numberInput = document.createElement('input');
        numberInput.type = 'number';
        numberInput.className = 'input';
        numberInput.name = `q_${index}`;
        numberInput.required = question.required;
        numberInput.addEventListener('input', () => this.updateResponseProgress());
        container.appendChild(numberInput);
        break;
      }
      case 'date': {
        const dateInput = document.createElement('input');
        dateInput.type = 'date';
        dateInput.className = 'input';
        dateInput.name = `q_${index}`;
        dateInput.required = question.required;
        dateInput.addEventListener('input', () => this.updateResponseProgress());
        container.appendChild(dateInput);
        break;
      }
      case 'radio': {
        question.options.forEach((option) => {
          const radioLabel = document.createElement('label');
          radioLabel.className = 'flex items-center gap-2';
          radioLabel.style.marginBottom = '0.5rem';
          const radio = document.createElement('input');
          radio.type = 'radio';
          radio.name = `q_${index}`;
          radio.value = option;
          radio.required = question.required;
          radio.addEventListener('change', () => this.updateResponseProgress());
          radioLabel.appendChild(radio);
          radioLabel.appendChild(document.createTextNode(option));
          container.appendChild(radioLabel);
        });
        break;
      }
      case 'checkbox': {
        question.options.forEach((option) => {
          const checkboxLabel = document.createElement('label');
          checkboxLabel.className = 'flex items-center gap-2';
          checkboxLabel.style.marginBottom = '0.5rem';
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.name = `q_${index}`;
          checkbox.value = option;
          checkbox.addEventListener('change', () => this.updateResponseProgress());
          checkboxLabel.appendChild(checkbox);
          checkboxLabel.appendChild(document.createTextNode(option));
          container.appendChild(checkboxLabel);
        });
        break;
      }
      case 'range': {
        const rangeInput = document.createElement('input');
        rangeInput.type = 'range';
        rangeInput.className = 'input';
        rangeInput.name = `q_${index}`;
        rangeInput.min = question.min || 1;
        rangeInput.max = question.max || 10;
        rangeInput.step = 1;
        rangeInput.style.width = '100%';
        const valueDisplay = document.createElement('div');
        valueDisplay.style.textAlign = 'center';
        valueDisplay.style.marginTop = '0.5rem';
        valueDisplay.textContent = rangeInput.value;
        rangeInput.addEventListener('input', () => {
          valueDisplay.textContent = rangeInput.value;
          this.updateResponseProgress();
        });
        container.appendChild(rangeInput);
        container.appendChild(valueDisplay);
        break;
      }
      case 'rating': {
        const ratingContainer = document.createElement('div');
        ratingContainer.className = 'flex gap-2 justify-center';
        ratingContainer.style.margin = '1rem 0';
        const scale = question.scale || 5;
        for (let i = 1; i <= scale; i++) {
          const star = document.createElement('button');
          star.type = 'button';
          star.textContent = '⭐';
          star.style.fontSize = '1.5rem';
          star.style.background = 'none';
          star.style.border = 'none';
          star.style.cursor = 'pointer';
          star.style.opacity = '0.3';
          star.dataset.rating = i;
          star.addEventListener('click', () => {
            ratingContainer.querySelectorAll('button').forEach((btn, idx) => { btn.style.opacity = idx < i ? '1' : '0.3'; });
            const hiddenInput = container.querySelector('input[type="hidden"]');
            hiddenInput.value = i;
            this.updateResponseProgress();
          });
          ratingContainer.appendChild(star);
        }
        const hiddenInput = document.createElement('input');
        hiddenInput.type = 'hidden';
        hiddenInput.name = `q_${index}`;
        hiddenInput.required = question.required;
        container.appendChild(ratingContainer);
        container.appendChild(hiddenInput);
        break;
      }
    }
    return container;
  }
  updateResponseProgress() {
    if (!currentSurvey) return;
    const form = $('surveyForm');
    const formData = new FormData(form);
    let answeredCount = 0;
    currentSurvey.questions.forEach((question, index) => {
      const value = formData.get(`q_${index}`);
      if (value && value.toString().trim()) {
        answeredCount++;
      } else if (question.type === 'checkbox') {
        const checkboxes = form.querySelectorAll(`input[name="q_${index}"]:checked`);
        if (checkboxes.length > 0) answeredCount++;
      }
    });
    const progress = (answeredCount / currentSurvey.questions.length) * 100;
    const bar = $('responseProgress');
    if (bar) bar.style.width = progress + '%';
  }
  collectFormData() {
    const form = $('surveyForm');
    const formData = new FormData(form);
    const payload = {};
    currentSurvey.questions.forEach((question, index) => {
      const name = `q_${index}`;
      if (question.type === 'checkbox') {
        const checkboxes = form.querySelectorAll(`input[name="${name}"]:checked`);
        payload[name] = Array.from(checkboxes).map(cb => cb.value);
      } else {
        payload[name] = formData.get(name) || '';
      }
      if (question.required) {
        const value = payload[name];
        if (!value || (Array.isArray(value) && value.length === 0) || (typeof value === 'string' && !value.trim())) {
          throw new Error(`「${question.text}」は必須項目です。`);
        }
      }
      if (question.validation && payload[name]) {
        if (!question.validation.pattern.test(payload[name])) {
          throw new Error(`「${question.text}」: ${question.validation.message}`);
        }
      }
    });
    return payload;
  }
  submitResponse() {
    if (!currentSurvey) { showNotification('アンケートが設定されていません', 'error'); return; }
    try {
      const responseData = this.collectFormData();
      const completionTime = this.startTime ? Date.now() - this.startTime : 0;
      const response = {
        id: Date.now().toString(),
        surveyId: currentSurvey.id,
        respondentName: $('respondentName').value || '匿名',
        responses: responseData,
        completed: true,
        completionTime: Math.round(completionTime / 1000),
        submittedAt: new Date().toISOString()
      };
      const existing = storage.get(STORAGE.RESPONSES, []);
      existing.push(response);
      storage.set(STORAGE.RESPONSES, existing);
      $('surveyForm').reset();
      $('respondentName').value = '';
      $('responseProgress').style.width = '0%';
      showNotification('回答を送信しました！ご協力ありがとうございました。', 'success');
      setTimeout(() => { switchTab('analytics'); }, 2000);
    } catch (error) {
      showNotification(error.message, 'error');
    }
  }
  saveDraft() {
    if (!currentSurvey) return;
    try {
      const responseData = this.collectFormData();
      const draft = {
        id: Date.now().toString(),
        surveyId: currentSurvey.id,
        respondentName: $('respondentName').value || '匿名',
        responses: responseData,
        completed: false,
        savedAt: new Date().toISOString()
      };
      const drafts = storage.get(STORAGE.DRAFTS, []);
      drafts.push(draft);
      storage.set(STORAGE.DRAFTS, drafts);
      showNotification('下書きを保存しました', 'success');
    } catch (error) {
      showNotification('下書きを保存しました', 'success');
    }
  }
}

// Analytics
class Analytics {
  update() {
    this.updateStats();
    this.renderChart();
    this.renderAnalysis();
  }
  updateStats() {
    const r = storage.get(STORAGE.RESPONSES, []);
    const completed = r.filter(x => x.completed);
    $('totalResponses').textContent = completed.length;
    if (completed.length > 0) {
      const avgTime = completed.reduce((s, x) => s + (x.completionTime || 0), 0) / completed.length;
      $('avgCompletionTime').textContent = Math.round(avgTime / 60) + '分';
    } else {
      $('avgCompletionTime').textContent = '0分';
    }
    const all = r.concat(storage.get(STORAGE.DRAFTS, []));
    const dropoffRate = all.length > 0 ? Math.round(((all.length - completed.length) / all.length) * 100) : 0;
    $('dropoffRate').textContent = dropoffRate + '%';
    const satisfaction = this.calculateSatisfactionScore(completed);
    $('satisfactionScore').textContent = satisfaction.toFixed(1);
  }
  calculateSatisfactionScore(resps) {
    if (!currentSurvey || resps.length === 0) return 0;
    const ratingQuestions = currentSurvey.questions.filter(q => q.type === 'rating');
    if (ratingQuestions.length === 0) return 0;
    let totalScore = 0; let totalCount = 0;
    resps.forEach(r => {
      ratingQuestions.forEach(q => {
        const idx = currentSurvey.questions.indexOf(q);
        const ans = r.responses[`q_${idx}`];
        if (ans) { totalScore += parseInt(ans); totalCount++; }
      });
    });
    return totalCount > 0 ? totalScore / totalCount : 0;
  }
  renderChart() {
    const canvas = $('responseChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const r = storage.get(STORAGE.RESPONSES, []).filter(x => x.completed);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (r.length === 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '16px Inter';
      ctx.textAlign = 'center';
      ctx.fillText('回答データがありません', canvas.width / 2, canvas.height / 2);
      return;
    }
    const daily = this.groupResponsesByDay(r);
    const days = Object.keys(daily).sort();
    const counts = days.map(d => daily[d]);
    const maxCount = Math.max(...counts, 1);
    const barWidth = (canvas.width - 100) / days.length;
    const maxHeight = canvas.height - 100;
    days.forEach((day, i) => {
      const count = counts[i];
      const barHeight = (count / maxCount) * maxHeight;
      const x = 50 + i * barWidth;
      const y = canvas.height - 50 - barHeight;
      const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
      gradient.addColorStop(0, '#6366f1');
      gradient.addColorStop(1, '#8b5cf6');
      ctx.fillStyle = gradient;
      ctx.fillRect(x + 5, y, barWidth - 10, barHeight);
      ctx.fillStyle = '#f1f5f9';
      ctx.font = '12px Inter';
      ctx.textAlign = 'center';
      ctx.fillText(count.toString(), x + barWidth / 2, y - 10);
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(day.slice(-5), x + barWidth / 2, canvas.height - 20);
    });
    ctx.fillStyle = '#f1f5f9';
    ctx.font = '16px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('日別回答数', canvas.width / 2, 30);
  }
  groupResponsesByDay(r) {
    const groups = {};
    r.forEach(resp => {
      const date = new Date(resp.submittedAt).toLocaleDateString('ja-JP');
      groups[date] = (groups[date] || 0) + 1;
    });
    return groups;
  }
  renderAnalysis() {
    const container = $('analysisResults');
    if (!container) return;
    const r = storage.get(STORAGE.RESPONSES, []).filter(x => x.completed);
    if (!currentSurvey || r.length === 0) {
      container.innerHTML = '<p style="color: var(--text-muted);">分析するデータがありません。</p>';
      return;
    }
    let html = '';
    currentSurvey.questions.forEach((question, index) => {
      html += `<div style="margin-bottom: 2rem; padding: 1rem; background: rgba(15, 23, 42, 0.3); border-radius: 12px;">`;
      html += `<h4 style="margin: 0 0 1rem 0; color: var(--text);">${question.text}</h4>`;
      if (question.type === 'radio') {
        const counts = {};
        r.forEach(resp => {
          const answer = resp.responses[`q_${index}`];
          if (answer) counts[answer] = (counts[answer] || 0) + 1;
        });
        Object.entries(counts).forEach(([option, count]) => {
          const percentage = ((count / r.length) * 100).toFixed(1);
          html += `
            <div style="margin: 0.5rem 0;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                <span>${option}</span>
                <span>${count}件 (${percentage}%)</span>
              </div>
              <div style="width: 100%; height: 6px; background: rgba(15, 23, 42, 0.5); border-radius: 3px;">
                <div style="width: ${percentage}%; height: 100%; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 3px;"></div>
              </div>
            </div>`;
        });
      } else if (question.type === 'rating') {
        const ratings = r.map(x => parseInt(x.responses[`q_${index}`]) || 0).filter(v => v > 0);
        if (ratings.length > 0) {
          const avg = ratings.reduce((s, v) => s + v, 0) / ratings.length;
          html += `<p>平均評価: <strong>${avg.toFixed(1)}点</strong> (${ratings.length}件の回答)</p>`;
        }
      }
      html += `</div>`;
    });
    container.innerHTML = html;
  }
}

// Responses table (basic for now)
function renderResponsesTable() {
  const table = $('responsesTable');
  if (!table || !currentSurvey) return;
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');
  thead.innerHTML = '';
  tbody.innerHTML = '';
  const headers = ['回答者', ...currentSurvey.questions.map(q => q.text)];
  const trh = document.createElement('tr');
  headers.forEach(h => { const th = document.createElement('th'); th.textContent = h; trh.appendChild(th); });
  thead.appendChild(trh);
  const r = storage.get(STORAGE.RESPONSES, []);
  r.forEach(row => {
    const tr = document.createElement('tr');
    const cols = [row.respondentName, ...currentSurvey.questions.map((_, i) => {
      const v = row.responses[`q_${i}`];
      return Array.isArray(v) ? v.join(';') : (v ?? '');
    })];
    cols.forEach(c => { const td = document.createElement('td'); td.textContent = c; tr.appendChild(td); });
    tbody.appendChild(tr);
  });
}

// Bootstrap
const designer = new SurveyDesigner();
const responder = new SurveyResponder();
const analytics = new Analytics();
initTabs();
switchTab('designer');
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
    // コンテナ
    const container = createElement("div");

    if (q.type === "single" || q.type === "multi") {
      // グループは label の入れ子を避けて fieldset/legend を使う
      const fs = createElement("fieldset");
      const lg = createElement("legend", { text: q.label + (q.required ? " *" : "") });
      fs.appendChild(lg);
      const inputs = (q.options || []).map((opt) =>
        createElement("label", { class: "inline" }, [
          createElement("input", { type: q.type === "single" ? "radio" : "checkbox", name: `q_${i}`, value: opt }),
          document.createTextNode(opt),
        ])
      );
      inputs.forEach((el) => fs.appendChild(el));
      container.appendChild(fs);
    } else {
      // 単一フィールドは label でOK（入れ子にならない）
      const control = q.type === "textarea"
        ? createElement("textarea", { id: `q_${i}`, placeholder: "回答" })
        : createElement("input", { id: `q_${i}`, placeholder: "回答" });
      const label = createElement("label", {}, [document.createTextNode(q.label + (q.required ? " *" : "")), control]);
      if (q.required) control.setAttribute("required", "true");
      container.appendChild(label);
    }

    answerForm.appendChild(container);
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
  initTabs();
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

// Tabs
function initTabs() {
  const tabs = Array.from(document.querySelectorAll('.tab'));
  const panels = {
    designer: document.getElementById('designer'),
    responder: document.getElementById('responder'),
    responses: document.getElementById('responses'),
  };
  function activate(key){
    tabs.forEach(b => { b.classList.remove('is-active'); b.setAttribute('aria-selected','false'); });
    const current = tabs.find(t=> t.getAttribute('data-tab')===key);
    if(current){ current.classList.add('is-active'); current.setAttribute('aria-selected','true'); }
    Object.entries(panels).forEach(([k, el]) => { if (k === key) el.classList.remove('is-hidden'); else el.classList.add('is-hidden'); });
  }
  tabs.forEach(a => a.addEventListener('click', (e)=>{ const key=a.getAttribute('data-tab'); activate(key); }));
  window.addEventListener('hashchange', ()=>{ const key = location.hash.replace('#','') || 'designer'; activate(key); });
  const initial = location.hash.replace('#','') || 'designer'; activate(initial);
}


