// Languages of the concept C pages. Russian lives at the plain paths, English under /en/.
import type { Project } from './schema';
import type { HomeWork } from './home';

export type Locale = 'ru' | 'en';
export const LANG_KEY = 'velmren.lang';

export const localePath = (locale: Locale, path: string) => locale === 'en' ? '/en' + path : path;

// The addresses a page names as its language versions; path is the Russian one.
// x-default is the English page: it serves everyone the Russian one is not written for.
export const languageAddresses = (path: string) => ({ ru: path, en: localePath('en', path), 'x-default': localePath('en', path) });

export const UI = {
  ru: {
    nav: 'Основная навигация', work: 'Работы', services: 'Услуги', video: 'Видео', about: 'Обо мне', contact: 'Контакты', language: 'Язык',
    // On a work page: the link to the service this work is an example of.
    serviceLink: (name: string) => `Услуга: ${name}`,
    // Shown on an English page to a visitor whose browser is Russian.
    thisLanguage: 'Версия на русском', closeHint: 'Закрыть',
    // Contacts: the footer block, the contacts page and the line under a work or a clip.
    telegram: 'Telegram', writeTelegram: 'Написать в Telegram',
    copyMail: 'Скопировать адрес', mailCopied: 'Адрес скопирован', mailCopyFailed: 'Не скопировалось, выделите адрес',
    contactsLead: 'Расскажите, что нужно сделать и к какому сроку.',
    contactsAbout: 'Написать VELMREN: Telegram @velmren и почта hello@velmren.com. Сайты, интернет-магазины, игры и моушен-графика на заказ.',
    askSimilar: 'Нужно что-то похожее?', askClip: 'Нужен такой ролик?',
    firstMessage: 'Что написать в первом сообщении',
    firstMessageItems: ['Что нужно сделать: сайт, магазин, игра, ролик', 'К какому сроку', 'Ссылки на то, что нравится или уже есть'],
    // What the practice does, in the words clients search with: the home title, its description and the first screen.
    siteTitle: 'VELMREN · Сайты, интернет-магазины, игры и моушен на заказ',
    siteAbout: 'Сайты на Tilda, WordPress и Next.js, интернет-магазины, админ-панели, игры на Godot и моушен-графика. Работы можно открыть и проверить.',
    heroTitle: 'Сайты, магазины, игры и\u00a0моушен',
    heroLead: 'Веб-интерфейсы, игровые механики и небольшие продукты: от идеи до работающей сборки.',
    seeWork: 'Смотреть работы',
    structure: 'Структура', pause: 'Остановить смену работ', resume: 'Продолжить смену работ',
    boardLabel: (title: string) => `${title}: открыть проект. Стрелки влево и вправо переключают работы`,
    boardTabs: 'Работы на экране', nowShowing: 'На экране: ',
    categories: 'Категории работ', aboutProject: 'О проекте', allWork: 'Все работы', openProject: 'Открыть проект',
    stack: 'Стек', year: 'Год',
    quote: 'Интересные идеи всегда находят способ стать реальностью.', toTop: 'Наверх',
    tags: { 'Все': 'Все', 'Веб': 'Веб', 'Игры': 'Игры', 'Анимация': 'Анимация', '3D': '3D', 'Инструменты': 'Инструменты', 'Дизайн': 'Дизайн', 'Minecraft': 'Minecraft' } as Record<string, string>,
  },
  en: {
    nav: 'Main navigation', work: 'Work', services: 'Services', video: 'Video', about: 'About', contact: 'Contact', language: 'Language',
    serviceLink: (name: string) => `Service: ${name}`,
    // Shown on a Russian page to a visitor whose browser is not Russian.
    thisLanguage: 'English version', closeHint: 'Close',
    telegram: 'Telegram', writeTelegram: 'Write on Telegram',
    copyMail: 'Copy address', mailCopied: 'Address copied', mailCopyFailed: 'Not copied, select the address',
    contactsLead: 'Tell me what you need and by when.',
    contactsAbout: 'Write to VELMREN: Telegram @velmren and hello@velmren.com. Websites, online stores, games and motion graphics made to order.',
    askSimilar: 'Need something similar?', askClip: 'Need a video like this?',
    firstMessage: 'What to put in the first message',
    firstMessageItems: ['What needs to be made: a site, a store, a game, a video', 'By when', 'Links to what you like or already have'],
    siteTitle: 'VELMREN · Websites, online stores, games and motion design',
    siteAbout: 'Websites on Tilda, WordPress and Next.js, online stores, admin dashboards, Godot games and motion graphics. Every work can be opened and tried.',
    heroTitle: 'Websites, stores, games and motion design',
    heroLead: 'Web interfaces, game mechanics and small products, from idea to working build.',
    seeWork: 'See the work',
    structure: 'Structure', pause: 'Pause the showcase', resume: 'Resume the showcase',
    boardLabel: (title: string) => `${title}: open the project. Left and right arrows switch works`,
    boardTabs: 'Works on screen', nowShowing: 'Now showing: ',
    categories: 'Work categories', aboutProject: 'About the project', allWork: 'All work', openProject: 'Open the project',
    stack: 'Stack', year: 'Year',
    quote: 'Interesting ideas always find a way to become real.', toTop: 'Back to top',
    tags: { 'Все': 'All', 'Веб': 'Web', 'Игры': 'Games', 'Анимация': 'Animation', '3D': '3D', 'Инструменты': 'Tools', 'Дизайн': 'Design', 'Minecraft': 'Minecraft' } as Record<string, string>,
  },
} as const;
export type Dictionary = typeof UI[Locale];

export function localizeWork(work: HomeWork, locale: Locale): HomeWork {
  const en = work.en;
  if (locale === 'ru' || !en) return work;
  const swap = (src: string) => en.media?.[src] ?? src;
  const live = work.live && {
    ...work.live,
    video: work.live.video && { src: swap(work.live.video.src), poster: swap(work.live.video.poster) },
    scroll: work.live.scroll && swap(work.live.scroll),
    slides: en.slides ?? work.live.slides?.map(swap),
  };
  return {
    ...work,
    title: en.title ?? work.title,
    type: en.type ?? work.type,
    description: en.description ?? work.description,
    action: work.action && { ...work.action, label: en.action ?? work.action.label },
    extra: work.extra && { ...work.extra, label: en.extra ?? work.extra.label },
    details: en.details ?? work.details,
    facts: work.facts?.map((fact, i) => ({ ...fact, ...en.facts?.[i] })),
    preview: work.preview && { ...work.preview, src: swap(work.preview.src), alt: en.alt ?? work.preview.alt, overlay: work.preview.overlay && { ...work.preview.overlay, src: en.overlay ?? swap(work.preview.overlay.src), alt: en.overlayAlt ?? work.preview.overlay.alt } },
    live,
  };
}

// English texts are merged over the Russian project; missing pieces keep the original.
export function localizeProject(project: Project, locale: Locale): Project {
  const en = project.en;
  if (locale === 'ru' || !en) return project;
  // A bilingual work shows its English interface: the screenshot is swapped, its size stays the same.
  // A looping clip is swapped the same way when the project lists an English one.
  const clip = (video?: string) => video && (en.media?.[video] ?? video);
  const alt = <T extends { src: string; alt: string }>(image: T, text?: string) => ({ ...image, src: en.media?.[image.src] ?? image.src, alt: text ?? image.alt });
  return {
    ...project,
    // The English page never falls back to the Russian search title: without its own it takes the English title.
    seo: en.seo,
    title: en.title ?? project.title, eyebrow: en.eyebrow ?? project.eyebrow, lead: en.lead ?? project.lead,
    summary: en.summary ?? project.summary, note: en.note ?? project.note, closing: en.closing ?? project.closing,
    actions: project.actions.map((action, i) => ({ ...action, label: en.actions?.[i] ?? action.label })),
    showcase: project.showcase && { ...project.showcase, video: clip(project.showcase.video), image: alt(project.showcase.image, en.showcase?.[0]), phone: project.showcase.phone && alt(project.showcase.phone, en.showcase?.[1]) },
    sections: project.sections.map((section, i) => {
      const t = en.sections?.[i];
      if (!t) return section;
      if (section.kind === 'benefit') return { ...section, title: t.title ?? section.title, text: t.text ?? section.text, figure: t.figure ?? section.figure, layers: section.layers.map((layer, j) => ({ ...layer, video: clip(layer.video), image: alt(layer.image, t.alts?.[j]) })) };
      if (section.kind === 'features') return { ...section, title: t.title ?? section.title, text: t.text ?? section.text, items: t.items ?? section.items, descriptions: t.descriptions ?? section.descriptions };
      return section;
    }),
  };
}

// The language a first-time visitor reads, by the browser setting: Russian for a Russian browser, English otherwise.
export const browserLocale = (language: string): Locale => language.toLowerCase().startsWith('ru') ? 'ru' : 'en';
