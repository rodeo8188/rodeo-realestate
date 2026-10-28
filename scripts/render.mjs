// 정적 HTML 생성 (홈 + 매물 상세)
import { youtubeId } from './listings.mjs';

export const OFFICE = {
  name: '로데오부동산',
  broker: '이정경',
  address: '대전광역시 서구 둔산동 1469번지 2층',
  mobile: '010-5735-8188',
  office: '042-824-0032',
  regNo: '30170-2026-00051',
};
const tel = n => n.replace(/\D/g, '');

export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function won(n) {
  if (n == null) return '';
  if (n >= 1e8) {
    const eok = Math.floor(n / 1e8), man = Math.round((n % 1e8) / 1e4);
    return `${eok.toLocaleString('ko-KR')}억${man ? ' ' + man.toLocaleString('ko-KR') + '만' : ''}원`;
  }
  if (n >= 1e4) return `${(Math.round(n / 1e4)).toLocaleString('ko-KR')}만원`;
  return `${n.toLocaleString('ko-KR')}원`;
}
const m2 = n => (n == null ? '' : `${Number(n).toLocaleString('ko-KR', { maximumFractionDigits: 2 })}㎡`);

export function priceText(p) {
  if (p.deal === '매매') return { label: '매매', value: won(p.salePrice) };
  if (p.deal === '전세') return { label: '전세', value: won(p.deposit) };
  if (p.deal === '월세') return { label: '월세', value: `${won(p.deposit)} / ${won(p.monthlyRent)}` };
  return { label: p.deal, value: won(p.salePrice ?? p.deposit) };
}
const region = p => [p.province, p.district, p.neighborhood].filter(Boolean).join(' ');
const place = p => p.address || region(p);

function mainArea(p) {
  if (p.exclusiveArea != null) return `전용 ${m2(p.exclusiveArea)}`;
  if (p.grossArea != null) return `연면적 ${m2(p.grossArea)}`;
  if (p.supplyArea != null) return `공급 ${m2(p.supplyArea)}`;
  if (p.landArea != null) return `대지 ${m2(p.landArea)}`;
  return '';
}
function cardMeta(p) {
  return [
    mainArea(p),
    p.floor && p.totalFloors ? `${p.floor}/${p.totalFloors}층` : p.totalFloors ? `총 ${p.totalFloors}층` : '',
    p.rooms ? `방 ${p.rooms}${p.baths ? ' · 욕실 ' + p.baths : ''}` : p.buildingUse || '',
  ].filter(Boolean);
}

function head({ title, description, base, url, image, siteUrl }) {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  ${siteUrl ? `<meta property="og:url" content="${esc(siteUrl + url)}"><link rel="canonical" href="${esc(siteUrl + url)}">` : ''}
  ${image && siteUrl ? `<meta property="og:image" content="${esc(siteUrl + image)}">` : ''}
  <link rel="stylesheet" href="${base}styles.css">
  <link rel="stylesheet" href="${base}customer-mobile.css">
  <link rel="stylesheet" href="${base}listing.css">
  <link rel="stylesheet" href="${base}site.css">
  <script src="${base}site.js" defer></script>
</head>
<body>
  <a class="skip-link" href="#main-content">본문으로 바로가기</a>
  <header class="header">
    <a class="brand" href="${base}" aria-label="로데오부동산 홈"><span class="brand-icon">R<span>·</span></span><span>로데오<span class="brand-light">부동산</span></span></a>
    <nav aria-label="주 메뉴"><a href="${base}#properties">매물 보기</a><a href="${base}#about">로데오 소개</a><a href="${base}#contact">상담 문의 <span>↗</span></a></nav>
  </header>`;
}

function officeBlock() {
  return `<dl class="office-info">
    <div><dt>상호</dt><dd>${OFFICE.name}</dd></div>
    <div><dt>대표 공인중개사</dt><dd>${OFFICE.broker}</dd></div>
    <div><dt>소재지</dt><dd>${OFFICE.address}</dd></div>
    <div><dt>연락처</dt><dd><a href="tel:${tel(OFFICE.mobile)}">${OFFICE.mobile}</a> · <a href="tel:${tel(OFFICE.office)}">${OFFICE.office}</a></dd></div>
    <div><dt>중개사무소 등록번호</dt><dd>${OFFICE.regNo}</dd></div>
  </dl>`;
}

function contactButtons(propertyId) {
  const body = propertyId ? `안녕하세요. 홈페이지에서 매물번호 ${propertyId} 보고 문의드립니다.` : '안녕하세요. 홈페이지 보고 매물 문의드립니다.';
  return `<div class="contact-actions">
    <a class="button orange" href="tel:${tel(OFFICE.mobile)}">전화 상담 ${OFFICE.mobile}</a>
    <a class="button blue-button" href="sms:${tel(OFFICE.mobile)}?&body=${encodeURIComponent(body)}">문자 문의하기</a>
    <a class="button line-button" href="tel:${tel(OFFICE.office)}">사무실 ${OFFICE.office}</a>
  </div>`;
}

function footer(base, propertyId) {
  const body = propertyId ? `매물번호 ${propertyId} 문의드립니다.` : '홈페이지 보고 문의드립니다.';
  return `<footer>
    <div class="container footer-inner"><a class="brand" href="${base}"><span class="brand-icon">R<span>·</span></span><span>로데오<span class="brand-light">부동산</span></span></a><p>당신의 공간, 새로운 가능성.</p><small>© ${new Date().getFullYear()} RODEO REAL ESTATE</small></div>
    <div class="container footer-note">상호 ${OFFICE.name} · 대표 공인중개사 ${OFFICE.broker} · ${OFFICE.address} · 중개사무소 등록번호 ${OFFICE.regNo} · 전화 ${OFFICE.mobile}, ${OFFICE.office}</div>
  </footer>
  <aside class="mobile-consult-bar" aria-label="상담 바로가기"><a href="sms:${tel(OFFICE.mobile)}?&body=${encodeURIComponent(body)}">문자 문의 <span>${propertyId ? esc(propertyId) + ' ' : ''}↗</span></a><a class="quick-call" href="tel:${tel(OFFICE.mobile)}">전화 상담</a></aside>
</body>
</html>`;
}

function card(p, base) {
  const img = p.images[0];
  const price = priceText(p);
  const url = `${base}p/${p.id}/`;
  const keywords = [p.title, p.category, p.deal, place(p), p.id, p.buildingUse].filter(Boolean).join(' ');
  return `<article class="property-card" data-group="${esc(p.group)}" data-deal="${esc(p.deal)}" data-keywords="${esc(keywords)}">
    <a class="property-photo" href="${url}" aria-label="${esc(p.title)} 상세 보기">${img
      ? `<img src="${base}${img.thumb}" width="640" height="427" alt="${esc(p.title)} 대표 사진" loading="lazy" decoding="async">`
      : `<span class="no-photo">사진 준비 중</span>`}<span class="badge">${esc(p.category)} · ${esc(p.deal)}</span><span class="photo-arrow">↗</span></a>
    <div class="property-info"><p class="location">${esc(place(p))} · ${esc(p.id)}</p><h3><a href="${url}">${esc(p.title)}</a></h3><p class="price">${esc(price.label)} <strong>${esc(price.value)}</strong></p><div class="property-meta">${cardMeta(p).map(t => `<span>${esc(t)}</span>`).join('')}</div></div>
  </article>`;
}

export function renderIndex(listings, { siteUrl = '' } = {}) {
  const base = './';
  const groups = ['아파트', '원룸·투룸', '상가·사무실', '건물'];
  const extra = [...new Set(listings.map(p => p.group))].filter(g => !groups.includes(g));
  const allGroups = [...groups, ...extra];
  return `${head({ title: '로데오부동산 | 대전 둔산동 공인중개사사무소', description: '대전 둔산동 로데오부동산. 아파트, 원룸·투룸, 상가, 건물 매물을 확인하고 바로 상담하세요.', base, url: '/', siteUrl, image: listings[0]?.images[0]?.full })}
  <main id="main-content" tabindex="-1">
    <section class="hero">
      <div class="hero-shade"></div>
      <div class="hero-content container">
        <p class="eyebrow"><span></span> YOUR SPACE, YOUR NEXT CHAPTER</p>
        <h1>좋은 공간이 만드는<br>새로운 <em>시작.</em></h1>
        <p class="hero-description">살고 싶은 집부터 가능성이 있는 상가까지.<br>당신의 다음 이야기를 로데오부동산과 시작하세요.</p>
        <a class="hero-link" href="#properties">나에게 맞는 공간 둘러보기 <span>↗</span></a>
      </div>
    </section>

    <section class="search-section container" aria-label="매물 검색">
      <form id="search-form" class="search-panel" role="search">
        <div class="search-heading"><span class="search-symbol">⌕</span><div><strong>어떤 공간을 찾으세요?</strong><p>원하는 조건으로 만나보세요.</p></div></div>
        <label>지역·키워드<input id="keyword" type="search" placeholder="예: 둔산동, 탄방동, 매물번호" autocomplete="off"></label>
        <label>매물 유형<select id="property-type"><option value="all">전체 유형</option>${allGroups.map(g => `<option>${esc(g)}</option>`).join('')}</select></label>
        <label>거래 유형<select id="deal-type"><option value="all">전체 거래</option><option>매매</option><option>전세</option><option>월세</option></select></label>
        <button class="button orange" type="submit">매물 검색 <span>↗</span></button>
      </form>
    </section>

    <section id="properties" class="properties container section">
      <div class="section-top"><div><p class="eyebrow blue">RODEO LISTINGS</p><h2>지금 소개하는 매물</h2><p class="section-description">로데오부동산이 직접 확인한 매물입니다.</p></div></div>
      <div class="filter-row"><div class="filters" role="group" aria-label="매물 유형 필터"><button class="active" type="button" data-filter="all" aria-pressed="true">전체</button>${allGroups.map(g => `<button type="button" data-filter="${esc(g)}" aria-pressed="false">${esc(g)}</button>`).join('')}</div><p id="result-count" aria-live="polite">총 ${listings.length}개 매물</p></div>
      <div class="property-grid" id="listing-grid">
        ${listings.map(p => card(p, base)).join('\n')}
      </div>
      <p id="empty-state" class="empty-state" ${listings.length ? 'hidden' : ''}>${listings.length ? '조건에 맞는 매물이 없습니다. 다른 조건으로 검색하거나 전화로 문의해 주세요.' : '현재 공개 중인 매물을 준비하고 있습니다. 원하시는 조건을 전화나 문자로 알려주세요.'}</p>
    </section>

    <section id="about" class="about-section"><div class="container about-inner"><div><p class="eyebrow blue">BEYOND THE SPACE</p><h2>공간을 넘어,<br>당신의 생활을 생각합니다.</h2></div><div class="about-copy"><p>집을 고르는 기준도, 새로운 가게를 시작하는 이유도<br class="desktop-break"> 모두 다르니까요. 당신의 이야기부터 듣겠습니다.</p><div class="values"><span><b>01</b> 필요한 조건부터 꼼꼼하게</span><span><b>02</b> 이해하기 쉬운 매물 안내</span><span><b>03</b> 다음 시작을 함께 고민하는 상담</span></div></div></div></section>

    <section id="contact" class="contact-section container section">
      <div class="contact-copy"><p class="eyebrow blue">LET’S TALK</p><h2>어떤 공간을<br>꿈꾸고 계신가요<span>?</span></h2><p>아직 구체적이지 않아도 괜찮습니다.<br>희망 지역, 예산, 입주 시기를 편하게 알려주세요.</p>${contactButtons()}</div>
      <div class="contact-office">${officeBlock()}</div>
    </section>
  </main>
  ${footer(base)}`;
}

export function renderDetail(p, { siteUrl = '' } = {}) {
  const base = '../../';
  const price = priceText(p);
  const yt = youtubeId(p.youtube);
  const facts = [
    ['매물번호', p.id], ['매물 종류', p.category], ['거래 형태', p.deal], ['소재지', place(p)],
    ['매매가', won(p.salePrice)], ['보증금', won(p.deposit)], ['월세', won(p.monthlyRent)], ['권리금', won(p.premium)],
    ['관리비', p.maintenance != null ? won(p.maintenance) + (p.maintenanceNote ? ` (${p.maintenanceNote})` : '') : p.maintenanceNote],
    ['전용면적', m2(p.exclusiveArea)], ['공급면적', m2(p.supplyArea)], ['대지면적', m2(p.landArea)],
    ['건축면적', m2(p.buildingArea)], ['연면적', m2(p.grossArea)],
    ['해당층 / 총층', p.floor && p.totalFloors ? `${p.floor}층 / ${p.totalFloors}층` : p.totalFloors ? `총 ${p.totalFloors}층` : p.floor ? `${p.floor}층` : ''],
    ['지하층', p.basement], ['방 / 욕실', p.rooms || p.baths ? `방 ${p.rooms ?? '-'} · 욕실 ${p.baths ?? '-'}` : ''],
    ['방향', p.direction], ['건축물 용도', p.buildingUse], ['구조', p.structure], ['사용승인일', p.approvalDate],
    ['주차', p.parking], ['엘리베이터', p.elevator], ['입주 가능일', p.moveIn],
    ['총 임대보증금', won(p.rentalDeposit)], ['월 임대수입', won(p.rentalIncome)], ['정보 확인일', p.checkedOn],
  ].filter(([, v]) => v != null && String(v).trim() !== '');
  const desc = `${p.title} · ${place(p)} · ${price.label} ${price.value}${mainArea(p) ? ' · ' + mainArea(p) : ''}`;
  const imgs = p.images;
  return `${head({ title: `${p.title} | ${price.label} ${price.value} | 로데오부동산`, description: desc, base, url: `/p/${p.id}/`, siteUrl, image: imgs[0]?.full })}
  <main id="main-content" tabindex="-1" class="container public-detail">
    <a class="back-link" href="${base}#properties">← 매물 목록</a>
    <div class="public-detail-heading">
      <p class="eyebrow blue">${esc(p.category)} · ${esc(p.deal)} · ${esc(p.id)}</p>
      <h1>${esc(p.title)}</h1>
      <p>${esc(place(p))}</p>
      <p class="public-price"><span>${esc(price.label)}</span> <strong>${esc(price.value)}</strong></p>
    </div>
    ${imgs.length ? `<section class="gallery" aria-label="매물 사진">
      <button class="gallery-main" type="button" aria-label="사진 크게 보기" aria-haspopup="dialog"><img id="gallery-main-image" src="${base}${imgs[0].full}" alt="${esc(p.title)} 사진 1" decoding="async" fetchpriority="high"></button>
      <p id="gallery-caption" role="status" aria-live="polite">사진 1 / ${imgs.length}</p>
      <div class="gallery-thumbs" role="group" aria-label="사진 선택">${imgs.map((im, i) => `<button class="gallery-thumb" type="button" data-full="${base}${im.full}" data-index="${i + 1}" aria-pressed="${i === 0}" aria-label="사진 ${i + 1}"><img src="${base}${im.thumb}" alt="" width="84" height="65" loading="lazy" decoding="async"></button>`).join('')}</div>
      <dialog id="photo-dialog" aria-label="사진 크게 보기"><button type="button" id="close-photo">닫기</button><img id="expanded-photo" alt=""></dialog>
    </section>` : `<p class="no-photo detail">사진 준비 중입니다. 사진이 필요하시면 문자로 요청해 주세요.</p>`}
    ${yt ? `<section class="video-gallery" aria-label="매물 영상"><h2>매물 영상</h2><div class="video-frame"><iframe src="https://www.youtube-nocookie.com/embed/${yt}" title="${esc(p.title)} 영상" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div></section>` : ''}
    ${p.description ? `<section class="public-description"><h2>매물 소개</h2>${String(p.description).split(/\n+/).map(t => `<p>${esc(t)}</p>`).join('')}</section>` : ''}
    <section class="public-facts"><h2>매물 정보</h2><dl>${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      ${p.rentalIncome != null ? '<p>임대수입은 현재 임대 현황 기준이며 향후 수익을 보장하지 않습니다.</p>' : ''}
    </section>
    <section class="public-contact"><h2>이 매물 문의하기</h2><p>매물번호 <b>${esc(p.id)}</b>를 말씀해 주시면 빠르게 안내해 드립니다.</p>${contactButtons(p.id)}${officeBlock()}</section>
  </main>
  ${footer(base, p.id)}`;
}

export function renderSitemap(listings, siteUrl) {
  const urls = ['/', ...listings.map(p => `/p/${p.id}/`)];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${esc(siteUrl + u)}</loc></url>`).join('\n')}\n</urlset>\n`;
}
