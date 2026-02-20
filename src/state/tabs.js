const KEY = 'smbank_tabs';
const bus = new EventTarget();

export function getTabs() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setTabs(tabs) {
  localStorage.setItem(KEY, JSON.stringify(tabs));
  bus.dispatchEvent(new Event('update'));
}

export function addTab(tab) {
  const tabs = getTabs();
  if (!tabs.find(t => t.to === tab.to)) {
    setTabs([...tabs, tab]);
  } else {
    setTabs(tabs);
  }
}

export function closeTab(to) {
  const tabs = getTabs().filter(t => t.to !== to);
  setTabs(tabs);
}

export function onTabsUpdate(cb) {
  const handler = () => cb(getTabs());
  bus.addEventListener('update', handler);
  const storageHandler = (e) => {
    if (e.key === KEY) handler();
  };
  window.addEventListener('storage', storageHandler);
  return () => {
    bus.removeEventListener('update', handler);
    window.removeEventListener('storage', storageHandler);
  };
}
