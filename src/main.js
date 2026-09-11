import { PROMPTS, CATEGORIES } from './data/prompts.js';

const state = {
  query: '',
  category: 'الكل',
  activePrompt: null,
};

const els = {
  searchInput: document.getElementById('searchInput'),
  categoryChips: document.getElementById('categoryChips'),
  promptsGrid: document.getElementById('promptsGrid'),
  resultsMeta: document.getElementById('resultsMeta'),
  emptyState: document.getElementById('emptyState'),
  modal: document.getElementById('modal'),
  modalTitle: document.getElementById('modalTitle'),
  modalCategory: document.getElementById('modalCategory'),
  modalNeed: document.getElementById('modalNeed'),
  modalPrompt: document.getElementById('modalPrompt'),
  copyPromptBtn: document.getElementById('copyPromptBtn'),
  toast: document.getElementById('toast'),
  converterInput: document.getElementById('converterInput'),
  convertBtn: document.getElementById('convertBtn'),
  converterOutput: document.getElementById('converterOutput'),
  converterResult: document.getElementById('converterResult'),
  copyConverterBtn: document.getElementById('copyConverterBtn'),
};

let toastTimer = null;

function normalize(text) {
  return (text || '')
    .toString()
    .toLowerCase()
    .replace(/[ًٌٍَُِّْ]/g, '')
    .trim();
}

function filterPrompts() {
  const q = normalize(state.query);
  return PROMPTS.filter((p) => {
    const catOk = state.category === 'الكل' || p.category === state.category;
    if (!catOk) return false;
    if (!q) return true;
    const hay = normalize(
      [p.title, p.needSummary, p.category, ...(p.tags || [])].join(' ')
    );
    return hay.includes(q);
  });
}

function renderChips() {
  els.categoryChips.innerHTML = '';
  CATEGORIES.forEach((cat) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip' + (state.category === cat ? ' active' : '');
    btn.textContent = cat;
    btn.setAttribute('role', 'listitem');
    btn.addEventListener('click', () => {
      state.category = cat;
      renderChips();
      renderCards();
    });
    els.categoryChips.appendChild(btn);
  });
}

function renderCards() {
  const list = filterPrompts();
  els.promptsGrid.innerHTML = '';
  els.resultsMeta.textContent = list.length
    ? `عرض ${list.length} من ${PROMPTS.length} برومبت`
    : '';
  els.emptyState.classList.toggle('hidden', list.length > 0);

  list.forEach((p) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'prompt-card';
    card.innerHTML = `
      <span class="badge">${escapeHtml(p.category)}</span>
      <h3>${escapeHtml(p.title)}</h3>
      <p class="need">${escapeHtml(p.needSummary)}</p>
      <ul class="tag-list">
        ${(p.tags || []).map((t) => `<li>${escapeHtml(t)}</li>`).join('')}
      </ul>
    `;
    card.addEventListener('click', () => openModal(p));
    els.promptsGrid.appendChild(card);
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function openModal(prompt) {
  state.activePrompt = prompt;
  els.modalTitle.textContent = prompt.title;
  els.modalCategory.textContent = prompt.category;
  els.modalNeed.textContent = prompt.needSummary;
  els.modalPrompt.textContent = prompt.fullPrompt;
  els.modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  els.modal.classList.add('hidden');
  state.activePrompt = null;
  document.body.style.overflow = '';
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
  showToast('تم النسخ');
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.classList.add('hidden');
  }, 1800);
}

/**
 * Client-side converter: detect Arabic keywords → structured prompt.
 * Never invents names, grades, or circulars.
 */
function convertRequestToPrompt(raw) {
  const text = (raw || '').trim();
  if (!text) {
    return 'يرجى كتابة طلبك أولاً.';
  }

  const rules = [
    {
      keys: ['تحضير', 'خطة درس', 'درس يومي', 'أهداف'],
      role: 'مساعد تربوي لإعداد خطط وتحضير دروس',
      focus: 'تحضير/تخطيط درس',
    },
    {
      keys: ['اختبار', 'أسئلة', 'تقويم', 'بلوم', 'نموذج إجابة'],
      role: 'خبير بناء اختبارات ونماذج إجابة',
      focus: 'الاختبارات والتقويم',
    },
    {
      keys: ['نتائج', 'تحليل', 'ضعف', 'تغذية راجعة', 'علاج'],
      role: 'محلل نتائج صفية ومخطط دعم',
      focus: 'تحليل النتائج والدعم العلاجي',
    },
    {
      keys: ['رصد', 'نور', 'غياب', 'واجبات', 'متابعة'],
      role: 'مساعد صياغة ملاحظات رصد ومتابعة',
      focus: 'الرصد والمتابعة',
    },
    {
      keys: ['ولي أمر', 'واتساب', 'رسالة', 'تواصل', 'محضر'],
      role: 'صائغ رسائل تواصل مهنية مع أولياء الأمور',
      focus: 'التواصل مع أولياء الأمور',
    },
    {
      keys: ['ملف إنجاز', 'شاهد', 'تقرير ذاتي', 'مشرف', 'توثيق'],
      role: 'مساعد توثيق مهني وملفات إنجاز',
      focus: 'ملف الإنجاز والتوثيق',
    },
    {
      keys: ['إذاعة', 'تهيئة', 'بداية الترم', 'لاصفية', 'توزيع زمني'],
      role: 'منسق أنشطة وتهيئة بداية الفصل',
      focus: 'الأنشطة وبداية الترم',
    },
    {
      keys: ['صعوبات', 'فردية', 'IEP', 'متدرجة', 'ورقة عمل'],
      role: 'مساعد دعم تعليمي وتفريق بحذر غير تشخيصي',
      focus: 'الدعم وصعوبات التعلم',
    },
  ];

  let matched = null;
  for (const rule of rules) {
    if (rule.keys.some((k) => text.includes(k))) {
      matched = rule;
      break;
    }
  }

  const role = matched
    ? matched.role
    : 'مساعد تربوي عام للمعلمين في السياق المدرسي السعودي';
  const focus = matched ? matched.focus : 'طلب عام من المعلم';

  return `الدور:\nأنت ${role}. ركّز على: ${focus}.\n\nالمدخلات:\n- طلب المعلم (نص خام كما هو):\n"""\n${text}\n"""\n- أي تفاصيل غير مذكورة صراحة تُعد غير متوفرة.\n\nالمطلوب:\nحوّل طلب المعلم إلى مخرج عملي جاهز للاستخدام، مع هيكل واضح وخطوات قابلة للتنفيذ.\n\nالقيود:\n- لا تخمّن أسماء طلاب أو معلمين أو مدارس.\n- لا تخمّن درجات أو نسب أو نتائج غير مذكورة.\n- لا تختلق أرقام تعاميم أو نماذج وزارية أو سياسات رسمية.\n- لا تنسب المخرج لوزارة التعليم أو أي جهة حكومية.\n- إذا نقصت معلومة ضرورية، اكتب «غير متوفر في المدخلات» واطلب توضيحها.\n\nشكل المخرج:\n1) ملخص فهم الطلب\n2) المخرج المطلوب مفصّلاً\n3) عناصر تحتاج استكمالًا من المعلم (إن وجدت)\n4) نسخة مختصرة جاهزة للنسخ إن ناسب السياق\n\nقاعدة عدم التخمين:\nاعتمد فقط على نص طلب المعلم أعلاه. أي اسم أو رقم أو تعميم أو درجة غير واردة صراحة يجب عدم اختراعها.`;
}

function init() {
  renderChips();
  renderCards();

  els.searchInput.addEventListener('input', (e) => {
    state.query = e.target.value;
    renderCards();
  });

  document.querySelectorAll('[data-close-modal]').forEach((el) => {
    el.addEventListener('click', closeModal);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !els.modal.classList.contains('hidden')) {
      closeModal();
    }
  });

  els.copyPromptBtn.addEventListener('click', () => {
    if (state.activePrompt) {
      copyText(state.activePrompt.fullPrompt);
    }
  });

  els.convertBtn.addEventListener('click', () => {
    const result = convertRequestToPrompt(els.converterInput.value);
    els.converterResult.textContent = result;
    els.converterOutput.classList.remove('hidden');
  });

  els.copyConverterBtn.addEventListener('click', () => {
    copyText(els.converterResult.textContent || '');
  });
}

init();
