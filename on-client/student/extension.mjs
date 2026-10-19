// 이 파일은 학생이 같은 프로젝트에서 이어서 구현합니다.
// 제공 UI를 받은 것만으로 단계 완료를 인정하지 않습니다.
export function createStudentView() {
  return {
    renderIdentity({ me, devices, sessions }) {
      const root = document.createElement('div');
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
      const root = document.createElement('div');
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
      const root = document.createElement('div');
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
      const root = document.createElement('div');
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
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection() { return '학생 구현 대기: 모델 응답 점검과 실제 사건 설명을 구분하고 AI 오류·취소·수동 복구를 안내하세요.'; },
    renderExplanation() { return '학생 구현 대기: 선택한 사건의 근거·규칙·현재 상태와 AI 설명을 연결하세요. 제안은 자동 실행하지 않습니다.'; },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
