(function () {
  // Guard: only run on the products page when the grade finder exists.
  const finder = document.querySelector('.grade-finder');
  if (!finder) return;

  const appTabs = Array.from(finder.querySelectorAll('[data-filter-group="app"]'));
  const familyTabs = Array.from(finder.querySelectorAll('[data-filter-group="family"]'));
  const resetBtn = finder.querySelector('#gfReset');
  const cards = Array.from(finder.querySelectorAll('.grade-card'));
  const count = finder.querySelector('#gfCount');

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
    card.addEventListener('keydown', evt => {
      if ((evt.key === 'Enter' || evt.key === ' ') && !card.hidden) {
        evt.preventDefault();
        activateCard(card);
      }
    });
    card.setAttribute('tabindex', '0');
  });
})();
