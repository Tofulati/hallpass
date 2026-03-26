/**
 * Shared helpers for catalog JSON merges (scraper output).
 * Rule: never replace a non-empty field with an empty one; prefer existing over scraped for conflicts.
 */

export function isNonEmpty(v) {
  if (v == null) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
}

export function slugify(s) {
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function preferExisting(primary, fallback) {
  return isNonEmpty(primary) ? primary : fallback;
}

function isDefaultColor(value) {
  const v = String(value || '').trim().toLowerCase();
  return v === '#6366f1' || v === '#8b92a7';
}

function pickColor(existing, incoming, fallbackDefault) {
  const ex = String(existing || '').trim();
  const inc = String(incoming || '').trim();
  if (!isNonEmpty(ex)) return inc || fallbackDefault;
  // If existing is just the generic default and incoming has a real value, prefer incoming.
  if (isDefaultColor(ex) && isNonEmpty(inc) && !isDefaultColor(inc)) return inc;
  return ex;
}

function cleanText(t) {
  if (!isNonEmpty(t)) return '';
  return String(t).replace(/\s+/g, ' ').trim();
}

function pickBetterText(existing, incoming) {
  const ex = cleanText(existing);
  const inc = cleanText(incoming);
  if (!isNonEmpty(ex)) return inc;
  if (!isNonEmpty(inc)) return ex;
  const exNoisy = /[\n\t]|Campus Organizations|Departments and Programs/i.test(String(existing || ''));
  const incNoisy = /[\n\t]|Campus Organizations|Departments and Programs/i.test(String(incoming || ''));
  if (exNoisy && !incNoisy) return inc;
  return ex;
}

export function mergeUniversities(existingList, incomingList) {
  const byId = new Map(existingList.map((u) => [u.id, { ...u }]));
  for (const inc of incomingList) {
    if (!inc?.id) continue;
    const ex = byId.get(inc.id);
    if (!ex) {
      byId.set(inc.id, { ...inc });
      continue;
    }
    byId.set(inc.id, {
      ...inc,
      ...ex,
      name: preferExisting(ex.name, inc.name),
      logo: preferExisting(ex.logo, inc.logo),
      image: preferExisting(ex.image, inc.image),
      colors: {
        primary: pickColor(ex.colors?.primary, inc.colors?.primary, '#6366f1'),
        secondary: pickColor(ex.colors?.secondary, inc.colors?.secondary, '#8b92a7'),
      },
    });
  }
  return [...byId.values()];
}

function normProfList(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const p of arr) {
    if (typeof p === 'string') {
      const t = p.trim();
      if (t) out.push(t);
    } else if (p && typeof p === 'object' && p.name) {
      const t = String(p.name).trim();
      if (t) out.push(t);
    }
  }
  return [...new Set(out)];
}

function mergeCourseRow(ex, inc) {
  return {
    ...inc,
    ...ex,
    universityId: ex.universityId || inc.universityId,
    code: preferExisting(ex.code, inc.code) || inc.code,
    name: preferExisting(ex.name, inc.name) || inc.name,
    description: pickBetterText(ex.description, inc.description),
    professors: [...new Set([...normProfList(ex.professors), ...normProfList(inc.professors)])],
  };
}

export function mergeCoursesCatalog(existingList, scrapedRows) {
  const rows = scrapedRows.filter((c) => c && !c._dry && c.universityId && c.code);
  const byUni = new Map();
  for (const c of rows) {
    if (!byUni.has(c.universityId)) byUni.set(c.universityId, []);
    byUni.get(c.universityId).push(c);
  }
  let out = existingList;
  for (const [uniId, incoming] of byUni) {
    const others = out.filter((c) => c.universityId !== uniId);
    const prev = out.filter((c) => c.universityId === uniId);
    const map = new Map();
    for (const c of prev) map.set(slugify(c.code), { ...c });
    for (const inc of incoming) {
      const k = slugify(inc.code);
      const ex = map.get(k);
      if (!ex) map.set(k, { ...inc });
      else map.set(k, mergeCourseRow(ex, inc));
    }
    out = [...others, ...map.values()];
  }
  return out;
}

function mergeOrgRow(ex, inc) {
  return {
    ...inc,
    ...ex,
    universityId: ex.universityId || inc.universityId,
    name: preferExisting(ex.name, inc.name) || inc.name,
    logo: preferExisting(ex.logo, inc.logo),
    description: pickBetterText(ex.description, inc.description),
    colors: {
      primary: pickColor(ex.colors?.primary, inc.colors?.primary, '#6366f1'),
      secondary: pickColor(ex.colors?.secondary, inc.colors?.secondary, '#8b92a7'),
    },
  };
}

export function mergeOrganizationsCatalog(existingList, scrapedRows) {
  const rows = scrapedRows.filter((o) => o && !o._dry && o.universityId && o.name);
  const byUni = new Map();
  for (const o of rows) {
    if (!byUni.has(o.universityId)) byUni.set(o.universityId, []);
    byUni.get(o.universityId).push(o);
  }
  let out = existingList;
  for (const [uniId, incoming] of byUni) {
    const others = out.filter((o) => o.universityId !== uniId);
    const prev = out.filter((o) => o.universityId === uniId);
    const map = new Map();
    for (const o of prev) map.set(slugify(o.name), { ...o });
    for (const inc of incoming) {
      const k = slugify(inc.name);
      const ex = map.get(k);
      if (!ex) map.set(k, { ...inc });
      else map.set(k, mergeOrgRow(ex, inc));
    }
    out = [...others, ...map.values()];
  }
  return out;
}

export function mergeProfessorsCatalog(existingList, scrapedRows) {
  const rows = scrapedRows.filter((p) => p && !p._dry && p.universityId && p.name);
  const key = (p) => `${p.universityId.trim()}::${p.name.toLowerCase().trim()}`;
  const map = new Map();
  for (const p of existingList) {
    if (p.universityId && p.name) map.set(key(p), { ...p });
  }
  for (const inc of rows) {
    const k = key(inc);
    const ex = map.get(k);
    if (!ex) {
      map.set(k, { ...inc });
      continue;
    }
    map.set(k, {
      ...inc,
      ...ex,
      name: preferExisting(ex.name, inc.name),
      email: preferExisting(ex.email, inc.email),
      image: preferExisting(ex.image, inc.image),
    });
  }
  return [...map.values()];
}
