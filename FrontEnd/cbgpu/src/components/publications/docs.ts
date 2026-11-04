export const docCategories = [
  {
    "id": "start",
    "title": "시작·계정"
  },
  {
    "id": "school",
    "title": "학교생활"
  },
  {
    "id": "research",
    "title": "GPU·연구"
  },
  {
    "id": "deploy",
    "title": "배포·협업"
  },
  {
    "id": "making",
    "title": "제작"
  },
  {
    "id": "community",
    "title": "대회·커뮤니티"
  },
  {
    "id": "operations",
    "title": "담당자·관리자"
  },
  {
    "id": "help",
    "title": "도움말"
  }
] as const;
export type DocCategoryId=typeof docCategories[number]['id'];
export type GuideSection={title:string;body:string;steps?:string[];code?:string;links?:{label:string;href:string}[]};
export type Guide={slug:string;title:string;description:string;category:DocCategoryId;features:string[];sections:GuideSection[];related:string[];keywords?:string[]};
export const guides:Guide[] = [
  {
    "slug": "getting-started",
    "title": "처음 시작하기",
    "description": "평범한 학생이 처음 들어왔을 때 필요한 로그인, 기능 찾기와 두 공간 안내.",
    "category": "start",
    "features": [
      "/",
      "/workspace",
      "https://student.cbgpu.com",
      "https://researcher.cbgpu.com",
      "https://developer.cbgpu.com"
    ],
    "sections": [
      {
        "title": "일단 메인부터 열기",
        "body": "메인은 학교생활 공간으로 시작합니다. 버전을 먼저 고를 필요 없이 자습 신청, 시간표, 급식, 기상송, 자료 공유를 찾을 수 있습니다.",
        "links": [
          {
            "label": "CBGPU 메인",
            "href": "https://cbgpu.com"
          }
        ]
      },
      {
        "title": "필요한 기능 찾기",
        "body": "홈의 “무엇이 필요한가요?” 아래에서 기능을 누릅니다. 즐겨찾기에 없는 기능도 분류별 목록에 모두 표시됩니다. 검색창에는 “밥”, “자료”, “프린터”처럼 알고 있는 단어를 입력해 보세요.",
        "steps": [
          "목록에서 기능을 고르거나 검색어를 입력합니다.",
          "결과가 없으면 검색과 분류를 초기화합니다.",
          "로그인이 필요한 기능은 CBGPU 계정으로 로그인한 뒤 이용합니다."
        ]
      },
      {
        "title": "학교생활과 연구·개발",
        "body": "학교생활은 자습·수업·급식·학교 활동 중심입니다. GPU, 웹사이트·서버 배포, 논문 작성과 제작은 연구·개발 공간에 모여 있습니다. 개발자용과 리서처용 공간은 통합되었으며 기존 developer.cbgpu.com 주소도 같은 통합 화면을 제공합니다.",
        "links": [
          {
            "label": "연구·개발 공간",
            "href": "https://researcher.cbgpu.com"
          }
        ]
      },
      {
        "title": "내 이름과 상태 확인",
        "body": "오른쪽 위 프로필에서 계정 정보를 확인합니다. 이름·학번 확인이 필요한 계정은 프로필을 수정하고 관리자에게 확인을 요청하세요. 다른 공간으로 이동할 때도 같은 CBGPU 계정을 사용합니다."
      }
    ],
    "related": [
      "account",
      "feature-search",
      "app"
    ]
  },
  {
    "slug": "feature-search",
    "title": "기능 찾기·즐겨찾기",
    "description": "검색, 분류, 최근 사용과 즐겨찾기를 이용해 원하는 기능으로 이동하기.",
    "category": "start",
    "features": [
      "/services"
    ],
    "sections": [
      {
        "title": "기능 이름을 몰라도 검색",
        "body": "홈 검색 또는 전체 기능에서 서비스 이름, 설명과 관련 단어를 검색합니다. “자료공유”처럼 띄어쓰기 없이 입력할 수도 있습니다. 다른 공간에만 있는 기능은 “다른 공간에서 찾았어요”에 표시됩니다.",
        "links": [
          {
            "label": "전체 기능 열기",
            "href": "https://cbgpu.com/services"
          }
        ]
      },
      {
        "title": "분류와 검색 함께 쓰기",
        "body": "학교생활, GPU 사용, 웹사이트·서버 배포 같은 분류 버튼으로 목록을 좁힙니다. 전체를 누르면 현재 공간의 모든 분류를 다시 볼 수 있습니다. 결과가 없으면 검색어 지우기 또는 검색과 분류 초기화를 사용하세요."
      },
      {
        "title": "키보드로 빠르게 열기",
        "body": "상단 돋보기 또는 Ctrl+K(macOS는 Command+K)로 기능 찾기를 엽니다. 검색 후 위·아래 방향키로 결과를 고르고 Enter로 이동합니다. Escape나 닫기를 누르면 검색창이 닫힙니다."
      },
      {
        "title": "즐겨찾기와 최근 사용",
        "body": "홈의 즐겨찾기에서 편집을 누르면 현재 공간의 기능을 최대 8개 선택할 수 있습니다. 최근 사용은 방문한 기능을 보여줍니다. 이 설정은 계정·공간별로 현재 브라우저에 저장되므로 다른 기기와 자동으로 같아지지는 않습니다. 브라우저 데이터를 지우면 초기화될 수 있습니다."
      }
    ],
    "related": [
      "getting-started",
      "app"
    ]
  },
  {
    "slug": "account",
    "title": "계정 만들기·로그인·비밀번호 찾기",
    "description": "회원가입부터 로그인 연결과 재설정 이메일 오류까지.",
    "category": "start",
    "features": [
      "/auth/signup",
      "/auth/login",
      "/auth/forgot-password",
      "/auth/reset-password",
      "/auth/callback",
      "/auth/transfer"
    ],
    "sections": [
      {
        "title": "회원가입",
        "body": "회원가입 화면의 필수 정보를 입력합니다. 본인 이메일과 정확한 이름·학번을 사용하세요. 가입 후 화면에 표시되는 이메일 확인 또는 계정 확인 안내를 따라 완료합니다.",
        "links": [
          {
            "label": "회원가입",
            "href": "https://cbgpu.com/auth/signup"
          }
        ]
      },
      {
        "title": "로그인과 공간 이동",
        "body": "기존 CBGPU 이메일·비밀번호로 로그인합니다. 학교생활과 연구·개발은 같은 계정을 사용하며 공간 이동 링크가 로그인을 연결합니다. 주소를 직접 열었을 때 로그인 화면이 나오면 같은 계정으로 다시 로그인하세요.",
        "links": [
          {
            "label": "로그인",
            "href": "https://cbgpu.com/auth/login"
          }
        ]
      },
      {
        "title": "비밀번호 재설정",
        "body": "로그인 화면의 비밀번호 찾기를 이용합니다.",
        "steps": [
          "가입한 이메일 주소를 입력하고 재설정 메일을 요청합니다.",
          "받은 이메일에서 재설정 링크를 엽니다.",
          "새 비밀번호를 저장하고 다시 로그인합니다."
        ],
        "links": [
          {
            "label": "비밀번호 찾기",
            "href": "https://cbgpu.com/auth/forgot-password"
          }
        ]
      },
      {
        "title": "메일이나 링크가 작동하지 않을 때",
        "body": "스팸함, 입력한 주소와 가장 최근 메일을 확인하세요. 만료되거나 이미 사용한 링크는 새로 요청합니다. “Error sending recovery email”이 표시되면 요청이 성공한 것이 아니므로 계속 반복하지 말고 오류 문구와 발생 시각을 문의에 남겨주세요. 비밀번호나 재설정 링크 전체는 보내지 마세요."
      }
    ],
    "related": [
      "profile",
      "troubleshooting",
      "contact"
    ]
  },
  {
    "slug": "profile",
    "title": "프로필·SSH 공개키·알림 설정",
    "description": "이름과 학번 수정, 비밀번호 변경, 공개키 등록, 알림과 계정 삭제.",
    "category": "start",
    "features": [
      "/profile"
    ],
    "sections": [
      {
        "title": "이름·학번·사진",
        "body": "프로필에서 본인의 정보를 확인하고 이름·학번을 수정한 뒤 저장합니다. 사진 변경 기능으로 프로필 이미지를 설정할 수 있습니다. 학번이나 이름 확인이 필요한 경우 수정만으로 즉시 권한이 복구된다고 보장되지는 않습니다.",
        "links": [
          {
            "label": "내 프로필",
            "href": "https://cbgpu.com/profile"
          }
        ]
      },
      {
        "title": "비밀번호 변경",
        "body": "비밀번호 변경 영역에서 현재 비밀번호와 새 비밀번호·확인 값을 입력하고 저장합니다. 현재 비밀번호를 모르면 비밀번호 찾기를 이용하세요."
      },
      {
        "title": "SSH 공개키 등록",
        "body": "개인 컴퓨터에서 준비한 ssh-ed25519 또는 지원되는 형식의 공개키 한 줄을 SSH 공개키에 붙여넣고 저장합니다. .pub 파일 내용만 등록하고 비공개키는 올리지 않습니다.",
        "links": [
          {
            "label": "SSH 안내",
            "href": "https://docs.cbgpu.com/ssh"
          }
        ]
      },
      {
        "title": "앱 알림 설정",
        "body": "프로필의 알림 항목에서 본인에게 제공되는 항목을 켜거나 끕니다. Android 앱 로그인과 휴대폰의 알림 허용도 필요합니다. 담당자·관리자 전용 항목은 역할에 따라 보이며 설정을 켰다는 이유만으로 그 역할을 얻는 것은 아닙니다."
      },
      {
        "title": "계정 삭제",
        "body": "계정 삭제는 확인 절차를 거쳐 진행합니다. 필요한 자료와 프로젝트 결과를 먼저 보관하고 화면에서 영향을 확인한 뒤 실행하세요. 단순 로그아웃을 원할 때는 계정 삭제 대신 로그아웃을 사용합니다."
      }
    ],
    "related": [
      "account",
      "ssh",
      "app"
    ]
  },
  {
    "slug": "app",
    "title": "모바일 웹·Android 앱",
    "description": "앱 설치, 학교생활·연구개발 전환, 알림 권한과 업데이트.",
    "category": "start",
    "features": [
      "/download",
      "https://app.cbgpu.com"
    ],
    "sections": [
      {
        "title": "모바일 웹으로 이용",
        "body": "app.cbgpu.com은 휴대폰에 맞춘 화면입니다. 위 가운데에서 학교생활과 연구·개발을 바꾸고, 하단의 홈·주요 기능·전체 기능·내 정보로 이동합니다. 앱 안의 일반 사용자 탐색은 app.cbgpu.com을 유지합니다. Docs와 arXiv 같은 독립 서비스는 별도 주소로 열립니다.",
        "links": [
          {
            "label": "모바일 버전",
            "href": "https://app.cbgpu.com"
          }
        ]
      },
      {
        "title": "Android 설치·업데이트",
        "body": "공식 다운로드 페이지에서 APK와 설치 안내를 확인합니다. 기기가 요청하는 경우 해당 브라우저의 설치 권한을 허용합니다. 이미 설치한 앱은 공식 업데이트 APK로 갱신하세요.",
        "links": [
          {
            "label": "공식 다운로드",
            "href": "https://cbgpu.com/download"
          }
        ]
      },
      {
        "title": "알림이 오지 않을 때",
        "body": "앱에 CBGPU 계정으로 로그인하고 Android 알림 권한과 프로필의 해당 알림 설정을 확인하세요. 담당자 알림은 역할과 담당 장비·지정 담당자에 따라 대상이 정해집니다. 등록된 기기가 없거나 알림 권한이 꺼져 있으면 휴대폰에서 받을 수 없습니다."
      },
      {
        "title": "화면이 예전과 다를 때",
        "body": "화면을 새로고침하거나 앱을 완전히 닫았다가 다시 엽니다. 로그인 상태와 앱 버전도 확인하세요. 계속 안 되면 해당 기능 주소, 앱 버전과 화면 사진을 문의에 첨부해 주세요."
      }
    ],
    "related": [
      "profile",
      "feature-search",
      "troubleshooting"
    ]
  },
  {
    "slug": "study",
    "title": "자습 신청·좌석 현황",
    "description": "자습실·교시·좌석 확인, EduSet 학생 계정 연결과 공식 신청·취소.",
    "category": "school",
    "features": [
      "/study",
      "/study/link"
    ],
    "sections": [
      {
        "title": "자습 현황 보기",
        "body": "자습 신청에서 자습실로 찾기 또는 학생으로 찾기를 선택합니다. 자습실 이름이나 학생 이름·학번으로 필요한 대상을 좁힐 수 있습니다.",
        "links": [
          {
            "label": "자습 신청 열기",
            "href": "https://cbgpu.com/study"
          }
        ]
      },
      {
        "title": "교시·좌석 선택",
        "body": "자습실을 열고 교시를 고른 뒤 배치도 또는 목록을 사용합니다. 좌석을 누르면 신청자와 승인 대기 상태를 확인할 수 있고, 빈자리의 이 자리 신청하기로 신청서를 채울 수 있습니다. 배치도가 화면보다 크면 해당 영역 안에서 가로·세로로 스크롤하세요."
      },
      {
        "title": "실제 신청하기",
        "body": "앱 v1.0.7 이상에서 EduSet 계정 연결 → EduSet 로그인을 누릅니다. 공식 학교 로그인 창에서 로그인하면 자동으로 CBGPU로 돌아오며, 본인 학생 정보를 확인해 한 번 연결하면 됩니다. 연결은 같은 CBGPU 계정의 앱·웹에서 유지됩니다. 기존 앱은 업데이트 없이 최초 연결 도우미를 사용할 수도 있습니다. 공식 신청 시간에 교실·선생님·교시·좌석·사유를 선택하고 공식 EduSet에 신청을 누릅니다. 정원제 교실은 좌석을 선택하지 않습니다. 성공 후 공식 내역을 다시 조회하며 승인 대기·승인·거절 상태를 그대로 표시합니다. 신청이 완료되기 전에는 좌석이 확보된 것이 아닙니다."
      },
      {
        "title": "변경·취소와 계정 연결",
        "body": "내 자습 신청에서 본인의 신청을 취소할 수 있습니다. 교실·좌석 변경은 기존 신청 취소 후 재신청으로 진행합니다. 신청과 취소는 공식 접수 시간에만 허용됩니다. EduSet 비밀번호는 CBGPU에서 입력받지 않고, 학교 세션은 서버에 암호화해 CBGPU 계정별로 저장합니다. 연결 해제로 삭제할 수 있으며, 공식 학교 세션이 만료되면 다시 로그인해야 합니다. 학교 보안 확인이 연결을 거절하면 공식 사이트를 이용하세요. 응답 오류가 나면 재신청하기 전에 내 신청 새로고침으로 실제 등록 여부부터 확인합니다."
      },
      {
        "title": "조회 실패·알림·연결 기여",
        "body": "일부 방 조회가 실패하면 다시 불러오기를 사용하세요. 토큰이나 조회 연결이 만료되면 연결 기여 안내를 확인합니다. 자습 알림은 화면의 알림 설정과 앱·브라우저 권한을 함께 확인하세요.",
        "links": [
          {
            "label": "조회 연결 기여",
            "href": "https://cbgpu.com/study/contribute"
          }
        ]
      }
    ],
    "related": [
      "study-contribute",
      "app",
      "troubleshooting"
    ],
    "keywords": [
      "eduset",
      "edu-set",
      "자습신청",
      "좌석"
    ]
  },
  {
    "slug": "study-contribute",
    "title": "자습 조회 연결 기여",
    "description": "브라우저 스크립트로 학교 자습 조회 연결을 갱신하는 방법.",
    "category": "school",
    "features": [
      "/study/contribute"
    ],
    "sections": [
      {
        "title": "언제 필요한가요?",
        "body": "조회 연결 갱신을 돕고 싶은 승인된 사용자를 위한 기능입니다. 일반적인 좌석 조회만 하려면 먼저 자습 신청 화면을 이용하세요.",
        "links": [
          {
            "label": "연결 기여 화면",
            "href": "https://cbgpu.com/study/contribute"
          }
        ]
      },
      {
        "title": "화면의 세 단계 따라 하기",
        "body": "현재 안내는 Chrome·Brave·Edge와 Violentmonkey 사용자 스크립트 방식을 사용합니다. 화면의 공식 설치 링크와 안내를 순서대로 따르세요.",
        "steps": [
          "안내된 브라우저에서 Violentmonkey를 설치하고 필요한 실행 설정을 확인합니다.",
          "CBGPU 스크립트 설치를 눌러 사용자 스크립트를 설치합니다.",
          "연결 버튼으로 기기를 등록하고 열린 학교 사이트에서 본인 계정으로 로그인합니다."
        ]
      },
      {
        "title": "연결 상태 확인",
        "body": "연결 화면에서 기기 목록과 최근 갱신 시각을 확인합니다. 설치만 하고 연결 등록이나 학교 로그인을 끝내지 않으면 갱신이 완료되지 않을 수 있습니다."
      },
      {
        "title": "다른 브라우저·연결 해제",
        "body": "다른 브라우저도 연결하기로 추가하고, 더 이상 쓰지 않는 기기는 목록에서 연결 해제합니다. 학교 로그인 정보와 조회 토큰은 공개 게시판이나 문의 메시지에 붙여넣지 마세요."
      }
    ],
    "related": [
      "study",
      "troubleshooting"
    ]
  },
  {
    "slug": "timetable",
    "title": "시간표",
    "description": "학년·반 선택, 이번 주 수업과 개인 시간표 편집.",
    "category": "school",
    "features": [
      "/timetable"
    ],
    "sections": [
      {
        "title": "내 학년·반 선택",
        "body": "시간표에서 학년과 반을 선택합니다. 프로필의 학번이 올바른지도 확인하세요. 화면에 표시되는 오늘 수업과 주간 표를 함께 볼 수 있습니다.",
        "links": [
          {
            "label": "시간표 열기",
            "href": "https://cbgpu.com/timetable"
          }
        ]
      },
      {
        "title": "변경된 수업 확인",
        "body": "대체 수업이나 최근 변경이 의심되면 새로고침을 누릅니다. 외부 시간표 제공처의 갱신 시점에 따라 실제 학교 안내와 차이가 날 수 있으므로 중요한 변경은 학교 공지도 확인하세요."
      },
      {
        "title": "편집·저장",
        "body": "개인 시간표 편집이 제공되는 경우 편집을 눌러 과목을 수정하고 저장합니다. 취소를 누르면 편집을 마치지 않고 돌아갑니다. 개인 표 변경과 학교 전체 시간표 수정은 다릅니다."
      },
      {
        "title": "설정 필요·빈 표",
        "body": "DB 설정 필요나 불러오기 오류가 나오면 반 선택을 다시 확인하고 재시도합니다. 계속 비어 있으면 날짜·학년·반과 오류 문구를 관리자에게 전달하세요."
      }
    ],
    "related": [
      "profile",
      "feed"
    ]
  },
  {
    "slug": "meal",
    "title": "급식",
    "description": "날짜별 아침·점심·저녁 식단 확인.",
    "category": "school",
    "features": [
      "/meal"
    ],
    "sections": [
      {
        "title": "오늘 식단 보기",
        "body": "급식에서 날짜를 확인하고 제공된 식단 카드를 읽습니다. 식사가 없는 날에는 해당 식단이 표시되지 않을 수 있습니다.",
        "links": [
          {
            "label": "급식 열기",
            "href": "https://cbgpu.com/meal"
          }
        ]
      },
      {
        "title": "다른 날짜 확인",
        "body": "화면의 날짜 이동·선택 기능으로 원하는 날의 메뉴를 확인합니다. 식사 종류별로 카드가 나뉘어 있으므로 점심과 저녁을 구분해 보세요."
      },
      {
        "title": "표시 정보 읽기",
        "body": "메뉴와 함께 제공되는 영양·알레르기 관련 정보는 해당 화면의 원문 표시를 확인하세요. 개인 알레르기나 섭취 가능 여부는 식단 제목만으로 판단하지 말고 학교 급식 담당자에게 확인합니다."
      },
      {
        "title": "메뉴가 없거나 늦게 보일 때",
        "body": "해당 날짜가 급식 운영일인지 확인하고 다시 불러옵니다. 외부 급식 자료가 늦게 갱신될 수 있으며 학교 현장 안내와 다르면 학교 안내를 우선 확인하세요."
      }
    ],
    "related": [
      "getting-started",
      "feed"
    ]
  },
  {
    "slug": "wakeup",
    "title": "기상송 신청",
    "description": "기숙사·날짜별 대기열 확인, Spotify 곡 선택과 내 신청 삭제.",
    "category": "school",
    "features": [
      "/wakeup"
    ],
    "sections": [
      {
        "title": "기숙사와 날짜",
        "body": "기상송에서 기숙사를 선택하고 신청할 날짜의 대기열을 확인합니다. 다른 기숙사나 날짜에 신청하지 않도록 제출 전에 다시 확인하세요.",
        "links": [
          {
            "label": "기상송 열기",
            "href": "https://cbgpu.com/wakeup"
          }
        ]
      },
      {
        "title": "노래 검색·신청",
        "body": "Spotify 검색에 곡명이나 가수를 입력하고 검색 결과에서 원하는 곡을 선택합니다. 선택한 곡을 확인하고 날짜와 선택 메모를 입력한 뒤 신청합니다. 한마디는 최대 80자입니다."
      },
      {
        "title": "내 신청 확인·취소",
        "body": "내 신청 내역에서 곡과 날짜를 확인하고 필요한 경우 해당 신청 삭제 버튼을 사용합니다. 대기열에 들어갔다는 사실이 실제 재생 순서나 재생 완료를 보장하지는 않습니다."
      },
      {
        "title": "검색·대기열 오류",
        "body": "검색이 실패하면 짧은 제목·가수명으로 다시 시도하세요. 음악 제공처나 운영 설정 문제로 계속 실패하면 기숙사, 날짜, 검색어와 오류 문구를 문의에 남깁니다."
      }
    ],
    "related": [
      "contact",
      "troubleshooting"
    ]
  },
  {
    "slug": "materials",
    "title": "자료 공유",
    "description": "공유 자료 검색·다운로드, 태그와 파일 업로드, 저장 공간 안내.",
    "category": "school",
    "features": [
      "/materials",
      "/materials/new"
    ],
    "sections": [
      {
        "title": "찾아서 내려받기",
        "body": "공유됨 또는 내 자료를 선택하고 제목·파일명·태그로 검색합니다. 태그 필터를 눌러 범위를 좁힌 뒤 다운로드를 선택하세요. 학생과 연구·개발 공간에서 같은 자료 공유 기능을 사용할 수 있습니다.",
        "links": [
          {
            "label": "자료 공유",
            "href": "https://cbgpu.com/materials"
          }
        ]
      },
      {
        "title": "자료 올리기",
        "body": "새 자료 화면에서 파일과 제목을 입력하고 태그를 최대 8개 추가해 업로드합니다. 다른 이용자와 공유하는 기능이므로 공유해도 되는 파일인지 먼저 확인하세요. 전송이 완료되고 목록에서 확인될 때까지 페이지를 유지하세요.",
        "links": [
          {
            "label": "자료 업로드",
            "href": "https://cbgpu.com/materials/new"
          }
        ]
      },
      {
        "title": "파일 크기와 재시도",
        "body": "현재 업로드 화면의 파일당 상한은 1 GiB입니다. 전송은 나누어 처리하며 일시적인 실패 시 진행 상태를 확인해 재시도합니다. 이것이 브라우저를 닫은 뒤에도 모든 업로드를 자동 복구한다는 뜻은 아닙니다. 서버 저장 공간 제한도 적용되므로 화면의 용량 안내를 함께 확인하세요."
      },
      {
        "title": "공유 범위·삭제",
        "body": "공유 자료에는 다른 사람에게 보여도 되는 파일만 올리세요. 내 자료에서는 본인이 올린 항목을 확인하고 삭제할 수 있습니다. 로컬 원본까지 자동으로 지워지는 것은 아닙니다."
      },
      {
        "title": "NetworkError·공간 부족",
        "body": "로그인 상태와 네트워크를 확인한 뒤 다시 시도합니다. 저장 공간 부족 메시지면 같은 파일을 반복 업로드하지 말고 불필요한 본인 자료를 정리하거나 관리자에게 문의하세요. 파일 크기와 발생 시각을 함께 남기면 도움이 됩니다."
      }
    ],
    "related": [
      "feature-search",
      "troubleshooting"
    ],
    "keywords": [
      "파일공유",
      "업로드",
      "다운로드",
      "storage"
    ]
  },
  {
    "slug": "gpu-notebook",
    "title": "GPU 예약·Jupyter",
    "description": "예약 신청, 승인 상태와 공개 Jupyter 접속, 결과 보관.",
    "category": "research",
    "features": [
      "/dashboard",
      "/schedule"
    ],
    "sections": [
      {
        "title": "GPU와 일정 선택",
        "body": "연구·개발의 GPU 예약에서 장비별 일정을 확인하고 필요한 GPU와 시작·종료 시간을 골라 신청합니다. 다른 사람의 예약과 겹치지 않는지 확인하세요.",
        "links": [
          {
            "label": "GPU 예약",
            "href": "https://researcher.cbgpu.com/dashboard"
          }
        ]
      },
      {
        "title": "신청과 승인 구분",
        "body": "신청했다고 바로 사용할 수 있는 것은 아닙니다. 내 예약에서 승인 대기·승인·반려와 사용 시간을 확인하세요. 승인된 예약이어도 실제 접속 정보 제공 여부는 현재 이용 권한과 사용 가능 시간에 따라 달라집니다."
      },
      {
        "title": "Jupyter 열기",
        "body": "사용 가능한 승인 예약의 접속 정보를 확인하고 해당 GPU의 Notebook을 엽니다. GPU별 주소를 혼동하지 마세요. 공개 HTTPS 주소라도 접속 인증은 별도로 필요합니다.",
        "links": [
          {
            "label": "GPU #1 Jupyter",
            "href": "https://gpu.cbgpu.com/1/"
          },
          {
            "label": "GPU #2 Jupyter",
            "href": "https://gpu.cbgpu.com/2/"
          },
          {
            "label": "GPU #3 Jupyter",
            "href": "https://gpu.cbgpu.com/3/"
          },
          {
            "label": "GPU #4 Jupyter",
            "href": "https://gpu.cbgpu.com/4/"
          }
        ]
      },
      {
        "title": "작업 마치기",
        "body": "예약이 끝나기 전에 필요한 코드·데이터·결과를 별도로 저장합니다. 대시보드에 제공되는 종료 기능과 종료 시간을 확인하세요. 세션 디스크가 개인 영구 보관함이라고 가정하지 마세요."
      },
      {
        "title": "접속 실패",
        "body": "GPU 번호, 예약 승인 상태, 현재 시간과 표시된 접속 정보를 다시 확인합니다. 계속 실패하면 예약 ID와 오류 문구를 전달하되 비밀번호·개인 키는 보내지 않습니다."
      }
    ],
    "related": [
      "ssh",
      "profile",
      "contact"
    ]
  },
  {
    "slug": "ssh",
    "title": "SSH로 GPU 사용하기",
    "description": "SSH 공개키, 실제 접속 설정과 VS Code 등 원격 도구 이용.",
    "category": "research",
    "features": [
      "/dashboard/ssh-guide"
    ],
    "sections": [
      {
        "title": "개인 공개키 준비",
        "body": "개인 컴퓨터에서 SSH 키를 만들고 .pub 공개키 파일을 준비합니다. 같은 이름의 기존 키는 덮어쓰지 마세요. 이미 쓰는 키가 있다면 그 공개키를 사용할 수 있습니다. 비공개키는 개인 컴퓨터에만 보관합니다.",
        "code": "ssh-keygen -t ed25519"
      },
      {
        "title": "프로필에 등록",
        "body": "프로필의 SSH 공개키 칸에 공개키 한 줄을 붙여넣고 저장합니다. 키 파일 경로나 비공개키 본문을 붙여넣는 것이 아닙니다.",
        "links": [
          {
            "label": "공개키 등록",
            "href": "https://researcher.cbgpu.com/profile"
          }
        ]
      },
      {
        "title": "예약과 공식 설정 확인",
        "body": "승인된 GPU 예약을 준비한 뒤 SSH 안내에서 실제 게이트웨이·포트·사용자명·클라이언트 설정을 확인합니다. 장비와 운영 설정에 따라 달라질 수 있으므로 이 문서의 예시 호스트를 임의로 만들어 사용하지 마세요.",
        "links": [
          {
            "label": "실제 SSH 접속 안내",
            "href": "https://researcher.cbgpu.com/dashboard/ssh-guide"
          },
          {
            "label": "예약 확인",
            "href": "https://researcher.cbgpu.com/dashboard"
          }
        ]
      },
      {
        "title": "터미널·VS Code에서 연결",
        "body": "안내에 나온 명령이나 SSH 설정을 개인 클라이언트에 적용합니다. 최초 연결의 호스트 키 안내를 확인하고, 작업이 끝나면 결과를 저장한 뒤 접속을 종료하세요. Permission denied는 공개키·사용자명·예약 권한을, 시간 초과는 주소·포트·네트워크를 우선 확인합니다."
      }
    ],
    "related": [
      "gpu-notebook",
      "profile"
    ]
  },
  {
    "slug": "latex",
    "title": "LaTeX 논문 작성·ZIP 가져오기",
    "description": "Overleaf 프로젝트 가져오기, 컴파일러 선택, PDF와 소스 내보내기.",
    "category": "research",
    "features": [
      "/latex"
    ],
    "sections": [
      {
        "title": "내 프로젝트 열기",
        "body": "연구·개발의 논문 작성에서 CBGPU 계정으로 로그인하고 내 프로젝트를 엽니다. 프로젝트 목록에서 이름을 검색하거나 내 프로젝트의 휴지통 버튼으로 삭제할 수 있습니다. 삭제한 프로젝트는 Overleaf 휴지통에서 복원할 수 있고, Overleaf에서 삭제한 항목도 목록에서 제외됩니다. ZIP이 없다면 빈 프로젝트를 눌러 새 문서로 시작하고, 편집기 프로젝트 관리에서 기존 프로젝트를 관리할 수 있습니다.",
        "links": [
          {
            "label": "논문 작성",
            "href": "https://researcher.cbgpu.com/latex"
          }
        ]
      },
      {
        "title": "기존 ZIP 가져오기",
        "body": "Overleaf에서 받은 Source ZIP이나 TeX 소스 ZIP을 준비합니다. 폴더 구조, 그림과 .bib 파일을 함께 보존하세요.",
        "steps": [
          "ZIP 가져오기로 파일을 고릅니다.",
          "확인 결과에서 프로젝트 이름과 메인 TeX 파일을 선택합니다.",
          "pdfLaTeX·XeLaTeX·LuaLaTeX 등 프로젝트에 맞는 컴파일러를 선택합니다.",
          "가져오고 편집기 열기를 눌러 PDF를 확인합니다."
        ]
      },
      {
        "title": "크기와 컴파일 제한",
        "body": "ZIP 업로드와 압축 해제 후 전체·개별 파일 용량에 별도의 고정 상한을 두지 않습니다. 큰 ZIP은 자동으로 나누어 전송하며 최대 1,000개 파일을 지원합니다. 현재 컴파일 시간 제한은 5분입니다. 잘못된 메인 파일이나 누락된 그림·참고문헌은 ZIP을 크게 만든다고 해결되지 않으니 로그를 확인하세요."
      },
      {
        "title": "편집·PDF·백업",
        "body": "편집기의 소스·PDF와 컴파일 로그를 사용합니다. 자동 저장 상태를 확인하고 PDF와 소스 ZIP을 필요할 때 내려받아 보관하세요. 특정 학술지 양식을 강제로 적용하지 않으므로 기존 클래스·스타일 파일도 프로젝트에 포함합니다."
      },
      {
        "title": "공유와 개인정보",
        "body": "프로젝트는 로그인 계정의 권한으로 관리됩니다. 일반 다른 사용자에게 자동 공개되는 것은 아니지만 명시적 공동작업자나 서버·백업 관리자는 접근할 수 있어 종단간 암호화 보관함과는 다릅니다. 공개 프리프린트로 게시하려면 별도로 arXiv에서 제출합니다."
      }
    ],
    "related": [
      "publishing",
      "notes",
      "troubleshooting"
    ],
    "keywords": [
      "라텍스",
      "레이텍스",
      "overleaf",
      "tex",
      "zip"
    ]
  },
  {
    "slug": "notes",
    "title": "연구노트",
    "description": "Markdown 기록, 태그, 자동 저장과 공유 범위.",
    "category": "research",
    "features": [
      "/notes"
    ],
    "sections": [
      {
        "title": "노트 만들기",
        "body": "연구노트에서 새 노트를 만들고 제목과 내용을 작성합니다. 실험 목적, 조건, 결과와 다음 할 일을 함께 남기면 나중에 찾기 쉽습니다.",
        "links": [
          {
            "label": "연구노트",
            "href": "https://researcher.cbgpu.com/notes"
          }
        ]
      },
      {
        "title": "작성과 미리보기",
        "body": "Markdown으로 제목·목록·코드 등을 작성하고 미리보기에서 표시 결과를 확인합니다. 태그를 붙이면 주제별로 찾기 쉽습니다. 자동 제안이 나와도 실제 내용에 맞는 태그인지 확인하세요."
      },
      {
        "title": "저장 상태 확인",
        "body": "입력 후 자동 저장이 진행되며 저장 중·저장 완료 상태를 확인할 수 있습니다. 저장이 실패했을 때는 창을 바로 닫지 말고 내용을 별도로 복사한 뒤 네트워크와 로그인을 확인합니다."
      },
      {
        "title": "공유와 삭제",
        "body": "내 노트와 공유된 노트를 구분하세요. 공유 설정을 켜기 전에 다른 사용자가 읽어도 되는 내용인지 확인합니다. 다른 사람이 공유한 노트를 읽는 것과 소유자 권한으로 편집하는 것은 다릅니다. 불필요한 본인 노트는 삭제 확인을 거쳐 정리합니다."
      }
    ],
    "related": [
      "materials",
      "latex"
    ]
  },
  {
    "slug": "frontend-deployment",
    "title": "프론트엔드 배포",
    "description": "Git 저장소를 연결해 웹사이트를 올리고 로그·설정·재배포 확인하기.",
    "category": "deploy",
    "features": [
      "/deploy",
      "/deploy/new"
    ],
    "sections": [
      {
        "title": "어떤 프로젝트에 쓰나요?",
        "body": "HTML·CSS·JavaScript, Vite, Astro, Next.js 등 웹사이트 프론트엔드를 배포할 때 사용합니다. API 서버나 여러 백엔드 컨테이너가 필요한 프로젝트는 서버 배포도 함께 살펴보세요.",
        "links": [
          {
            "label": "프론트엔드 배포",
            "href": "https://researcher.cbgpu.com/deploy"
          },
          {
            "label": "새 프로젝트",
            "href": "https://researcher.cbgpu.com/deploy/new"
          }
        ]
      },
      {
        "title": "저장소와 루트 폴더",
        "body": "Add New Project에서 GitHub 저장소 URL, 프로젝트 이름과 브랜치를 입력합니다. 비공개 저장소는 읽기 권한이 있는 GitHub 토큰이 필요합니다. 소스가 저장소 안의 하위 폴더에 있으면 Root Directory를 그 상대 경로로 지정합니다. 예를 들어 저장소의 web 폴더라면 web을 입력합니다."
      },
      {
        "title": "빌드 설정과 환경변수",
        "body": "감지된 프레임워크, 설치·빌드 명령과 Output Directory를 확인하고 Deploy를 누릅니다. 브라우저에 포함되는 환경변수에는 비밀키를 넣지 마세요. API 키처럼 서버에서만 쓰는 값과 공개해도 되는 값을 구분합니다."
      },
      {
        "title": "주소·상태·로그",
        "body": "기본 주소는 설정한이름.front.cbgpu.com입니다. 프로젝트의 배포 목록과 빌드 로그에서 설치·빌드·실행 중 어느 단계가 실패했는지 확인합니다. 초기 HTTPS 준비에 시간이 걸릴 수 있습니다."
      },
      {
        "title": "업데이트와 복원",
        "body": "설정한 브랜치의 변경을 자동으로 확인하는 자동 배포 옵션을 사용할 수 있습니다. 수동 배포도 프로젝트의 설정된 저장소·브랜치를 기준으로 합니다. 코드 수정 후 실제 배포 커밋과 로그를 확인하고, 제공되는 정상 배포 복원 기능을 사용해 이전 결과를 다시 지정할 수 있습니다."
      }
    ],
    "related": [
      "server-deployment",
      "collaboration-domains",
      "troubleshooting"
    ],
    "keywords": [
      "frontend",
      "프론트",
      "git",
      "github",
      "vercel"
    ]
  },
  {
    "slug": "server-deployment",
    "title": "서버·백엔드 배포",
    "description": "Git·Docker 이미지·Docker Compose, 루트 폴더와 포트, 설정 수정과 재배포.",
    "category": "deploy",
    "features": [
      "/server",
      "/server/new"
    ],
    "sections": [
      {
        "title": "배포 방식 고르기",
        "body": "Spring·Node.js·Python 등 백엔드나 데이터베이스와 함께 동작하는 서비스를 올릴 때 사용합니다. Git 기반 런타임, Docker 이미지 또는 Docker Compose 중 프로젝트에 맞는 방식을 고릅니다.",
        "links": [
          {
            "label": "서버 목록",
            "href": "https://researcher.cbgpu.com/server"
          },
          {
            "label": "서버 만들기",
            "href": "https://researcher.cbgpu.com/server/new"
          }
        ]
      },
      {
        "title": "Git과 이미지 설정",
        "body": "Git은 저장소·브랜치·Root Directory·런타임·실행 명령을 확인합니다. 저장소의 server 폴더만 쓸 때는 상대 경로 server를 지정하세요. Docker 이미지는 실행할 이미지와 컨테이너 내부 서비스 포트를 지정합니다. 사이트에서 제공하는 런타임·프리셋 중 실제 프로젝트에 맞는 것을 선택합니다."
      },
      {
        "title": "Docker Compose 설정",
        "body": "여러 컨테이너가 필요하면 Compose 모드를 선택합니다. Compose File 경로, 외부 연결을 받을 Gateway Service 이름, 컨테이너 포트와 CPU·RAM·저장 공간을 확인합니다. 예를 들어 api-gw가 HTTP를 8000번으로 제공한다면 서비스 이름과 내부 포트를 그 값으로 입력합니다. 실제 저장소의 Compose 정의와 일치해야 합니다."
      },
      {
        "title": "공개 범위와 주소",
        "body": "Private·School·Public의 접속 범위를 읽고 필요한 범위를 고릅니다. Public 서버의 기본 주소는 설정한이름.server.cbgpu.com입니다. 관리자의 배포 승인 단계를 별도로 기다리는 방식은 아니지만 계정 확인과 자원·설정 조건은 충족해야 합니다."
      },
      {
        "title": "설정만 저장과 재배포",
        "body": "프로젝트 상세의 설정 수정에서 “설정만 저장” 또는 “저장 후 재배포”를 구분하세요. 저장만 한 값은 다음 배포에 적용됩니다. Git 재배포는 설정된 저장소·브랜치에서 코드를 가져와 실행합니다. 로컬 컴퓨터에서 수정만 하고 Git에 올리지 않은 코드는 포함되지 않습니다."
      },
      {
        "title": "볼륨과 실패 로그",
        "body": "데이터베이스·업로드 파일은 적절한 영구 볼륨에 보관하고 별도로 백업하세요. 재배포는 데이터 이전 작업을 자동으로 대신하지 않습니다. Compose가 unhealthy이면 실패 서비스명, 상태·컨테이너 로그와 헬스체크 출력을 확인하세요. 실패를 고치기 위해 데이터 볼륨부터 지우지 마세요."
      }
    ],
    "related": [
      "collaboration-domains",
      "troubleshooting"
    ],
    "keywords": [
      "backend",
      "docker",
      "compose",
      "spring",
      "python",
      "node",
      "백엔드"
    ]
  },
  {
    "slug": "collaboration-domains",
    "title": "배포 공동작업·커스텀 도메인",
    "description": "프로젝트 멤버 관리, 기본 주소와 내 도메인 DNS·HTTPS 연결.",
    "category": "deploy",
    "features": [],
    "sections": [
      {
        "title": "같이 작업할 사람 추가",
        "body": "프로젝트의 공동작업 영역에서 CBGPU 사용자를 검색하고 추가합니다. 팀원의 역할에 따라 가능한 작업이 달라지므로 실제로 필요한 권한을 선택하고 더 이상 필요 없는 권한은 제거하세요."
      },
      {
        "title": "기본 주소 사용",
        "body": "프론트엔드는 이름.front.cbgpu.com, 공개 서버는 이름.server.cbgpu.com을 사용합니다. Git 저장소의 이름이나 하위 폴더 이름이 자동으로 도메인이 된다고 가정하지 말고 프로젝트 화면의 실제 주소를 복사하세요."
      },
      {
        "title": "내 도메인 연결",
        "body": "프로젝트의 도메인 영역에서 소유한 호스트명을 추가합니다.",
        "steps": [
          "예: www.example.com을 입력해 도메인을 추가합니다.",
          "화면에 나온 DNS 레코드의 Type·Name·Value를 DNS 제공업체에 그대로 등록합니다.",
          "같은 이름의 기존 레코드와 충돌하는지 확인합니다.",
          "연결 확인을 눌러 DNS 상태와 HTTPS 상태를 각각 확인합니다."
        ]
      },
      {
        "title": "HTTPS와 제거",
        "body": "DNS 확인 대기, HTTPS 발급 대기, HTTPS 설정 대기, 연결 완료를 구분합니다. DNS 확인만으로 모든 제공업체의 HTTPS 설정이 자동 완료되는 것은 아닙니다. 화면에 공급자 설정 안내가 있으면 운영자에게 요청하세요. 커스텀 도메인을 제거해도 기본 CBGPU 주소와 프로젝트 자체의 삭제는 별개입니다."
      }
    ],
    "related": [
      "frontend-deployment",
      "server-deployment"
    ]
  },
  {
    "slug": "printing",
    "title": "3D 프린팅 신청",
    "description": "초보자·고급자 모드, 파일별 설정과 담당자·대기열 확인.",
    "category": "making",
    "features": [
      "/manufacturing",
      "/manufacturing/print",
      "/manufacturing/print/new"
    ],
    "sections": [
      {
        "title": "현황부터 확인",
        "body": "3D 프린팅 화면에서 프린터 상태와 내 신청을 확인하고 신청하기를 누릅니다. 레이저 커팅은 별도 화면이므로 필요한 제작 방식을 먼저 고르세요.",
        "links": [
          {
            "label": "프린터 현황·내 신청",
            "href": "https://researcher.cbgpu.com/manufacturing/print"
          },
          {
            "label": "3D 프린팅 신청",
            "href": "https://researcher.cbgpu.com/manufacturing/print/new"
          }
        ]
      },
      {
        "title": "프린터와 모드",
        "body": "사용할 프린터를 선택합니다. 초보자 모드는 슬라이싱 전 원본 3MF를 올려 담당자에게 슬라이싱을 요청하는 흐름이고, 고급자 모드는 본인이 Bambu Studio에서 슬라이싱한 완료 파일로 출력을 요청하는 흐름입니다."
      },
      {
        "title": "파일과 수량",
        "body": "현재 화면은 .3mf를 받으며 .stl·.obj는 3mf 변환을 진행합니다. 파일별 수량·플레이트 수·필라멘트와 사용 목적을 확인합니다. 여러 파일을 선택했다면 각 항목을 확인한 뒤 제출하세요. 각 프린터의 작업 선택 목록에는 그 프린터로 신청한 접수 작업만 표시됩니다."
      },
      {
        "title": "담당자와 상태",
        "body": "선택한 프린터 담당자 중에서 지정하거나 수락 가능한 담당자에게 맡길 수 있습니다. 접수·대기열·프린팅 중·완료 등 상태를 내 신청에서 확인하세요. 접수는 출력 완료가 아니며 제작 완료 후 수령 방법은 담당자 안내에 따릅니다."
      },
      {
        "title": "취소·반려·변환 실패",
        "body": "상세 화면에서 가능한 취소 동작과 반려 사유를 확인합니다. 이미 작업이 진행되었다면 담당자에게 먼저 문의하세요. 파일 변환이 실패하면 원본 모델이 열리는지 확인하고 지원 형식으로 다시 내보내세요."
      }
    ],
    "related": [
      "laser-cutting",
      "equipment-console",
      "app"
    ]
  },
  {
    "slug": "laser-cutting",
    "title": "레이저 커팅 신청",
    "description": "DXF·SVG·DWG, 재질·두께·수량 설정과 완료 확인.",
    "category": "making",
    "features": [
      "/manufacturing/laser",
      "/manufacturing/laser/new"
    ],
    "sections": [
      {
        "title": "레이저 화면 열기",
        "body": "레이저 커팅에서 내 신청을 확인하고 새 신청을 엽니다. 3D 프린팅과 별도 화면·대기열을 사용합니다.",
        "links": [
          {
            "label": "레이저 내 신청",
            "href": "https://researcher.cbgpu.com/manufacturing/laser"
          },
          {
            "label": "레이저 신청",
            "href": "https://researcher.cbgpu.com/manufacturing/laser/new"
          }
        ]
      },
      {
        "title": "도면과 변환",
        "body": "현재 지원 형식은 .dxf·.svg·.dwg입니다. DXF는 그대로 사용하고 SVG·DWG는 DXF로 변환합니다. 변환 완료 표시와 결과 파일을 확인하고, 치수·선·단위가 의도한 설계인지 담당자와 확인하세요."
      },
      {
        "title": "재질·두께·수량",
        "body": "사용 목적을 입력하고 파일마다 등록된 재질·두께와 수량을 고릅니다. 여러 파일은 각각 별도 신청 건으로 접수됩니다. 재질 목록이 비어 있으면 임의 값을 넣지 말고 담당자에게 등록을 요청하세요."
      },
      {
        "title": "담당자·작업·수령",
        "body": "담당자 지정과 메모를 확인해 제출하고 내 신청에서 대기·작업 중·완료·반려 상태를 확인합니다. 실제 장비 조작과 재료 사용은 담당자 안내에 따릅니다. 완료 표시 후에도 수령 여부를 확인하세요."
      }
    ],
    "related": [
      "printing",
      "equipment-console",
      "app"
    ]
  },
  {
    "slug": "contests",
    "title": "교내 대회·행사",
    "description": "참가 신청부터 작품 제출, 체크인과 주최자 운영까지.",
    "category": "community",
    "features": [
      "/contests",
      "/contests/new"
    ],
    "sections": [
      {
        "title": "참가할 대회 찾기",
        "body": "교내 대회에서 행사 상세를 열어 설명·일정·참가 조건과 마감을 확인합니다.",
        "links": [
          {
            "label": "대회 목록",
            "href": "https://cbgpu.com/contests"
          }
        ]
      },
      {
        "title": "신청·작품 제출",
        "body": "대회가 요구하는 이름·팀명과 각 질문을 작성합니다. 파일 항목은 해당 항목의 확장자와 최대 크기를 확인하세요. 필요한 입력·업로드를 완료한 뒤 제출 결과와 접수 상태를 확인합니다."
      },
      {
        "title": "수정·체크인",
        "body": "대회 상세에서 제공되는 내 신청·수정·취소·체크인 기능을 이용합니다. 수정 가능 여부와 체크인 시간은 행사 설정에 따라 다르므로 마감이나 운영 안내를 먼저 확인하세요."
      },
      {
        "title": "대회 만들기·운영",
        "body": "주최자는 새 대회에서 설명, 일정, 참가·제출 양식과 파일 조건 등을 설정합니다. 운영 화면에서 참가자와 제출물을 확인하고 제공되는 관리·내보내기 기능을 사용합니다. 참가자 개인정보나 제출물을 공개하려면 행사 안내와 동의를 확인하세요.",
        "links": [
          {
            "label": "대회 만들기",
            "href": "https://cbgpu.com/contests/new"
          }
        ]
      }
    ],
    "related": [
      "materials",
      "contact"
    ]
  },
  {
    "slug": "study-groups",
    "title": "스터디 매칭",
    "description": "모집글 만들기, 과목·태그 검색, 참여·탈퇴와 모집 종료.",
    "category": "community",
    "features": [
      "/match"
    ],
    "sections": [
      {
        "title": "모집글 살펴보기",
        "body": "전체 목록에서 과목과 태그를 확인하고 관심 있는 스터디의 설명과 현재 인원을 읽습니다. 참여 중 탭에서는 본인이 참여한 모집을 볼 수 있습니다.",
        "links": [
          {
            "label": "스터디 매칭",
            "href": "https://cbgpu.com/match"
          }
        ]
      },
      {
        "title": "참여와 탈퇴",
        "body": "모집 중이고 정원이 남은 글에서 참여합니다. 참여 후 멤버 목록을 확인하고 더 이상 함께하지 않을 때는 탈퇴를 사용하세요. 정원이 찼거나 모집이 끝난 글은 참여가 제한될 수 있습니다."
      },
      {
        "title": "새 스터디 만들기",
        "body": "만들기에서 과목·제목·설명·정원과 태그를 입력합니다. 화면의 정원 범위와 필수 입력을 지켜 등록하세요. 제목에는 공부할 내용과 모집 대상을 구체적으로 적으면 좋습니다."
      },
      {
        "title": "모집 종료와 삭제",
        "body": "작성자는 모집을 닫거나 불필요한 글을 삭제할 수 있습니다. 모집 종료와 글 삭제는 다르므로 참여자와의 약속이나 안내 내용을 정리한 뒤 선택하세요."
      }
    ],
    "related": [
      "feature-search",
      "polls"
    ]
  },
  {
    "slug": "polls",
    "title": "투표·설문 참여",
    "description": "진행 중·마감된 설문, 응답 제출과 공개 결과 확인.",
    "category": "community",
    "features": [
      "/polls"
    ],
    "sections": [
      {
        "title": "진행 중·마감 확인",
        "body": "투표에서 진행 중 또는 마감 목록을 선택하고 질문 설명과 마감 시각을 확인합니다.",
        "links": [
          {
            "label": "투표·설문",
            "href": "https://cbgpu.com/polls"
          }
        ]
      },
      {
        "title": "질문에 응답하기",
        "body": "객관식·복수 선택·단답형·장문형·선형 배율 등 질문 형식에 맞춰 응답합니다. 필수 질문을 빠뜨리지 않고 제출하기를 누른 뒤 제출 결과를 확인하세요."
      },
      {
        "title": "결과 보기",
        "body": "응답 후 표시되는 결과는 해당 설문의 결과 공개 설정에 따라 달라집니다. 결과를 볼 수 없다고 해서 항상 제출 실패는 아닙니다. AI 요약이 있더라도 실제 집계 수치를 함께 확인하세요."
      },
      {
        "title": "운영자용 생성·마감",
        "body": "설문 생성 권한이 있는 사용자는 제목, 질문·선택지, 마감일과 결과 공개를 설정합니다. 수정·마감·삭제는 권한에 따라 제공됩니다. 일반 참여자에게 운영 메뉴가 보이지 않는 것은 정상일 수 있습니다."
      }
    ],
    "related": [
      "admin-console",
      "contact"
    ]
  },
  {
    "slug": "feed",
    "title": "학교·기술 소식",
    "description": "학교 공지, Tech News와 서비스 장례식 탐색.",
    "category": "community",
    "features": [
      "/feed"
    ],
    "sections": [
      {
        "title": "학교 공지 보기",
        "body": "소식에서 학교 소식 탭을 선택하고 필요한 공지의 제목·내용과 원문 링크를 확인합니다.",
        "links": [
          {
            "label": "소식 열기",
            "href": "https://cbgpu.com/feed"
          }
        ]
      },
      {
        "title": "Tech News",
        "body": "기술 소식 탭에서 AI·보안·임베디드 등의 글을 살펴봅니다. 원문을 열어 작성 시점과 전체 내용을 확인하세요."
      },
      {
        "title": "Graveyard",
        "body": "서비스 장례식 탭은 종료된 서비스와 관련 이야기를 읽는 코너입니다. 현재 이용할 수 있는 CBGPU 기능 목록과는 다른 콘텐츠입니다."
      },
      {
        "title": "자료가 갱신되지 않을 때",
        "body": "외부 제공처의 사정에 따라 지연되거나 일시적으로 비어 있을 수 있습니다. 새로고침 후에도 계속 실패하면 탭 이름과 발생 시각을 함께 문의하세요."
      }
    ],
    "related": [
      "contact",
      "feature-search"
    ]
  },
  {
    "slug": "tools",
    "title": "집중 타이머·D-day",
    "description": "포모도로 시작·일시정지, 날짜 카운트다운 추가·삭제.",
    "category": "community",
    "features": [
      "/tools"
    ],
    "sections": [
      {
        "title": "포모도로 선택",
        "body": "도구에서 포모도로 탭을 고르고 집중·휴식 프리셋을 선택합니다. 시작, 일시정지와 초기화를 목적에 맞게 사용하세요.",
        "links": [
          {
            "label": "도구 열기",
            "href": "https://cbgpu.com/tools"
          }
        ]
      },
      {
        "title": "타이머와 알림",
        "body": "알림·소리를 사용하려면 해당 화면과 기기의 권한을 확인합니다. 브라우저를 닫거나 앱이 절전 상태가 되면 동작이 달라질 수 있으니 시험·일정의 유일한 알람으로 의존하지 마세요."
      },
      {
        "title": "D-day 추가",
        "body": "D-day 탭에서 시험·행사 이름, 날짜와 표시를 입력해 추가합니다. 당일은 D-Day, 남은 날과 지난 날은 각각 표시 방식에 따라 확인할 수 있습니다."
      },
      {
        "title": "기기별 저장",
        "body": "D-day 목록은 현재 브라우저의 저장 공간을 사용합니다. 다른 기기와 자동 동기화된다고 가정하지 말고, 기기 변경이나 브라우저 데이터 정리 전에 필요한 날짜를 따로 보관하세요."
      }
    ],
    "related": [
      "app",
      "profile"
    ],
    "keywords": [
      "디데이",
      "뽀모도로",
      "타이머",
      "카운트다운"
    ]
  },
  {
    "slug": "games",
    "title": "게임·아케이드",
    "description": "제공되는 게임과 터치·키보드 조작 안내.",
    "category": "community",
    "features": [
      "/games"
    ],
    "sections": [
      {
        "title": "게임 고르기",
        "body": "아케이드의 게임 선택 줄에서 원하는 게임을 고릅니다. 현재 화면에는 Flappy, Memory, Mines, Snake, Tetris, 2048이 있습니다.",
        "links": [
          {
            "label": "게임 열기",
            "href": "https://cbgpu.com/games"
          }
        ]
      },
      {
        "title": "터치와 키보드",
        "body": "게임 이름 옆의 touch·keys 안내와 화면 안의 조작 설명을 확인합니다. 휴대폰에서는 터치 지원 게임부터 이용하고, 키보드 게임은 키 입력을 받을 수 있는 기기에서 사용하세요."
      },
      {
        "title": "다시 시작·전환",
        "body": "각 게임의 시작·재시작 버튼과 안내를 사용합니다. 게임을 바꾸거나 페이지를 닫으면 진행 상태가 초기화될 수 있습니다."
      },
      {
        "title": "게임이 안 움직일 때",
        "body": "게임 영역을 한 번 눌러 입력 초점을 주고, 검색창 등 다른 입력 칸에 커서가 있지 않은지 확인하세요. 화면에 없는 게임을 예전 주소로 찾기보다는 현재 게임 목록을 기준으로 이용합니다."
      }
    ],
    "related": [
      "tools",
      "contact"
    ],
    "keywords": [
      "arcade",
      "아케이드",
      "2048",
      "테트리스",
      "스네이크"
    ]
  },
  {
    "slug": "publishing",
    "title": "연구 프리프린트 읽기·게시",
    "description": "공개 논문 검색, PDF·인용 정보와 CBGPU 계정으로 원고 제출.",
    "category": "research",
    "features": [
      "https://arxiv.cbgpu.com",
      "/arxiv",
      "/arxiv/submit"
    ],
    "sections": [
      {
        "title": "누구나 읽기",
        "body": "arxiv.cbgpu.com은 학교 연구를 공개하는 독립 사이트입니다. 공개된 논문 목록·검색·상세·PDF는 로그인 없이 읽을 수 있습니다. 이곳에 게시되었다는 사실이 학술지 심사나 학교의 공식 승인을 뜻하지는 않습니다.",
        "links": [
          {
            "label": "프리프린트 목록",
            "href": "https://arxiv.cbgpu.com"
          }
        ]
      },
      {
        "title": "원고 제출",
        "body": "연구 제출에서 기존 CBGPU 계정으로 로그인합니다. 제목·초록·저자·소속·분야 등 필수 정보를 확인하고 PDF를 올립니다. 현재 PDF 상한은 20 MiB입니다.",
        "links": [
          {
            "label": "연구 제출",
            "href": "https://arxiv.cbgpu.com/submit"
          }
        ]
      },
      {
        "title": "공개 범위와 라이선스",
        "body": "공개 게시를 완료한 원고는 외부 사람도 읽고 내려받을 수 있습니다. 저자·그림·데이터의 공개 권한을 확인하고 화면에서 라이선스를 선택하세요. 기본 모든 권리 보유와 선택 가능한 CC BY 4.0의 의미를 구분합니다."
      },
      {
        "title": "버전·인용·후속 작업",
        "body": "상세 페이지에서 PDF, 버전과 BibTeX 인용문을 확인합니다. 본인 원고의 수정·후속 버전은 화면에서 제공되는 작업을 사용하세요. LaTeX 프로젝트를 편집했다고 공개 PDF까지 자동 교체되는 것은 아닙니다."
      }
    ],
    "related": [
      "latex",
      "account",
      "contact"
    ]
  },
  {
    "slug": "admin-console",
    "title": "학교 관리자 패널",
    "description": "관리자 로그인과 GPU·서버·계정·학교생활·자료 관리 화면.",
    "category": "operations",
    "features": [
      "https://admin.cbgpu.com",
      "/admin",
      "/admin/gpu",
      "/admin/server",
      "/admin/accounts",
      "/admin/manufacture",
      "/admin/materials",
      "/admin/study",
      "/admin/wakeup",
      "/admin/timetable",
      "/admin/polls",
      "/admin/manufacturing"
    ],
    "sections": [
      {
        "title": "대상과 로그인",
        "body": "admin.cbgpu.com은 학교 관리자 권한이 있는 계정용 독립 패널입니다. CBGPU 이메일과 비밀번호로 로그인합니다. 별도 공용 시스템 비밀번호를 추가로 입력하는 단계는 현재 사용하지 않습니다. 일반 학생 계정으로 접속할 수 있는 화면이 아닙니다.",
        "links": [
          {
            "label": "관리자 로그인",
            "href": "https://admin.cbgpu.com"
          }
        ]
      },
      {
        "title": "Workspace 메뉴",
        "body": "GPU reservations, Server deployments, Accounts, Equipment managers, File storage와 학교생활 관리 항목을 선택합니다. 각 항목은 별도 화면으로 열리며 현재 항목이 강조 표시됩니다. 이름이 비슷한 일반 사용자 예약·배포 화면과 구분하세요."
      },
      {
        "title": "GPU·서버·계정 검토",
        "body": "GPU 예약에서 시간 충돌과 신청 목적을 확인해 승인·반려 등 제공되는 동작을 수행합니다. 서버는 현재 배포·설정과 운영 상태를 확인합니다. 계정은 이름·학번과 권한을 검토하며 정보가 없거나 Unknown으로 보인다는 이유만으로 사용자를 바로 삭제하지 마세요."
      },
      {
        "title": "학교생활·저장 공간 관리",
        "body": "Study settings, Wake-up music, Timetable, Polls 등 해당 기능의 관리 화면에서 설정합니다. 토큰·기상송 설정은 해당 화면에서 다루고 일반 파일 저장소 작업과 구분합니다. File storage에서는 실제 자료와 용량을 확인합니다."
      },
      {
        "title": "장비 담당자 지정",
        "body": "Equipment managers에서 프린터별·레이저 역할을 확인하고 담당자를 지정합니다. 관리자 권한과 장비 담당자 권한은 다르므로 필요한 역할만 부여하세요. 담당자는 각각 전용 포털을 사용합니다."
      }
    ],
    "related": [
      "equipment-console",
      "developer-console",
      "troubleshooting"
    ]
  },
  {
    "slug": "equipment-console",
    "title": "프린터·레이저 담당자 패널",
    "description": "담당 장비의 접수·대기열·재료 관리, 완료·수령과 앱 알림.",
    "category": "operations",
    "features": [
      "https://print.cbgpu.com",
      "https://laser.cbgpu.com",
      "https://manufacturing.cbgpu.com",
      "/manage/manufacturing",
      "/manage/manufacturing/requests",
      "/manage/manufacturing/queues",
      "/manage/manufacturing/filament",
      "/manage/manufacturing/materials"
    ],
    "sections": [
      {
        "title": "각 담당자 포털",
        "body": "프린터 담당자는 print.cbgpu.com, 레이저 담당자는 laser.cbgpu.com에서 CBGPU 계정으로 로그인합니다. 제조 포털 선택 화면도 사용할 수 있습니다. 본인에게 배정된 장비·역할이 있어야 하며 일반 사용자 신청 페이지와 별도입니다. 관리자 권한만 있고 해당 장비의 담당자로 지정되지 않은 계정은 이 담당자 포털에 들어갈 수 없습니다.",
        "links": [
          {
            "label": "프린터 담당자",
            "href": "https://print.cbgpu.com"
          },
          {
            "label": "레이저 담당자",
            "href": "https://laser.cbgpu.com"
          },
          {
            "label": "담당자 포털 선택",
            "href": "https://manufacturing.cbgpu.com"
          }
        ]
      },
      {
        "title": "프린터 Workspace",
        "body": "Overview는 현황, Print requests는 접수 목록, Printer queues는 프린터 작업 대기열, Filament stock은 재료 재고입니다. 메뉴를 누르면 해당 화면만 표시됩니다. 요청 상세에서 목적·파일·수량을 확인하고 수락·반려 또는 가능한 작업 상태 변경을 사용하세요."
      },
      {
        "title": "프린팅 진행과 수령",
        "body": "출력할 작업과 프린터 상태를 확인한 후 작업을 시작합니다. 완료 시 필라멘트와 플레이트 등 화면의 완료 절차를 확인하고, 전달 완료는 실제로 신청자에게 전달한 뒤 기록하세요. 재고의 추가·증감·삭제는 실물을 기준으로 합니다."
      },
      {
        "title": "레이저 Workspace",
        "body": "Cutting requests에서 요청·파일·재질·두께와 진행 상태를 관리합니다. Materials는 신청자가 고를 재질·두께 목록을 관리하는 별도 화면입니다. 등록 항목이 없으면 신청자가 선택할 재료도 없을 수 있으므로 운영 전에 확인하세요."
      },
      {
        "title": "접수 알림과 권한 변경",
        "body": "Android 앱에 담당자 본인 계정으로 로그인하고 알림 권한·프로필 설정을 확인합니다. 지정 담당자와 장비 담당 범위에 따라 알림 대상이 정해지며, 등록 기기가 없으면 수신할 수 없습니다. 역할이 해제되면 기존 포털 접속도 제한됩니다."
      }
    ],
    "related": [
      "printing",
      "laser-cutting",
      "app",
      "profile"
    ]
  },
  {
    "slug": "developer-console",
    "title": "CBGPU 운영 개발자 패널",
    "description": "서비스 상태·방문·배포 관찰, 테이블·SQL·터미널 등 운영 도구.",
    "category": "operations",
    "features": [
      "https://developers.cbgpu.com"
    ],
    "sections": [
      {
        "title": "이용자 개발 공간과 구분",
        "body": "developers.cbgpu.com은 CBGPU 자체를 운영하는 승인된 개발자용입니다. 사용자의 Git 프로젝트를 배포하는 연구·개발 공간과는 다릅니다. 등록된 운영 개발자 계정의 CBGPU 이메일·비밀번호로 로그인합니다.",
        "links": [
          {
            "label": "운영 개발자 로그인",
            "href": "https://developers.cbgpu.com"
          }
        ]
      },
      {
        "title": "상태·배포·로그 관찰",
        "body": "Overview에서 방문·상태 정보를, Deployments에서 배포 현황을, Logs & services에서 로그와 서비스 정보를 확인합니다. 운영 대시보드의 관찰 화면과 일반 사용자의 실제 배포 만들기 화면을 혼동하지 마세요."
      },
      {
        "title": "Table editor와 SQL editor",
        "body": "Table editor는 테이블·열과 행을 탐색하고 권한 내 데이터 작업을 하는 도구이고 SQL editor는 직접 SQL을 실행하는 도구입니다. 같은 화면의 중복 메뉴가 아닙니다. 행 수정·삭제나 SQL 변경은 실제 데이터에 영향을 주므로 대상과 조건을 먼저 확인합니다."
      },
      {
        "title": "Terminal·Audit·Email·Security",
        "body": "Terminal은 제공되는 서버 계정의 대화형 셸로, 설치된 명령과 권한 범위 안에서 사용합니다. Audit trail, Email delivery, Account & security에서 감사 기록, 메일 처리 상태와 계정·보안 정보를 살펴봅니다. 명령을 입력했다고 자동으로 더 높은 운영체제 권한을 얻는 것은 아닙니다."
      },
      {
        "title": "운영 정보 공유",
        "body": "일반 문의에 로그를 전달할 때 토큰, 비밀번호, 데이터베이스 연결 문자열과 개인정보를 제외하세요. 공개 Docs에는 로그인 비밀값이나 서버의 개인 자격증명을 게시하지 않습니다."
      }
    ],
    "related": [
      "admin-console",
      "troubleshooting"
    ]
  },
  {
    "slug": "documentation",
    "title": "Docs 사용법·기능별 안내",
    "description": "공개 문서 검색, 분류, 목차와 기능 바로가기.",
    "category": "help",
    "features": [
      "https://docs.cbgpu.com",
      "/docs"
    ],
    "sections": [
      {
        "title": "로그인 없이 읽기",
        "body": "Docs는 학교 밖에서도 로그인 없이 읽을 수 있는 공개 사이트입니다. 문서를 읽을 수 있다는 것이 실제 서비스의 계정·관리자 권한까지 제공한다는 뜻은 아닙니다.",
        "links": [
          {
            "label": "문서 홈",
            "href": "https://docs.cbgpu.com"
          }
        ]
      },
      {
        "title": "검색과 분류",
        "body": "문서 홈에서 기능 이름이나 오류 문구를 검색하고 시작·계정, 학교생활, GPU·연구, 배포·협업, 제작, 커뮤니티, 담당자·관리자, 도움말로 범위를 좁힙니다."
      },
      {
        "title": "목차와 관련 문서",
        "body": "각 안내에는 단계별 목차와 실제 기능으로 가는 링크가 있습니다. 화면에서 사용하는 이름을 기준으로 읽고, 관련 문서에서 로그인·공유·오류 처리 안내를 이어서 확인하세요."
      },
      {
        "title": "다른 화면과 차이가 날 때",
        "body": "운영 설정과 권한에 따라 메뉴나 제한이 다르게 보일 수 있습니다. 실제 화면의 현재 안내를 함께 확인하고, 문서 누락·오류는 해당 문서 주소와 기능 화면을 알려주세요."
      }
    ],
    "related": [
      "feature-search",
      "contact"
    ]
  },
  {
    "slug": "troubleshooting",
    "title": "문제 해결",
    "description": "로그인·메일·네트워크·업로드·배포·앱 화면 문제의 확인 순서.",
    "category": "help",
    "features": [],
    "sections": [
      {
        "title": "먼저 어디서 실패했는지 확인",
        "body": "기능 주소, 누른 버튼, 발생 시각과 화면에 표시된 오류를 메모합니다. 인터넷 연결을 확인하고 새로고침합니다. 저장·제출 같은 작업을 무조건 반복하기보다 목록에서 앞선 요청이 처리됐는지 먼저 확인하세요."
      },
      {
        "title": "로그인·권한·메일",
        "body": "로그인 페이지로 돌아가면 계정을 확인해 다시 로그인합니다. Access denied나 승인·확인 필요 메시지는 프로필 정보와 역할을 점검하세요. 재설정 메일 전송 실패는 스팸함만의 문제가 아닐 수 있으므로 실제 오류 문구를 문의에 남깁니다."
      },
      {
        "title": "파일 NetworkError·용량",
        "body": "자료 업로드는 파일 크기와 남은 저장 공간, 네트워크를 확인합니다. 토큰이나 다운로드 링크가 만료되면 다시 로그인하거나 목록에서 다운로드를 새로 요청하세요. 실패한 파일을 공개 링크나 문의 본문에 무단으로 첨부하지 마세요."
      },
      {
        "title": "배포·Compose unhealthy",
        "body": "실패한 단계와 해당 배포의 커밋·브랜치·Root Directory·포트를 확인합니다. Compose는 서비스 상태, 컨테이너 로그와 헬스체크 결과를 함께 봅니다. DB 연결이나 스키마 오류를 알기 전 데이터를 지우는 방식으로 해결하려고 하지 마세요."
      },
      {
        "title": "오래된 앱 화면·알림",
        "body": "웹은 새로고침하고 앱은 완전히 닫은 뒤 다시 열어봅니다. 알림은 앱 버전·로그인·기기 권한·프로필 설정을 확인합니다. 문제가 남으면 문의에 재현 순서와 화면을 보내되 비밀값을 가립니다."
      }
    ],
    "related": [
      "account",
      "materials",
      "server-deployment",
      "contact"
    ]
  },
  {
    "slug": "contact",
    "title": "문의·지원·개인정보",
    "description": "어디에 무엇을 보내야 빠르게 문제를 확인할 수 있는지.",
    "category": "help",
    "features": [
      "/contact",
      "/privacy"
    ],
    "sections": [
      {
        "title": "문의 보내기",
        "body": "문의 화면에서 이름·이메일과 예약 문의, 계정 문제, 기술 지원, 기타 중 맞는 분류를 선택하고 내용을 작성합니다. 전송 성공 안내를 확인하세요.",
        "links": [
          {
            "label": "문의하기",
            "href": "https://cbgpu.com/contact"
          }
        ]
      },
      {
        "title": "함께 적으면 좋은 정보",
        "body": "기능 주소, 문제 발생 시각, 누른 순서, 오류 문구와 기기·브라우저·앱 버전을 적습니다. 배포는 프로젝트 ID·실패 단계, GPU는 예약 ID·GPU 번호처럼 해당 작업을 찾을 정보를 함께 적어주세요."
      },
      {
        "title": "보내면 안 되는 정보",
        "body": "비밀번호, OTP·재설정 링크 전체, GitHub 토큰, 비공개 SSH 키와 데이터베이스 연결 문자열은 보내지 않습니다. 화면 사진·로그에도 개인 정보나 토큰이 없는지 확인하세요."
      },
      {
        "title": "개인정보와 삭제",
        "body": "수집·이용 안내는 개인정보처리방침에서 확인합니다. 계정 설정은 내 프로필에서, 자료·프로젝트 삭제는 해당 기능의 확인 절차를 통해 진행합니다.",
        "links": [
          {
            "label": "개인정보처리방침",
            "href": "https://cbgpu.com/privacy"
          },
          {
            "label": "내 프로필",
            "href": "https://cbgpu.com/profile"
          }
        ]
      }
    ],
    "related": [
      "troubleshooting",
      "profile"
    ]
  }
];
export const guideForFeature=(href:string)=>guides.find(guide=>guide.features.includes(href));
