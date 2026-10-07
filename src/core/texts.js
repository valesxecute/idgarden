// What each garden item "says", for similarity (keywords and embeddings alike).
// notes are excluded: they collect kept assistant text, which made everything look related
export const ideaText = (i) => [i.title, i.content, i.why, i.tags.join(' ')].join(' ');
export const inspText = (s) => [s.title, s.note, s.caught, s.apply].join(' ');
export const projText = (p) => [p.name, p.goal, p.description].join(' ');
export const learnText = (l) => [l.topic, l.goal, l.notes, l.resources.map((r) => r.title).join(' ')].join(' ');
