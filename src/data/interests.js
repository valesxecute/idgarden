// Interest ids = Discover source groups (scripts/sources.json)
export const INTERESTS = [
  { id: 'science', label: 'Science', emoji: '🔬' },
  { id: 'research', label: 'Research papers', emoji: '📄' },
  { id: 'health', label: 'Health', emoji: '🌿' },
  { id: 'psychology', label: 'Psychology', emoji: '🧠' },
  { id: 'tech', label: 'Technology', emoji: '💻' },
  { id: 'design', label: 'Design', emoji: '🎨' },
  { id: 'architecture', label: 'Architecture', emoji: '🏛️' },
  { id: 'business', label: 'Business', emoji: '📈' },
  { id: 'education', label: 'Learning', emoji: '🎓' },
  { id: 'culture', label: 'Culture & ideas', emoji: '🎭' },
  { id: 'writing', label: 'Books & writing', emoji: '📚' },
  { id: 'food', label: 'Food', emoji: '🍜' },
  { id: 'news', label: 'World news', emoji: '🌍' },
];
export const interest = (id) => INTERESTS.find((i) => i.id === id);
