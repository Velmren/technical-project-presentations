// Rules for showing and filtering home works. Kept free of the schema library so client
// components can use it without shipping the validator to the browser.
import type { HomeData, HomeWork } from './home';

export const categoryOrder = ['Веб', 'Игры', 'Анимация', '3D', 'Инструменты', 'Дизайн', 'Minecraft', 'Прототипы'];

export function shownWorks(home: HomeData) {
  const accepted = home.works.filter(w => w.status === 'accepted');
  const main = accepted.filter(w => w.placement === 'main');
  const moreCandidates = accepted.filter(w => w.placement === 'more');
  const more = moreCandidates.length >= home.moreThreshold ? moreCandidates : [];
  return { main, more, all: [...main, ...more] };
}

export function filterTabs(works: HomeWork[]) {
  const tags = new Set(works.flatMap(w => w.tags));
  return ['Все', ...categoryOrder.filter(c => tags.has(c))];
}

export function matchesWork(work: HomeWork, category: string, query: string) {
  const q = query.trim().toLocaleLowerCase('ru');
  return (category === 'Все' || work.tags.includes(category))
    && (!q || [work.title, work.description, work.category, work.stack].join(' ').toLocaleLowerCase('ru').includes(q));
}
