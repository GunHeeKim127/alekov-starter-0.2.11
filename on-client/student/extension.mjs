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
    renderEvents() { return '학생 구현 대기: 본인 접속·XDR 기록을 연결하세요.'; },
    renderStatus() { return '학생 구현 대기: 기기·세션·알림과 연결 점검 상태를 구분하세요.'; },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection() { return '학생 구현 대기: 모델 응답 점검과 실제 사건 설명을 구분하고 AI 오류·취소·수동 복구를 안내하세요.'; },
    renderExplanation() { return '학생 구현 대기: 선택한 사건의 근거·규칙·현재 상태와 AI 설명을 연결하세요. 제안은 자동 실행하지 않습니다.'; },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
