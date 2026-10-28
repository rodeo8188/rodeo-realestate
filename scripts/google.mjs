// 구글 시트·드라이브 읽기 전용 접근 (서비스 계정)
// 서비스 계정 키는 GitHub Secrets(GOOGLE_SERVICE_ACCOUNT_JSON)로만 전달한다. 파일로 저장하지 않는다.
import crypto from 'node:crypto';

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
].join(' ');

async function call(url, options = {}, attempt = 0) {
  const res = await fetch(url, options);
  if (res.ok) return res;
  if ((res.status === 429 || res.status >= 500) && attempt < 3) {
    await new Promise(r => setTimeout(r, 1000 * 2 ** attempt));
    return call(url, options, attempt + 1);
  }
  // 응답 본문에는 시트 내용이 섞일 수 있으므로 상태 코드만 남긴다.
  const where = new URL(url).hostname;
  const hint = res.status === 403 || res.status === 404
    ? ' (서비스 계정에 시트/폴더가 공유됐는지, Drive API·Sheets API가 켜져 있는지 확인)'
    : '';
  throw new Error(`구글 요청 실패: ${where} HTTP ${res.status}${hint}`);
}

export async function getAccessToken(json) {
  let key;
  try { key = JSON.parse(json); } catch { throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON 값이 올바른 JSON이 아닙니다.'); }
  if (key.type !== 'service_account' || !key.client_email || !key.private_key) {
    throw new Error('서비스 계정 키(JSON) 형식이 아닙니다.');
  }
  const now = Math.floor(Date.now() / 1000);
  const enc = v => Buffer.from(JSON.stringify(v)).toString('base64url');
  const unsigned = `${enc({ alg: 'RS256', typ: 'JWT' })}.${enc({
    iss: key.client_email, scope: SCOPES, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  })}`;
  const sig = crypto.sign('RSA-SHA256', Buffer.from(unsigned), key.private_key).toString('base64url');
  const res = await call('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${sig}` }),
  });
  const data = await res.json();
  return { token: data.access_token, email: key.client_email };
}

// 스프레드시트의 모든 탭을 { 탭이름: [[행]...] } 형태로 읽는다.
export async function readAllTabs(token, spreadsheetId) {
  const headers = { Authorization: `Bearer ${token}` };
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`;
  const meta = await (await call(`${base}?fields=sheets(properties(title))`, { headers })).json();
  const titles = meta.sheets.map(s => s.properties.title);
  const params = new URLSearchParams({ valueRenderOption: 'UNFORMATTED_VALUE', dateTimeRenderOption: 'FORMATTED_STRING' });
  titles.forEach(t => params.append('ranges', `'${t.replace(/'/g, "''")}'`));
  const data = await (await call(`${base}/values:batchGet?${params}`, { headers })).json();
  const tabs = {};
  data.valueRanges.forEach((vr, i) => { tabs[titles[i]] = vr.values || []; });
  return tabs;
}

async function listChildren(token, folderId) {
  const headers = { Authorization: `Bearer ${token}` };
  const files = [];
  let pageToken = '';
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, md5Checksum, modifiedTime, size)',
      pageSize: '1000', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const data = await (await call(`https://www.googleapis.com/drive/v3/files?${params}`, { headers })).json();
    files.push(...data.files);
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return files;
}

const FOLDER = 'application/vnd.google-apps.folder';

// 루트 폴더 아래에서 매물번호로 시작하는 폴더를 찾아 사진 목록을 반환한다.
// 매물 폴더 안의 하위 폴더(예: "사진")도 한 단계까지 확인한다.
export async function listPropertyFolders(token, rootId) {
  const children = await listChildren(token, rootId);
  return children.filter(f => f.mimeType === FOLDER);
}

export async function listImages(token, folderId) {
  const items = await listChildren(token, folderId);
  const images = items.filter(f => f.mimeType.startsWith('image/'));
  for (const sub of items.filter(f => f.mimeType === FOLDER)) {
    if (/사진|photo|image/i.test(sub.name)) {
      images.push(...(await listChildren(token, sub.id)).filter(f => f.mimeType.startsWith('image/')));
    }
  }
  return images;
}

export async function download(token, fileId) {
  const res = await call(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return Buffer.from(await res.arrayBuffer());
}
