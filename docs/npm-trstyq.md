# @trstyq/gemini-cli

SSE를 지원하지 않는 사설 LLM 게이트웨이를 위한
[Gemini CLI](https://github.com/google-gemini/gemini-cli) 포크입니다.

NDJSON 스트리밍 응답을 처리하며, 게이트웨이 환경에 맞게 스트림 형식과 모델·Auto
라우팅 설정을 구성할 수 있습니다.

## 추가된 기능

- **NDJSON 스트리밍**: 줄마다 JSON을 반환하는 Gateway의 응답을 처리합니다.
- **스트림 형식 선택**: `GEMINI_CLI_STREAM_FORMAT=NDJSON|SSE`로 인증 방식과
  별도로 선택합니다. 미설정 시 SSE를 사용합니다.
- **모델 기본 설정**: 설치 시 모델 6종과 Auto 라우팅 기본값을 사용자
  `~/.gemini/settings.json`에 추가합니다. 기존 설정값과 주석은 보존합니다.
- **수동 모델 선택 유지**: 동적 모델 설정을 사용할 때 직접 선택한 모델 ID가 SDK
  요청 직전에 다른 모델로 치환되지 않도록 합니다.

## 설치

Node.js 20 이상이 필요합니다.

```sh
npm install -g @trstyq/gemini-cli@latest
gemini --version
```

정식 배포 채널은 `latest`입니다. Canary 채널은 `@ca`로 별도 설치할 수 있습니다.

자동 업데이트와 업데이트 알림은 기본적으로 꺼져 있습니다. 수동 업데이트는
`npm install -g @trstyq/gemini-cli@latest`로 진행합니다. 두 기능을 모두 켜면
`@trstyq/gemini-cli`의 새 버전을 확인하고 자동으로 업데이트합니다.

## 게이트웨이 환경변수

CLI를 실행하기 전에 게이트웨이 환경에 맞게 다음 환경변수를 설정하세요.

| 환경변수                    | 용도                                                         | 예시 값                                                |
| --------------------------- | ------------------------------------------------------------ | ------------------------------------------------------ |
| `GEMINI_API_KEY`            | Gemini API 키 인증에 사용할 게이트웨이 API 키                | `YOUR_GATEWAY_API_KEY`                                 |
| `GOOGLE_GEMINI_BASE_URL`    | Gemini API 요청을 보낼 게이트웨이의 베이스 URL               | `https://llm-gateway.example.com/gemini`               |
| `GOOGLE_GENAI_API_VERSION`  | 게이트웨이가 지원하는 API 버전                               | `v1beta`                                               |
| `GEMINI_CLI_CUSTOM_HEADERS` | 요청에 추가할 커스텀 HTTP 헤더                               | `Authorization: Bearer <token>,X-Client-Id:gemini-cli` |
| `GEMINI_CLI_STREAM_FORMAT`  | 스트리밍 응답 형식. NDJSON 게이트웨이는 대문자 `NDJSON` 지정 | `NDJSON`                                               |

Linux / macOS (Bash, Zsh):

```sh
export GEMINI_API_KEY="YOUR_GATEWAY_API_KEY"
export GOOGLE_GEMINI_BASE_URL="https://llm-gateway.example.com/gemini"
export GOOGLE_GENAI_API_VERSION="v1beta"
export GEMINI_CLI_CUSTOM_HEADERS="Authorization: Bearer <token>,X-Client-Id:gemini-cli,X-Project:my-project"
export GEMINI_CLI_STREAM_FORMAT="NDJSON"
```

Windows PowerShell:

```powershell
$env:GEMINI_API_KEY = "YOUR_GATEWAY_API_KEY"
$env:GOOGLE_GEMINI_BASE_URL = "https://llm-gateway.example.com/gemini"
$env:GOOGLE_GENAI_API_VERSION = "v1beta"
$env:GEMINI_CLI_CUSTOM_HEADERS = "Authorization: Bearer <token>,X-Client-Id:gemini-cli,X-Project:my-project"
$env:GEMINI_CLI_STREAM_FORMAT = "NDJSON"
```

API 키, URL, 버전, 헤더 이름과 값은 예시이므로 실제 게이트웨이 설정으로
바꾸세요. 커스텀 헤더는 `헤더명:값` 형식이며, 여러 개는 쉼표로 구분합니다. 추가
헤더가 필요하지 않으면 `GEMINI_CLI_CUSTOM_HEADERS`는 생략할 수 있습니다.

`Authorization: Bearer <token>`의 `<token>`은 게이트웨이에서 발급받은 실제
토큰으로 바꾸세요. 인증 헤더 형식은 게이트웨이 요구사항에 맞춰 설정합니다.

위 명령은 현재 터미널 세션에 적용됩니다. 계속 사용하려면 Bash의 `~/.bashrc`,
Zsh의 `~/.zshrc` 또는 Windows 사용자 환경변수에 등록하고 새 터미널을 여세요.

## 모델 및 Auto 기본 설정

npm 설치 스크립트가 사용자 홈의 `~/.gemini/settings.json`을 초기화합니다. 설치
스크립트가 차단되거나 `--ignore-scripts`로 설치한 경우 첫 CLI 실행 때 같은
초기화를 수행합니다. `GEMINI_CLI_HOME`을 지정했다면 그 경로 아래의
`.gemini/settings.json`을 사용합니다.

기본 시작 모델은 `auto`입니다.

| 역할                                  | 모델 ID                  |
| ------------------------------------- | ------------------------ |
| Auto 요청 분류                        | `gemini-3.5-flash-lite`  |
| 복잡한 추론 작업                      | `gemini-3.1-pro-preview` |
| 일반 작업 및 라우터 실패 시 기본 모델 | `gemini-3.8-flash`       |

수동 선택할 수 있는 모델은 다음 6종입니다.

- `gemini-3-flash-preview`
- `gemini-3.1-pro-preview`
- `gemini-3.5-flash`
- `gemini-3.5-flash-lite`
- `gemini-3.7-flash`
- `gemini-3.8-flash`

모델 ID는
[Google 공식 모델 목록](https://ai.google.dev/gemini-api/docs/models?hl=en)을
기준으로 확인했습니다. Flash-Lite의 철자는 `light`가 아닌 `lite`입니다. 위
목록은 이 포크에 포함된 초기 기본값입니다. 게이트웨이가 제공하는 모델에 맞춰
`settings.json`의 `modelConfigs`에서 모델 목록과 Auto 라우팅을 조정하세요.

기존 값과 JSON 주석은 보존하고 없는 항목만 채웁니다. 기존 `model.name`이나
`experimental.dynamicModelConfiguration`을 명시했다면 그 값이 우선합니다.
초기화는 한 번만 수행하며, 이후 재설치·실행에서 사용자가 변경하거나 삭제한
항목을 다시 채우지 않습니다. 인증 정보·Gateway 주소·스트림 환경변수는 별도로
설정합니다.

Auto는 기존 CLI 분류기를 사용하므로 모든 요청에서 반드시 라우터를 호출하는 것은
아닙니다. 도구 응답, 명시적 모델 선택, 계획 모드 등 기존 우회 규칙은 유지됩니다.

## NDJSON 선택

- `NDJSON`: 줄마다 JSON을 반환하는 Gateway의 스트리밍 응답 처리
- `SSE` 또는 미설정: SDK 기본 SSE 처리
- 소문자, 빈 문자열 등 다른 값: 설정 오류
- 일반 JSON 생성 요청: 기존 SDK 처리 유지

`gemini-api-key`, `vertex-ai`, ACP의 `gateway` 인증에 적용됩니다. Google
로그인/Code Assist는 별도 전송 경로를 사용하므로 이 설정이 적용되지 않습니다.

일반 CLI에서는 기존 Gemini API 키 인증을 유지하고 사설 게이트웨이 주소와 헤더를
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
설정합니다.

이전 `0.67.0-nightly-rc`의 Gateway 자동 NDJSON 선택은 제거되었습니다. 업데이트
시 `GEMINI_CLI_STREAM_FORMAT=NDJSON`을 명시하세요.

## 패키지 준비

소스를 커밋한 뒤 저장소 루트에서 실행합니다.

```sh
npm run package:trstyq -- --tag latest
```

명령은 번들을 새로 빌드하고 임시 디렉터리에 tarball, `SHA256SUMS`,
`release.json`을 생성합니다. `release.json`에는 소스 커밋과 npm 무결성 값이
포함됩니다. 자동 발행은 수행하지 않습니다. `--tag`를 생략하면 기존 Canary 채널인
`ca`로 준비합니다.

발행 시 준비된 tarball의 경로와 버전을 명시합니다.

```sh
npm publish "/path/to/trstyq-gemini-cli-<version>.tgz" --tag latest --access public --ignore-scripts
```

소스: https://github.com/ts2580/gemini-cli

원본: https://github.com/google-gemini/gemini-cli

라이선스: Apache-2.0 (`LICENSE` 참고).
