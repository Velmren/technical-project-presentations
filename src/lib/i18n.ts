// Languages of the concept C pages. Russian lives at the plain paths, English under /en/.
import type { Project } from './schema';
import type { HomeWork } from './home';

export type Locale = 'ru' | 'en';
export const LANG_KEY = 'velmren.lang';

export const localePath = (locale: Locale, path: string) => locale === 'en' ? '/en' + path : path;

export const UI = {
  ru: {
    nav: 'Основная навигация', work: 'Работы', about: 'Обо мне', contact: 'Контакты', language: 'Язык',
    heroTitle: 'Интерактивные продукты и\u00a0игровые системы',
    heroLead: 'Веб-интерфейсы, игровые механики и небольшие продукты: от идеи до работающей сборки.',
    seeWork: 'Смотреть работы', getInTouch: 'Написать мне',
    structure: 'Структура', pause: 'Остановить смену работ', resume: 'Продолжить смену работ',
    boardLabel: (title: string) => `${title}: открыть проект. Стрелки влево и вправо переключают работы`,
    boardTabs: 'Работы на экране', nowShowing: 'На экране: ',
    categories: 'Категории работ', aboutProject: 'О проекте', allWork: 'Все работы', openProject: 'Открыть проект',
    stack: 'Стек', year: 'Год',
    quote: 'Интересные идеи всегда находят способ стать реальностью.', toTop: 'Наверх',
    tags: { 'Все': 'Все', 'Веб': 'Веб', 'Игры': 'Игры', 'Анимация': 'Анимация', 'Инструменты': 'Инструменты', 'Дизайн': 'Дизайн', 'Minecraft': 'Minecraft' } as Record<string, string>,
  },
  en: {
    nav: 'Main navigation', work: 'Work', about: 'About', contact: 'Contact', language: 'Language',
    heroTitle: 'Interactive products and game systems',
    heroLead: 'Web interfaces, game mechanics and small products, from idea to working build.',
    seeWork: 'See the work', getInTouch: 'Get in touch',
    structure: 'Structure', pause: 'Pause the showcase', resume: 'Resume the showcase',
    boardLabel: (title: string) => `${title}: open the project. Left and right arrows switch works`,
    boardTabs: 'Works on screen', nowShowing: 'Now showing: ',
    categories: 'Work categories', aboutProject: 'About the project', allWork: 'All work', openProject: 'Open the project',
    stack: 'Stack', year: 'Year',
    quote: 'Interesting ideas always find a way to become real.', toTop: 'Back to top',
    tags: { 'Все': 'All', 'Веб': 'Web', 'Игры': 'Games', 'Анимация': 'Animation', 'Инструменты': 'Tools', 'Дизайн': 'Design', 'Minecraft': 'Minecraft' } as Record<string, string>,
  },
} as const;
export type Dictionary = typeof UI[Locale];

export function localizeWork(work: HomeWork, locale: Locale): HomeWork {
  const en = work.en;
  if (locale === 'ru' || !en) return work;
  return {
    ...work,
    title: en.title ?? work.title,
    type: en.type ?? work.type,
    description: en.description ?? work.description,
    action: work.action && { ...work.action, label: en.action ?? work.action.label },
    extra: work.extra && { ...work.extra, label: en.extra ?? work.extra.label },
    details: en.details ?? work.details,
    facts: work.facts?.map((fact, i) => ({ ...fact, ...en.facts?.[i] })),
    preview: work.preview && { ...work.preview, alt: en.alt ?? work.preview.alt, overlay: work.preview.overlay && { ...work.preview.overlay, src: en.overlay ?? work.preview.overlay.src, alt: en.overlayAlt ?? work.preview.overlay.alt } },
    live: work.live && en.slides ? { ...work.live, slides: en.slides } : work.live,
  };
}

// English texts are merged over the Russian project; missing pieces keep the original.
export function localizeProject(project: Project, locale: Locale): Project {
  const en = project.en;
  if (locale === 'ru' || !en) return project;
  // A bilingual work shows its English interface: the screenshot is swapped, its size stays the same.
  const alt = <T extends { src: string; alt: string }>(image: T, text?: string) => ({ ...image, src: en.media?.[image.src] ?? image.src, alt: text ?? image.alt });
  return {
    ...project,
    title: en.title ?? project.title, eyebrow: en.eyebrow ?? project.eyebrow, lead: en.lead ?? project.lead,
    summary: en.summary ?? project.summary, note: en.note ?? project.note, closing: en.closing ?? project.closing,
    actions: project.actions.map((action, i) => ({ ...action, label: en.actions?.[i] ?? action.label })),
    showcase: project.showcase && { ...project.showcase, image: alt(project.showcase.image, en.showcase?.[0]), phone: project.showcase.phone && alt(project.showcase.phone, en.showcase?.[1]) },
    sections: project.sections.map((section, i) => {
      const t = en.sections?.[i];
      if (!t) return section;
      if (section.kind === 'benefit') return { ...section, title: t.title ?? section.title, text: t.text ?? section.text, figure: t.figure ?? section.figure, layers: section.layers.map((layer, j) => ({ ...layer, image: alt(layer.image, t.alts?.[j]) })) };
      if (section.kind === 'features') return { ...section, title: t.title ?? section.title, text: t.text ?? section.text, items: t.items ?? section.items, descriptions: t.descriptions ?? section.descriptions };
      return section;
    }),
  };
}

// Runs before the page paints: a first visit follows the browser language, later visits follow the saved choice.
export function languageGateScript(locale: Locale, alternate: string) {
  return `(function(){try{var s=localStorage.getItem('${LANG_KEY}');var b=((navigator.languages&&navigator.languages[0])||navigator.language||'').toLowerCase();var w=s||(b.indexOf('ru')===0?'ru':'en');${locale === 'en' ? "document.documentElement.lang='en';" : ''}if(w!=='${locale}')location.replace('${alternate}'+location.hash);}catch(e){}})();`;
}
