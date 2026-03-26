#!/usr/bin/env node
/**
 * Push scripts/onboarding-catalog.json to Firestore — fill-only: does not overwrite
 * non-empty fields on existing documents (adds missing data + unions course lists).
 *
 * Env: GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
 *
 * Usage: node scripts/catalog-push.mjs [--catalog path] [--dry-run] [--project id]
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';

function parseArgs(argv) {
  const args = { catalog: null, dryRun: false, projectId: null, help: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--catalog' && argv[i + 1]) args.catalog = argv[++i];
    else if (a === '--project' && argv[i + 1]) args.projectId = argv[++i];
    else if (a === '--help' || a === '-h') args.help = true;
  }
  return args;
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function cleanLogo(url) {
  if (!url || typeof url !== 'string') return '';
  return url.trim().replace(/\s+/g, '');
}

function isNonEmptyStr(s) {
  return typeof s === 'string' && s.trim().length > 0;
}

function buildCourseId(universityId, code, explicitId) {
  if (explicitId && String(explicitId).trim()) return String(explicitId).trim();
  return `${slugify(universityId)}__${slugify(code)}`;
}

function buildOrgId(universityId, name, explicitId) {
  if (explicitId && String(explicitId).trim()) return String(explicitId).trim();
  return `${slugify(universityId)}__org__${slugify(name)}`;
}

function nameKey(universityId, name) {
  return `${universityId.trim()}::${name.toLowerCase().trim()}`;
}

function parseProfArray(arr) {
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

async function loadCatalog(catalogPath) {
  const raw = await readFile(resolve(catalogPath), 'utf8');
  const data = JSON.parse(raw);
  if (data._comment !== undefined) delete data._comment;
  return data;
}

function mergeColorsExistingData(existingColors, incoming) {
  const next = { ...(existingColors || {}) };
  if (!isNonEmptyStr(next.primary) && incoming?.primary) next.primary = incoming.primary;
  if (!isNonEmptyStr(next.secondary) && incoming?.secondary) next.secondary = incoming.secondary;
  if (!isNonEmptyStr(next.primary)) next.primary = '#6366f1';
  if (!isNonEmptyStr(next.secondary)) next.secondary = '#8b92a7';
  return next;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(`catalog-push.mjs
  --catalog <path>   default: scripts/onboarding-catalog.json
  --dry-run
  --project <id>     optional Firebase project id
`);
    process.exit(0);
  }

  const catalogPath =
    args.catalog || resolve(process.cwd(), 'scripts/onboarding-catalog.json');

  let catalog;
  try {
    catalog = await loadCatalog(catalogPath);
  } catch (e) {
    console.error(`Cannot read catalog at ${catalogPath}:`, e.message);
    process.exit(1);
  }

  const universities = Array.isArray(catalog.universities) ? catalog.universities : [];
  const organizations = Array.isArray(catalog.organizations) ? catalog.organizations : [];
  const courses = Array.isArray(catalog.courses) ? catalog.courses : [];
  const extraProfessors = Array.isArray(catalog.professors) ? catalog.professors : [];

  if (!universities.length) {
    console.error('Catalog must include at least one university.');
    process.exit(1);
  }

  if (args.dryRun) {
    console.log('[dry-run] Would push (fill-missing only on existing docs):', {
      universities: universities.length,
      organizations: organizations.length,
      courses: courses.length,
      professorExtras: extraProfessors.length,
    });
    process.exit(0);
  }

  const { default: admin } = await import('firebase-admin');
  const { FieldValue } = await import('firebase-admin/firestore');

  if (!admin.apps.length) {
    const init = { credential: admin.credential.applicationDefault() };
    if (args.projectId) init.projectId = args.projectId;
    admin.initializeApp(init);
  }

  const db = admin.firestore();

  const uniById = new Map();
  for (const u of universities) {
    const name = (u.name || '').trim();
    if (!name) continue;
    const id = (u.id && String(u.id).trim()) || slugify(name);
    uniById.set(id, { ...u, id, name });
  }

  for (const u of uniById.values()) {
    const ref = db.collection('universities').doc(u.id);
    const snap = await ref.get();
    const data = snap.exists ? snap.data() : {};

    if (!snap.exists) {
      await ref.set({
        name: u.name,
        logo: cleanLogo(u.logo || ''),
        image: (u.image || '').trim(),
        colors: u.colors || { primary: '#6366f1', secondary: '#8b92a7' },
        nameLowercase: u.name.toLowerCase().trim(),
        createdAt: FieldValue.serverTimestamp(),
      });
      console.log('University created:', u.id, u.name);
      continue;
    }

    const payload = {};
    if (!isNonEmptyStr(data.name) && u.name) {
      payload.name = u.name;
      payload.nameLowercase = u.name.toLowerCase().trim();
    }
    if (!isNonEmptyStr(data.logo) && u.logo) payload.logo = cleanLogo(u.logo);
    if (!isNonEmptyStr(data.image) && u.image) payload.image = u.image.trim();

    const needsColors =
      (!isNonEmptyStr(data.colors?.primary) && u.colors?.primary) ||
      (!isNonEmptyStr(data.colors?.secondary) && u.colors?.secondary);
    if (needsColors) {
      payload.colors = mergeColorsExistingData(data.colors, u.colors);
    }

    if (Object.keys(payload).length) {
      await ref.set(payload, { merge: true });
      console.log('University patched (gaps only):', u.id);
    } else {
      console.log('University unchanged:', u.id);
    }
  }

  for (const o of organizations) {
    const universityId = (o.universityId || '').trim();
    if (!universityId || !uniById.has(universityId)) {
      console.warn('Skipping organization (unknown universityId):', o.name, universityId);
      continue;
    }
    const name = (o.name || '').trim();
    if (!name) continue;
    const docId = buildOrgId(universityId, name, o.id);
    const ref = db.collection('organizations').doc(docId);
    const osnap = await ref.get();
    const data = osnap.exists ? osnap.data() : {};
    const members = osnap.exists ? data.members || [] : [];
    const logoIn = cleanLogo(o.logo);
    const descIn = (o.description || '').trim();

    if (!osnap.exists) {
      await ref.set({
        name,
        logo: logoIn,
        description: descIn,
        universityId,
        colors: o.colors || { primary: '#6366f1', secondary: '#8b92a7' },
        nameLowercase: name.toLowerCase().trim(),
        members,
      });
      console.log('Organization created:', docId, name);
      continue;
    }

    const payload = {};
    if (!isNonEmptyStr(data.name) && name) {
      payload.name = name;
      payload.nameLowercase = name.toLowerCase().trim();
    }
    if (!isNonEmptyStr(data.logo) && logoIn) payload.logo = logoIn;
    if (!isNonEmptyStr(data.description) && descIn) payload.description = descIn;
    if (
      (!isNonEmptyStr(data.colors?.primary) && o.colors?.primary) ||
      (!isNonEmptyStr(data.colors?.secondary) && o.colors?.secondary)
    ) {
      payload.colors = mergeColorsExistingData(data.colors, o.colors);
    }

    if (Object.keys(payload).length) {
      await ref.set(payload, { merge: true });
      console.log('Organization patched (gaps only):', docId);
    } else {
      console.log('Organization unchanged:', docId);
    }
  }

  const courseDocIds = [];
  const canonicalProfNameByKey = new Map();

  for (const c of courses) {
    const universityId = (c.universityId || '').trim();
    if (!universityId || !uniById.has(universityId)) {
      console.warn('Skipping course (unknown universityId):', c.code, universityId);
      continue;
    }
    const code = (c.code || '').trim();
    const name = (c.name || '').trim();
    if (!code || !name) {
      console.warn('Skipping course (missing code/name):', c);
      continue;
    }
    const professorNames = Array.isArray(c.professors)
      ? [...new Set(c.professors.map((p) => String(p).trim()).filter(Boolean))]
      : [];
    for (const pname of professorNames) {
      const pk = nameKey(universityId, pname);
      if (!canonicalProfNameByKey.has(pk)) canonicalProfNameByKey.set(pk, pname);
    }
    const docId = buildCourseId(universityId, code, c.id);
    const ref = db.collection('courses').doc(docId);
    const csnap = await ref.get();
    const data = csnap.exists ? csnap.data() : {};
    const members = csnap.exists ? data.members || [] : [];
    const desc = (c.description || '').trim();

    if (!csnap.exists) {
      const doc = {
        code,
        name,
        universityId,
        professors: professorNames,
        members,
        createdAt: FieldValue.serverTimestamp(),
      };
      if (desc) doc.description = desc;
      await ref.set(doc);
      console.log('Course created:', docId, code);
      courseDocIds.push({ docId, universityId, professorNames });
      continue;
    }

    const payload = {};
    if (!isNonEmptyStr(data.code) && code) payload.code = code;
    if (!isNonEmptyStr(data.name) && name) payload.name = name;
    if (!isNonEmptyStr(data.description) && desc) payload.description = desc;
    const prevP = parseProfArray(data.professors);
    const mergedP = [...new Set([...prevP, ...professorNames])];
    if (mergedP.length > prevP.length) payload.professors = mergedP;

    if (Object.keys(payload).length) {
      await ref.set(payload, { merge: true });
      console.log('Course patched (gaps / new professors):', docId);
    } else {
      console.log('Course unchanged:', docId);
    }
    courseDocIds.push({ docId, universityId, professorNames: mergedP });
  }

  const courseIdsByProf = new Map();
  for (const row of courseDocIds) {
    for (const pname of row.professorNames) {
      const k = nameKey(row.universityId, pname);
      if (!courseIdsByProf.has(k)) courseIdsByProf.set(k, new Set());
      courseIdsByProf.get(k).add(row.docId);
    }
  }

  for (const p of extraProfessors) {
    const universityId = (p.universityId || '').trim();
    const name = (p.name || '').trim();
    if (!universityId || !name || !uniById.has(universityId)) continue;
    const k = nameKey(universityId, name);
    if (!canonicalProfNameByKey.has(k)) canonicalProfNameByKey.set(k, name);
    if (!courseIdsByProf.has(k)) courseIdsByProf.set(k, new Set());
    if (Array.isArray(p.courseIds)) {
      for (const cid of p.courseIds) {
        if (cid && String(cid).trim()) courseIdsByProf.get(k).add(String(cid).trim());
      }
    }
  }

  for (const [k, idSet] of courseIdsByProf) {
    const sep = k.indexOf('::');
    const universityId = sep === -1 ? k : k.slice(0, sep);
    const profLookup = sep === -1 ? '' : k.slice(sep + 2);
    const profName = canonicalProfNameByKey.get(k) || profLookup;
    const courseIds = [...idSet];

    const q = await db
      .collection('professors')
      .where('universityId', '==', universityId)
      .get();

    let profRef = null;
    let profData = null;
    for (const doc of q.docs) {
      const n = (doc.data().name || '').toLowerCase().trim();
      if (n === profName.toLowerCase().trim()) {
        profRef = doc.ref;
        profData = doc.data();
        break;
      }
    }

    const extra = extraProfessors.find(
      (e) =>
        (e.universityId || '').trim() === universityId &&
        (e.name || '').toLowerCase().trim() === profName.toLowerCase().trim(),
    );

    if (profRef) {
      const updates = {};
      if (courseIds.length > 0) {
        updates.courses = FieldValue.arrayUnion(...courseIds);
      }
      if (extra?.email && String(extra.email).trim() && !isNonEmptyStr(profData?.email)) {
        updates.email = String(extra.email).trim();
      }
      if (extra?.image && String(extra.image).trim() && !isNonEmptyStr(profData?.image)) {
        updates.image = String(extra.image).trim();
      }
      if (Object.keys(updates).length > 0) {
        await profRef.update(updates);
        console.log('Professor updated:', profRef.id, profName);
      }
    } else {
      const row = {
        name: profName,
        universityId,
        courses: courseIds,
        averageRating: {
          totalRating: 5,
          difficulty: 1,
          enjoyment: 5,
          retakePercentage: 100,
          understandability: 5,
        },
        createdAt: FieldValue.serverTimestamp(),
      };
      if (extra?.email && String(extra.email).trim()) row.email = String(extra.email).trim();
      if (extra?.image && String(extra.image).trim()) row.image = String(extra.image).trim();
      const added = await db.collection('professors').add(row);
      console.log('Professor created:', added.id, profName);
    }
  }

  console.log('Done. Processed catalog from', catalogPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
