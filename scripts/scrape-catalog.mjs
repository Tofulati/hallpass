#!/usr/bin/env node
/**
 * Configurable catalog scraper → JSON consumed by catalog-push.mjs.
 *
 * - sections.* toggles what to scrape (universities, courses, organizations, professors).
 * - University rows: Wikipedia infobox + REST summary for names, logo image, hero image.
 * - courses: htmlTable or htmlBlocks; codeSelector optional for htmlBlocks (parse "DEPT 123. Title" from name text).
 *   descriptionSelector may start with "+ " for the adjacent sibling (e.g. "+ .course-descriptions").
 * - organizations: htmlList / htmlBlocks (itemSelector) or htmlTable (rowSelector + nameSelector).
 * - professors: htmlTable or htmlBlocks (rowSelector + nameSelector; optional imageSelector, profileLinkSelector).
 *   (you must set URLs and CSS selectors for your target pages).
 *
 * Wikipedia requires a descriptive User-Agent: https://meta.wikimedia.org/wiki/User-Agent_policy
 *
 * By default each run **replaces** scripts/onboarding-catalog.json (no merge with the previous file).
 * Set `"mergeExisting": true` in the config, or pass `--merge`, to merge with the existing JSON instead.
 * Within a run, multiple schools still merge together; catalog-lib still prefers non-empty fields when merging.
 *
 * Usage:
 *   node scripts/scrape-catalog.mjs --config scripts/scraper-config.json
 *   node scripts/scrape-catalog.mjs --config scripts/scraper-config.json --dry-run
 *   node scripts/scrape-catalog.mjs --config scripts/scraper-config.json --merge
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';
import { load as loadHtml } from 'cheerio';
import {
  mergeUniversities,
  mergeCoursesCatalog,
  mergeOrganizationsCatalog,
  mergeProfessorsCatalog,
} from './catalog-lib.mjs';

const UA =
  'HallpassCatalogScraper/1.0 (private admin tooling; https://wikimediafoundation.org/wiki/Policy:User-Agent_policy)';

function parseArgs(argv) {
  const args = {
    config: null,
    dryRun: false,
    merge: false,
    help: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--merge') args.merge = true;
    else if (a === '--config' && argv[i + 1]) args.config = argv[++i];
    else if (a === '--help' || a === '-h') args.help = true;
  }
  return args;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function stripMeta(obj) {
  if (!obj || typeof obj !== 'object') return;
  for (const k of Object.keys(obj)) {
    if (k.startsWith('_comment')) delete obj[k];
    else if (typeof obj[k] === 'object' && obj[k] !== null) stripMeta(obj[k]);
  }
}

function absolutize(src, baseUrl) {
  if (!src || typeof src !== 'string') return '';
  const s = src.trim();
  if (s.startsWith('//')) return `https:${s}`;
  if (s.startsWith('http')) return s;
  try {
    return new URL(s, baseUrl).href;
  } catch {
    return s;
  }
}

function normalizeText(value) {
  if (value == null) return '';
  return String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanCourseCode(value) {
  return normalizeText(value).replace(/[.:;,\s]+$/g, '');
}

function cleanCourseName(value) {
  return normalizeText(value).replace(/\s+[.:;,\-–—]+$/g, '').replace(/[.:;,\s]+$/g, '');
}

function cleanDescription(value) {
  const base = normalizeText(value);
  if (!base) return '';
  // Remove common category preambles from some club directory pages.
  const cleaned = base
    .replace(/^Campus Organizations\s*[-:]\s*/i, '')
    .replace(/^Departments and Programs\s*[-:]\s*/i, '');
  if (/^(Campus Organizations|Departments and Programs)$/i.test(cleaned)) return '';
  return cleaned.length > 240 ? `${cleaned.slice(0, 237).trim()}...` : cleaned;
}

async function fetchText(url, { json = false } = {}) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: json ? 'application/json' : 'text/html,*/*' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return json ? res.json() : res.text();
}

async function fetchWikipediaSummary(title) {
  const path = encodeURIComponent(title.replace(/ /g, '_'));
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${path}`;
  return fetchText(url, { json: true });
}

async function fetchWikipediaParseHtml(title) {
  const params = new URLSearchParams({
    action: 'parse',
    page: title,
    prop: 'text',
    format: 'json',
    formatversion: '2',
  });
  const url = `https://en.wikipedia.org/w/api.php?${params}`;
  const data = await fetchText(url, { json: true });
  if (data.error) throw new Error(data.error.info || JSON.stringify(data.error));
  return data.parse?.html || '';
}

function infoboxImages(html) {
  const $ = loadHtml(html);
  const $box = $('.infobox, .infobox_v2, table.infobox').first();
  const urls = [];
  $box.find('img').each((_, el) => {
    let src = $(el).attr('src') || $(el).attr('data-src') || '';
    src = absolutize(src, 'https://en.wikipedia.org');
    if (src && !src.toLowerCase().includes('wikipedia.org/static') && !src.includes('1x1')) {
      urls.push(src);
    }
  });
  const logo = urls[0] || '';
  const image =
    urls.find((u) => !/logo|seal/i.test(u)) ||
    urls[1] ||
    '';
  return { logo, image: image || logo, all: urls };
}

async function scrapeUniversityFromWikipedia({ wikipediaTitle, id, colors, nameOverride, logoOverride, imageOverride }) {
  const title = wikipediaTitle.trim();
  const [summary, html] = await Promise.all([
    fetchWikipediaSummary(title),
    fetchWikipediaParseHtml(title),
  ]);
  const { logo, image, all } = infoboxImages(html);

  const name = normalizeText(nameOverride || summary.title || title.replace(/_/g, ' '));
  const hero =
    summary.originalimage?.source ||
    summary.thumbnail?.source ||
    image ||
    all[1] ||
    logo;
  const sealOrLogo = logo || all[0] || '';

  const scrapedLogo = sealOrLogo || hero || '';
  const scrapedImage = hero || sealOrLogo || '';

  return {
    id,
    name,
    logo: normalizeText(logoOverride || scrapedLogo),
    image: normalizeText(imageOverride || scrapedImage),
    colors: colors || { primary: '#6366f1', secondary: '#8b92a7' },
  };
}

/**
 * Parse "CSE 100. Introduction to Computing" or "CSE 100 Introduction..." into code + title.
 */
function stripCatalogUnitsSuffix(title) {
  return cleanCourseName(String(title).replace(/\s*\(\d+\)\s*$/u, ''));
}

function parseCourseCodeAndName(raw) {
  const text = normalizeText(raw);
  if (!text) return { code: '', name: '' };
  const m = text.match(
    /^([A-Z]{2,10}(?:\s+[A-Z]{2,10})?\s+\d{1,4}[A-Z]?)\s*[.:;\-–—]\s*(.+)$/i,
  );
  if (m) {
    return {
      code: cleanCourseCode(m[1]),
      name: stripCatalogUnitsSuffix(m[2]),
    };
  }
  const m2 = text.match(/^([A-Z]{2,10}(?:\s+[A-Z]{2,10})?\s+\d{1,4}[A-Z]?)\s+(.+)$/i);
  if (m2) {
    return {
      code: cleanCourseCode(m2[1]),
      name: stripCatalogUnitsSuffix(m2[2]),
    };
  }
  return { code: '', name: stripCatalogUnitsSuffix(text) };
}

function courseNameElement($row, nameSelector, $) {
  if (!nameSelector || nameSelector === ':scope') return $row;
  return $row.find(nameSelector).first();
}

function splitProfessors(cell, pattern) {
  let re = /[,;/]/;
  if (pattern && String(pattern).trim()) {
    try {
      re = new RegExp(String(pattern));
    } catch {
      console.warn('Invalid professorsSplitPattern; using default split');
    }
  }
  return cell
    .split(re)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/** Professor rows in an HTML table (one row per person). */
async function scrapeHtmlTable(source, universityId) {
  const { url, rowSelector, nameSelector, emailSelector } = source;

  if (!url || !rowSelector || !nameSelector) {
    throw new Error('htmlTable requires url, rowSelector, and nameSelector');
  }

  const html = await fetchText(url);
  const $ = loadHtml(html);
  const rows = [];

  $(rowSelector).each((_, el) => {
    const $row = $(el);
    const $nameEl = courseNameElement($row, nameSelector, $);
    const name = normalizeText($nameEl.text());
    const email = emailSelector ? normalizeText($row.find(emailSelector).first().text()) : '';
    if (name) {
      rows.push({
        universityId,
        name,
        email: email || undefined,
      });
    }
  });

  return rows;
}

async function scrapeCoursesFromHtml(source, universityId) {
  const {
    url,
    rowSelector,
    codeSelector,
    nameSelector,
    professorsSelector,
    professorsSplitPattern,
    descriptionSelector,
  } = source;

  if (!url || !rowSelector || !nameSelector) {
    throw new Error('course source requires url, rowSelector, nameSelector');
  }

  const html = await fetchText(url);
  const $ = loadHtml(html);
  const rows = [];

  $(rowSelector).each((_, el) => {
    const $row = $(el);
    const $nameEl = courseNameElement($row, nameSelector, $);

    let code = '';
    let name = '';
    if (codeSelector && String(codeSelector).trim()) {
      code = cleanCourseCode($row.find(codeSelector).first().text());
      name = cleanCourseName($nameEl.text());
    } else {
      const parsed = parseCourseCodeAndName($nameEl.text());
      code = parsed.code;
      name = parsed.name;
    }

    let desc = '';
    if (descriptionSelector && String(descriptionSelector).trim()) {
      const ds = String(descriptionSelector).trim();
      if (ds.startsWith('+')) {
        const sel = ds.replace(/^\+\s*/, '');
        const $sib = $row.next(sel);
        desc = cleanDescription($sib.text());
      } else {
        desc = cleanDescription($row.find(ds).first().text());
      }
    }

    const profCell = professorsSelector ? normalizeText($row.find(professorsSelector).first().text()) : '';

    if (!code || !name) return;
    const row = {
      code,
      name,
      universityId,
      professors: profCell ? splitProfessors(profCell, professorsSplitPattern) : [],
    };
    if (desc) row.description = desc;
    rows.push(row);
  });

  return rows;
}

async function scrapeOrgHtmlTable(source, universityId, defaultColors) {
  const { url, rowSelector, nameSelector, descriptionSelector, logoSelector, logoAttr } = source;
  if (!url || !rowSelector || !nameSelector) {
    throw new Error('org htmlTable requires url, rowSelector, nameSelector');
  }
  const html = await fetchText(url);
  const $ = loadHtml(html);
  const items = [];

  $(rowSelector).each((_, el) => {
    const $row = $(el);
    const $nameEl = $row.find(nameSelector).first();
    const name = normalizeText($nameEl.text());
    const descRaw = descriptionSelector ? $row.find(descriptionSelector).first().text() : '';
    const desc = cleanDescription(descRaw);
    const $logoEl = logoSelector ? $row.find(logoSelector).first() : null;
    const rawLogo = $logoEl
      ? $logoEl.attr(logoAttr || 'src') || $logoEl.attr('data-src') || $logoEl.attr('href') || ''
      : '';
    const logo = normalizeText(rawLogo ? absolutize(rawLogo, url) : '');
    if (name) {
      items.push({
        universityId,
        name,
        logo,
        description: desc || '',
        colors: defaultColors || { primary: '#6366f1', secondary: '#8b92a7' },
      });
    }
  });

  return items;
}

async function scrapeProfessorBlocks(source, universityId) {
  const { url, rowSelector, nameSelector, emailSelector, imageSelector, imageAttr } = source;
  if (!url || !rowSelector || !nameSelector) {
    throw new Error('professor htmlBlocks requires url, rowSelector, nameSelector');
  }
  const html = await fetchText(url);
  const $ = loadHtml(html);
  const rows = [];

  $(rowSelector).each((_, el) => {
    const $row = $(el);
    const $nameEl = courseNameElement($row, nameSelector, $);
    const name = normalizeText($nameEl.text());
    if (!name) return;
    const email = emailSelector ? normalizeText($row.find(emailSelector).first().text()) : '';
    let image = '';
    if (imageSelector) {
      const $img = $row.find(imageSelector).first();
      const src = $img.attr(imageAttr || 'src') || $img.attr('data-src') || '';
      image = normalizeText(src ? absolutize(src, url) : '');
    }
    rows.push({
      universityId,
      name,
      email: email || undefined,
      image: image || undefined,
    });
  });

  return rows;
}

async function scrapeHtmlList(source, universityId, defaultColors) {
  const { url, itemSelector, nameSelector, descriptionSelector, logoSelector, logoAttr } = source;
  const html = await fetchText(url);
  const $ = loadHtml(html);
  const items = [];

  $(itemSelector).each((_, el) => {
    const $el = $(el);
    const $nameEl = nameSelector ? $el.find(nameSelector).first() : $el;
    const name = normalizeText($nameEl.text());
    const descRaw = descriptionSelector ? $el.find(descriptionSelector).first().text() : '';
    const desc = cleanDescription(descRaw);
    const $logoEl = logoSelector ? $el.find(logoSelector).first() : null;
    const rawLogo = $logoEl
      ? $logoEl.attr(logoAttr || 'src') || $logoEl.attr('data-src') || $logoEl.attr('href') || ''
      : '';
    const logo = normalizeText(rawLogo ? absolutize(rawLogo, url) : '');
    if (name)
      items.push({
        universityId,
        name,
        logo,
        description: desc || '',
        colors: defaultColors || { primary: '#6366f1', secondary: '#8b92a7' },
      });
  });

  return items;
}

/** Course scrape: table row or repeated block (e.g. .courseblock). */
function isCourseHtmlSource(s) {
  if (!s?.url || !s.rowSelector || !s.nameSelector) return false;
  const t = s.type;
  return t === 'htmlTable' || t === 'htmlBlocks';
}

/** Org scrape: list items or table rows. */
function isOrgHtmlSource(s) {
  if (!s?.url) return false;
  const t = s.type;
  if (t === 'htmlList' || t === 'htmlBlocks') return !!s.itemSelector;
  if (t === 'htmlTable') return !!(s.rowSelector && s.nameSelector);
  return false;
}

function isProfessorHtmlSource(s) {
  if (!s?.url || !s.rowSelector || !s.nameSelector) return false;
  return s.type === 'htmlTable' || s.type === 'htmlBlocks';
}

function dedupeProfessors(rows) {
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    const key = `${r.universityId}::${r.name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

function buildProfessorsFromCourses(courses) {
  const map = new Map();
  for (const c of courses) {
    const uni = c.universityId;
    const names = c.professors || [];
    for (const n of names) {
      const key = `${uni}::${n.toLowerCase()}`;
      if (!map.has(key)) map.set(key, { universityId: uni, name: n });
    }
  }
  return [...map.values()];
}

async function loadExistingCatalog(outputPath) {
  try {
    const raw = await readFile(resolve(outputPath), 'utf8');
    const data = JSON.parse(raw);
    stripMeta(data);
    return {
      universities: Array.isArray(data.universities) ? data.universities : [],
      courses: Array.isArray(data.courses) ? data.courses : [],
      organizations: Array.isArray(data.organizations) ? data.organizations : [],
      professors: Array.isArray(data.professors) ? data.professors : [],
    };
  } catch {
    return { universities: [], courses: [], organizations: [], professors: [] };
  }
}

function normalizeCatalog(catalog) {
  catalog.universities = (catalog.universities || []).map((u) => ({
    ...u,
    name: normalizeText(u.name),
    logo: normalizeText(u.logo),
    image: normalizeText(u.image),
    colors: u.colors || { primary: '#6366f1', secondary: '#8b92a7' },
  }));
  catalog.courses = (catalog.courses || []).map((c) => ({
    ...c,
    code: cleanCourseCode(c.code),
    name: cleanCourseName(c.name),
    description: cleanDescription(c.description),
    professors: Array.isArray(c.professors)
      ? c.professors.map((p) => normalizeText(p)).filter(Boolean)
      : [],
  }));
  catalog.organizations = (catalog.organizations || []).map((o) => ({
    ...o,
    name: normalizeText(o.name),
    logo: normalizeText(o.logo),
    description: cleanDescription(o.description),
    colors: o.colors || { primary: '#6366f1', secondary: '#8b92a7' },
  }));
  catalog.professors = (catalog.professors || []).map((p) => ({
    ...p,
    name: normalizeText(p.name),
    email: normalizeText(p.email),
    image: normalizeText(p.image),
  }));
  return catalog;
}

function pruneEmptyFields(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(pruneEmptyFields);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    if (Array.isArray(v) && v.length === 0 && (k === 'professors' || k === 'courseIds')) {
      out[k] = v;
      continue;
    }
    out[k] = typeof v === 'object' ? pruneEmptyFields(v) : v;
  }
  return out;
}

async function main() {
  const argv = parseArgs(process.argv);
  if (argv.help) {
    console.log(`scrape-catalog.mjs
  --config <path>   Scraper config JSON (required)
  --dry-run         Fetch and log counts only; do not write output
  --merge           Merge with existing output file (otherwise overwrite file each run)
`);
    process.exit(0);
  }

  if (!argv.config) {
    console.error('Pass --config scripts/scraper-config.json');
    process.exit(1);
  }

  let cfg;
  try {
    const raw = await readFile(resolve(argv.config), 'utf8');
    cfg = JSON.parse(raw);
    stripMeta(cfg);
  } catch (e) {
    console.error('Bad config:', e.message);
    process.exit(1);
  }

  const outputPath = resolve(cfg.outputPath || 'scripts/onboarding-catalog.json');
  const delayMs = typeof cfg.delayMs === 'number' ? cfg.delayMs : 800;
  const sections = {
    universities: cfg.sections?.universities !== false,
    courses: cfg.sections?.courses === true,
    organizations: cfg.sections?.organizations === true,
    professors: cfg.sections?.professors === true,
  };

  const mergeFromDisk = argv.merge || cfg.mergeExisting === true;
  let catalog = mergeFromDisk
    ? await loadExistingCatalog(outputPath)
    : { universities: [], courses: [], organizations: [], professors: [] };
  catalog = normalizeCatalog(catalog);

  const targets = Array.isArray(cfg.universities) ? cfg.universities : [];
  if (!targets.length) {
    console.error('config.universities must be a non-empty array');
    process.exit(1);
  }

  const scrapedUniversities = [];
  const scrapedCourses = [];
  const scrapedOrgs = [];
  let scrapedProfessors = [];

  for (const u of targets) {
    stripMeta(u);
    const id = (u.id || '').trim();
    if (!id) {
      console.warn('Skipping university entry without id');
      continue;
    }

    const defaultColors = u.colors || { primary: '#6366f1', secondary: '#8b92a7' };
    const sources = u.sources || {};

    if (sections.universities) {
      if (u.wikipediaTitle) {
        console.log(`[wiki] ${u.wikipediaTitle} → ${id}`);
        if (argv.dryRun) {
          scrapedUniversities.push({
            id,
            name: u.wikipediaTitle,
            logo: '(dry-run)',
            image: '(dry-run)',
            colors: defaultColors,
          });
        } else {
          const uni = await scrapeUniversityFromWikipedia({
            wikipediaTitle: u.wikipediaTitle,
            id,
            colors: defaultColors,
            nameOverride: u.name,
            logoOverride: u.logo,
            imageOverride: u.image,
          });
          scrapedUniversities.push(uni);
          await sleep(delayMs);
        }
      } else if (u.name) {
        scrapedUniversities.push({
          id,
          name: normalizeText(u.name),
          logo: normalizeText(u.logo || ''),
          image: normalizeText(u.image || ''),
          colors: defaultColors,
        });
      } else {
        console.warn(`No wikipediaTitle or static name for ${id}; skipping university scrape`);
      }
    }

    if (sections.courses && isCourseHtmlSource(sources.courses)) {
      console.log(`[courses] ${id} ← ${sources.courses.url}`);
      if (argv.dryRun) {
        scrapedCourses.push({ universityId: id, _dry: true });
      } else {
        const courses = await scrapeCoursesFromHtml(sources.courses, id);
        scrapedCourses.push(...courses);
        console.log(`  rows: ${courses.length}`);
        await sleep(delayMs);
      }
    }

    if (sections.organizations && isOrgHtmlSource(sources.organizations)) {
      console.log(`[orgs] ${id} ← ${sources.organizations.url}`);
      if (argv.dryRun) {
        scrapedOrgs.push({ universityId: id, _dry: true });
      } else {
        const orgs =
          sources.organizations.type === 'htmlTable'
            ? await scrapeOrgHtmlTable(sources.organizations, id, defaultColors)
            : await scrapeHtmlList(sources.organizations, id, defaultColors);
        scrapedOrgs.push(...orgs);
        console.log(`  items: ${orgs.length}`);
        await sleep(delayMs);
      }
    }

    if (sections.professors && isProfessorHtmlSource(sources.professors)) {
      console.log(`[professors] ${id} ← ${sources.professors.url}`);
      if (argv.dryRun) {
        scrapedProfessors.push({ universityId: id, _dry: true });
      } else {
        const normalized =
          sources.professors.type === 'htmlTable'
            ? await scrapeHtmlTable(sources.professors, id)
            : await scrapeProfessorBlocks(sources.professors, id);
        scrapedProfessors.push(...normalized);
        console.log(`  rows: ${normalized.length}`);
        await sleep(delayMs);
      }
    }
  }

  const hadProfessorSource = targets.some((u) => isProfessorHtmlSource(u.sources?.professors));
  if (
    sections.professors &&
    !hadProfessorSource &&
    scrapedCourses.some((c) => Array.isArray(c.professors) && c.professors.length > 0)
  ) {
    const inferred = buildProfessorsFromCourses(scrapedCourses);
    scrapedProfessors = dedupeProfessors([...scrapedProfessors, ...inferred]);
    console.log(`[professors] inferred ${inferred.length} unique names from course rows`);
  }

  if (sections.courses && !targets.some((u) => isCourseHtmlSource(u.sources?.courses))) {
    console.warn(
      '[courses] sections.courses is true but no university has sources.courses with type htmlTable/htmlBlocks (needs url, rowSelector, nameSelector; codeSelector optional — parsed from title if omitted)',
    );
  }
  if (sections.organizations && !targets.some((u) => isOrgHtmlSource(u.sources?.organizations))) {
    console.warn(
      '[organizations] sections.organizations is true but no valid sources.organizations (htmlList/htmlBlocks: itemSelector; htmlTable: rowSelector + nameSelector)',
    );
  }
  if (
    sections.professors &&
    !hadProfessorSource &&
    !scrapedCourses.some((c) => Array.isArray(c.professors) && c.professors.length > 0)
  ) {
    console.warn(
      '[professors] sections.professors is true but no professor htmlTable/htmlBlocks source or instructor column on courses was scraped',
    );
  }

  if (argv.dryRun) {
    console.log('[dry-run] Summary:', {
      sections,
      universities: scrapedUniversities.length,
      courses: scrapedCourses.filter((c) => !c._dry).length,
      organizations: scrapedOrgs.filter((o) => !o._dry).length,
      professors: scrapedProfessors.filter((p) => !p._dry).length,
      outputPath,
    });
    process.exit(0);
  }

  if (sections.universities && scrapedUniversities.length) {
    catalog.universities = mergeUniversities(catalog.universities, scrapedUniversities);
  }

  if (sections.courses && scrapedCourses.length) {
    catalog.courses = mergeCoursesCatalog(catalog.courses, scrapedCourses);
  }

  if (sections.organizations && scrapedOrgs.length) {
    catalog.organizations = mergeOrganizationsCatalog(catalog.organizations, scrapedOrgs);
  }

  if (sections.professors && scrapedProfessors.length) {
    scrapedProfessors = dedupeProfessors(scrapedProfessors);
    catalog.professors = mergeProfessorsCatalog(catalog.professors, scrapedProfessors);
  }

  const out = pruneEmptyFields({
    _generatedBy: 'scrape-catalog.mjs',
    universities: catalog.universities,
    courses: catalog.courses,
    organizations: catalog.organizations,
    professors: catalog.professors,
  });

  await writeFile(outputPath, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
  console.log('Wrote', outputPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
