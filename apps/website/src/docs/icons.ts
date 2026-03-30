export const icons = {
  id: 'icons',
  title: 'Shapes',
  titleKo: '도형',
  content: `
## What Are Shapes?

The \`shape\` element displays an SVG loaded from an external registry at render time.
You only write a semantic key — Depix resolves the matching SVG automatically.

\`\`\`depix
@page 16:9

scene "System Components" {
  layout: header-grid
  header: heading "System Overview"
  cell: shape "server"   label:"API Server"
  cell: shape "database" label:"PostgreSQL"
  cell: shape "cache"    label:"Redis"
  cell: shape "queue"    label:"Message Queue"
}
\`\`\`

## Syntax

\`\`\`
shape "key" [label:"..."] [description:"..."]
\`\`\`

| Part | Required | Description |
|------|:--------:|-------------|
| \`"key"\` | ✓ | Registry key — the semantic name of the shape |
| \`label:"..."\` | — | Short label rendered below the shape |
| \`description:"..."\` | — | Small caption below the label |

## Available Keys

The official **tech** pack ships with the following keys:

| Key | Description |
|-----|-------------|
| \`server\` | Server / compute node |
| \`database\` | Database / storage |
| \`cloud\` | Cloud provider |
| \`api\` | API / service endpoint |
| \`cache\` | Cache layer (Redis, Memcached) |
| \`queue\` | Message queue (Kafka, RabbitMQ) |
| \`browser\` | Web browser / frontend client |
| \`mobile\` | Mobile device |
| \`cpu\` | CPU / processing unit |
| \`network\` | Network / load balancer |

> **Tip:** Keys are resolved at runtime — new packs become available without updating Depix.

## Shapes with Labels and Descriptions

\`\`\`depix
@page 16:9

scene "Data Pipeline" {
  layout: header-grid
  header: heading "Data Pipeline"
  cell: shape "browser"  label:"Client"       description:"Web App"
  cell: shape "api"      label:"API Gateway"  description:"REST / GraphQL"
  cell: shape "server"   label:"Service"      description:"Node.js"
  cell: shape "database" label:"Database"     description:"PostgreSQL"
}
\`\`\`

## Architecture Diagram

Combine shapes with flow blocks to describe system topology:

\`\`\`depix
@page 16:9

scene "Microservices" {
  layout: header-split
  header: heading "Microservice Architecture"
  left: flow direction:down {
    node "Client" #client
    node "API Gateway" #gw
    node "Auth Service" #auth
    #client -> #gw
    #gw -> #auth
  }
  right: stack direction:col {
    shape "database" label:"User DB"      description:"PostgreSQL"
    shape "cache"    label:"Session Cache" description:"Redis"
    shape "queue"    label:"Event Bus"    description:"Kafka"
  }
}
\`\`\`

## Fallback Rendering

If the registry key is not found (network unavailable, unknown key), Depix renders
a **dashed outline box** with the key name — so your diagram always displays correctly.

\`\`\`depix
@page 16:9

scene "With Fallback" {
  layout: header-grid
  header: heading "Known and Unknown Shapes"
  cell: shape "server"       label:"Known key"
  cell: shape "unknown-key"  label:"Unknown key (fallback)"
}
\`\`\`

> The fallback ensures that diagrams with unknown or unloaded shapes never break.

## How the Registry Works

1. On first render, Depix fetches the **registry index** (a list of available keys — no SVG data).
2. After compiling the DSL, Depix collects all \`shape\` keys used in the document.
3. Only the **packs that contain those keys** are fetched lazily.
4. SVGs are stored in the engine's \`ShapeRegistry\` for the lifetime of the component.

The compiler never accesses the network — registry loading happens entirely in the React layer.
  `,
  contentKo: `
## 도형이란?

\`shape\` 요소는 런타임에 외부 레지스트리에서 불러온 SVG를 표시합니다.
시맨틱 키만 작성하면 Depix가 자동으로 매칭 SVG를 가져옵니다.

\`\`\`depix
@page 16:9

scene "System Components" {
  layout: header-grid
  header: heading "시스템 개요"
  cell: shape "server"   label:"API 서버"
  cell: shape "database" label:"PostgreSQL"
  cell: shape "cache"    label:"Redis"
  cell: shape "queue"    label:"메시지 큐"
}
\`\`\`

## 문법

\`\`\`
shape "key" [label:"..."] [description:"..."]
\`\`\`

| 요소 | 필수 | 설명 |
|------|:----:|------|
| \`"key"\` | ✓ | 레지스트리 키 — 도형의 시맨틱 이름 |
| \`label:"..."\` | — | 도형 아래 짧은 라벨 |
| \`description:"..."\` | — | 라벨 아래 작은 설명 |

## 사용 가능한 키

공식 **tech** 팩에는 다음 키가 포함되어 있습니다:

| 키 | 설명 |
|----|------|
| \`server\` | 서버 / 컴퓨트 노드 |
| \`database\` | 데이터베이스 / 스토리지 |
| \`cloud\` | 클라우드 프로바이더 |
| \`api\` | API / 서비스 엔드포인트 |
| \`cache\` | 캐시 레이어 (Redis, Memcached) |
| \`queue\` | 메시지 큐 (Kafka, RabbitMQ) |
| \`browser\` | 웹 브라우저 / 프론트엔드 클라이언트 |
| \`mobile\` | 모바일 기기 |
| \`cpu\` | CPU / 처리 장치 |
| \`network\` | 네트워크 / 로드 밸런서 |

> **팁:** 키는 런타임에 해석되므로, Depix를 업데이트하지 않아도 새 팩을 바로 사용할 수 있습니다.

## 라벨과 설명 포함

\`\`\`depix
@page 16:9

scene "Data Pipeline" {
  layout: header-grid
  header: heading "데이터 파이프라인"
  cell: shape "browser"  label:"클라이언트"    description:"Web App"
  cell: shape "api"      label:"API 게이트웨이" description:"REST / GraphQL"
  cell: shape "server"   label:"서비스"       description:"Node.js"
  cell: shape "database" label:"데이터베이스"   description:"PostgreSQL"
}
\`\`\`

## 아키텍처 다이어그램

도형과 flow 블록을 조합해 시스템 구조를 표현할 수 있습니다:

\`\`\`depix
@page 16:9

scene "마이크로서비스" {
  layout: header-split
  header: heading "마이크로서비스 아키텍처"
  left: flow direction:down {
    node "클라이언트" #client
    node "API 게이트웨이" #gw
    node "인증 서비스" #auth
    #client -> #gw
    #gw -> #auth
  }
  right: stack direction:col {
    shape "database" label:"사용자 DB"   description:"PostgreSQL"
    shape "cache"    label:"세션 캐시"   description:"Redis"
    shape "queue"    label:"이벤트 버스" description:"Kafka"
  }
}
\`\`\`

## 폴백 렌더링

레지스트리 키를 찾을 수 없는 경우(네트워크 오류, 알 수 없는 키), Depix는
**점선 아웃라인 박스**와 키 이름을 표시합니다. 다이어그램은 항상 정상적으로 렌더링됩니다.

\`\`\`depix
@page 16:9

scene "폴백 예시" {
  layout: header-grid
  header: heading "알려진 키와 알 수 없는 키"
  cell: shape "server"       label:"알려진 키"
  cell: shape "unknown-key"  label:"알 수 없는 키 (폴백)"
}
\`\`\`

> 폴백 렌더링은 알 수 없거나 로드되지 않은 도형이 있어도 다이어그램이 깨지지 않도록 보장합니다.

## 레지스트리 동작 방식

1. 첫 렌더링 시 **레지스트리 인덱스**(SVG 없이 키 목록만)를 fetch합니다.
2. DSL 컴파일 후 문서에 사용된 모든 \`shape\` 키를 수집합니다.
3. 해당 키가 포함된 팩만 **지연 fetch**합니다.
4. SVG는 컴포넌트 생애 동안 엔진의 \`ShapeRegistry\`에 저장됩니다.

컴파일러는 네트워크에 접근하지 않으며, 레지스트리 로딩은 전적으로 React 레이어에서 처리됩니다.
  `,
};
