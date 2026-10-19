# 17단계 AI 사건 설명 호출 연결 검토 자료

## 작성 목적과 한계

대상 피드백 커밋은 d0b5d1b621bd6863b0c65864f99da8cd072485b1입니다. 피드백에서 server.mjs와 clco-http.mjs가 목록으로만 전달됐다고 하여, 연결 부분을 짧은 문서로 재수록합니다. 기존 JSON을 직접 검사한 결과 두 파일의 본문은 원문 묶음에 모두 포함되어 있었고 대상 Git 커밋과 바이트 단위로 일치했습니다. 검토 AI가 본문을 받지 못한 원인은 확인되지 않았습니다.

이 문서는 연결 원문과 로컬 합성 시험 결과의 기록입니다. 실제 계정 권한·실제 모델 호출·공식 통과를 입증하지 않습니다. 제공 서버·전송 모듈·학생 함수·인증 설정은 이 보완 작업에서 수정하지 않았습니다.

## 원본 파일 식별

| 파일 | 바이트 수 | SHA-256 |
|---|---:|---|
| on-client/src/server.mjs | 73831 | 32ce16598554ffcd044e3aaa1caf91bcc70f10efb42ea279463cd2a7f7d1f010 |
| on-client/src/ai/service.mjs | 38270 | 96537ad8da6b498be7e13e05eb9183301f07de4c40dcac7456f7b5ebf1c564e1 |
| on-client/vendor/clco-http.mjs | 9068 | e9c12c59c90d6b102726c3912cf26174c9b0c91160f83ed226092de6eb904667 |

## 서버가 사건 설명 서비스에 전달하는 경로

브라우저 제공 app.js의 requestExplain은 사건 ID를 POST /api/ai/explain으로 보냅니다. 서버는 본인 사건과 신원 연결을 확인하고, 사건의 근거·규칙·상태를 AI 서비스에 전달합니다. NativeHost 구성 경로와 일반 연결 경로는 다음 원문에 나뉘어 있습니다.

출처: `on-client/src/server.mjs`, 497~504행. 아래는 해당 파일의 연속된 원문입니다.

```javascript
          const service=createVaultOnAiService({enabled:true,vault:createNativeOperationVault(nativeHost,nativeOperation),timeoutMs:remaining(),
            appAuthorization:nativeConfiguration.fetchImpl?{fetchImpl:nativeConfiguration.fetchImpl}:{}});
          const options=Object.freeze({signal:lifetime.signal,
            expectedScope:Object.freeze({subjectId:identity.subjectId,projectId:identity.projectId,appId:'aleph-on',audience:'on-client'}),
            expectedContext:Object.freeze({alephUserId:identity.alephUserId,siteId:identity.siteId,identityVersion:identity.identityVersion}),
            beforeDispatch:recheck,beforePublish:recheck});
          const incident={incidentId:event.id,evidence:event.evidence.map(row=>({id:row.id,summary:row.text})),rules:event.rules.map(row=>({id:row.id,description:row.text})),currentState:event.state,supportedActions:event.supportedActions};
          const raw=await bounded(()=>service.explainIncident(incident,options));
```

위 발췌는 /api/ai/explain의 NativeHost 분기에 있습니다. 아래는 같은 파일의 일반 분기입니다.

출처: `on-client/src/server.mjs`, 527~544행. 아래는 해당 파일의 연속된 원문입니다.

```javascript
      if(req.method==='POST'&&url.pathname==='/api/ai/explain'){
        const {eventId}=await bounded(()=>jsonBody(req,['eventId']));
        const identity=assertData('identity',await call('readIdentity'));
        const expectedScope=Object.freeze({subjectId:identity.user.id,projectId:engine.projectId,appId:'aleph-on',audience:'on-client'});
        if(mode==='connected'&&(!id(expectedScope.projectId)||identity.session.status!=='active'))throw engineError('SUBJECT_SCOPE_UNVERIFIED','');
        const rawEvents=await call('readEvents',expectedScope);
        if(mode==='connected'&&(!Array.isArray(rawEvents)||rawEvents.some(event=>event.subjectId!==expectedScope.subjectId||event.projectId!==expectedScope.projectId)))throw engineError('SUBJECT_SCOPE_UNVERIFIED','');
        const events=assertData('events',rawEvents);const event=events.find(row=>row.id===eventId);
        if(!event)throw engineError('EVENT_NOT_FOUND','본인 기록에서 사건을 찾을 수 없습니다.',404);
        const after=assertData('identity',await call('readIdentity'));
        if(after.user.id!==identity.user.id||after.session.id!==identity.session.id||after.session.status!=='active'||engine.projectId!==expectedScope.projectId)throw engineError('SUBJECT_SCOPE_UNVERIFIED','');
        if(lifetime.signal.aborted||res.destroyed)throw engineError('REQUEST_CANCELLED','');
        const source=Object.freeze({sourceSubjectId:identity.user.id,projectId:expectedScope.projectId,sessionId:identity.session.id});
        const binding=await readMapping(source);
        const output=await bounded(()=>mappedService().explainIncident({incidentId:event.id,evidence:event.evidence.map(e=>({id:e.id,summary:e.text})),rules:event.rules.map(r=>({id:r.id,description:r.text})),currentState:event.state,supportedActions:event.supportedActions},authOptions(binding)));
        await finishMapping(source,binding);
        if(!output?.ok){send(503,{ok:false,error:aiFailure(output)});return;}
        send(200,{ok:true,data:{explanation:assertExplanation(output.explanation,event,aiSecrets)}});return;
```

## 서비스가 공통 전송 모듈을 불러오는 경로

출처: `on-client/src/ai/service.mjs`, 263~273행. 아래는 해당 파일의 연속된 원문입니다.

```javascript
  async function transport() {
    if (!configured) throw own('ON_AI_PROVISIONING_PENDING');
    if (!client) {
      let factory = transportFactory;
      if (!factory) {
        try { factory = (await import('../../vendor/clco-http.mjs')).createClcoClient; }
        catch { throw own('ON_AI_TRANSPORT_PENDING'); }
      }
      client = factory({ baseUrl, token, timeoutMs, maxResponseBytes: 65536, allowLoopbackHttp });
    }
    return client;
```

## 서비스가 모델 설명 요청을 보내고 응답을 검증하는 경로

아래는 일반 서비스 분기 원문입니다. NativeHost 분기는 같은 explainIncident 안에서 권한 재확인 전후 훅을 추가로 사용합니다. 연결 점검의 listModels와 사건 설명의 chat은 서로 다른 호출입니다.

출처: `on-client/src/ai/service.mjs`, 382~392행. 아래는 해당 파일의 연속된 원문입니다.

```javascript
        const authorization = await authorize('explain', 'ai.explain', signal, expectedScope, expectedContext);
        const incident = validateInput(input, secrets);
        checkModel(authorization,true);
        const activeClient=await transport();guard(authorization,signal);
        const result = await activeClient.chat({ model, stream: false, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: JSON.stringify(incident) }] }, { signal });guard(authorization,signal);
        const choice = result?.choices?.[0];
        if (choice?.message?.tool_calls || choice?.message?.function_call || choice?.finish_reason === 'length' || typeof choice?.message?.content !== 'string') throw own('ON_AI_INVALID_OUTPUT');
        let output;
        try { output = JSON.parse(choice.message.content); } catch { throw own('ON_AI_INVALID_OUTPUT'); }
        return { ok: true, transportChecked: true, audienceAuthorization:authorization.mode, explanation: validateOutput(output, incident, secrets),
          help: help(authorization.mode==='verified'?'ON_AI_APP_AUTHORIZATION_VERIFIED':'ON_AI_TEST_TRANSPORT_ONLY',authorization.mode==='verified'?'verified':'pending') };
```

## 전송 모듈의 HTTP 요청과 chat 경로

출처: `on-client/vendor/clco-http.mjs`, 65~70행. 아래는 해당 파일의 연속된 원문입니다.

```javascript
      const response = await fetch(base.href.replace(/\/$/, '') + endpoint, {
        method: body ? 'POST' : 'GET',
        headers: { authorization: `Bearer ${token}`, accept: body?.stream ? 'text/event-stream' : 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
        redirect: 'manual',
```
출처: `on-client/vendor/clco-http.mjs`, 119~124행. 아래는 해당 파일의 연속된 원문입니다.

```javascript
    async chat(body, options = {}) {
      if (!body || typeof body.model !== 'string' || !body.model || !Array.isArray(body.messages) || !body.messages.length || (body.stream !== undefined && typeof body.stream !== 'boolean')) throw fail('WB_CLCO_INVALID_REQUEST');
      if (body.stream && typeof options.readStream !== 'function') throw fail('WB_CLCO_STREAM_READER_REQUIRED');
      const result = await request('/chat/completions', body, options);
      if (!body.stream && (!Array.isArray(result?.choices) || !result.choices.length)) throw fail('WB_CLCO_INVALID_RESPONSE', 200);
      return result;
```

## 수행한 검증

- 기존 17단계 학생 화면은 378개 실제 브라우저 DOM 모의 검증을 통과했습니다. 이 보완 작업에서는 학생 표시 함수를 변경하지 않았습니다.
- 기존 제출 JSON에서 server.mjs 73,831바이트와 clco-http.mjs 9,068바이트 본문을 추출해 Git 원문과 일치함을 확인했습니다.
- 이번 연결 시험은 별도 loopback HTTP 모의 게이트, 합성 사건·신원, 시험 전용 값만 사용했습니다. 기존 서비스의 명시적인 test 경로를 사용했으며 운영 설정이나 권한 검증 코드를 수정하지 않았습니다.
- POST /api/ai/check는 /v1/models 1회에 도달했고, 이때 chat 요청은 0회였습니다.
- POST /api/ai/explain은 기존 서버·서비스·vendor 모듈을 거쳐 모의 /v1/chat/completions에 도달했습니다. 정상 응답에서 executed=false 및 requiresHumanConfirmation=true를 확인했습니다.
- 없는 사건은 404, 다른 Origin은 403으로 거절됐고 두 경우 모두 추가 chat 요청은 없었습니다.
- 모의 게이트의 인증 실패는 안전한 WB_CLCO_AUTH_REQUIRED 오류와 503으로 반환됐습니다. 합성 자격 값이 응답에 노출되지 않았습니다.
- 정상 경로 1회와 인증 실패 경로 1회를 합쳐 모의 chat HTTP 요청은 총 2회였습니다. 실제 AI 모델은 한 번도 호출하지 않았습니다.

## 미확인 및 실제 확인에 필요한 조건

- 현재 공개 Vercel 진입점 on-client/api/index.mjs는 읽기 전용 미연결 미리보기입니다. POST를 405로 거절하므로 그 배포 사이트에서 실제 사건 설명 모델 호출이 완료됐다고 기록할 수 없습니다.
- 실제 계정 연결, 앱 전용 설명 권한 발급, 운영 게이트와 허용 모델, 본인 사건의 정상 연결은 운영 측 준비와 로컬 앱의 실제 확인이 필요합니다. 학생 표시 함수만 고쳐 준비 상태를 성공으로 바꿀 수 없습니다.
- 운영자가 연결 준비를 마친 뒤, 제공된 로컬 앱의 계정 연결과 앱 AI 승인 절차를 진행하고 보안 기록에서 본인 사건 설명을 직접 요청해야 합니다. 유료 호출 여부와 이용 권한을 확인한 뒤 사용자가 실행해야 합니다.
- 실제 결과를 확인하기 전에는 ai_model_called를 충족하거나 공식 통과했다고 주장하지 않습니다. 이 문서의 모의 결과를 실제 계정 결과로 제출해서는 안 됩니다.
- 키 복사·임의 모델·대체 연결·자동 재시도·보안 조치는 추가하지 않았습니다.
