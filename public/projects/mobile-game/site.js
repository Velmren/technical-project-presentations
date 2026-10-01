'use strict';
(() => {
  const zones = {
    forest: {number: 'Первая тропа / 01', title: 'Шепчущий лес', description: 'Шелест травы, деревянные мостики и дорожки под кронами. Здесь Люми знакомится с островом и находит первые следы исчезнувшего ветра.', detail: 'Загляни за деревья: рядом с основной тропой прячутся находки.'},
    village: {number: 'Место встречи / 02', title: 'Деревня Тёплый берег', description: 'Дома, знакомые лица и маленькие заботы жителей. Поговори с соседями, возьми задание и узнай, почему на острове стало так тихо.', detail: 'Возвращайся к жителям после задания — разговор продолжается.'},
    mountain: {number: 'Выше облаков / 03', title: 'Горы Трёх огней', description: 'Каменные дорожки выводят из леса к горным склонам. Здесь особенно пригодятся уклонение, запас зелий и внимательный взгляд на повадки врагов.', detail: 'Перед дорогой проверь снаряжение и запас здоровья.'},
    ruins: {number: 'Следы прошлого / 04', title: 'Руины Памяти', description: 'Старые стены помнят ветер, который потерял остров. Исследуй руины, сражайся с их обитателями и ищи части большой истории.', detail: 'Порыв ветра поможет, когда противники собираются вокруг.'},
    coast: {number: 'Навстречу горизонту / 05', title: 'Берег Возвращения', description: 'Путь заканчивается у моря, но любопытство — нет. Пройди вдоль берега, осмотри тихие уголки и пополни коллекцию островных находок.', detail: 'Реликвии и тайники ждут за пределами главной тропы. Сколько найдёшь ты?'}
  };
  document.querySelectorAll('[data-zone]').forEach(button => button.addEventListener('click', () => {
    const key = button.dataset.zone;
    const zone = zones[key];
    document.querySelectorAll('[data-zone]').forEach(pin => {
      const selected = pin === button;
      pin.classList.toggle('active', selected);
      pin.setAttribute('aria-pressed', String(selected));
    });
    document.getElementById('zone-number').textContent = zone.number;
    document.getElementById('zone-title').textContent = zone.title;
    document.getElementById('zone-description').textContent = zone.description;
    document.getElementById('zone-detail').textContent = zone.detail;
    const image = document.getElementById('zone-image');
    image.src = `./assets/gameplay-${key}.webp`;
    image.alt = `Игровой кадр: ${zone.title}`;
  }));
  document.querySelectorAll('.battle-marker').forEach(button => button.addEventListener('click', () => {
    const opening = button.getAttribute('aria-expanded') !== 'true';
    document.querySelectorAll('.battle-marker').forEach(marker => {
      const active = opening && marker === button;
      marker.setAttribute('aria-expanded', String(active));
      document.getElementById(marker.getAttribute('aria-controls')).hidden = !active;
    });
  }));

  let lastFocus;
  const showDialog = dialog => {
    lastFocus = document.activeElement;
    dialog.showModal();
    document.body.classList.add('modal-open');
    dialog.querySelector('[data-close-dialog]').focus();
  };
  document.querySelectorAll('[data-open-download]').forEach(button => button.addEventListener('click', () => showDialog(document.getElementById('downloads'))));
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.querySelector('[data-close-dialog]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    dialog.addEventListener('close', () => {
      document.body.classList.remove('modal-open');
      lastFocus?.focus();
    });
  });

  const gallery = Array.from(document.querySelectorAll('[data-image]'));
  const lightbox = document.getElementById('lightbox');
  let galleryIndex = 0;
  const renderGallery = index => {
    galleryIndex = (index + gallery.length) % gallery.length;
    const item = gallery[galleryIndex];
    const image = document.getElementById('lightbox-image');
    image.src = item.dataset.image;
    image.alt = item.dataset.caption;
    document.getElementById('lightbox-caption').textContent = item.dataset.caption;
    document.getElementById('lightbox-count').textContent = `${galleryIndex + 1} / ${gallery.length}`;
  };
  gallery.forEach((button, index) => button.addEventListener('click', () => {
    renderGallery(index);
    showDialog(lightbox);
  }));
  document.querySelectorAll('[data-gallery-step]').forEach(button => button.addEventListener('click', () => renderGallery(galleryIndex + Number(button.dataset.galleryStep))));
  lightbox.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      renderGallery(galleryIndex + (event.key === 'ArrowRight' ? 1 : -1));
    }
  });
})();
