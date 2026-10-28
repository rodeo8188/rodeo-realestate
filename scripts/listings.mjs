// 시트 행 → 공개 매물 데이터 변환
// 중요: 아래 FIELDS에 등록된 열만 홈페이지에 나간다.
// 집주인 연락처, 상세 주소, 내부 메모 등 다른 열은 시트에 있어도 절대 공개되지 않는다.

export const PUBLISH_VALUE = '게시';

const FIELDS = {
  id:            { h: ['매물번호'], t: 'text' },
  status:        { h: ['공개상태'], t: 'text' },
  category:      { h: ['카테고리', '매물종류', '매물 유형'], t: 'text' },
  title:         { h: ['매물명', '제목'], t: 'text' },
  deal:          { h: ['거래유형', '거래 유형'], t: 'text' },
  address:       { h: ['공개 주소', '공개주소'], t: 'text' },
  province:      { h: ['시도'], t: 'text' },
  district:      { h: ['시군구'], t: 'text' },
  neighborhood:  { h: ['동/읍면', '동'], t: 'text' },
  salePrice:     { h: ['매매가(원)', '매매가'], t: 'won' },
  deposit:       { h: ['보증금(원)', '보증금', '전세가(원)'], t: 'won' },
  monthlyRent:   { h: ['월세(원)', '월세'], t: 'won' },
  premium:       { h: ['권리금(원)', '권리금'], t: 'won' },
  maintenance:   { h: ['관리비(원)', '관리비'], t: 'won' },
  maintenanceNote:{ h: ['관리비 포함항목', '관리비 내역'], t: 'text' },
  exclusiveArea: { h: ['전용면적(㎡)', '전용면적'], t: 'num' },
  supplyArea:    { h: ['공급면적(㎡)', '공급면적'], t: 'num' },
  landArea:      { h: ['대지면적(㎡)'], t: 'num' },
  buildingArea:  { h: ['건축면적(㎡)'], t: 'num' },
  grossArea:     { h: ['연면적(㎡)'], t: 'num' },
  floor:         { h: ['해당층', '해당 층'], t: 'text' },
  totalFloors:   { h: ['총 층수', '총층수', '지상층'], t: 'text' },
  basement:      { h: ['지하층'], t: 'text' },
  rooms:         { h: ['방 수', '방수'], t: 'text' },
  baths:         { h: ['욕실 수', '욕실수'], t: 'text' },
  direction:     { h: ['방향'], t: 'text' },
  approvalDate:  { h: ['사용승인일'], t: 'text' },
  moveIn:        { h: ['입주가능일', '입주 가능일'], t: 'text' },
  parking:       { h: ['주차 대수', '주차정보', '주차'], t: 'text' },
  elevator:      { h: ['엘리베이터'], t: 'text' },
  buildingUse:   { h: ['건축물 용도', '용도'], t: 'text' },
  structure:     { h: ['구조'], t: 'text' },
  rentalDeposit: { h: ['총 임대보증금(원)'], t: 'won' },
  rentalIncome:  { h: ['월 임대수입(원)'], t: 'won' },
  description:   { h: ['소개글', '공개 설명'], t: 'longtext' },
  youtube:       { h: ['유튜브 링크', '유튜브', '영상 링크'], t: 'text' },
  checkedOn:     { h: ['마지막 확인일'], t: 'text' },
  cover:         { h: ['대표사진 파일명'], t: 'text' },
};

const clean = v => String(v ?? '').normalize('NFKC').trim();
const normId = v => clean(v).toUpperCase();

function parse(type, raw) {
  const s = clean(raw);
  if (!s) return null;
  if (type === 'won' || type === 'num') {
    const n = Number(s.replace(/[,\s원㎡]/g, ''));
    return Number.isFinite(n) && n >= 0 ? n : { invalid: s };
  }
  if (type === 'longtext') return String(raw).trim().slice(0, 3000);
  return s.slice(0, 300);
}

// 탭 하나를 { 매물번호: {key:value} } 로 변환
function readTab(rows) {
  if (!rows.length) return null;
  const headers = rows[0].map(h => clean(h));
  const idCol = headers.indexOf('매물번호');
  if (idCol < 0) return null;
  const cols = {};
  for (const [key, def] of Object.entries(FIELDS)) {
    const i = def.h.map(h => headers.indexOf(clean(h))).find(i => i >= 0);
    if (i !== undefined) cols[key] = i;
  }
  const out = new Map();
  for (const row of rows.slice(1)) {
    const id = normId(row[idCol]);
    if (!id) continue;
    const rec = {};
    for (const [key, i] of Object.entries(cols)) {
      const v = parse(FIELDS[key].t, row[i]);
      if (v !== null) rec[key] = v;
    }
    rec.id = id;
    out.set(id, out.has(id) ? { ...rec, __duplicate: true } : rec);
  }
  return out;
}

export function categoryGroup(category = '') {
  if (/아파트/.test(category)) return '아파트';
  if (/원룸|투룸|쓰리룸|오피스텔|빌라|주택/.test(category) && !/건물|다가구.*매매/.test(category)) return '원룸·투룸';
  if (/상가|사무실|점포/.test(category)) return '상가·사무실';
  if (/건물|다가구|상가주택|빌딩/.test(category)) return '건물';
  return '기타';
}

// 모든 탭을 합쳐 공개 대상 매물 목록과 건너뛴 사유를 반환
export function buildListings(tabs) {
  const mainName = Object.keys(tabs).find(n => clean(n) === '공통매물') || Object.keys(tabs)[0];
  const main = readTab(tabs[mainName] || []);
  if (!main) throw new Error(`'${mainName}' 탭에서 '매물번호' 열을 찾지 못했습니다.`);
  const extras = Object.entries(tabs)
    .filter(([name]) => name !== mainName)
    .map(([, rows]) => readTab(rows))
    .filter(Boolean);

  const listings = [], skipped = [];
  for (const [id, base] of main) {
    if (clean(base.status) !== PUBLISH_VALUE) continue;
    // 공통매물 값이 우선, 비어 있는 항목만 카테고리별 탭에서 채운다.
    const rec = { ...base };
    for (const tab of extras) {
      const extra = tab.get(id);
      if (extra) for (const [k, v] of Object.entries(extra)) if (rec[k] == null) rec[k] = v;
    }
    const problems = [];
    if (base.__duplicate) problems.push('매물번호 중복');
    if (!/^[A-Z]+-\d+$/.test(id)) problems.push('매물번호 형식 오류(예: B-0001)');
    if (!rec.title) problems.push('매물명 없음');
    if (!rec.category) problems.push('카테고리 없음');
    if (!rec.deal) problems.push('거래유형 없음');
    for (const [k, v] of Object.entries(rec)) if (v && typeof v === 'object' && 'invalid' in v) problems.push(`숫자 형식 오류: ${FIELDS[k].h[0]} "${v.invalid}"`);
    const deal = clean(rec.deal);
    if (deal === '매매' && rec.salePrice == null) problems.push('매매가 없음');
    if (deal === '전세' && rec.deposit == null) problems.push('보증금(전세가) 없음');
    if (deal === '월세' && (rec.deposit == null || rec.monthlyRent == null)) problems.push('보증금 또는 월세 없음');
    if (problems.length) { skipped.push({ id, reason: problems.join(', ') }); continue; }
    delete rec.status; delete rec.__duplicate; delete rec.cover;
    rec.coverFile = base.cover ?? rec.cover;
    rec.group = categoryGroup(rec.category);
    listings.push(rec);
  }
  listings.reverse(); // 시트 아래쪽(최근 입력) 매물이 먼저 보이도록
  return { listings, skipped };
}

export function youtubeId(url = '') {
  const m = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/))([\w-]{11})/.exec(url);
  return m ? m[1] : null;
}
