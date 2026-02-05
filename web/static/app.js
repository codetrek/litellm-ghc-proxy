const state = {
  keys: [],
};

const els = {
  stats: document.getElementById('stats'),
  grid: document.getElementById('keysGrid'),
  search: document.getElementById('searchInput'),
  refresh: document.getElementById('refreshBtn'),
  createBtn: document.getElementById('createKeyBtn'),
  drawer: document.getElementById('drawer'),
  drawerBody: document.getElementById('drawerBody'),
  drawerClose: document.getElementById('drawerClose'),
  modal: document.getElementById('modal'),
  modalClose: document.getElementById('modalClose'),
  modalForm: document.getElementById('modalForm'),
  toast: document.getElementById('toast'),
  modelList: document.getElementById('modelList'),
  modelDisplay: document.getElementById('modelDisplay'),
  modelToggle: document.getElementById('modelToggle'),
  modelPanel: document.getElementById('modelPanel'),
  modelFilter: document.getElementById('modelFilter'),
  modelClear: document.getElementById('modelClear'),
  modelSelectAll: document.getElementById('modelSelectAll'),
  moreToggle: document.getElementById('moreToggle'),
  morePanel: document.getElementById('morePanel'),
};

const show = (el) => el && el.classList.remove('hidden');
const hide = (el) => el && el.classList.add('hidden');

const toast = (msg) => {
  els.toast.textContent = msg;
  show(els.toast);
  setTimeout(() => hide(els.toast), 2400);
};

const fetchJSON = async (url, options = {}) => {
  const res = await fetch(url, options);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || data?.message || 'Request failed');
  }
  return res.json();
};

const maskKey = (value) => {
  if (!value) return '—';
  const str = String(value);
  if (str.length <= 8) return `${str.slice(0, 2)}****${str.slice(-2)}`;
  return `${str.slice(0, 4)}****${str.slice(-4)}`;
};

const extractRealKey = (payload) => {
  if (!payload || typeof payload !== 'object') return null;
  return payload.__real_key || null;
};

const requireCopyGate = () => {
  const confirmCheckbox = document.getElementById('confirmCopied');
  const closeButtons = document.querySelectorAll('[data-require-copy-close]');
  if (!confirmCheckbox) return;
  const toggle = () => {
    const disabled = !confirmCheckbox.checked;
    closeButtons.forEach((btn) => {
      btn.disabled = disabled;
      btn.classList.toggle('opacity-60', disabled);
      btn.classList.toggle('cursor-not-allowed', disabled);
    });
  };
  confirmCheckbox.addEventListener('change', toggle);
  toggle();
};

const normalizeKeys = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload?.keys) return payload.keys;
  if (payload?.data) return payload.data;
  return [];
};

const stateModels = {
  list: [],
  selected: new Set(),
};

const updateModelDisplay = () => {
  if (!els.modelDisplay) return;
  const selected = Array.from(stateModels.selected);
  const total = stateModels.list.length;
  if (total > 0 && selected.length === total) {
    els.modelDisplay.value = `All models (${total})`;
    return;
  }
  if (selected.length > 5) {
    const head = selected.slice(0, 5).join(', ');
    els.modelDisplay.value = `${head} +${selected.length - 5}`;
    return;
  }
  els.modelDisplay.value = selected.join(', ');
};

const renderModels = () => {
  const query = (els.modelFilter?.value || '').toLowerCase();
  const filtered = stateModels.list
    .slice()
    .sort((a, b) => {
      const group = (name) => {
        const lower = name.toLowerCase();
        if (lower.startsWith('gpt-')) return 0;
        if (lower.startsWith('claude-')) return 1;
        if (lower.startsWith('gemini-')) return 2;
        return 3;
      };
      const ga = group(a);
      const gb = group(b);
      if (ga !== gb) return ga - gb;
      return a.localeCompare(b);
    })
    .filter((name, idx, arr) => arr.indexOf(name) === idx)
    .filter((m) => m.toLowerCase().includes(query));
  els.modelList.innerHTML = filtered
    .map(
      (name) => `
      <label class="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs text-slate-200">
        <input type="checkbox" name="model_checkbox" value="${name}" ${stateModels.selected.has(name) ? 'checked' : ''} class="h-4 w-4 accent-amber-400" />
        <span class="truncate">${name}</span>
      </label>
    `
    )
    .join('');
  updateModelDisplay();
};

const loadModels = async () => {
  try {
    const data = await fetchJSON('/api/models');
    stateModels.list = data.models || [];
    stateModels.selected = new Set();  // 默认不选，让用户主动选择
    renderModels();
  } catch (err) {
    toast(err.message || 'Failed to load models');
  }
};

const renderStats = () => {
  const total = state.keys.length;
  const infoItems = state.keys.map((k) => k?.info).filter(Boolean);
  const blocked = infoItems.length ? infoItems.filter((k) => k?.blocked).length : '—';
  const service = infoItems.length ? infoItems.filter((k) => k?.is_service_account).length : '—';
  const recent = infoItems
    .map((k) => k?.created_at)
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => b - a)[0];

  const items = [
    { label: 'Total Keys', value: total },
    { label: 'Blocked', value: blocked },
    { label: 'Service Accounts', value: service },
    { label: 'Latest Created', value: recent ? recent.toLocaleString() : '—' },
  ];

  els.stats.innerHTML = items
    .map(
      (item) => `
      <div class="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <h3 class="text-xs uppercase tracking-wider text-slate-400">${item.label}</h3>
        <p class="mt-2 text-xl font-semibold">${item.value}</p>
      </div>
    `
    )
    .join('');
  updateModelDisplay();
};

const renderKeys = () => {
  const query = (els.search.value || '').toLowerCase();
  const filtered = state.keys.filter((key) => {
    if (typeof key === 'string') {
      return key.toLowerCase().includes(query);
    }
    const info = key?.info || key;
    const text = [key?.key, info?.key_alias, info?.user_id, info?.team_id, info?.key_name]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return text.includes(query);
  });

  els.grid.innerHTML = filtered
    .map((key) => {
      const info = typeof key === 'string' ? null : key?.info || key;
      const rawKey = typeof key === 'string' ? key : key?.key || '';
      const keyLabel =
        typeof key === 'string'
          ? maskKey(rawKey)
          : info?.key_alias || info?.key_name || 'Unknown key';
      const isBlocked = typeof key === 'string' ? false : info?.blocked ?? key?.blocked;
      const blocked = isBlocked
        ? '<span class="inline-flex rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-200">Blocked</span>'
        : '<span class="inline-flex rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-200">Active</span>';

      const usageValue = typeof key === 'string' ? null : info?.spend ?? null;
      const budgetValue = typeof key === 'string' ? null : info?.max_budget ?? null;
      const requestValue = typeof key === 'string' ? null : info?.request_count ?? null;
      const usageLine = (() => {
        if (usageValue == null && budgetValue == null && requestValue == null) return '';
        const usageText =
          usageValue != null && budgetValue != null
            ? `${usageValue} / ${budgetValue}`
            : usageValue != null
            ? `${usageValue}`
            : budgetValue != null
            ? `${budgetValue}`
            : '';
        const reqText = requestValue != null ? `Requests: ${requestValue}` : '';
        const parts = [usageText, reqText].filter(Boolean).join(' · ');
        return `<div class="text-xs text-slate-400">Usage: ${parts}</div>`;
      })();
      return `
      <div class="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <div class="flex items-center justify-between gap-3">
          <h4 class="text-base font-semibold truncate" title="${keyLabel}">${keyLabel}</h4>
          ${blocked}
        </div>
        <div class="mt-3 space-y-1 text-sm text-slate-300">
          <div class="truncate">
            <span class="text-slate-400">Key</span>: <span class="font-mono">${typeof key === 'string' ? maskKey(rawKey) : info?.key_name || '—'}</span>
          </div>
          ${usageLine}
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          <button class="rounded-xl border border-slate-800 px-3 py-1.5 text-sm hover:bg-slate-800" data-action="info" data-key="${typeof key === 'string' ? key : key?.key}">Details</button>
          ${isBlocked ? `<button class="rounded-xl border border-slate-800 px-3 py-1.5 text-sm hover:bg-slate-800" data-action="unblock" data-key="${typeof key === 'string' ? key : key?.key}">Unblock</button>` : `<button class="rounded-xl border border-slate-800 px-3 py-1.5 text-sm hover:bg-slate-800" data-action="block" data-key="${typeof key === 'string' ? key : key?.key}">Block</button>`}
          <button class="rounded-xl border border-slate-800 px-3 py-1.5 text-sm text-red-200 hover:bg-red-500/10" data-action="delete" data-key="${typeof key === 'string' ? key : key?.key}">Delete</button>
        </div>
      </div>
    `;
    })
    .join('');
  updateModelDisplay();
};

const loadKeys = async () => {
  try {
    const data = await fetchJSON('/api/keys/list');
    state.keys = normalizeKeys(data);
    renderStats();
    renderKeys();
  } catch (err) {
    toast(err.message || 'Failed to load keys');
  }
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const renderKeyDetails = (payload) => {
  const info = payload?.info || payload;
  const key = payload?.key || info?.key || '—';
  const maskedKey = info?.key_name || '—';
  const keyAlias = info?.key_alias || '—';
  const models = info?.models || [];
  const spend = info?.spend ?? '—';
  const maxBudget = info?.max_budget ?? '—';
  const status = info?.blocked ? 'Blocked' : 'Active';
  const rotationCount = info?.rotation_count ?? '—';
  const expires = formatDate(info?.expires);
  const createdAt = formatDate(info?.created_at);
  const updatedAt = formatDate(info?.updated_at);

  const realKey = extractRealKey(payload);
  const realKeyBanner = realKey
    ? `
      <div class="rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm">
        <div class="text-xs uppercase tracking-wider text-amber-200">New API Key</div>
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <span class="font-mono break-all text-amber-100">${realKey}</span>
          <button class="rounded-lg border border-amber-400/40 px-2 py-1 text-xs text-amber-100 hover:bg-amber-400/20"
            data-action="copy"
            data-key="${realKey}">
            Copy
          </button>
        </div>
        <label class="mt-3 flex items-center gap-2 text-xs text-amber-200/80">
          <input type="checkbox" id="confirmCopied" class="h-4 w-4 accent-amber-400" />
          I have copied this key
        </label>
        <div class="mt-2 text-xs text-amber-200/80">This key is shown once. Copy and store it now.</div>
      </div>
    `
    : '';

  return `
    <div class="grid gap-4 md:grid-cols-2">
      ${realKeyBanner}
      <div class="md:col-span-2 rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="text-xs uppercase tracking-wider text-slate-400">Key ID</div>
          <div class="flex gap-2">
            <span class="inline-flex rounded-full ${info?.blocked ? 'bg-red-500/20 text-red-200' : 'bg-emerald-500/20 text-emerald-200'} px-2 py-0.5 text-xs">${status}</span>
            <span class="inline-flex rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-200">Rotation ${rotationCount}</span>
          </div>
        </div>
        <div class="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span class="font-mono break-all">${maskKey(key)}</span>
        </div>
        <div class="mt-4 grid gap-3 sm:grid-cols-3">
          <div class="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-sm">
            <div class="text-xs uppercase text-slate-400">Spend</div>
            <div class="mt-1 font-semibold">${spend}</div>
          </div>
          <div class="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-sm">
            <div class="text-xs uppercase text-slate-400">Max Budget</div>
            <div class="mt-1 font-semibold">${maxBudget}</div>
          </div>
          <div class="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-sm">
            <div class="text-xs uppercase text-slate-400">Expires</div>
            <div class="mt-1 font-semibold">${expires}</div>
          </div>
        </div>
      </div>
      <div class="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
        <h3 class="text-xs uppercase tracking-wider text-slate-400">Identity</h3>
        <div class="mt-3 space-y-2 text-sm">
          <div class="flex justify-between"><span class="text-slate-400">Alias</span><span>${keyAlias}</span></div>
          <div class="flex justify-between"><span class="text-slate-400">Key</span><span class="font-mono">${maskedKey}</span></div>
          <div class="flex justify-between"><span class="text-slate-400">Team</span><span>${info?.team_id || '—'}</span></div>
        </div>
      </div>
      <div class="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
        <h3 class="text-xs uppercase tracking-wider text-slate-400">Usage</h3>
        <div class="mt-3 space-y-2 text-sm">
          <div class="flex justify-between"><span class="text-slate-400">Budget Reset</span><span>${info?.budget_reset_at ? formatDate(info?.budget_reset_at) : '—'}</span></div>
          <div class="flex justify-between"><span class="text-slate-400">Requests</span><span>${info?.request_count ?? info?.num_requests ?? info?.total_requests ?? '—'}</span></div>
        </div>
      </div>
      <div class="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
        <h3 class="text-xs uppercase tracking-wider text-slate-400">Lifecycle</h3>
        <div class="mt-3 space-y-2 text-sm">
          <div class="flex justify-between"><span class="text-slate-400">Created</span><span>${createdAt}</span></div>
          <div class="flex justify-between"><span class="text-slate-400">Updated</span><span>${updatedAt}</span></div>
        </div>
      </div>
      <div class="md:col-span-2 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
        <h3 class="text-xs uppercase tracking-wider text-slate-400">Models</h3>
        <div class="mt-3 flex flex-wrap gap-2">
          ${models.length ? models.map((m) => `<span class="rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1 text-xs text-slate-200">${m}</span>`).join('') : '<span class="text-slate-400">—</span>'}
        </div>
      </div>
      <div class="md:col-span-2 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
        <details class="text-sm text-slate-300">
          <summary class="cursor-pointer text-xs uppercase tracking-wider text-slate-400">Raw JSON</summary>
          <pre class="mt-3 overflow-auto rounded-xl border border-slate-800 bg-slate-900 p-3 text-xs">${JSON.stringify(payload, null, 2)}</pre>
        </details>
      </div>
    </div>
  `;
};

const openDrawer = (title, payload) => {
  show(els.drawer);
  if (payload && typeof payload === 'object') {
    els.drawerBody.innerHTML = renderKeyDetails(payload);
    if (extractRealKey(payload)) {
      requireCopyGate();
    }
    return;
  }
  els.drawerBody.innerHTML = `<pre>${JSON.stringify(payload, null, 2)}</pre>`;
};

// 简化版：只显示新密钥和复制按钮
const openKeyCreatedDrawer = (realKey, keyAlias) => {
  show(els.drawer);
  els.drawerBody.innerHTML = `
    <div class="space-y-4">
      <div class="rounded-2xl border border-amber-400/40 bg-amber-400/10 p-5">
        <div class="text-xs uppercase tracking-wider text-amber-200">🎉 Key Created Successfully</div>
        <div class="mt-1 text-sm text-slate-300">${keyAlias || 'New Key'}</div>
        <div class="mt-4 rounded-xl bg-slate-950/50 p-3">
          <div class="font-mono break-all text-amber-100 text-sm">${realKey}</div>
        </div>
        <div class="mt-4 flex items-center gap-3">
          <button class="rounded-xl bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-300"
            data-action="copy"
            data-key="${realKey}">
            Copy Key
          </button>
          <span id="copyStatus" class="text-xs text-slate-400"></span>
        </div>
        <label class="mt-4 flex items-center gap-2 text-xs text-amber-200/80">
          <input type="checkbox" id="confirmCopied" class="h-4 w-4 accent-amber-400" />
          I have copied this key
        </label>
        <div class="mt-2 text-xs text-amber-200/60">⚠️ This key is shown only once. Make sure to copy it now.</div>
      </div>
    </div>
  `;
  requireCopyGate();
};

const closeDrawer = () => hide(els.drawer);

const openModal = () => show(els.modal);
const closeModal = () => hide(els.modal);

const handleAction = async (action, key) => {
  try {
    if (action === 'info') {
      const cached = state.keys.find((item) => {
        if (typeof item === 'string') return item === key;
        if (item?.key) return item.key === key;
        return false;
      });
      if (cached) {
        openDrawer('Key Details', cached);
        return;
      }
      const data = await fetchJSON(`/api/keys/info?key=${encodeURIComponent(key)}`);
      openDrawer('Key Details', data);
      return;
    }
    if (action === 'block' || action === 'unblock') {
      await fetchJSON(`/api/keys/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      toast(action === 'block' ? 'Key blocked' : 'Key unblocked');
      await loadKeys();
      return;
    }
    if (action === 'delete') {
      if (!confirm('Delete this key? This cannot be undone.')) return;
      await fetchJSON('/api/keys/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: [key] }),
      });
      toast('Key deleted');
      await loadKeys();
    }
  } catch (err) {
    toast(err.message || 'Action failed');
  }
};

els.search?.addEventListener('input', renderKeys);
els.refresh?.addEventListener('click', loadKeys);
els.createBtn?.addEventListener('click', openModal);
els.drawerClose?.addEventListener('click', closeDrawer);
els.modalClose?.addEventListener('click', closeModal);
els.modelFilter?.addEventListener('input', renderModels);
els.modelToggle?.addEventListener('click', () => {
  els.modelPanel?.classList.toggle('hidden');
});
els.modelDisplay?.addEventListener('click', () => {
  els.modelPanel?.classList.toggle('hidden');
});
els.modelClear?.addEventListener('click', () => {
  stateModels.selected = new Set();
  renderModels();
});
els.modelSelectAll?.addEventListener('click', () => {
  stateModels.selected = new Set(stateModels.list);
  renderModels();
});
els.moreToggle?.addEventListener('click', () => {
  els.morePanel?.classList.toggle('hidden');
});

document.addEventListener('click', (event) => {
  if (!els.modelPanel || !els.modelDisplay || !els.modelToggle) return;
  const target = event.target;
  if (els.modelPanel.contains(target) || els.modelDisplay.contains(target) || els.modelToggle.contains(target)) return;
  els.modelPanel.classList.add('hidden');
});

document.addEventListener('change', (event) => {
  const target = event.target;
  if (target && target.matches('input[name=\"model_checkbox\"]')) {
    if (target.checked) {
      stateModels.selected.add(target.value);
    } else {
      stateModels.selected.delete(target.value);
    }
    updateModelDisplay();
  }
});

els.grid?.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  handleAction(button.dataset.action, button.dataset.key);
});

els.drawer?.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action="copy"]');
  if (!button) return;
  const value = button.dataset.key || '';
  if (!value) {
    toast('No key to copy');
    return;
  }
  navigator.clipboard.writeText(value).then(
    () => toast('Key copied'),
    () => toast('Copy failed')
  );
});

els.modalForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const payload = {};
  const selectedModels = Array.from(stateModels.selected);
  if (selectedModels.length) {
    payload.models = selectedModels;
  }
  const keyAlias = formData.get('key_alias');
  if (!keyAlias || !String(keyAlias).trim()) {
    toast('Key Name is required');
    return;
  }
  payload.key_alias = String(keyAlias).trim();
  payload.user_id = 'default_user_id';
  const teamId = formData.get('team_id');
  if (teamId) payload.team_id = teamId;
  const maxBudget = formData.get('max_budget');
  if (maxBudget) payload.max_budget = Number(maxBudget);
  const duration = formData.get('duration');
  if (duration) {
    const raw = String(duration).trim();
    const yearMatch = raw.match(/^(\d+)\s*y$/i);
    const monthMatch = raw.match(/^(\d+)\s*m$/i);
    if (yearMatch) {
      const days = Number(yearMatch[1]) * 365;
      payload.duration = `${days}d`;
    } else if (monthMatch) {
      const days = Number(monthMatch[1]) * 30;
      payload.duration = `${days}d`;
    } else {
      payload.duration = raw;
    }
  }
  const metadata = formData.get('metadata');
  if (metadata) {
    try {
      payload.metadata = JSON.parse(metadata);
    } catch (err) {
      toast('Metadata must be valid JSON');
      return;
    }
  }

  try {
    const data = await fetchJSON('/api/keys/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    closeModal();
    form.reset();
    const realKey = data?.key || data?.api_key || data?.generated_key || data?.data?.key || data?.data?.api_key || null;
    if (realKey) {
      openKeyCreatedDrawer(realKey, payload.key_alias);
    } else {
      toast('Key created but no key returned');
    }
    await loadKeys();
  } catch (err) {
    toast(err.message || 'Create failed');
  }
});

loadKeys();
loadModels();
