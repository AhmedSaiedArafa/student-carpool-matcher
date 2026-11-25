const CONFIG = {
  API_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000/api'
    : `http://${window.location.hostname}:3000/api`,
  WEEKDAYS: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  scheduleLabel(item) {
    if (item.schedule_type === 'once') {
      const d = item.trip_date || item.start_date;
      if (!d) return 'One time';
      const dt = new Date(String(d).slice(0, 10) + 'T00:00:00');
      return 'One time · ' + dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    }
    const days = (item.weekdays || [item.weekday]).sort().map(w => CONFIG.WEEKDAYS[w].slice(0, 3));
    const label = days.length > 0 ? 'Every ' + days.join(' & ') : '';
    if (item.end_date) {
      const ed = new Date(String(item.end_date).slice(0, 10) + 'T00:00:00');
      return label + ' · until ' + ed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    }
    return label;
  },
};

const TW_CONFIG = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'surface-container-low': '#f2f3ff',
        'secondary': '#006c49',
        'background': '#faf8ff',
        'surface-variant': '#dae2fd',
        'surface-container-lowest': '#ffffff',
        'on-secondary': '#ffffff',
        'secondary-container': '#6cf8bb',
        'on-secondary-container': '#00714d',
        'error-container': '#ffdad6',
        'on-error-container': '#93000a',
        'error': '#ba1a1a',
        'on-error': '#ffffff',
        'primary-container': '#2563eb',
        'on-primary-container': '#eeefff',
        'on-primary': '#ffffff',
        'on-surface': '#131b2e',
        'on-surface-variant': '#434655',
        'surface-container': '#eaedff',
        'surface-container-high': '#e2e7ff',
        'surface-container-highest': '#dae2fd',
        'surface': '#faf8ff',
        'primary': '#004ac6',
        'primary-fixed': '#dbe1ff',
        'on-primary-fixed': '#00174b',
        'secondary-fixed': '#6ffbbe',
        'outline': '#737686',
        'outline-variant': '#c3c6d7',
        'inverse-surface': '#283044',
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
};
