/** Readable March calendar scrap for inventory close-up inspect. */
export function createCalendarScrapInspectElement(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'calendar-scrap-inspect';

  const paper = document.createElement('div');
  paper.className = 'calendar-scrap-paper';

  const header = document.createElement('div');
  header.className = 'calendar-scrap-header';
  header.textContent = 'MARCH';

  const grid = document.createElement('div');
  grid.className = 'calendar-scrap-grid';
  grid.setAttribute('aria-label', 'March calendar');

  const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  for (const d of weekdays) {
    const label = document.createElement('span');
    label.className = 'calendar-scrap-dow';
    label.textContent = d;
    grid.appendChild(label);
  }

  // March layout: 1st on Saturday (leading blanks ×5)
  for (let i = 0; i < 5; i++) {
    const blank = document.createElement('span');
    blank.className = 'calendar-scrap-day blank';
    blank.setAttribute('aria-hidden', 'true');
    grid.appendChild(blank);
  }

  for (let day = 1; day <= 31; day++) {
    const cell = document.createElement('span');
    cell.className = 'calendar-scrap-day';
    if (day === 17) cell.classList.add('circled');
    cell.textContent = String(day);
    grid.appendChild(cell);
  }

  const margin = document.createElement('div');
  margin.className = 'calendar-scrap-margin';
  margin.innerHTML = '<span class="calendar-scrap-note">3:17</span>';

  paper.appendChild(header);
  paper.appendChild(grid);
  paper.appendChild(margin);
  wrap.appendChild(paper);
  return wrap;
}

export function createCalendarScrapRailThumb(): HTMLElement {
  const thumb = document.createElement('div');
  thumb.className = 'calendar-scrap-rail-thumb';
  thumb.innerHTML = '<span class="csr-month">MAR</span><span class="csr-mark">17</span>';
  return thumb;
}
