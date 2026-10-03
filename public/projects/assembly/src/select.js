// Drop-down list in the style of the site in place of the native <select>, which opens a white system list.
// The native element stays in the page, hidden, and keeps the value: the component sets it and fires `change`,
// so the code that listens to the select does not know about the component.
// Keyboard: arrows, Home, End, Enter or Space to choose, Escape to close, a letter to jump to an option.
let count = 0;
const all = [];

function enhance(select) {
  count += 1;
  const id = `select-${count}`;
  const box = document.createElement('div');
  box.className = `select ${select.className}`.trim();
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'select-button';
  button.setAttribute('role', 'combobox');
  button.setAttribute('aria-haspopup', 'listbox');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', `${id}-list`);
  const value = document.createElement('span');
  button.append(value);
  const list = document.createElement('ul');
  list.className = 'select-list';
  list.id = `${id}-list`;
  list.setAttribute('role', 'listbox');
  list.hidden = true;
  select.after(box);
  box.append(select, button, list);
  select.hidden = true;
  select.tabIndex = -1;

  let active = -1;
  const options = () => [...list.children];

  function render() {
    list.innerHTML = [...select.options].map((option, i) => `<li role="option" id="${id}-${i}" aria-selected="${option.selected}">${option.textContent}</li>`).join('');
    value.textContent = select.options[select.selectedIndex]?.textContent || '';
    button.setAttribute('aria-label', `${select.getAttribute('aria-label') || ''}: ${value.textContent}`);
  }

  function highlight(i) {
    const items = options();
    active = Math.max(0, Math.min(items.length - 1, i));
    items.forEach((item, k) => item.classList.toggle('active', k === active));
    button.setAttribute('aria-activedescendant', items[active].id);
    items[active].scrollIntoView({block: 'nearest'});
  }

  // Below the field if there is room, otherwise above; never past the right edge of the screen.
  function place() {
    box.classList.remove('up', 'end');
    const field = button.getBoundingClientRect();
    const height = list.offsetHeight;
    if (field.bottom + height + 8 > innerHeight && field.top - height - 8 > 0) box.classList.add('up');
    if (field.left + list.offsetWidth > document.documentElement.clientWidth - 8) box.classList.add('end');
  }

  function open() {
    if (!list.hidden) return;
    for (const other of all) if (other !== api) other.close(false);
    list.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    place();
    highlight(select.selectedIndex);
  }

  function close(focus = true) {
    if (list.hidden) return;
    list.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    button.removeAttribute('aria-activedescendant');
    if (focus) button.focus();
  }

  function choose(i) {
    if (select.selectedIndex !== i) {
      select.selectedIndex = i;
      select.dispatchEvent(new Event('change', {bubbles: true}));
    }
    render();
    close();
  }

  function jump(letter) {
    const items = [...select.options];
    const from = list.hidden ? select.selectedIndex : active;
    for (let k = 1; k <= items.length; k += 1) {
      const i = (from + k) % items.length;
      if (items[i].textContent.trim().toLowerCase().startsWith(letter)) return i;
    }
    return -1;
  }

  button.addEventListener('click', () => (list.hidden ? open() : close()));
  button.addEventListener('keydown', (event) => {
    const closed = list.hidden;
    const {key} = event;
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      event.preventDefault();
      if (closed) open();
      else highlight(active + (key === 'ArrowDown' ? 1 : -1));
    } else if (key === 'Home' || key === 'End') {
      if (closed) return;
      event.preventDefault();
      highlight(key === 'Home' ? 0 : options().length - 1);
    } else if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      if (closed) open();
      else choose(active);
    } else if (key === 'Escape') {
      if (!closed) {
        event.preventDefault();
        close();
      }
    } else if (key === 'Tab') {
      close(false);
    } else if (key.length === 1 && /\S/.test(key)) {
      const i = jump(key.toLowerCase());
      if (i < 0) return;
      if (closed) choose(i);
      else highlight(i);
    }
  });
  list.addEventListener('mousedown', (event) => event.preventDefault());
  list.addEventListener('click', (event) => {
    const item = event.target.closest('[role="option"]');
    if (item) choose(options().indexOf(item));
  });
  list.addEventListener('mousemove', (event) => {
    const item = event.target.closest('[role="option"]');
    if (item && options().indexOf(item) !== active) highlight(options().indexOf(item));
  });
  button.addEventListener('blur', () => close(false));

  const api = {render, close};
  all.push(api);
  render();
}

// Texts of the options follow the language of the page.
export function refreshSelects() {
  for (const select of all) select.render();
}

export function initSelects() {
  for (const select of document.querySelectorAll('select[data-select]')) enhance(select);
  addEventListener('resize', () => all.forEach((s) => s.close(false)));
}
