# 시민제과 직원앱

매장 체크리스트 및 냉동재고 관리 웹앱입니다.
체크 기록이 노션에 자동으로 저장됩니다.

## 배포 방법 (Vercel)

### 1단계: GitHub에 올리기

1. https://github.com 에서 회원가입/로그인
2. 오른쪽 상단 "+" → "New repository" 클릭
3. Repository name: `simin-checklist` 입력
4. "Create repository" 클릭
5. 이 프로젝트 폴더의 파일들을 업로드
   - "uploading an existing file" 링크 클릭
   - 모든 파일을 드래그 앤 드롭
   - "Commit changes" 클릭

### 2단계: 노션 API 키 발급

1. https://www.notion.so/my-integrations 접속
2. "새 통합" 클릭
3. 이름: "시민제과 직원앱" 입력
4. 워크스페이스 선택 후 "제출"
5. "내부 통합 시크릿" 복사 → 이것이 API 키입니다
6. 노션에서 "시민제과 직원앱 시스템" 페이지 열기
7. 우측 상단 "..." → "연결" → 방금 만든 통합 선택

### 3단계: Vercel에서 배포

1. https://vercel.com 에서 GitHub으로 로그인
2. "Add New Project" 클릭
3. GitHub에서 `simin-checklist` 저장소 선택 → "Import"
4. Environment Variables 섹션에 3개 추가:
   - `NOTION_API_KEY` = 2단계에서 복사한 키
   - `NOTION_DAILY_RECORD_DB_ID` = `3be3d0e9e35c4fb2b30ea6f8ee98535b`
   - `NOTION_INVENTORY_DB_ID` = `a8fe350a0c9c48e084dc2017f9544d31`
5. "Deploy" 클릭

### 4단계: 완료!

배포가 완료되면 `simin-checklist.vercel.app` 같은 주소가 생깁니다.
직원들에게 이 주소를 공유하면 핸드폰 브라우저에서 바로 사용 가능합니다.

**홈화면 추가 방법 (아이폰):**
사파리에서 주소 접속 → 하단 공유 버튼 → "홈 화면에 추가"

**홈화면 추가 방법 (안드로이드):**
크롬에서 주소 접속 → 우측 상단 메뉴 → "홈 화면에 추가"
