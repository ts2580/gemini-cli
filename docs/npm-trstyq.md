# @trstyq/gemini-cli

Gemini CLI 포크. 스트리밍 응답 형식을 인증 방식과 별도로 선택합니다.

## 설치

```sh
npm install -g @trstyq/gemini-cli@ca
gemini --version
```

0.67.1 패키지의 배포 채널은 `ca`입니다. 위 명령은 npm 발행 후 사용할 수
있습니다.

## NDJSON 선택

```sh
export GEMINI_CLI_STREAM_FORMAT=NDJSON
```

Windows PowerShell:

```powershell
$env:GEMINI_CLI_STREAM_FORMAT = "NDJSON"
```

- `NDJSON`: 줄마다 JSON을 반환하는 Gateway의 스트리밍 응답 처리
- `SSE` 또는 미설정: SDK 기본 SSE 처리
- 소문자, 빈 문자열 등 다른 값: 설정 오류
- 일반 JSON 생성 요청: 기존 SDK 처리 유지

`gemini-api-key`, `vertex-ai`, ACP의 `gateway` 인증에 적용됩니다. Google
로그인/Code Assist는 별도 전송 경로를 사용하므로 이 설정이 적용되지 않습니다.

일반 CLI에서는 기존 Gemini API 키 인증을 유지하고 회사 Gateway 주소와 헤더를
설정하세요. `GOOGLE_GEMINI_BASE_URL`만 지정하고 인증을 선택하지 않으면 기존
Gateway 자동 감지 경로로 진입할 수 있으므로, `gemini-api-key` 인증을 명시해야
합니다. 기존 `.gemini/settings.json`의 다른 설정을 유지하면서 다음 항목을
설정합니다.

```json
{
  "security": {
    "auth": {
      "selectedType": "gemini-api-key"
    }
  }
}
```

API 키, 주소, API 버전 및 추가 헤더 값은 사용하는 Gateway 규칙에 맞춰
설정합니다. 실제 회사 Gateway 접속과 전체 도구 호출 왕복은 별도 검증이
필요합니다.

이전 `0.67.0-nightly-rc`의 Gateway 자동 NDJSON 선택은 제거되었습니다. 업데이트
시 `GEMINI_CLI_STREAM_FORMAT=NDJSON`을 명시하세요.

## 패키지 준비

소스를 커밋한 뒤 저장소 루트에서 실행합니다.

```sh
npm run package:trstyq
```

명령은 번들을 새로 빌드하고 임시 디렉터리에 tarball, `SHA256SUMS`,
`release.json`을 생성합니다. `release.json`에는 소스 커밋과 npm 무결성 값이
포함됩니다. 자동 발행은 수행하지 않습니다.

발행 시 준비된 tarball을 명시합니다.

```sh
npm publish /path/to/trstyq-gemini-cli-0.67.1.tgz --tag ca --access public --ignore-scripts
```

소스: https://github.com/ts2580/gemini-cli

원본: https://github.com/google-gemini/gemini-cli

라이선스: Apache-2.0 (`LICENSE` 참고).
