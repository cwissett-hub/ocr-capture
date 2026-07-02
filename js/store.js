export function createStore({ load = () => [], save = () => {} } = {}) {
  let items = load() || [];
  let nextId = items.reduce((m, it) => Math.max(m, it.id || 0), 0) + 1;
  const persist = () => save(items.map((it) => ({ ...it })));

  return {
    all() { return items.map((it) => ({ ...it })); },
    add(serial, ts = null) {
      const dup = items.some((it) => it.serial === serial);
      const item = { id: nextId++, serial, dup, ts };
      items = [item, ...items];
      persist();
      return { ...item };
    },
    update(id, serial) {
      items = items.map((it) => it.id === id
        ? { ...it, serial, dup: items.some((o) => o.id !== id && o.serial === serial) }
        : it);
      persist();
    },
    remove(id) { items = items.filter((it) => it.id !== id); persist(); },
    clear() { items = []; persist(); },
  };
}
