// Claude 연결 창구 (사진으로 재료 인식, 새 레시피 만들기)
//
// 지금 동작:
//  - claude.ai 아티팩트 안에서 열면 window.claude 로 Claude를 바로 써요.
//  - 그 밖(우리 웹사이트)에서는 아직 연결된 서버가 없어서 null 을 돌려줘요.
//    그러면 앱이 "사진 찍어서 재료 추가"와 "새 레시피 만들기"를 숨기고,
//    나머지 기능(냉장고, 추천, 장보기)은 그대로 다 돼요.
//
// 다음 단계(배포할 때):
//  - Claude API 키는 브라우저 코드에 절대 넣지 않아요. 누구나 볼 수 있거든요.
//  - 대신 Vercel 서버 함수(/api/ai)를 하나 만들고, 키는 Vercel 환경변수에 둬요.
//  - 아래 connectAI()가 그 서버 함수를 부르는 객체를 돌려주게 바꾸면,
//    app.js 는 고칠 필요 없이 그대로 동작해요.
//    필요한 모양: { json(prompt, {images}) → 결과 JSON, limits() → {images:true} }

async function connectAI() {
  try {
    const s = await window.claude?.use?.("sample");
    if (s) return s;
  } catch (e) { /* 권한이 없거나 claude.ai 밖이면 여기로 와요 */ }
  return null;
}
