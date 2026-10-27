// 이 파일은 학생이 같은 프로젝트에서 이어서 구현합니다.
// 제공 UI를 받은 것만으로 단계 완료를 인정하지 않습니다.
// Styles stay inside returned student DOM; no provided page or global stylesheet changes.
function createStudentPanel(label, busy = false, intro = '') {
  const root = document.createElement('div');
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', label);
  root.setAttribute('aria-busy', String(busy));
  root.setAttribute('style', 'padding:16px;border:1px solid #d5ddea;border-left:4px solid #5a43b5;border-radius:10px;background:#fff;color:#182235;line-height:1.7;overflow-wrap:anywhere;');
  if (intro) {
    const heading = document.createElement('p');
    heading.textContent = intro;
    heading.setAttribute('style', 'font-weight:700;margin:0 0 12px;');
    root.append(heading);
  }
  return root;
}
export function createStudentView() {
  return {
    renderIdentity({ me, devices, sessions }) {
      const root = createStudentPanel('현재 계정·기기·세션', [me, devices, sessions].some(item => item?.status === 'loading'), '핵심 1 · 내 계정과 기기의 현재 상태');
      const deviceLabels = {
        compliant: '보안 기준 충족',
        noncompliant: '보안 기준 미충족',
        unknown: '확인 불가',
      };
      const sessionLabels = {
        active: '활성',
        expired: '만료',
        revoked: '철회됨',
        unknown: '확인 불가',
      };
      const modeLabels = {
        demo: '예제 자료',
        disconnected: '연결 없음',
        unknown: '확인 불가',
      };
      const value = (text) => text == null || text === '' ? '확인 불가' : String(text);
      const line = (parent, text) => {
        const paragraph = document.createElement('p');
        paragraph.textContent = text;
        parent.append(paragraph);
      };
      const showDevice = (parent, device) => {
        line(parent, `기기: ${value(device?.label)} (ID: ${value(device?.id)}) · ${deviceLabels[device?.status] ?? '확인 불가'} (${value(device?.status)})`);
      };
      const showSession = (parent, session) => {
        line(parent, `세션 ID: ${value(session?.id)} · ${sessionLabels[session?.status] ?? '확인 불가'} (${value(session?.status)})`);
      };
      const showResource = (title, resource, showData) => {
        const section = document.createElement('section');
        const heading = document.createElement('h3');
        heading.textContent = title;
        section.append(heading);
        root.append(section);

        const modeLabel = modeLabels[resource?.mode];
        if (modeLabel) line(section, modeLabel);
        if (resource?.status === 'loading') {
          line(section, '불러오는 중');
        } else if (resource?.status === 'error') {
          line(section, `연결 실패: ${value(resource.error?.message)}`);
          line(section, '다음: 제공 화면 위쪽의 다시 불러오기를 직접 누르세요. 미연결이 계속되면 담당자에게 연결 설정을 확인하세요.');
        } else if (resource?.status === 'ok') {
          showData(section, resource.data);
        } else {
          line(section, '확인 불가');
        }
      };

      showResource('현재 계정·기기·세션', me, (section, data) => {
        line(section, `사용자: ${value(data?.user?.label)} (ID: ${value(data?.user?.id)})`);
        showDevice(section, data?.device);
        showSession(section, data?.session);
      });
      showResource('기기 목록', devices, (section, data) => {
        if (!Array.isArray(data)) return line(section, '확인 불가');
        if (data.length === 0) return line(section, '기기 없음');
        for (const device of data) showDevice(section, device);
      });
      showResource('세션 목록', sessions, (section, data) => {
        if (!Array.isArray(data)) return line(section, '확인 불가');
        if (data.length === 0) return line(section, '세션 없음');
        for (const session of data) showSession(section, session);
      });
      return root;
    },
    renderDecision({ status, mode, data, error, appId }) {
      const root = createStudentPanel('업무 앱 접근 판정', status === 'loading', '핵심 2 · 선택한 업무 앱의 판정과 이유');
      const line = (text) => {
        const paragraph = document.createElement('p');
        paragraph.textContent = text;
        root.append(paragraph);
      };
      const value = (text) => text == null || text === '' ? '확인 불가' : String(text);
      const modes = { demo: '예제 자료', disconnected: '연결 없음', unknown: '확인 불가' };
      if (Object.hasOwn(modes, mode)) line(modes[mode]);

      if (status === 'idle') {
        line('앱을 골라 접속을 요청하세요.');
      } else if (status === 'loading') {
        line(`업무 앱 ID: ${value(appId)}`);
        line('판정 확인 중');
      } else if (status === 'error') {
        line(`업무 앱 ID: ${value(appId)}`);
        line(`요청 실패: ${value(error?.message)}`);
        line('요청 실패는 접근 거부 판정이 아닙니다. 접근 가능 여부는 확인 불가입니다.');
      } else if (status === 'ok') {
        const decisions = {
          allow: '접근 허용 (allow)',
          deny: '접근 거부 (deny)',
          challenge: '추가 확인 필요 (challenge)',
          unknown: '판정 확인 불가 (unknown)',
        };
        const decision = Object.hasOwn(decisions, data?.decision) ? data.decision : 'unknown';
        line(`업무 앱 ID: ${value(data?.appId ?? appId)}`);
        line(decisions[decision]);
        line(`판정 이유: ${data?.reason == null || data.reason === '' ? '사유 정보 없음' : String(data.reason)}`);
        line(`판정 시각: ${value(data?.checkedAt)}`);
        if (decision === 'allow') {
          line('정책상 접근 허용이며 실제 앱 접속 성공을 보장하지 않습니다.');
        } else if (decision === 'challenge') {
          line('추가 인증 또는 확인이 필요합니다. 이 앱이 추가 인증·확인 절차를 대신 수행하지 않습니다.');
        } else if (decision === 'unknown') {
          line('접근 허용으로 판단할 수 없습니다.');
        }
      } else {
        line('판정 확인 불가 (unknown)');
      }
      return root;
    },
    renderEvents({ status, mode, data, error }) {
      const root = createStudentPanel('내 보안 기록과 근거', status === 'loading', '핵심 3 · 내 기록의 근거와 현재 상태');
      const value = (text) => text == null || text === '' ? '확인 불가' : String(text);
      const line = (parent, text) => {
        const paragraph = document.createElement('p');
        paragraph.textContent = text;
        parent.append(paragraph);
      };
      const modes = { demo: '예제 자료', disconnected: '연결 없음', unknown: '확인 불가' };
      if (Object.hasOwn(modes, mode)) line(root, modes[mode]);
      if (status === 'loading') {
        line(root, '기록을 불러오는 중');
        return root;
      }
      if (status === 'error') {
        line(root, `기록을 불러오지 못했습니다: ${value(error?.message)}`);
        line(root, '다음: 제공 화면 위쪽의 다시 불러오기를 직접 누르세요. 이전 기록을 현재 결과로 표시하지 않습니다.');
        if (error?.code === 'CONTRACT_MISMATCH') line(root, '확인 불가 (CONTRACT_MISMATCH)');
        return root;
      }
      if (status !== 'ok' || !Array.isArray(data)
          || data.some(event => event === null || typeof event !== 'object')) {
        line(root, '기록 응답 확인 불가 (CONTRACT_MISMATCH)');
        return root;
      }

      const events = [...data].sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0));
      const kindLabels = { access: '접속 기록', xdr: 'XDR 경보' };
      const accessLabels = { allowed: '접근 허용', denied: '접근 거부', unknown: '확인 불가' };
      const sessionLabels = { active: '활성', expired: '만료', revoked: '철회됨', unknown: '확인 불가' };
      const deviceLabels = { compliant: '보안 기준 충족', noncompliant: '보안 기준 미충족', unknown: '확인 불가' };
      const stateText = (labels, code) => {
        const safeCode = Object.hasOwn(labels, code) ? code : 'unknown';
        return `${labels[safeCode]}(${safeCode})`;
      };
      const kindText = code => `${Object.hasOwn(kindLabels, code) ? kindLabels[code] : '확인 불가'}(${value(code)})`;
      const appText = appId => appId == null || appId === '' ? '앱 확인 불가' : String(appId);
      const filters = document.createElement('div');
      const createFilter = (name, values, labelFor) => {
        const label = document.createElement('label');
        label.textContent = name;
        const select = document.createElement('select');
        select.setAttribute('aria-label', name);
        const all = document.createElement('option');
        all.value = 'all';
        all.textContent = '전체';
        select.append(all);
        for (const raw of new Set(values)) {
          if (raw == null || raw === '') continue;
          const option = document.createElement('option');
          option.value = raw;
          option.textContent = labelFor(raw);
          select.append(option);
        }
        label.append(select);
        filters.append(label);
        return select;
      };
      const kindFilter = createFilter('기록 종류', events.map(event => event.kind), kindText);
      const appFilter = createFilter('업무 앱', events.map(event => event.appId), appText);
      const accessFilter = createFilter('접속 상태', events.map(event => event.state?.access), code => stateText(accessLabels, code));
      const count = document.createElement('p');
      count.setAttribute('role', 'status');
      const list = document.createElement('ul');
      const detail = document.createElement('div');
      root.append(filters, count, list, detail);

      const showDetail = event => {
        const section = document.createElement('section');
        section.setAttribute('data-student-event-detail', event.id);
        line(section, `사건 ID: ${value(event.id)}`);
        line(section, `업무 앱: ${appText(event.appId)}`);
        const showEntries = (title, entries) => {
          const heading = document.createElement('h3');
          heading.textContent = title;
          section.append(heading);
          if (!Array.isArray(entries) || entries.length === 0) {
            line(section, `${title} 없음`);
          } else {
            for (const entry of entries) line(section, `${value(entry?.id)}: ${value(entry?.text)}`);
          }
        };
        showEntries('근거', event.evidence);
        showEntries('규칙', event.rules);
        line(section, `접속 상태: ${stateText(accessLabels, event.state?.access)}`);
        line(section, `세션 상태: ${stateText(sessionLabels, event.state?.session)}`);
        line(section, `기기 상태: ${stateText(deviceLabels, event.state?.device)}`);
        if (Array.isArray(event.supportedActions) && event.supportedActions.length > 0) {
          line(section, '아직 지원하지 않는 조치입니다. 조치 실행 연결은 준비 중입니다.');
          for (const action of event.supportedActions) {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = `${action} 미지원`;
            button.disabled = true;
            section.append(button);
          }
        }
        detail.replaceChildren(section);
      };
      const renderList = () => {
        const visible = events.filter(event =>
          (kindFilter.value === 'all' || event.kind === kindFilter.value)
          && (appFilter.value === 'all' || event.appId === appFilter.value)
          && (accessFilter.value === 'all' || event.state?.access === accessFilter.value));
        count.textContent = `표시 ${visible.length}건 / 받은 기록 ${events.length}건`;
        list.replaceChildren();
        detail.replaceChildren();
        if (visible.length === 0) {
          const empty = document.createElement('li');
          empty.textContent = '표시할 기록이 없습니다';
          list.append(empty);
        }
        for (const event of visible) {
          const row = document.createElement('li');
          row.setAttribute('data-student-event-id', event.id);
          line(row, `사건 ID: ${value(event.id)} · 시각: ${value(event.at)} · 종류: ${kindText(event.kind)} · 업무 앱: ${appText(event.appId)}`);
          line(row, `요약: ${value(event.summary)}`);
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = `${event.id} 상세`;
          button.addEventListener('click', () => showDetail(event));
          row.append(button);
          list.append(row);
        }
      };
      for (const select of [kindFilter, appFilter, accessFilter]) select.addEventListener('change', renderList);
      renderList();
      return root;
    },
    renderStatus({ devices, sessions, notifications, diagnostics, mode }) {
      const root = createStudentPanel('상태·알림·진단', [devices, sessions, diagnostics].some(item => item?.status === 'loading'));
      const value = (text) => ['string', 'number', 'boolean'].includes(typeof text) && text !== '' ? String(text) : '확인 불가';
      const line = (parent, text) => {
        const paragraph = document.createElement('p');
        paragraph.textContent = text;
        parent.append(paragraph);
      };
      const section = title => {
        const block = document.createElement('section');
        const heading = document.createElement('h3');
        heading.textContent = title;
        block.append(heading);
        root.append(block);
        return block;
      };
      const modes = { demo: '예제 자료', disconnected: '연결 없음', unknown: '확인 불가' };
      const showMode = (parent, code) => {
        if (Object.hasOwn(modes, code)) line(parent, modes[code]);
      };
      const retry = parent => line(parent, '다시 시도는 위쪽 다시 불러오기 버튼을 직접 누르세요. 자동으로 다시 요청하지 않습니다.');
      const showFailure = (parent, title, error) => {
        line(parent, `${title} 정보를 불러오지 못했습니다: ${value(error?.message)}`);
        if (/TIMEOUT/i.test(value(error?.code)) || /시간.*초과/.test(value(error?.message))) {
          line(parent, `시간 초과 (${value(error?.code)})`);
        }
        retry(parent);
      };
      const stateText = (labels, code) => {
        const safeCode = Object.hasOwn(labels, code) ? code : 'unknown';
        return `${labels[safeCode]}(${safeCode})`;
      };
      const deviceLabels = { compliant: '보안 기준 충족', noncompliant: '보안 기준 미충족', unknown: '확인 불가' };
      const sessionLabels = { active: '활성', expired: '만료', revoked: '철회됨', unknown: '확인 불가' };
      showMode(root, mode);
      const showList = (title, resource, emptyText, describe) => {
        const block = section(title);
        showMode(block, resource?.mode);
        if (resource?.status === 'loading') {
          line(block, `${title} 정보를 불러오는 중`);
        } else if (resource?.status === 'error') {
          showFailure(block, title, resource.error);
        } else if (resource?.status === 'ok' && Array.isArray(resource.data)) {
          if (resource.data.length === 0) line(block, emptyText);
          for (const item of resource.data) line(block, describe(item));
        } else {
          line(block, `${title} 정보 확인 불가`);
        }
      };
      showList('기기', devices, '등록된 기기가 없습니다', device => `기기: ${value(device?.label)} · ${stateText(deviceLabels, device?.status)}`);
      showList('세션', sessions, '현재 연결이 없습니다', session => `세션 ID: ${value(session?.id)} · ${stateText(sessionLabels, session?.status)}`);
      line(root, '세션 조회 범위는 지금 검증된 연결 하나입니다.');

      const alerts = section('알림');
      if (Array.isArray(notifications)) {
        if (notifications.length === 0) line(alerts, '주의할 알림이 없습니다');
        for (const notification of notifications) {
          line(alerts, `자료: ${value(notification?.resource)} · 코드: ${value(notification?.code)} · 메시지: ${value(notification?.message)}`);
        }
      } else {
        line(alerts, '알림 정보 확인 불가');
      }

      const info = section('진단 정보');
      showMode(info, diagnostics?.mode);
      let safeInfo;
      if (diagnostics?.status === 'ok') {
        const data = diagnostics.data;
        safeInfo = {
          requestId: value(data?.requestId),
          component: value(data?.component),
          version: value(data?.version),
          checkedAt: value(data?.checkedAt),
          engine: { mode: value(data?.engine?.mode), code: value(data?.engine?.code) },
        };
        line(info, `requestId: ${safeInfo.requestId}`);
        line(info, `component: ${safeInfo.component}`);
        line(info, `version: ${safeInfo.version}`);
        line(info, `checkedAt: ${safeInfo.checkedAt}`);
        line(info, `engine.mode: ${safeInfo.engine.mode}`);
        line(info, `engine.code: ${safeInfo.engine.code}`);
      } else if (diagnostics?.status === 'loading') {
        line(info, '진단 정보를 불러오는 중');
      } else if (diagnostics?.status === 'error') {
        showFailure(info, '진단', diagnostics.error);
        line(info, '진단 정보의 재조회는 제공 화면의 도움정보 불러오기 버튼을 직접 누르세요.');
      } else {
        line(info, '진단 정보를 확인하려면 제공 화면의 도움정보 불러오기 버튼을 직접 누르세요.');
      }
      line(info, '도움 요청에 사용할 위의 안전한 진단 정보만 복사합니다. 사용자가 버튼을 누를 때만 복사합니다.');
      const copy = document.createElement('button');
      copy.type = 'button';
      copy.textContent = '도움정보 복사';
      copy.disabled = !safeInfo;
      const copyStatus = document.createElement('p');
      copyStatus.setAttribute('role', 'status');
      copy.addEventListener('click', async () => {
        if (!safeInfo || copy.disabled) return;
        try {
          await navigator.clipboard.writeText(JSON.stringify(safeInfo, null, 2));
          copyStatus.textContent = '안전한 진단 정보를 복사했습니다.';
        } catch {
          copyStatus.textContent = '도움정보를 복사하지 못했습니다. 브라우저의 클립보드 권한을 확인하세요.';
        }
      });
      info.append(copy, copyStatus);
      return root;
    },
    renderVulnerabilities({ status, mode, data, error }) {
      const root = createStudentPanel('패키지 조회 결과', status === 'loading');
      const line = (parent, text) => {
        const paragraph = document.createElement('p');
        paragraph.textContent = text;
        parent.append(paragraph);
      };
      const show = (parent, label, value) => {
        if (value !== undefined && value !== null && value !== '') line(parent, `${label}: ${value}`);
      };
      if (status === 'idle') {
        line(root, '조회 전(idle)');
      } else if (status === 'loading') {
        line(root, '조회 중(loading)');
      } else if (status === 'error') {
        line(root, `조회 실패: ${error?.message ?? '패키지 조회를 확인할 수 없습니다.'}`);
        line(root, '조회 실패는 취약점이 없다는 뜻이 아닙니다. 제공 화면에서 직접 다시 조회하세요.');
      } else if (status === 'ok' && data) {
        const scanLabels = {
          complete: '모두 조회(complete)',
          partial: '일부 조회 실패(partial)',
          not_checked: '아직 조회 안 함(not_checked). 승인된 공개 조회 대상이 없는 등의 미조회 상태입니다.',
          not_configured: '조회 준비 미완료(not_configured). 조회 대상 프로젝트 설정이 필요합니다.',
          unverifiable: 'lock 파일 확인 불가(unverifiable)',
        };
        line(root, Object.hasOwn(scanLabels, data.status) ? scanLabels[data.status] : '전체 조회 상태 확인 불가');
        show(root, 'lockfileVersion', data.lockfileVersion);
        show(root, 'lockfileHash', data.lockfileHash);
        show(root, '전체 확인 시각(checkedAt)', data.checkedAt);
        const packageLabels = {
          known_vulnerabilities: '알려진 항목 있음(known_vulnerabilities)',
          none_found: '알려진 항목 없음(none_found)',
          unverifiable: '조회 확인 불가(unverifiable)',
        };
        for (const pkg of data.packages ?? []) {
          const row = document.createElement('div');
          row.setAttribute('data-student-package-name', pkg.name);
          row.setAttribute('data-student-package-version', pkg.version);
          show(row, '패키지 이름', pkg.name);
          show(row, '설치된 정확한 버전', pkg.version);
          line(row, Object.hasOwn(packageLabels, pkg.status) ? packageLabels[pkg.status] : '패키지 조회 상태 확인 불가');
          show(row, '출처(source)', pkg.source);
          show(row, '패키지 확인 시각(checkedAt)', pkg.checkedAt);
          if (pkg.status === 'none_found') {
            line(row, '이번 조회 범위에서 알려진 취약점 항목이 없다는 뜻입니다. 패키지나 앱 전체가 안전하다는 보장은 아닙니다.');
          } else if (pkg.status === 'unverifiable') {
            line(row, pkg.vulnerabilities?.length ? '일부 확인·전체 조회 확인 불가' : '조회를 확인할 수 없으며 취약점 없음으로 판단할 수 없습니다.');
          }
          for (const finding of pkg.vulnerabilities ?? []) {
            show(row, '취약점 ID', finding.id);
            show(row, '취약점 수정 시각(modified)', finding.modified);
          }
          root.append(row);
        }
        if (!data.packages?.length) line(root, '표시할 패키지 결과가 없습니다. 미조회·설정 없음·확인 불가는 취약점 없음이 아닙니다.');
      } else {
        line(root, '조회 결과 확인 불가. 취약점 없음으로 판단할 수 없습니다.');
      }
      return root;
    },
    renderAiConnection({ status, mode, data, error, checkedAt, explanationAccepted }) {
      const root = createStudentPanel('AI 연결 점검 결과', status === 'loading');
      const line = text => {
        const paragraph = document.createElement('p');
        paragraph.textContent = text;
        root.append(paragraph);
      };
      const value = text => typeof text === 'string' && text !== '' ? text : '확인 불가';
      const modes = { demo: '예제 자료', disconnected: '연결 없음', unknown: '확인 불가' };
      if (Object.hasOwn(modes, mode)) line(modes[mode]);
      if (status === 'idle') {
        line('AI 연결 점검 전');
      } else if (status === 'loading') {
        line('AI 연결 점검 중');
      } else if (status === 'ok') {
        if (data?.transportChecked === true
            && ['test', 'verified'].includes(data.audienceAuthorization)
            && Number.isInteger(data.modelCount) && data.modelCount >= 0) {
          line(data.audienceAuthorization === 'test' ? '시험 연결 점검(test)' : '앱 권한 확인 후 점검(verified)');
          line('연결 점검: transportChecked=true');
          line(`응답 모델 수: ${data.modelCount}`);
          line(`점검 시각: ${value(checkedAt)}`);
          if (data.audienceAuthorization === 'test') line('시험 연결이며 실제 운영 연결을 확인한 결과가 아닙니다.');
          if (data.modelCount === 0) line('쓸 수 있는 모델이 없습니다. 담당자에게 모델 허용 설정을 확인하세요.');
        } else {
          line('AI 연결 점검 결과 확인 불가');
        }
        line('사건 설명은 아직 실행하지 않았습니다. 연결 점검과 사건 설명은 별도입니다.');
      } else if (status === 'error') {
        const messages = {
          ON_AI_PROVISIONING_PENDING: '학생 앱 이용 권한의 발급·연결을 준비 중입니다. 담당자에게 확인하세요.',
          WB_CLCO_AUTH_REQUIRED: '앱 전용 열쇠의 인증을 확인하세요. Workbench 열쇠를 복사하지 마세요.',
          WB_CLCO_ACCESS_BLOCKED: '학생 앱의 이용 권한을 확인하세요.',
          WB_CLCO_COHORT_BUDGET_EXHAUSTED: '반의 AI 사용량이 소진됐습니다. 담당자에게 확인하세요.',
          WB_CLCO_RATE_LIMITED: 'AI 요청이 잠시 제한됐습니다. 잠시 후 직접 다시 요청하세요.',
          WB_CLCO_LIMIT_REACHED: 'AI 이용 한도에 도달했습니다. 담당자에게 확인하세요.',
          WB_CLCO_SESSION_CLOSED: '현재 AI 이용 시간이 아닙니다. 이용 시간을 확인하세요.',
          WB_CLCO_TIMEOUT: 'AI 응답 시간이 초과됐습니다. 필요하면 직접 다시 요청하세요.',
          REQUEST_TIMEOUT: '서버의 AI 응답 시간이 초과됐습니다. 필요하면 직접 다시 요청하세요.',
          ENGINE_TIMEOUT: '서버의 확인 시간이 초과됐습니다. 필요하면 직접 다시 요청하세요.',
          TIMEOUT: 'AI 응답 시간이 초과됐습니다. 필요하면 직접 다시 요청하세요.',
          WB_CLCO_CANCELLED: 'AI 요청을 취소했습니다. 이전 응답은 현재 결과가 아닙니다.',
          CANCELLED: 'AI 요청을 취소했습니다. 이전 응답은 현재 결과가 아닙니다.',
          REQUEST_CANCELLED: 'AI 요청을 취소했습니다. 이전 응답은 현재 결과가 아닙니다.',
          MODEL_NOT_CONFIGURED: '서버에 사용할 AI 모델을 설정하세요.',
          ON_AI_AUTHORIZATION_CHANGED: 'AI 이용 권한 내용이 점검 도중 바뀌었습니다. 다시 점검하기 전에 담당자에게 현재 권한을 확인하세요.',
          ON_AI_MODEL_LIST_EMPTY: '현재 앱 권한으로 쓸 수 있는 AI 모델이 없습니다. 담당자에게 모델 허용 설정을 확인하세요.',
          SUBJECT_SCOPE_UNVERIFIED: '현재 로그인과 사건·프로젝트의 연결을 확인할 수 없습니다.',
          ON_AI_INVALID_INPUT: '설명에 필요한 사건 근거·규칙을 확인할 수 없습니다.',
          ON_AI_INVALID_OUTPUT: 'AI 설명의 근거·조치·응답 형식을 확인할 수 없습니다.',
          AI_REQUEST_UNVERIFIED: 'AI 연결 또는 응답을 확인할 수 없습니다. 기존 기록을 확인하세요.',
        };
        const code = Object.hasOwn(messages, error?.code) ? error.code : 'AI_REQUEST_UNVERIFIED';
        const message = error?.message === messages[code] ? error.message : messages[code];
        line(`AI 연결 점검 실패: ${code}`);
        line(message);
        if (['ON_AI_PROVISIONING_PENDING', 'ON_AI_AUTHORIZATION_CHANGED', 'SUBJECT_SCOPE_UNVERIFIED', 'AI_REQUEST_UNVERIFIED'].includes(code)) {
          line('권한 준비 중 또는 확인 불가입니다. 담당자에게 계정 연결과 앱 권한을 확인해 달라고 요청하세요.');
        } else if (['WB_CLCO_AUTH_REQUIRED', 'WB_CLCO_ACCESS_BLOCKED'].includes(code)) {
          line('인증 또는 접근 제한입니다. 계정 연결을 다시 확인하고 담당자에게 문의하세요.');
        } else if (['WB_CLCO_COHORT_BUDGET_EXHAUSTED', 'WB_CLCO_LIMIT_REACHED'].includes(code)) {
          line('사용량·이용 한도를 담당자에게 확인하세요.');
        } else if (code === 'WB_CLCO_SESSION_CLOSED') {
          line('AI 이용 시간을 확인하세요.');
        } else if (['WB_CLCO_CANCELLED', 'CANCELLED', 'REQUEST_CANCELLED'].includes(code)) {
          line('취소됨. 이전 결과는 현재 점검 결과가 아닙니다.');
        } else if (['MODEL_NOT_CONFIGURED', 'ON_AI_MODEL_LIST_EMPTY'].includes(code)) {
          line('담당자에게 모델 허용 설정을 확인해 달라고 요청하세요.');
        } else if (['WB_CLCO_RATE_LIMITED', 'WB_CLCO_TIMEOUT', 'REQUEST_TIMEOUT', 'ENGINE_TIMEOUT', 'TIMEOUT'].includes(code)) {
          line('요청 제한 또는 시간 초과입니다. 잠시 뒤 직접 다시 점검하세요.');
        }
        if (code === 'AI_REQUEST_UNVERIFIED') line('네트워크 연결 상태도 확인하고 잠시 뒤 직접 다시 점검하세요.');
      } else {
        line('AI 연결 상태 확인 불가');
      }
      line('다시 점검하려면 제공 화면의 AI 연결 점검 버튼을 직접 누르세요. 자동으로 다시 점검하지 않습니다.');
      return root;
    },
    renderExplanation({ event, explanation, checkedAt }) {
      const root = createStudentPanel('참고용 AI 설명', explanation?.status === 'loading');
      const line = text => {
        const paragraph = document.createElement('p');
        paragraph.textContent = text;
        root.append(paragraph);
      };
      if (explanation?.status === 'error') {
        const messages = {
          ON_AI_PROVISIONING_PENDING: '학생 앱 이용 권한의 발급·연결을 준비 중입니다. 담당자에게 확인하세요.',
          WB_CLCO_AUTH_REQUIRED: '앱 전용 열쇠의 인증을 확인하세요. Workbench 열쇠를 복사하지 마세요.',
          WB_CLCO_ACCESS_BLOCKED: '학생 앱의 이용 권한을 확인하세요.',
          WB_CLCO_COHORT_BUDGET_EXHAUSTED: '반의 AI 사용량이 소진됐습니다. 담당자에게 확인하세요.',
          WB_CLCO_RATE_LIMITED: 'AI 요청이 잠시 제한됐습니다. 잠시 후 직접 다시 요청하세요.',
          WB_CLCO_LIMIT_REACHED: 'AI 이용 한도에 도달했습니다. 담당자에게 확인하세요.',
          WB_CLCO_SESSION_CLOSED: '현재 AI 이용 시간이 아닙니다. 이용 시간을 확인하세요.',
          WB_CLCO_TIMEOUT: 'AI 응답 시간이 초과됐습니다. 필요하면 직접 다시 요청하세요.',
          REQUEST_TIMEOUT: '서버의 AI 응답 시간이 초과됐습니다. 필요하면 직접 다시 요청하세요.',
          ENGINE_TIMEOUT: '서버의 확인 시간이 초과됐습니다. 필요하면 직접 다시 요청하세요.',
          TIMEOUT: 'AI 응답 시간이 초과됐습니다. 필요하면 직접 다시 요청하세요.',
          WB_CLCO_CANCELLED: 'AI 요청을 취소했습니다. 이전 응답은 현재 결과가 아닙니다.',
          CANCELLED: 'AI 요청을 취소했습니다. 이전 응답은 현재 결과가 아닙니다.',
          REQUEST_CANCELLED: 'AI 요청을 취소했습니다. 이전 응답은 현재 결과가 아닙니다.',
          MODEL_NOT_CONFIGURED: '서버에 사용할 AI 모델을 설정하세요.',
          ON_AI_AUTHORIZATION_CHANGED: 'AI 이용 권한 내용이 점검 도중 바뀌었습니다. 다시 점검하기 전에 담당자에게 현재 권한을 확인하세요.',
          ON_AI_MODEL_LIST_EMPTY: '현재 앱 권한으로 쓸 수 있는 AI 모델이 없습니다. 담당자에게 모델 허용 설정을 확인하세요.',
          SUBJECT_SCOPE_UNVERIFIED: '현재 로그인과 사건·프로젝트의 연결을 확인할 수 없습니다.',
          ON_AI_INVALID_INPUT: '설명에 필요한 사건 근거·규칙을 확인할 수 없습니다.',
          ON_AI_INVALID_OUTPUT: 'AI 설명의 근거·조치·응답 형식을 확인할 수 없습니다.',
          AI_REQUEST_UNVERIFIED: 'AI 연결 또는 응답을 확인할 수 없습니다. 기존 기록을 확인하세요.',
        };
        const code = Object.hasOwn(messages, explanation.error?.code) ? explanation.error.code : 'AI_REQUEST_UNVERIFIED';
        const message = explanation.error?.message === messages[code] ? explanation.error.message : messages[code];
        line(`AI 사건 설명 실패: ${code}`);
        line(message);
        line('기록은 그대로 유지됩니다.');
      } else if (!event) {
        line('보안 기록에서 기록을 먼저 고르세요.');
      } else if (explanation?.status === 'loading') {
        line('AI 설명 요청 중');
      } else if (explanation?.status === 'ok') {
        const data = explanation.data;
        const evidence = Array.isArray(event.evidence) ? event.evidence : [];
        const evidenceById = new Map(evidence.map(item => [item.id, item]));
        const ids = data?.evidenceIds;
        const proposals = data?.proposals;
        // 실패한 설명에는 요약과 성공 표식을 남기지 않는다.
        if (data?.executed === true) {
          line('AI 설명을 사용할 수 없습니다: AI가 이미 조치를 실행했다고 답했습니다.');
          line('기록은 그대로입니다.');
          return root;
        }
        if (typeof event.id !== 'string' || !event.id || typeof data?.summary !== 'string'
            || !Array.isArray(ids) || ids.length === 0
            || new Set(ids).size !== ids.length || ids.length !== evidence.length
            || ids.some(id => !evidenceById.has(id))
            || !Array.isArray(proposals)
            || proposals.some(proposal => !Array.isArray(proposal.evidenceIds)
              || proposal.evidenceIds.some(id => !evidenceById.has(id)))
            || data.executed !== false || data.requiresHumanConfirmation !== true) {
          line('AI 설명을 사용할 수 없습니다: 근거가 부족하거나 현재 기록의 근거·응답 형식과 맞지 않습니다.');
          line('기록은 그대로입니다.');
          return root;
        }
        root.setAttribute('data-student-explanation-event', event.id);
        line(`사건 ID: ${event.id}`);
        line('AI 설명(참고용)');
        line(data.summary);
        line('AI 설명은 해석입니다. 사실 판단은 근거와 연동 시스템이 알려 준 상태로 합니다.');
        line('인용한 근거');
        for (const id of ids) line(`${id} — ${evidenceById.get(id).text}`);
        line('규칙');
        for (const rule of event.rules ?? []) line(`${rule.id} — ${rule.text}`);
        if (!event.rules?.length) line('규칙 없음');
        line('확인 불가 상태');
        let hasUnknown = false;
        for (const [key, label] of [['access', '접속'], ['session', '세션'], ['device', '기기']]) {
          if (event.state?.[key] === 'unknown') {
            line(`${label}: 확인 불가(unknown)`);
            hasUnknown = true;
          }
        }
        if (!hasUnknown) line('없음');
        line('조치 제안');
        if (proposals.length === 0) {
          line(event.supportedActions?.length
            ? 'AI가 제안한 조치가 없습니다.'
            : '연동 시스템이 지원하는 조치가 없어 제안이 없습니다(정상).');
        } else {
          for (const proposal of proposals) {
            line(`조치: ${proposal.action}`);
            line(`이유: ${proposal.reason}`);
            for (const id of proposal.evidenceIds) line(`제안 근거: ${id} — ${evidenceById.get(id).text}`);
            line('사람 확인이 필요하며 실행되지 않았습니다.');
          }
        }
      } else if (explanation?.status === 'idle' || !explanation) {
        line('AI 설명 요청 전입니다. 선택한 보안 기록의 설명을 요청하세요.');
      } else {
        line('AI 설명 결과 확인 불가. 기록은 그대로입니다.');
      }
      return root;
    },
    renderAction({ status, event, actionId, target, receipt, observation, message, confirmationExpiresAt, error }) {
      const root = createStudentPanel('조치 상태', ['loading', 'executing'].includes(status));
      const line = text => {
        const paragraph = document.createElement('p');
        paragraph.textContent = text;
        root.append(paragraph);
      };
      const show = (label, value) => {
        if (value !== undefined && value !== null && value !== '') line(`${label}: ${value}`);
      };
      const confirmed = status === 'succeeded' && observation?.effectApplied === true;
      const labels = {
        idle: '아직 미실행(idle)',
        loading: '조치 준비 또는 결과 조회 중(loading). 실행 결과는 아직 확인되지 않았습니다.',
        prepared: '준비됨·미실행(prepared)',
        executing: '서버에 전달 중(executing). 실행 결과는 아직 확인되지 않았습니다.',
        pending: '서버 접수·처리 중(pending). 접수 응답(ACK)은 효과 확인이 아닙니다.',
        succeeded: confirmed ? '효과 확인(succeeded)' : '결과 불명(unknown). 효과 관측을 확인할 수 없습니다.',
        denied: '거절(denied)',
        failed: '실패(failed)',
        unknown: '결과 불명(unknown)',
        expired: '확인 기한 지남(expired). 제공 화면에서 조치를 다시 준비하세요.',
        error: '요청 처리 안 됨(error)',
      };
      line(labels[status] ?? '결과 불명(unknown)');
      if (status === 'prepared') {
        line('AI 제안과 조치 준비는 집행이 아닙니다. 실제 대상과 확인 기한을 읽고 제공 화면의 「대상과 조치를 확인했으며 집행합니다」에서 사람이 확인해야 합니다.');
        show('확인 기한', confirmationExpiresAt);
      }
      if (confirmed) {
        show('관측 시각', observation.observedAt);
        line('effectApplied: true');
      } else if (status === 'unknown' || status === 'succeeded' || !Object.hasOwn(labels, status)) {
        line('성공이나 효과 없음으로 판단하지 마세요. 제공 화면의 「연동 시스템 결과만 재조회」로 결과만 직접 확인하세요. 다시 집행하지 마세요.');
      }
      show('사건 ID', event?.id);
      if (event?.id) root.setAttribute('data-student-action-event', event.id);
      for (const evidence of event?.evidence ?? []) show('근거 ID', evidence.id);
      show('조치 ID', actionId);
      show('실제 대상 ID', target?.id);
      show('대상 세대(generation)', target?.generation);
      show('요청 ID(requestId)', receipt?.requestId);
      if (receipt?.requestId) root.setAttribute('data-student-action-request', receipt.requestId);
      show('접수 ID(receiptId)', receipt?.receiptId);
      show('버전(version)', receipt?.version);
      if (receipt?.replayed === true) line('기존 요청 응답 재전달(replayed): true. 새 집행 성공을 뜻하지 않습니다.');
      if (['denied', 'failed', 'idle'].includes(status)) show('안내', message);
      if (error) {
        const messages = {
  ACTION_UNSUPPORTED: '미지원: 현재 원천의 조치 연결·권한을 확인할 수 없습니다.',
  ACTION_DENIED: '거절: 현재 원천 정책이 이 조치를 허용하지 않습니다.',
  ACTION_CONFIRMATION_EXPIRED: '확인 기한 만료: 조치를 다시 준비하고 대상을 확인하세요.',
  ACTION_CONFIRMATION_INVALID: '조치 확인 정보가 유효하지 않습니다. 다시 준비하세요.',
  ACTION_SCOPE_CHANGED: '사용자·프로젝트·세션 또는 원천 권한이 변경됐습니다. 현재 기록에서 다시 준비하세요.',
  ACTION_SCOPE_UNVERIFIED: '현재 사용자와 조치 권한을 확인할 수 없습니다.',
  SUBJECT_SCOPE_UNVERIFIED: '현재 사용자·프로젝트·세션을 확인할 수 없습니다.',
  ACTION_SNAPSHOT_CHANGED: '사건 대상·근거·상태가 변경됐습니다. 현재 사건으로 다시 준비하세요.',
  ACTION_EVENT_UNAVAILABLE: '현재 본인 사건을 확인할 수 없습니다.',
  ACTION_TIMEOUT: '결과 불명(unknown): 이미 전달된 조치의 효과가 없다고 판단하지 마세요. 결과만 직접 재조회하세요.',
  ACTION_STORE_FAILED: '조치 기록 확인 불가. 자동 집행하지 말고 결과만 직접 조회하세요.',
  ACTION_RESULT_UNVERIFIED: '결과 확인 불가: 성공이나 효과 없음으로 판단하지 마세요.',
};
        const code = Object.hasOwn(messages, error.code) ? error.code : 'ACTION_RESULT_UNVERIFIED';
        line(`오류 코드: ${code}`);
        line(error.message === messages[code] ? error.message : messages[code]);
      }
      if (event && Array.isArray(event.supportedActions) && event.supportedActions.length === 0) {
        line('연동 시스템이 지원하는 조치가 없어 조치 준비 버튼이 나오지 않는 것이 정상입니다.');
      }
      line('조작은 제공 화면의 버튼을 사용하세요. 「조치 화면 취소」는 이미 서버에 전달된 조치 효과를 되돌리지 않습니다.');
      return root;
    },
  };
}
