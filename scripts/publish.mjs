// 구글시트(매물정보) + 구글드라이브(사진) → 정적 홈페이지(dist/) 생성
// 실행: node scripts/publish.mjs            (실제 데이터, 환경변수 필요)
//       node scripts/publish.mjs --sample   (가짜 샘플 데이터로 시험)
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { buildListings } from './listings.mjs';
import { renderIndex, renderDetail, renderSitemap } from './render.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const CACHE = path.join(ROOT, '.cache', 'images');
const SAMPLE = process.argv.includes('--sample');
const MAX_PHOTOS = 30;
const siteUrl = (process.env.SITE_URL || '').replace(/\/$/, '');

const log = [], warn = [];
const say = m => { console.log(m); log.push(m); };
const caution = m => { console.warn('⚠ ' + m); warn.push(m); if (process.env.GITHUB_ACTIONS) console.log(`::warning::${m}`); };

async function source() {
  if (SAMPLE) return (await import('./sample-data.mjs')).sampleSource();
  const { getAccessToken, readAllTabs, listPropertyFolders, listImages, download } = await import('./google.mjs');
  const need = ['GOOGLE_SERVICE_ACCOUNT_JSON', 'SHEET_ID', 'DRIVE_FOLDER_ID'].filter(k => !process.env[k]);
  if (need.length) throw new Error(`설정값이 없습니다: ${need.join(', ')} (GitHub > Settings > Secrets 에 등록 필요)`);
  const { token, email } = await getAccessToken(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  say(`구글 서비스 계정 로그인: ${email}`);
  return {
    tabs: () => readAllTabs(token, process.env.SHEET_ID),
    folders: () => listPropertyFolders(token, process.env.DRIVE_FOLDER_ID),
    images: id => listImages(token, id),
    download: id => download(token, id),
  };
}

const natural = (a, b) => a.localeCompare(b, 'ko', { numeric: true, sensitivity: 'base' });
const folderMatches = (name, id) => {
  const n = name.normalize('NFKC').trim().toUpperCase();
  return n === id || (n.startsWith(id) && !/[0-9A-Z]/.test(n[id.length]));
};

async function processImage(src, file) {
  const key = crypto.createHash('sha1').update(`${file.id}:${file.md5Checksum || file.modifiedTime}:v1`).digest('hex').slice(0, 16);
  const full = path.join(CACHE, `${key}.webp`), thumb = path.join(CACHE, `${key}-t.webp`);
  try { await fs.access(full); await fs.access(thumb); return { key, full, thumb, cached: true }; } catch {}
  const buf = await src.download(file.id);
  const img = sharp(buf, { failOn: 'error' }).rotate();
  await img.clone().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toFile(full);
  await img.clone().resize({ width: 640, height: 427, fit: 'cover' }).webp({ quality: 72 }).toFile(thumb);
  return { key, full, thumb, cached: false };
}

const LEGAL_HINT = {
  default: [['totalFloors', '총 층수'], ['approvalDate', '사용승인일'], ['direction', '방향'], ['parking', '주차'], ['moveIn', '입주가능일']],
  residential: [['rooms', '방 수'], ['baths', '욕실 수'], ['maintenance', '관리비']],
};

async function main() {
  const started = Date.now();
  const src = await source();
  const { listings, skipped } = buildListings(await src.tabs());
  say(`시트에서 '게시' 상태 매물 ${listings.length + skipped.length}건 확인`);
  for (const s of skipped) caution(`${s.id} 게시 제외 — ${s.reason}`);

  await fs.rm(DIST, { recursive: true, force: true });
  await fs.mkdir(DIST, { recursive: true });
  await fs.mkdir(CACHE, { recursive: true });
  for (const f of await fs.readdir(path.join(ROOT, 'web'))) await fs.copyFile(path.join(ROOT, 'web', f), path.join(DIST, f));

  const folders = await src.folders();
  let newPhotos = 0;
  for (const p of listings) {
    p.images = [];
    const cover = p.coverFile; delete p.coverFile;
    if (/^\d+$/.test(p.parking ?? '')) p.parking += '대';
    const folder = folders.filter(f => folderMatches(f.name, p.id)).sort((a, b) => natural(a.name, b.name))[0];
    if (!folder) { caution(`${p.id} 사진 폴더 없음 (드라이브에 '${p.id}' 이름의 폴더 필요) — 사진 없이 게시`); continue; }
    let files = (await src.images(folder.id)).sort((a, b) => natural(a.name, b.name));
    if (cover) {
      const i = files.findIndex(f => f.name === cover || f.name.replace(/\.[^.]+$/, '') === cover);
      if (i > 0) files.unshift(...files.splice(i, 1));
      else if (i < 0) caution(`${p.id} 대표사진 '${cover}' 파일을 찾지 못해 첫 번째 사진을 대표로 사용`);
    }
    if (files.length > MAX_PHOTOS) { caution(`${p.id} 사진 ${files.length}장 중 앞의 ${MAX_PHOTOS}장만 사용`); files = files.slice(0, MAX_PHOTOS); }
    const dir = path.join(DIST, 'images', p.id);
    await fs.mkdir(dir, { recursive: true });
    for (const file of files) {
      try {
        const r = await processImage(src, file);
        if (!r.cached) newPhotos++;
        await fs.copyFile(r.full, path.join(dir, `${r.key}.webp`));
        await fs.copyFile(r.thumb, path.join(dir, `${r.key}-t.webp`));
        p.images.push({ full: `images/${p.id}/${r.key}.webp`, thumb: `images/${p.id}/${r.key}-t.webp` });
      } catch {
        caution(`${p.id} 사진 '${file.name}' 변환 실패 — JPG/PNG로 다시 올려주세요 (아이폰 HEIC는 변환이 안 될 수 있음)`);
      }
    }
    if (!p.images.length) caution(`${p.id} 사용할 수 있는 사진이 없음 — 사진 없이 게시`);
    const hints = [...LEGAL_HINT.default, ...(['아파트', '원룸·투룸'].includes(p.group) ? LEGAL_HINT.residential : [])]
      .filter(([k]) => p[k] == null || p[k] === '').map(([, label]) => label);
    if (hints.length) caution(`${p.id} 광고 명시 권장 항목 비어 있음: ${hints.join(', ')}`);
  }

  await fs.writeFile(path.join(DIST, 'index.html'), renderIndex(listings, { siteUrl }));
  for (const p of listings) {
    await fs.mkdir(path.join(DIST, 'p', p.id), { recursive: true });
    await fs.writeFile(path.join(DIST, 'p', p.id, 'index.html'), renderDetail(p, { siteUrl }));
  }
  // 향후 인스타·유튜브·블로그 자동화에서 재사용할 공개 데이터
  await fs.writeFile(path.join(DIST, 'listings.json'), JSON.stringify({ updatedAt: new Date().toISOString(), listings }, null, 1));
  await fs.writeFile(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\n${siteUrl ? `Sitemap: ${siteUrl}/sitemap.xml\n` : ''}`);
  if (siteUrl) await fs.writeFile(path.join(DIST, 'sitemap.xml'), renderSitemap(listings, siteUrl));
  await fs.writeFile(path.join(DIST, '.nojekyll'), '');

  say(`홈페이지 생성 완료: 게시 ${listings.length}건, 제외 ${skipped.length}건, 새로 변환한 사진 ${newPhotos}장 (${((Date.now() - started) / 1000).toFixed(1)}초)`);

  // 변경 여부 판단: 현재 공개된 홈페이지의 listings.json과 비교 (변경 없으면 배포 생략)
  const digest = v => crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
  let changed = true;
  if (siteUrl && !process.env.FORCE_DEPLOY) {
    try {
      const res = await fetch(`${siteUrl}/listings.json`, { cache: 'no-store' });
      if (res.ok) changed = digest((await res.json()).listings) !== digest(listings);
    } catch { /* 첫 배포이거나 접속 실패 → 배포 진행 */ }
  }
  say(changed ? '홈페이지를 업데이트합니다.' : '바뀐 내용이 없어 배포를 생략합니다.');
  if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    const md = [`## 매물 홈페이지 업데이트 결과`, '', ...log.map(l => `- ${l}`), '',
      warn.length ? `### 확인이 필요한 항목 (${warn.length})` : '### 확인이 필요한 항목 없음', ...warn.map(w => `- ⚠ ${w}`), '',
      '| 매물번호 | 매물명 | 거래 | 사진 |', '|---|---|---|---|', ...listings.map(p => `| ${p.id} | ${p.title} | ${p.deal} | ${p.images.length}장 |`)];
    await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, md.join('\n') + '\n');
  }
}

main().catch(async e => {
  const msg = String(e?.message || e).replace(/[\r\n]+/g, ' ');
  console.error('❌ 실패: ' + msg);
  // GitHub 실행 화면(요약/주석)에 원인이 바로 보이도록 남긴다
  if (process.env.GITHUB_ACTIONS) console.log(`::error title=홈페이지 생성 실패::${msg}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, `## ❌ 홈페이지 생성 실패\n\n${msg}\n\n${log.map(l => `- ${l}`).join('\n')}\n`).catch(() => {});
  }
  process.exitCode = 1;
});
