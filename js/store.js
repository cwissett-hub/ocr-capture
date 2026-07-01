export function createStore({ load = () => [], save = () => {} } = {}) {
  let items = load() || [];
  let nextId = items.reduce((m, it) => Math.max(m, it.id || 0), 0) + 1;
  const persist = () => save(items.map((it) => ({ ...it })));

  return {
    all() { return items.map((it) => ({ ...it })); },
    add(serial) {
      const dup = items.some((it) => it.serial === serial);
      const item = { id: nextId++, serial, dup };
      items = [item, ...items];
      persist();
      return { ...item };
    },
    remove(id) {
      items = items.filter((it) => it.id !== id);
      persist();
    },
    clear() {
      items = [];
      persist();
    },
  };
}
