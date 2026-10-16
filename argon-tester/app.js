// Gemini 4 Argon Tester — Application Logic
const STORAGE_KEYS = {
  API_KEY: 'argon_tester_api_key',
  BASE_URL: 'argon_tester_base_url',
  MODEL: 'argon_tester_model',
  MODELS_LIST: 'argon_tester_models_list',
  CHATS: 'argon_tester_chats',
  ACTIVE_CHAT_ID: 'argon_tester_active_chat_id',
  THEME: 'argon_tester_theme',
  SYSTEM_PROMPT: 'argon_tester_sys_prompt',
  TEMP: 'argon_tester_temp',
  STREAM: 'argon_tester_stream',
};

const DEFAULT_BASE_URL = 'https://llm.thelead.io';
const DEFAULT_MODEL = 'gemini-4-argon';

// State
let state = {
  apiKey: localStorage.getItem(STORAGE_KEYS.API_KEY) || '',
  baseUrl: localStorage.getItem(STORAGE_KEYS.BASE_URL) || DEFAULT_BASE_URL,
  model: localStorage.getItem(STORAGE_KEYS.MODEL) || DEFAULT_MODEL,
  models: JSON.parse(localStorage.getItem(STORAGE_KEYS.MODELS_LIST) || 'null') || [
    'gemini-4-argon',
    'gemini-4-argon-medium',
    'gemini-4-argon-high',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
  ],
  chats: JSON.parse(localStorage.getItem(STORAGE_KEYS.CHATS) || '[]'),
  activeChatId: localStorage.getItem(STORAGE_KEYS.ACTIVE_CHAT_ID) || null,
  theme: localStorage.getItem(STORAGE_KEYS.THEME) || 'dark',
  systemPrompt: localStorage.getItem(STORAGE_KEYS.SYSTEM_PROMPT) || '',
  temperature: parseFloat(localStorage.getItem(STORAGE_KEYS.TEMP) ?? '0.7'),
  stream: localStorage.getItem(STORAGE_KEYS.STREAM) !== 'false',
  attachments: [], // { name, type, dataUrl, textContent, isImage }
  abortController: null,
  isGenerating: false,
};

// DOM Elements
const els = {
  sidebar: document.getElementById('sidebar'),
  sidebarToggleBtn: document.getElementById('sidebarToggleBtn'),
  mobileMenuBtn: document.getElementById('mobileMenuBtn'),
  newChatBtn: document.getElementById('newChatBtn'),
  chatHistoryList: document.getElementById('chatHistoryList'),
  baseUrlInput: document.getElementById('baseUrlInput'),
  customModelInput: document.getElementById('customModelInput'),
  modelSuggestions: document.getElementById('modelSuggestions'),
  modelSelectDropdown: document.getElementById('modelSelectDropdown'),
  fetchModelsBtn: document.getElementById('fetchModelsBtn'),
  tempInput: document.getElementById('tempInput'),
  tempVal: document.getElementById('tempVal'),
  streamToggle: document.getElementById('streamToggle'),
  systemPromptInput: document.getElementById('systemPromptInput'),
  clearChatsBtn: document.getElementById('clearChatsBtn'),
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  themeLabel: document.getElementById('themeLabel'),
  endpointBadge: document.getElementById('endpointBadge'),
  apiKeyBar: document.getElementById('apiKeyBar'),
  apiKeyStatusDot: document.getElementById('apiKeyStatusDot'),
  apiKeyInput: document.getElementById('apiKeyInput'),
  toggleKeyVisibilityBtn: document.getElementById('toggleKeyVisibilityBtn'),
  testConnectionBtn: document.getElementById('testConnectionBtn'),
  chatViewport: document.getElementById('chatViewport'),
  welcomeScreen: document.getElementById('welcomeScreen'),
  messagesContainer: document.getElementById('messagesContainer'),
  attachmentsPreview: document.getElementById('attachmentsPreview'),
  promptInput: document.getElementById('promptInput'),
  fileInput: document.getElementById('fileInput'),
  attachBtn: document.getElementById('attachBtn'),
  activeModelChip: document.getElementById('activeModelChip'),
  stopBtn: document.getElementById('stopBtn'),
  sendBtn: document.getElementById('sendBtn'),
  toastContainer: document.getElementById('toastContainer'),
};

// Configure Marked with Highlight.js and custom code blocks
function configureMarkdown() {
  const renderer = new marked.Renderer();
  renderer.code = function (code, infostring) {
    // Handle Marked v12 object or string signature
    let rawCode = typeof code === 'object' ? code.text : code;
    let lang = (typeof code === 'object' ? code.lang : infostring) || 'plaintext';
    lang = lang.trim().split(/\s+/)[0] || 'plaintext';

    let highlighted = '';
    try {
      if (hljs.getLanguage(lang)) {
        highlighted = hljs.highlight(rawCode, { language: lang }).value;
      } else {
        highlighted = hljs.highlightAuto(rawCode).value;
      }
    } catch {
      highlighted = escapeHtml(rawCode);
    }

    const encoded = encodeURIComponent(rawCode);
    return `
      <div class="code-block-wrapper">
        <div class="code-block-header">
          <span>${escapeHtml(lang)}</span>
          <button class="copy-code-btn" onclick="copyCodeBlock(this, '${encoded}')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span>Copy code</span>
          </button>
        </div>
        <pre><code class="hljs language-${escapeHtml(lang)}">${highlighted}</code></pre>
      </div>
    `;
  };

  marked.setOptions({
    renderer,
    gfm: true,
    breaks: true,
  });
}

window.copyCodeBlock = function (btn, encodedCode) {
  const decoded = decodeURIComponent(encodedCode);
  navigator.clipboard.writeText(decoded).then(() => {
    const span = btn.querySelector('span');
    const prev = span.textContent;
    span.textContent = 'Copied!';
    setTimeout(() => (span.textContent = prev), 1800);
  });
};

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showToast(msg, duration = 3000) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  els.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

// Gemini Sparkle SVG helper
function getSparkleSvg(size = 26) {
  const uid = Math.random().toString(36).slice(2, 7);
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 32 32" fill="none">
      <path d="M16 0C16 8.83656 8.83656 16 0 16C8.83656 16 16 23.1634 16 32C16 23.1634 23.1634 16 32 16C23.1634 16 16 8.83656 16 0Z" fill="url(#g-${uid})"/>
      <defs>
        <linearGradient id="g-${uid}" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#4285F4"/>
          <stop offset="50%" stop-color="#9B72CB"/>
          <stop offset="100%" stop-color="#D96570"/>
        </linearGradient>
      </defs>
    </svg>
  `;
}

// Normalize Base URL
function getCleanBaseUrl() {
  let url = (state.baseUrl || DEFAULT_BASE_URL).trim().replace(/\/+$/, '');
  if (url.endsWith('/v1')) {
    url = url.slice(0, -3);
  }
  return url;
}

function updateEndpointBadge() {
  try {
    const u = new URL(getCleanBaseUrl());
    els.endpointBadge.textContent = u.host;
  } catch {
    els.endpointBadge.textContent = state.baseUrl;
  }
}

// Sync Model UI
function syncModelOutputs() {
  els.customModelInput.value = state.model;
  els.activeModelChip.textContent = state.model;

  // Populate datalist and header dropdown
  const uniqueModels = Array.from(new Set([state.model, ...state.models]));
  els.modelSuggestions.innerHTML = uniqueModels
    .map((m) => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`)
    .join('');

  els.modelSelectDropdown.innerHTML = uniqueModels
    .map(
      (m) =>
        `<option value="${escapeHtml(m)}" ${m === state.model ? 'selected' : ''}>${escapeHtml(m)}</option>`
    )
    .join('');
}

function setModel(newModel) {
  const clean = newModel.trim();
  if (!clean) return;
  state.model = clean;
  localStorage.setItem(STORAGE_KEYS.MODEL, clean);
  syncModelOutputs();
}

// Fetch Models from https://llm.thelead.io/v1/models
async function fetchModelsFromServer(silent = false) {
  const key = state.apiKey.trim();
  if (!key) {
    if (!silent) {
      highlightMissingApiKey();
      showToast('Please enter your API key first.');
    }
    return;
  }

  const base = getCleanBaseUrl();
  els.testConnectionBtn.textContent = 'Connecting...';
  els.fetchModelsBtn.textContent = '...';

  try {
    const res = await fetch(`${base}/v1/models`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${key}`,
        'x-api-key': key,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errText.slice(0, 140)}`);
    }

    const data = await res.json();
    const list = Array.isArray(data?.data)
      ? data.data.map((item) => item.id).filter(Boolean)
      : [];

    if (list.length > 0) {
      // Sort models so argon & gemini appear at the top
      list.sort((a, b) => {
        const aArgon = /argon/i.test(a) ? -2 : /gemini/i.test(a) ? -1 : 0;
        const bArgon = /argon/i.test(b) ? -2 : /gemini/i.test(b) ? -1 : 0;
        if (aArgon !== bArgon) return aArgon - bArgon;
        return a.localeCompare(b);
      });

      state.models = list;
      localStorage.setItem(STORAGE_KEYS.MODELS_LIST, JSON.stringify(list));

      // Auto-select an Argon model if current model isn't in list and an Argon model exists
      const argonMatch = list.find((m) => /argon/i.test(m));
      if (argonMatch && !list.includes(state.model)) {
        state.model = argonMatch;
        localStorage.setItem(STORAGE_KEYS.MODEL, state.model);
      }
      syncModelOutputs();
    }

    els.apiKeyStatusDot.className = 'api-key-status-dot connected';
    els.testConnectionBtn.textContent = 'Connected';
    if (!silent) {
      showToast(`Connected to ${base}! Found ${list.length || 'default'} models.`);
    }
  } catch (err) {
    els.apiKeyStatusDot.className = 'api-key-status-dot error';
    els.testConnectionBtn.textContent = 'Retry';
    if (!silent) {
      showToast(`Connection check failed: ${err.message}`);
    }
  } finally {
    els.fetchModelsBtn.textContent = 'Sync';
  }
}

function highlightMissingApiKey() {
  els.apiKeyBar.classList.remove('missing-highlight');
  void els.apiKeyBar.offsetWidth; // trigger reflow
  els.apiKeyBar.classList.add('missing-highlight');
  els.apiKeyInput.focus();
}

// Theme Management
function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEYS.THEME, theme);
  els.themeLabel.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
}

// Chat Management
function getActiveChat() {
  return state.chats.find((c) => c.id === state.activeChatId) || null;
}

function saveChats() {
  localStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(state.chats));
  if (state.activeChatId) {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_CHAT_ID, state.activeChatId);
  } else {
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_CHAT_ID);
  }
}

function createNewChat() {
  if (state.isGenerating && state.abortController) {
    state.abortController.abort();
  }
  state.activeChatId = null;
  saveChats();
  renderSidebarChats();
  renderConversation();
  els.promptInput.focus();
}

function deleteChat(chatId, event) {
  event.stopPropagation();
  state.chats = state.chats.filter((c) => c.id !== chatId);
  if (state.activeChatId === chatId) {
    state.activeChatId = state.chats[0]?.id || null;
  }
  saveChats();
  renderSidebarChats();
  renderConversation();
}

function renderSidebarChats() {
  if (state.chats.length === 0) {
    els.chatHistoryList.innerHTML = `<div style="padding: 8px 12px; font-size: 12.5px; color: var(--text-muted);" class="sidebar-label">No recent chats</div>`;
    return;
  }

  els.chatHistoryList.innerHTML = state.chats
    .map(
      (chat) => `
      <div class="chat-history-item ${chat.id === state.activeChatId ? 'active' : ''}" data-id="${chat.id}">
        <span class="chat-history-title sidebar-label">${escapeHtml(chat.title || 'New chat')}</span>
        <button class="delete-chat-btn sidebar-label" data-delete-id="${chat.id}" title="Delete chat">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `
    )
    .join('');

  els.chatHistoryList.querySelectorAll('.chat-history-item').forEach((item) => {
    item.addEventListener('click', () => {
      state.activeChatId = item.dataset.id;
      saveChats();
      renderSidebarChats();
      renderConversation();
    });
  });

  els.chatHistoryList.querySelectorAll('.delete-chat-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => deleteChat(btn.dataset.deleteId, e));
  });
}

// Parse <think>...</think> blocks if model emits inline thinking tags
function splitThinkTags(rawContent = '', explicitReasoning = '') {
  let reasoning = explicitReasoning || '';
  let content = rawContent || '';

  const thinkMatch = content.match(/^<think>([\s\S]*?)(?:<\/think>|$)/i);
  if (thinkMatch) {
    const extracted = thinkMatch[1].trim();
    if (extracted) {
      reasoning = reasoning ? `${reasoning}\n${extracted}` : extracted;
    }
    if (content.includes('</think>')) {
      content = content.replace(/^<think>[\s\S]*?<\/think>\s*/i, '');
    } else {
      content = '';
    }
  }
  return { reasoning, content };
}

function renderAssistantInnerHtml(msg, isStreamingThis = false) {
  const { reasoning, content } = splitThinkTags(msg.content, msg.reasoning);

  let thinkingHtml = '';
  if (reasoning) {
    thinkingHtml = `
      <details class="thinking-details" ${isStreamingThis && !content ? 'open' : ''}>
        <summary>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <span>${isStreamingThis && !content ? 'Thinking...' : 'Show thinking process'}</span>
        </summary>
        <div class="thinking-content">${escapeHtml(reasoning)}</div>
      </details>
    `;
  }

  const bodyHtml = content
    ? `<div class="markdown-content">${marked.parse(content)}</div>`
    : isStreamingThis && !reasoning
    ? `<div class="markdown-content" style="color: var(--text-muted);">Thinking...</div>`
    : '';

  const errorHtml = msg.error
    ? `<div class="error-banner"><strong>API Error:</strong> ${escapeHtml(msg.error)}</div>`
    : '';

  let metricsHtml = '';
  if (msg.metrics) {
    const m = msg.metrics;
    const pills = [];
    if (m.model) pills.push(`<span class="metric-pill">${escapeHtml(m.model)}</span>`);
    if (m.ttftMs) pills.push(`<span class="metric-pill" title="Time to first token">TTFT: ${m.ttftMs}ms</span>`);
    if (m.totalSec) pills.push(`<span class="metric-pill">Time: ${m.totalSec}s</span>`);
    if (m.tps) pills.push(`<span class="metric-pill">${m.tps} tok/s</span>`);
    if (m.totalTokens) pills.push(`<span class="metric-pill">${m.totalTokens} tokens</span>`);
    metricsHtml = `<div class="metrics-pills">${pills.join('')}</div>`;
  }

  return `
    ${thinkingHtml}
    ${bodyHtml}
    ${errorHtml}
    ${
      !isStreamingThis
        ? `
      <div class="assistant-footer">
        <div class="message-actions">
          <button class="msg-action-btn copy-msg-btn" title="Copy response" data-msg-id="${msg.id}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
          <button class="msg-action-btn regen-msg-btn" title="Regenerate response" data-msg-id="${msg.id}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"></polyline>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
          </button>
        </div>
        ${metricsHtml}
      </div>
    `
        : ''
    }
  `;
}

function renderConversation() {
  const chat = getActiveChat();
  if (!chat || chat.messages.length === 0) {
    els.welcomeScreen.hidden = false;
    els.messagesContainer.innerHTML = '';
    return;
  }

  els.welcomeScreen.hidden = true;
  els.messagesContainer.innerHTML = chat.messages
    .map((msg) => {
      if (msg.role === 'user') {
        const attHtml =
          Array.isArray(msg.attachments) && msg.attachments.length > 0
            ? `<div class="user-attachments">
                ${msg.attachments
                  .map((att) =>
                    att.isImage
                      ? `<img src="${att.dataUrl}" class="user-attachment-thumb" alt="${escapeHtml(att.name)}" />`
                      : `<span class="user-file-badge">📄 ${escapeHtml(att.name)}</span>`
                  )
                  .join('')}
              </div>`
            : '';

        return `
          <div class="message-row user" data-row-id="${msg.id}">
            ${attHtml}
            <div class="user-bubble">${escapeHtml(msg.content)}</div>
          </div>
        `;
      } else {
        return `
          <div class="message-row assistant" data-row-id="${msg.id}">
            <div class="assistant-wrapper">
              <div class="gemini-avatar" id="avatar-${msg.id}">
                ${getSparkleSvg(28)}
              </div>
              <div class="assistant-body" id="body-${msg.id}">
                ${renderAssistantInnerHtml(msg, false)}
              </div>
            </div>
          </div>
        `;
      }
    })
    .join('');

  bindMessageActionButtons();
  scrollToBottom();
}

function bindMessageActionButtons() {
  const chat = getActiveChat();
  if (!chat) return;

  els.messagesContainer.querySelectorAll('.copy-msg-btn').forEach((btn) => {
    btn.onclick = () => {
      const msg = chat.messages.find((m) => m.id === btn.dataset.msgId);
      if (msg) {
        navigator.clipboard.writeText(msg.content || '');
        showToast('Response copied to clipboard');
      }
    };
  });

  els.messagesContainer.querySelectorAll('.regen-msg-btn').forEach((btn) => {
    btn.onclick = () => {
      if (state.isGenerating) return;
      const idx = chat.messages.findIndex((m) => m.id === btn.dataset.msgId);
      if (idx !== -1) {
        chat.messages = chat.messages.slice(0, idx);
        saveChats();
        renderConversation();
        triggerAssistantCompletion(chat);
      }
    };
  });
}

function scrollToBottom() {
  els.chatViewport.scrollTop = els.chatViewport.scrollHeight;
}

// File & Image Attachments
function renderAttachmentsPreview() {
  if (state.attachments.length === 0) {
    els.attachmentsPreview.hidden = true;
    els.attachmentsPreview.innerHTML = '';
    return;
  }

  els.attachmentsPreview.hidden = false;
  els.attachmentsPreview.innerHTML = state.attachments
    .map(
      (att, idx) => `
      <div class="attachment-chip">
        ${att.isImage ? `<img src="${att.dataUrl}" alt="${escapeHtml(att.name)}" />` : '<span>📄</span>'}
        <span>${escapeHtml(att.name)}</span>
        <button class="remove-attachment-btn" data-idx="${idx}" title="Remove">&times;</button>
      </div>
    `
    )
    .join('');

  els.attachmentsPreview.querySelectorAll('.remove-attachment-btn').forEach((btn) => {
    btn.onclick = () => {
      state.attachments.splice(Number(btn.dataset.idx), 1);
      renderAttachmentsPreview();
      updateSendButtonState();
    };
  });
}

function handleFilesSelected(fileList) {
  Array.from(fileList).forEach((file) => {
    const isImage = file.type.startsWith('image/');
    const reader = new FileReader();
    if (isImage) {
      reader.onload = () => {
        state.attachments.push({
          name: file.name,
          type: file.type,
          dataUrl: reader.result,
          isImage: true,
        });
        renderAttachmentsPreview();
        updateSendButtonState();
      };
      reader.readAsDataURL(file);
    } else {
      reader.onload = () => {
        state.attachments.push({
          name: file.name,
          type: file.type || 'text/plain',
          textContent: reader.result,
          isImage: false,
        });
        renderAttachmentsPreview();
        updateSendButtonState();
      };
      reader.readAsText(file);
    }
  });
}

// Build OpenAI-compatible payload messages for https://llm.thelead.io/v1/chat/completions
function buildApiMessages(chat) {
  const apiMessages = [];
  if (state.systemPrompt.trim()) {
    apiMessages.push({
      role: 'system',
      content: state.systemPrompt.trim(),
    });
  }

  for (const m of chat.messages) {
    if (m.role === 'user') {
      const hasImages = Array.isArray(m.attachments) && m.attachments.some((a) => a.isImage);
      const textAttachments = Array.isArray(m.attachments)
        ? m.attachments.filter((a) => !a.isImage)
        : [];

      let combinedText = m.content || '';
      if (textAttachments.length > 0) {
        const filesBlock = textAttachments
          .map((f) => `\n\n--- File: ${f.name} ---\n${f.textContent}`)
          .join('');
        combinedText += filesBlock;
      }

      if (hasImages) {
        const contentParts = [];
        if (combinedText) {
          contentParts.push({ type: 'text', text: combinedText });
        }
        m.attachments
          .filter((a) => a.isImage)
          .forEach((img) => {
            contentParts.push({
              type: 'image_url',
              image_url: { url: img.dataUrl },
            });
          });
        apiMessages.push({ role: 'user', content: contentParts });
      } else {
        apiMessages.push({ role: 'user', content: combinedText });
      }
    } else if (m.role === 'assistant' && m.content) {
      apiMessages.push({ role: 'assistant', content: m.content });
    }
  }

  return apiMessages;
}

// Send Prompt & Stream Response
async function handleSendPrompt(overrideText = null) {
  if (state.isGenerating) return;

  const text = (overrideText !== null ? overrideText : els.promptInput.value).trim();
  if (!text && state.attachments.length === 0) return;

  if (!state.apiKey.trim()) {
    highlightMissingApiKey();
    showToast('Please enter your API key in the top bar first.');
    return;
  }

  let chat = getActiveChat();
  if (!chat) {
    chat = {
      id: 'chat_' + Date.now(),
      title: (text || 'Attachment prompt').slice(0, 42),
      createdAt: Date.now(),
      messages: [],
    };
    state.chats.unshift(chat);
    state.activeChatId = chat.id;
  }

  const userMsg = {
    id: 'msg_' + Date.now(),
    role: 'user',
    content: text,
    attachments: [...state.attachments],
  };

  chat.messages.push(userMsg);
  state.attachments = [];
  els.promptInput.value = '';
  els.promptInput.style.height = 'auto';
  renderAttachmentsPreview();
  updateSendButtonState();
  saveChats();
  renderSidebarChats();
  renderConversation();

  await triggerAssistantCompletion(chat);
}

async function triggerAssistantCompletion(chat) {
  const assistantMsg = {
    id: 'msg_' + (Date.now() + 1),
    role: 'assistant',
    content: '',
    reasoning: '',
    metrics: { model: state.model },
  };

  chat.messages.push(assistantMsg);
  renderConversation();

  const avatarEl = document.getElementById(`avatar-${assistantMsg.id}`);
  const bodyEl = document.getElementById(`body-${assistantMsg.id}`);
  if (avatarEl) avatarEl.classList.add('spinning');
  if (bodyEl) bodyEl.innerHTML = renderAssistantInnerHtml(assistantMsg, true);

  state.isGenerating = true;
  state.abortController = new AbortController();
  els.stopBtn.hidden = false;
  els.sendBtn.hidden = true;

  const startTime = performance.now();
  let firstTokenTime = null;
  let usageTokens = null;

  const base = getCleanBaseUrl();
  const endpoint = `${base}/v1/chat/completions`;
  const payload = {
    model: state.model,
    messages: buildApiMessages({
      messages: chat.messages.slice(0, -1),
    }),
    temperature: state.temperature,
    stream: state.stream,
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.apiKey.trim()}`,
        'x-api-key': state.apiKey.trim(),
      },
      body: JSON.stringify(payload),
      signal: state.abortController.signal,
    });

    if (!response.ok) {
      let errMsg = `HTTP ${response.status}`;
      try {
        const errJson = await response.json();
        errMsg = errJson?.error?.message || JSON.stringify(errJson);
      } catch {
        const txt = await response.text();
        if (txt) errMsg = txt;
      }
      throw new Error(errMsg);
    }

    els.apiKeyStatusDot.className = 'api-key-status-dot connected';

    if (state.stream && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line || !line.startsWith('data:')) continue;
          const dataStr = line.slice(5).trim();
          if (dataStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.model) assistantMsg.metrics.model = parsed.model;
            if (parsed.usage?.total_tokens) {
              usageTokens = parsed.usage.total_tokens;
            }
            const delta = parsed.choices?.[0]?.delta;
            if (delta) {
              if (!firstTokenTime && (delta.content || delta.reasoning_content || delta.reasoning)) {
                firstTokenTime = performance.now();
              }
              if (delta.reasoning_content || delta.reasoning) {
                assistantMsg.reasoning += delta.reasoning_content || delta.reasoning;
              }
              if (delta.content) {
                assistantMsg.content += delta.content;
              }
              if (bodyEl) {
                bodyEl.innerHTML = renderAssistantInnerHtml(assistantMsg, true);
              }
              scrollToBottom();
            }
          } catch {
            // ignore partial JSON chunks
          }
        }
      }
    } else {
      const data = await response.json();
      firstTokenTime = performance.now();
      const choice = data.choices?.[0]?.message;
      assistantMsg.content = choice?.content || '';
      assistantMsg.reasoning = choice?.reasoning_content || choice?.reasoning || '';
      if (data.model) assistantMsg.metrics.model = data.model;
      if (data.usage?.total_tokens) usageTokens = data.usage.total_tokens;
    }

    const endTime = performance.now();
    const totalSec = ((endTime - startTime) / 1000).toFixed(2);
    const ttftMs = firstTokenTime ? Math.round(firstTokenTime - startTime) : null;
    const approxCompletionTokens = Math.max(
      1,
      Math.round((assistantMsg.content.length + assistantMsg.reasoning.length) / 4)
    );
    const genDurationSec = Math.max(0.1, (endTime - (firstTokenTime || startTime)) / 1000);
    const tps = (approxCompletionTokens / genDurationSec).toFixed(1);

    assistantMsg.metrics = {
      model: assistantMsg.metrics.model || state.model,
      ttftMs,
      totalSec,
      tps,
      totalTokens: usageTokens || approxCompletionTokens,
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      assistantMsg.content += '\n\n*(Generation stopped)*';
    } else {
      assistantMsg.error = err.message;
      els.apiKeyStatusDot.className = 'api-key-status-dot error';
    }
  } finally {
    state.isGenerating = false;
    state.abortController = null;
    els.stopBtn.hidden = true;
    els.sendBtn.hidden = false;
    if (avatarEl) avatarEl.classList.remove('spinning');
    if (bodyEl) bodyEl.innerHTML = renderAssistantInnerHtml(assistantMsg, false);
    bindMessageActionButtons();
    saveChats();
    scrollToBottom();
  }
}

function updateSendButtonState() {
  const hasText = els.promptInput.value.trim().length > 0;
  const hasFiles = state.attachments.length > 0;
  els.sendBtn.disabled = !(hasText || hasFiles);
}

// Initialize App & Event Listeners
function init() {
  configureMarkdown();
  applyTheme(state.theme);

  // Populate initial UI inputs
  els.apiKeyInput.value = state.apiKey;
  els.baseUrlInput.value = state.baseUrl;
  els.tempInput.value = state.temperature;
  els.tempVal.textContent = state.temperature;
  els.streamToggle.checked = state.stream;
  els.systemPromptInput.value = state.systemPrompt;

  if (state.apiKey) {
    els.apiKeyStatusDot.className = 'api-key-status-dot connected';
  }

  updateEndpointBadge();
  syncModelOutputs();
  renderSidebarChats();
  renderConversation();

  // Sidebar collapse
  els.sidebarToggleBtn.addEventListener('click', () => {
    els.sidebar.classList.toggle('collapsed');
  });

  els.mobileMenuBtn.addEventListener('click', () => {
    els.sidebar.classList.toggle('mobile-open');
  });

  els.newChatBtn.addEventListener('click', createNewChat);

  // API Key Input
  els.apiKeyInput.addEventListener('input', (e) => {
    state.apiKey = e.target.value;
    localStorage.setItem(STORAGE_KEYS.API_KEY, state.apiKey);
    els.apiKeyBar.classList.remove('missing-highlight');
    els.apiKeyStatusDot.className = state.apiKey.trim()
      ? 'api-key-status-dot connected'
      : 'api-key-status-dot';
  });

  els.apiKeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      fetchModelsFromServer(false);
    }
  });

  els.toggleKeyVisibilityBtn.addEventListener('click', () => {
    const isPwd = els.apiKeyInput.type === 'password';
    els.apiKeyInput.type = isPwd ? 'text' : 'password';
  });

  els.testConnectionBtn.addEventListener('click', () => fetchModelsFromServer(false));
  els.fetchModelsBtn.addEventListener('click', () => fetchModelsFromServer(false));

  // Base URL & Model
  els.baseUrlInput.addEventListener('input', (e) => {
    state.baseUrl = e.target.value;
    localStorage.setItem(STORAGE_KEYS.BASE_URL, state.baseUrl);
    updateEndpointBadge();
  });

  els.customModelInput.addEventListener('change', (e) => setModel(e.target.value));
  els.customModelInput.addEventListener('input', (e) => {
    state.model = e.target.value.trim() || DEFAULT_MODEL;
    localStorage.setItem(STORAGE_KEYS.MODEL, state.model);
    els.activeModelChip.textContent = state.model;
  });

  els.modelSelectDropdown.addEventListener('change', (e) => setModel(e.target.value));

  // Temperature, Stream, System Prompt
  els.tempInput.addEventListener('input', (e) => {
    state.temperature = parseFloat(e.target.value);
    els.tempVal.textContent = state.temperature;
    localStorage.setItem(STORAGE_KEYS.TEMP, state.temperature);
  });

  els.streamToggle.addEventListener('change', (e) => {
    state.stream = e.target.checked;
    localStorage.setItem(STORAGE_KEYS.STREAM, state.stream);
  });

  els.systemPromptInput.addEventListener('input', (e) => {
    state.systemPrompt = e.target.value;
    localStorage.setItem(STORAGE_KEYS.SYSTEM_PROMPT, state.systemPrompt);
  });

  // Clear Chats & Theme
  els.clearChatsBtn.addEventListener('click', () => {
    state.chats = [];
    state.activeChatId = null;
    saveChats();
    renderSidebarChats();
    renderConversation();
    showToast('All chat history cleared');
  });

  els.themeToggleBtn.addEventListener('click', () => {
    applyTheme(state.theme === 'dark' ? 'light' : 'dark');
  });

  // Suggestion Cards
  document.querySelectorAll('.suggestion-card').forEach((card) => {
    card.addEventListener('click', () => {
      const prompt = card.dataset.prompt;
      if (prompt) handleSendPrompt(prompt);
    });
  });

  // Composer Auto-resize & Enter to send
  els.promptInput.addEventListener('input', () => {
    els.promptInput.style.height = 'auto';
    els.promptInput.style.height = Math.min(els.promptInput.scrollHeight, 200) + 'px';
    updateSendButtonState();
  });

  els.promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendPrompt();
    }
  });

  els.sendBtn.addEventListener('click', () => handleSendPrompt());
  els.stopBtn.addEventListener('click', () => {
    if (state.abortController) state.abortController.abort();
  });

  // File Attachments
  els.attachBtn.addEventListener('click', () => els.fileInput.click());
  els.fileInput.addEventListener('change', (e) => {
    if (e.target.files?.length) {
      handleFilesSelected(e.target.files);
      e.target.value = '';
    }
  });

  // Auto-sync models silently if API key already exists
  if (state.apiKey.trim()) {
    fetchModelsFromServer(true);
  }
}

document.addEventListener('DOMContentLoaded', init);
