(function () {
  // Guard: only run on the products page when the grade finder exists.
  const finder = document.querySelector('.grade-finder');
  if (!finder) return;

  const appTabs = Array.from(finder.querySelectorAll('[data-filter-group="app"]'));
  const familyTabs = Array.from(finder.querySelectorAll('[data-filter-group="family"]'));
  const resetBtn = finder.querySelector('#gfReset');
  const cards = Array.from(finder.querySelectorAll('.grade-card'));
  const count = finder.querySelector('#gfCount');
  const infoButtons = Array.from(finder.querySelectorAll('.grade-info-btn'));

  const state = { app: '', family: '' };
  const norm = (value = '') => value.trim().toLowerCase();

  const setActive = (tabs, value) => {
    tabs.forEach(tab => {
      const isActive = norm(tab.dataset.value) === value;
      tab.classList.toggle('is-active', isActive);
      tab.setAttribute('aria-pressed', String(isActive));
    });
  };

  const applyFilters = () => {
    let shown = 0;

    cards.forEach(card => {
    const apps = (card.dataset.app || '')
      .split(',')
      .map(norm)
      .filter(Boolean);

      const matchesApp = !state.app || apps.includes(state.app);
      const matchesFamily = !state.family || norm(card.dataset.family) === state.family;
      const visible = matchesApp && matchesFamily;

      card.hidden = !visible;
      card.style.display = visible ? '' : 'none'; // Force hide for browsers that ignore hidden on div
      if (visible) shown += 1;
    });

    if (count) {
      count.textContent = `Showing ${shown} of ${cards.length} grades`;
    }
  };

  const update = (group, value) => {
    const normalised = norm(value);
    if (group === 'app') {
      state.app = normalised;
      setActive(appTabs, normalised);
    } else {
      state.family = normalised;
      setActive(familyTabs, normalised);
    }
    applyFilters();
  };

  appTabs.forEach(tab => {
    tab.addEventListener('click', () => update('app', tab.dataset.value));
    tab.addEventListener('keydown', evt => {
      if (evt.key === 'Enter' || evt.key === ' ') {
        evt.preventDefault();
        tab.click();
      }
    });
  });

  familyTabs.forEach(tab => {
    tab.addEventListener('click', () => update('family', tab.dataset.value));
    tab.addEventListener('keydown', evt => {
      if (evt.key === 'Enter' || evt.key === ' ') {
        evt.preventDefault();
        tab.click();
      }
    });
  });

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      update('app', '');
      update('family', '');
    });
  }

  applyFilters();

  // Card highlight + reason reveal (hover on desktop, click/tap on touch)
  const activateCard = (card) => {
    cards.forEach(c => c.classList.remove('active'));
    if (card) card.classList.add('active');
  };

  cards.forEach(card => {
    card.addEventListener('click', () => {
      if (card.hidden) return;
      activateCard(card);
    });
    card.addEventListener('dblclick', () => {
      if (card.hidden) return;
      const infoBtn = card.querySelector('.grade-info-btn');
      const gradeId = infoBtn && infoBtn.dataset ? infoBtn.dataset.grade : '';
      if (gradeId) openGradeModal(gradeId, infoBtn || card);
    });
    card.addEventListener('keydown', evt => {
      if ((evt.key === 'Enter' || evt.key === ' ') && !card.hidden) {
        evt.preventDefault();
        activateCard(card);
      }
    });
    card.setAttribute('tabindex', '0');
  });

  // Grade specs modal
  const modal = document.getElementById('gradeModal');
  const modalTitle = document.getElementById('gradeModalTitle');
  const modalContent = document.getElementById('gradeModalContent');
  const modalClose = modal ? modal.querySelector('.grade-modal__close') : null;

  const setViewportHeightVar = () => {
    // Mobile browsers (especially iOS Safari) can misreport `vh` due to the address bar.
    document.documentElement.style.setProperty('--vvh', `${window.innerHeight * 0.01}px`);
  };

  if (modal) {
    setViewportHeightVar();
    window.addEventListener('resize', setViewportHeightVar, { passive: true });
    window.addEventListener('orientationchange', setViewportHeightVar, { passive: true });
  }

  const SPEC_URL = '/assets/alkyd-specs.json';
  let specsPromise = null;
  let lastFocusEl = null;
  let prevBodyOverflow = '';

  const fixEncoding = (value) => {
    if (value === null || value === undefined) return '';
    return String(value)
      .replaceAll('Â±', '±')
      .replaceAll('â€“', '–')
      .replaceAll('â€”', '—')
      .replaceAll('Â©', '©')
      .replaceAll('âœ“', '✓')
      .replaceAll('â€˜', '‘')
      .replaceAll('â€™', '’')
      .replaceAll('â€œ', '“')
      .replaceAll('â€�', '”');
  };

  const loadSpecs = async () => {
    if (!specsPromise) {
      specsPromise = fetch(SPEC_URL, { headers: { 'Accept': 'application/json' } })
        .then(res => {
          if (!res.ok) throw new Error(`Failed to load specs: ${res.status}`);
          return res.json();
        });
    }
    return specsPromise;
  };

  const gradeKey = (value) => fixEncoding(value).replace(/\s+/g, '').toLowerCase();

  const prettyChainLength = (chainLength, metadata) => {
    const key = fixEncoding(chainLength);
    const map = {
      long: 'Long oil',
      medium: 'Medium oil',
      short: 'Short oil',
      urethane_modified: 'Urethane-modified',
    };
    const base = map[key] || key;
    const def = metadata && metadata.chain_length_definition && metadata.chain_length_definition[key];
    return def ? `${base} (${fixEncoding(def)})` : base;
  };

  const node = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = fixEncoding(text);
    return el;
  };

  const renderValueNode = (value) => {
    if (value === null || value === undefined || value === '') return node('span', null, '—');
    if (Array.isArray(value)) return node('span', null, value.map(v => fixEncoding(v)).join(', '));

    if (typeof value === 'object') {
      const list = node('ul');
      Object.entries(value).forEach(([key, val]) => {
        const label = fixEncoding(key).replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
        const li = node('li');
        li.textContent = `${label}: ${fixEncoding(val)}`;
        list.appendChild(li);
      });
      return list;
    }

    return node('span', null, value);
  };

  const renderSpecsTable = (grade, metadata) => {
    const wrap = node('div', 'table-scroll');
    const table = node('table', 'data');
    const thead = node('thead');
    const headRow = node('tr');
    headRow.appendChild(node('th', null, 'Spec'));
    headRow.appendChild(node('th', null, 'Value'));
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = node('tbody');

    const addRow = (label, valueNodeOrText) => {
      const tr = node('tr');
      tr.appendChild(node('th', null, label));
      const td = node('td');
      if (valueNodeOrText instanceof Node) td.appendChild(valueNodeOrText);
      else td.textContent = fixEncoding(valueNodeOrText);
      tr.appendChild(td);
      tbody.appendChild(tr);
    };

    addRow('Grade', grade.grade);
    addRow('Chain length', prettyChainLength(grade.chain_length, metadata));
    addRow('Oil type', grade.oil_type);
    addRow('Oil (%)', grade.oil_percent != null ? `${grade.oil_percent}%` : '—');
    addRow('Phthalic anhydride (%)', grade.phthalic_anhydride_percent != null ? `${grade.phthalic_anhydride_percent}%` : '—');
    addRow('Polyol', renderValueNode(grade.polyol));
    addRow('Solvent', grade.form && grade.form.solvent);
    addRow('Non-volatile (%)', grade.form && grade.form.non_volatile_percent);
    addRow('Viscosity (25°C, Gardner)', renderValueNode(grade.viscosity_25c_gardner));
    addRow('Color (Gardner, max)', grade.color_max_gardner != null ? String(grade.color_max_gardner) : '—');
    addRow('Acid value (max, mg KOH/g)', grade.acid_value_max_mg_koh_g != null ? String(grade.acid_value_max_mg_koh_g) : '—');

    if (grade.typical_use) addRow('Typical use', renderValueNode(grade.typical_use));

    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  };

  const setModalOpen = (open) => {
    if (!modal) return;
    if (open) {
      setViewportHeightVar();
      prevBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      modal.hidden = false;
    } else {
      document.body.style.overflow = prevBodyOverflow;
      modal.hidden = true;
      if (modalContent) modalContent.replaceChildren();
      if (lastFocusEl && typeof lastFocusEl.focus === 'function') lastFocusEl.focus();
      lastFocusEl = null;
    }
  };

  const openGradeModal = async (gradeId, triggerEl) => {
    if (!modal || !modalTitle || !modalContent) return;

    lastFocusEl = triggerEl || document.activeElement;
    modalTitle.textContent = `Grade ${fixEncoding(gradeId)} specs`;
    modalContent.replaceChildren(node('p', 'muted', 'Loading specs…'));
    setModalOpen(true);
    if (modalClose) modalClose.focus();

    try {
      const specs = await loadSpecs();
      const grades = Array.isArray(specs.grades) ? specs.grades : [];
      const metadata = specs.metadata || {};

      const found = grades.find(g => gradeKey(g.grade) === gradeKey(gradeId));
      modalContent.replaceChildren();

      if (!found) {
        modalContent.appendChild(node('p', null, `No specs found for grade “${fixEncoding(gradeId)}”.`));
        return;
      }

      if (metadata && metadata.notes) {
        modalContent.appendChild(node('p', 'muted small', metadata.notes));
      }

      modalContent.appendChild(renderSpecsTable(found, metadata));
    } catch (err) {
      modalContent.replaceChildren(node('p', null, 'Unable to load grade specs right now.'));
    }
  };

  if (modal) {
    modal.querySelectorAll('[data-grade-modal-close]').forEach(el => {
      el.addEventListener('click', () => setModalOpen(false));
    });

    document.addEventListener('keydown', evt => {
      if (evt.key === 'Escape' && !modal.hidden) setModalOpen(false);
    });
  }

  infoButtons.forEach(btn => {
    btn.addEventListener('click', evt => {
      evt.preventDefault();
      evt.stopPropagation();
      if (btn.disabled) return;
      openGradeModal(btn.dataset.grade, btn);
    });

    btn.addEventListener('keydown', evt => {
      if (evt.key === 'Enter' || evt.key === ' ') {
        evt.preventDefault();
        btn.click();
      }
    });
  });
})();
