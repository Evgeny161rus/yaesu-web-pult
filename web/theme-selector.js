// Theme Selector для Yaesu Web Pult
// Управление темами оформления

(function() {
  'use strict';
  
  const THEMES = [
    {
      id: 'modern',
      name: 'Modern Dark',
      description: 'Современная тёмная тема (по умолчанию)',
      icon: '🌙',
      preview: {
        bg: '#0a0e14',
        panel: '#1a1f2b',
        lcd: '#4af0c8',
        accent: '#2ea44f'
      }
    },
    {
      id: 'studio',
      name: 'Studio',
      description: 'Профессиональная синяя тема',
      icon: '🎙',
      preview: {
        bg: '#0d1117',
        panel: '#161b22',
        lcd: '#79c0ff',
        accent: '#58a6ff'
      }
    },
    {
      id: 'daylight',
      name: 'Daylight',
      description: 'Светлая дневная тема',
      icon: '☀️',
      preview: {
        bg: '#f6f8fa',
        panel: '#ffffff',
        lcd: '#0550ae',
        accent: '#0969da'
      }
    },
    {
      id: 'radio-night',
      name: 'Radio Night',
      description: 'Как настоящий трансивер',
      icon: '📻',
      preview: {
        bg: '#0a0a0a',
        panel: '#1a1a1a',
        lcd: '#00ff88',
        accent: '#00ff88'
      }
    },
    {
      id: 'heritage',
      name: 'Heritage',
      description: 'Винтажная янтарная тема',
      icon: '🕰',
      preview: {
        bg: '#1a1410',
        panel: '#2a2018',
        lcd: '#ffcc66',
        accent: '#ffb855'
      }
    },
    {
      id: 'field',
      name: 'Field',
      description: 'Полевая зелёная тема',
      icon: '🏕',
      preview: {
        bg: '#0d1410',
        panel: '#1a2420',
        lcd: '#ccff88',
        accent: '#88dd44'
      }
    },
    {
      id: 'tactical',
      name: 'Tactical',
      description: 'Военный тактический стиль',
      icon: '🪖',
      preview: {
        bg: '#0a0c0a',
        panel: '#1a1c1a',
        lcd: '#aacc88',
        accent: '#88aa66'
      }
    }
  ];
  
  // Получить текущую тему
  function getCurrentTheme() {
    return localStorage.getItem('yaesu-theme') || 'modern';
  }
  
  // Применить тему
  function applyTheme(themeId) {
    const root = document.documentElement;
    
    if (themeId === 'modern' || !themeId) {
      root.removeAttribute('data-appearance');
    } else {
      root.setAttribute('data-appearance', themeId);
    }
    
    // Сохранить в localStorage
    localStorage.setItem('yaesu-theme', themeId);
    
    // Отправить событие
    window.dispatchEvent(new CustomEvent('themechanged', { 
      detail: { theme: themeId } 
    }));
    
    console.log('Theme applied:', themeId);
  }
  
  // Создать UI выбора темы
  function createThemeSelector() {
    const currentTheme = getCurrentTheme();
    
    const html = `
      <div class="theme-selector-overlay" id="themeSelectorOverlay">
        <div class="theme-selector-dialog">
          <div class="theme-selector-header">
            <h2>🎨 Выбор темы оформления</h2>
            <button class="theme-close" id="themeClose">✕</button>
          </div>
          <div class="theme-selector-grid">
            ${THEMES.map(theme => `
              <div class="theme-card ${currentTheme === theme.id ? 'active' : ''}" 
                   data-theme="${theme.id}">
                <div class="theme-preview">
                  <div class="theme-preview-bg" style="background: ${theme.preview.bg}">
                    <div class="theme-preview-panel" style="background: ${theme.preview.panel}">
                      <div class="theme-preview-lcd" style="color: ${theme.preview.lcd}">
                        14.074.000
                      </div>
                      <div class="theme-preview-accent" style="background: ${theme.preview.accent}">
                        USB
                      </div>
                    </div>
                  </div>
                </div>
                <div class="theme-info">
                  <div class="theme-icon">${theme.icon}</div>
                  <div class="theme-details">
                    <div class="theme-name">${theme.name}</div>
                    <div class="theme-description">${theme.description}</div>
                  </div>
                  ${currentTheme === theme.id ? '<div class="theme-badge">✓ Текущая</div>' : ''}
                </div>
              </div>
            `).join('')}
          </div>
          <div class="theme-selector-footer">
            <button class="btn" id="themeApply">Применить</button>
            <button class="btn" id="themeCancel">Отмена</button>
          </div>
        </div>
      </div>
    `;
    
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container.firstElementChild);
    
    attachEventListeners();
  }
  
  // Прикрепить обработчики событий
  function attachEventListeners() {
    const overlay = document.getElementById('themeSelectorOverlay');
    const closeBtn = document.getElementById('themeClose');
    const applyBtn = document.getElementById('themeApply');
    const cancelBtn = document.getElementById('themeCancel');
    const cards = overlay.querySelectorAll('.theme-card');
    
    let selectedTheme = getCurrentTheme();
    
    // Клик по карточке темы
    cards.forEach(card => {
      card.addEventListener('click', () => {
        cards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        selectedTheme = card.dataset.theme;
      });
    });
    
    // Применить тему
    applyBtn.addEventListener('click', () => {
      applyTheme(selectedTheme);
      closeThemeSelector();
    });
    
    // Отмена
    const closeHandler = () => {
      applyTheme(getCurrentTheme()); // Вернуть текущую тему
      closeThemeSelector();
    };
    
    closeBtn.addEventListener('click', closeHandler);
    cancelBtn.addEventListener('click', closeHandler);
    
    // Клик вне диалога
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeHandler();
      }
    });
    
    // ESC для закрытия
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        closeHandler();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }
  
  // Закрыть селектор тем
  function closeThemeSelector() {
    const overlay = document.getElementById('themeSelectorOverlay');
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => {
        overlay.remove();
      }, 300);
    }
  }
  
  // Показать селектор тем
  function showThemeSelector() {
    // Удалить существующий, если есть
    const existing = document.getElementById('themeSelectorOverlay');
    if (existing) {
      existing.remove();
    }
    
    createThemeSelector();
    
    // Анимация появления
    requestAnimationFrame(() => {
      const overlay = document.getElementById('themeSelectorOverlay');
      if (overlay) {
        overlay.style.opacity = '1';
      }
    });
  }
  
  // Инициализация
  function init() {
    // Применить сохранённую тему при загрузке
    const savedTheme = getCurrentTheme();
    applyTheme(savedTheme);
    
    // Создать кнопку выбора темы в настройках
    const createThemeButton = () => {
      const optsTab = document.getElementById('tab-opts');
      if (optsTab) {
        const themeSection = document.createElement('div');
        themeSection.className = 'note';
        themeSection.innerHTML = `
          <h4 style="margin-top: 0">🎨 Оформление пульта</h4>
          <p class="muted small">Выберите цветовую тему интерфейса</p>
          <button class="btn wide" id="btnOpenThemeSelector" style="margin-top: 8px">
            Выбрать тему оформления
          </button>
        `;
        optsTab.insertBefore(themeSection, optsTab.firstChild);
        
        document.getElementById('btnOpenThemeSelector').addEventListener('click', showThemeSelector);
      }
    };
    
    // Создать кнопку при загрузке или через небольшую задержку
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(createThemeButton, 500);
      });
    } else {
      setTimeout(createThemeButton, 500);
    }
  }
  
  // Экспорт API
  window.YaesuThemes = {
    applyTheme,
    getCurrentTheme,
    showThemeSelector,
    themes: THEMES
  };
  
  // Автоинициализация
  init();
  
})();
