"use client";
import { useState, useCallback } from "react";

const LOCATIONS = [
  { id: "store", label: "매장", items: [
    { key: "효자강변점 매장", name: "효자강변점", sub: "효자동", type: "store" },
    { key: "본점 매장", name: "본점", sub: "중앙상가 1-2층", type: "store" },
    { key: "롯데백화점 포항점 매장", name: "롯데백화점 포항점", sub: "롯데백화점 B1", type: "store" },
  ]},
  { id: "prod", label: "생산", items: [
    { key: "본점 생산", name: "본점 생산", sub: "2층·3층·4층", type: "prod" },
    { key: "효자점 생산", name: "효자점 생산", sub: "효자강변점 생산실", type: "prod" },
  ]},
];

const FLOORS = {
  "본점 생산": [
    { key: "본점 생산 2층", name: "2층", sub: "케이크실" },
    { key: "본점 생산 3층", name: "3층", sub: "찹쌀떡·소성·샌드위치·성형" },
    { key: "본점 생산 4층", name: "4층", sub: "냉동생지실" },
  ],
  "효자점 생산": [
    { key: "효자점 생산", name: "생산실", sub: "효자강변점 생산실" },
  ],
};

const PRODUCTS = [
  { name: "단팥빵", cat: "빵류", steps: ["반죽·성형·굽기"], unit: "개" },
  { name: "소보로", cat: "빵류", steps: ["반죽·성형·굽기"], unit: "개" },
  { name: "찹쌀떡 (팥)", cat: "찹쌀떡류", steps: ["반죽·성형·포장"], unit: "개" },
  { name: "찹쌀떡 (깨)", cat: "찹쌀떡류", steps: ["반죽·성형·포장"], unit: "개" },
  { name: "몽블랑", cat: "페이스트리", steps: ["1차: 반죽·밀어펴기", "2차: 마무리·데코"], unit: "개" },
  { name: "크로와상", cat: "페이스트리", steps: ["1차: 반죽·접기", "2차: 밀어펴기·성형", "3차: 굽기·마무리"], unit: "개" },
  { name: "식빵", cat: "빵류", steps: ["반죽·성형·발효·굽기"], unit: "개" },
  { name: "사워도우", cat: "빵류", steps: ["1차: 반죽·성형·발효", "2차: 굽기·컨팅"], unit: "개" },
  { name: "샌드위치", cat: "샌드위치", steps: ["조립·포장"], unit: "개" },
  { name: "소금빵", cat: "빵류", steps: ["반죽·성형·굽기"], unit: "개" },
  { name: "바게트", cat: "빵류", steps: ["반죽·성형·굽기"], unit: "개" },
  { name: "치아바타", cat: "빵류", steps: ["반죽·성형·굽기"], unit: "개" },
];

const POSITIONS = {"효자강변점 매장":{"오픈":[{key:"오픈 가(베이커리)",name:"오픈 가",sub:"베이커리"},{key:"오픈 나(컷팅+포장)",name:"오픈 나",sub:"컷팅+포장"}],"마감":[{key:"마감A(카페마감)",name:"마감 A",sub:"카페마감"},{key:"마감B(1·2층마감)",name:"마감 B",sub:"1·2층마감"},{key:"마감C(설거지/청소)",name:"마감 C",sub:"설거지/청소"},{key:"마감C-1(대청소/성수기)",name:"마감 C-1",sub:"대청소/성수기"},{key:"마감C-2(백룸마감)",name:"마감 C-2",sub:"백룸마감"}]}};

const CL = {"효자강변점 매장":{"오픈 가(베이커리)":[{id:1,time:"08:30",name:"냉장 쇼케이스 켜기",cat:"오픈준비"},{id:2,time:"08:30",name:"냉장 빵 진열",cat:"제품체크"},{id:3,time:"08:30",name:"재판카트 제품 진열",cat:"제품체크"},{id:4,time:"08:30",name:"금일 생산된 효자제품 진열",cat:"제품체크"},{id:5,time:"08:30",name:"미진열된 제품 시간표 배치하기",cat:"제품체크"},{id:6,time:"08:40",name:"본점/롯데 보낼 제품 챙기기",cat:"물류제품"},{id:7,time:"08:40",name:"1차 배송 - 샌드위치",cat:"물류제품"},{id:8,time:"08:50",name:"본점에서 온 제품 진열하기",cat:"제품체크"},{id:9,time:"09:00",name:"냉장 제품 재고파악 후 필요수량 해동 (관리자 확인)",cat:"제품체크"},{id:10,time:"10:00",name:"2차 배송 - 전통 바게트",cat:"물류제품"},{id:11,time:"11:00~11:30",name:"3차 배송 - 치아바타류, 초코바게트",cat:"물류제품"},{id:12,time:"상시",name:"매대 진열상태 확인 후 정리하기",cat:"제품체크"}],"오픈 나(컷팅+포장)":[{id:21,time:"08:30",name:"본점/롯데 사워도우 챙기기",cat:"물류제품"},{id:22,time:"08:40",name:"2층 서비스바 물품 채우기 (냅킨,설탕,스틱 외)",cat:"오픈준비"},{id:23,time:"08:40",name:"2층 서비스바 미니 오븐 셋팅 후 전원 켜기",cat:"오픈준비"},{id:24,time:"08:40",name:"여자화장실 비품 채우기",cat:"오픈준비"},{id:25,time:"08:40",name:"남자화장실 비품 채우기",cat:"오픈준비"},{id:26,time:"08:45",name:"쇼케이스 케이크 진열하기",cat:"제품체크"},{id:27,time:"08:45",name:"케이크 예약건 확인 (관리자 전달받기)",cat:"제품체크"},{id:28,time:"08:45",name:"소비기한 체크하기 (후방 제품과 더블체크)",cat:"소비기한"},{id:29,time:"08:50",name:"자동문 켜기",cat:"오픈준비"},{id:30,time:"08:50",name:"1층 블라인드 올리기",cat:"오픈준비"},{id:31,time:"09:00",name:"컷팅+포장 or 포스+음료 포지션 담당",cat:"제품체크"},{id:32,time:"11:00",name:"라운딩 가기",cat:"라운딩"}],"마감A(카페마감)":[{id:101,time:"14:00",name:"부재료 각 1통씩 제조 + 냉장고 채우기",cat:"마감체크"},{id:102,time:"14:00",name:"바 냉장고 내부 닦기",cat:"마감체크"},{id:103,time:"상시",name:"커피 머신 및 그라인더 수시로 닦기",cat:"마감체크"},{id:104,time:"19:00",name:"커피머신 밑 커피찌꺼기 청소",cat:"마감체크"},{id:105,time:"19:00",name:"원두 보관통, 시럽 펌프 세척 및 닦기",cat:"마감체크"},{id:106,time:"19:00",name:"테이크아웃 컵 보충 + 그라인더 용품 세척",cat:"마감체크"},{id:107,time:"20:30~21:00",name:"케이크 마감리스트 소비기한 작성 (관리자 확인)",cat:"마감체크"},{id:108,time:"21:00",name:"커피머신 마감 시작 (추출구→시브→스팀피처)",cat:"마감체크"},{id:109,time:"21:00",name:"모든 집기 세척 확인",cat:"마감체크"},{id:110,time:"21:00",name:"드립트레이 세척 + 전원 끄기",cat:"마감체크"},{id:111,time:"21:30",name:"쓰레기 종량제 봉투에 버리기",cat:"청소"},{id:112,time:"21:30",name:"행주 세척 + 시럽통 닦기 + 행주 널기",cat:"청소"},{id:113,time:"21:55",name:"케이크 쇼케이스 닦기 + 물버리기 + 조명 OFF",cat:"마감체크"},{id:114,time:"22:15",name:"냉장 쇼케이스 닦고 네임택 진열",cat:"마감체크"},{id:115,time:"22:15",name:"폐기 버리기 (전체)",cat:"마감체크"}],"마감B(1·2층마감)":[{id:201,time:"13:20",name:"오픈 가 인수인계 받기",cat:"정산인수인계"},{id:202,time:"13:20",name:"중앙 매대 가득 채우기 (관리자 상의)",cat:"제품체크"},{id:203,time:"13:20",name:"냉장빵 해동하기 (관리자 상의)",cat:"제품체크"},{id:204,time:"14:30",name:"오후 냉동 물류 확인 후 정리",cat:"물류제품"},{id:205,time:"16:00",name:"조리빵/크로와상/찹쌀떡도너츠 포장 + 시민점 찍기",cat:"제품체크"},{id:206,time:"휴식 후",name:"매대 정리 + 냉장 쇼케이스 정리 + 구움과자 채우기",cat:"제품체크"},{id:207,time:"20:00",name:"당일떡 10구 도시락 만들기 + 시민카트 가져오기",cat:"제품체크"},{id:208,time:"20:00",name:"네임택 정리 (다음날 순서대로)",cat:"마감체크"},{id:209,time:"20:30",name:"2,3층 창가 매대 닦기 + 우드판 정리",cat:"청소"},{id:210,time:"20:55",name:"2층 오븐마감",cat:"마감체크"},{id:211,time:"21:00",name:"포스주변 마감 + 포스 보기",cat:"마감체크"},{id:212,time:"21:00",name:"포스 하단선반/트레이 반납대 닦기",cat:"청소"},{id:213,time:"21:30",name:"건강빵 매대 닦기 + 타공판 배치 + 바 바닥 쓸기",cat:"청소"},{id:214,time:"21:45",name:"2층 마감",cat:"마감체크"},{id:215,time:"22:00~22:30",name:"자동문 OFF + 블라인드 + 구움과자 제자리",cat:"마감체크"},{id:216,time:"22:00~22:30",name:"재판정리 + 기부/공장 박스 적재",cat:"마감체크"},{id:217,time:"22:00~22:30",name:"매대 닦은 후 타공판+네임택 진열",cat:"청소"}],"마감C(설거지/청소)":[{id:301,time:"13:30",name:"베이커리 보조 및 포스보조",cat:"제품체크"},{id:302,time:"17:00",name:"브런치기계 마감 + 타공판 22개 닦기",cat:"마감체크"},{id:303,time:"상시",name:"비품 채우기 + 트레이/집게 상시 채우기",cat:"마감체크"},{id:304,time:"21:00",name:"쉐이크 마감",cat:"마감체크"},{id:305,time:"21:00",name:"A관련 설거지 + 쉐이크 부품 세척",cat:"청소"},{id:306,time:"22:00",name:"백룸 설거지 완료 및 백룸 마감",cat:"청소"},{id:307,time:"22:15",name:"바 바닥 닦기 + 걸레물 비우기 + 청소도구 정리",cat:"청소"},{id:308,time:"22:15",name:"바 뒤/백룸 정리 + 걸레 널기 + 컷팅존 닦기",cat:"청소"}],"마감C-1(대청소/성수기)":[{id:401,time:"18:00",name:"빵 채우기 + 라운딩",cat:"제품체크"},{id:402,time:"18:00",name:"리턴바 소모품 + 포스보조/픽업",cat:"마감체크"},{id:403,time:"18:00",name:"포장류 마무리 + 30분 간격 라운딩",cat:"제품체크"},{id:404,time:"21:00",name:"쉐이크 마감",cat:"마감체크"},{id:405,time:"21:30",name:"테라스 마감 + 문잠그기",cat:"청소"},{id:406,time:"21:30",name:"베이커리 정리 (찹쌀떡 4구 포장)",cat:"제품체크"},{id:407,time:"21:50",name:"2층 홀 테이블 닦기 + 22시 마감 고지",cat:"마감체크"},{id:408,time:"22:00",name:"2층 블라인드/창문/에어컨 끄기 + 정리",cat:"청소"},{id:409,time:"22:00",name:"서비스바 청소 + 쓰레기통 + 냉난방기 OFF",cat:"청소"},{id:410,time:"22:15",name:"바 바닥 닦기 + 걸레물 비우기 + 백룸 정리",cat:"청소"}],"마감C-2(백룸마감)":[{id:501,time:"18:30",name:"백룸 설거지 정리 + 마른 집기 채우기",cat:"청소"},{id:502,time:"18:30",name:"매대 트레이/집게 채우기 + 포스보조",cat:"마감체크"},{id:503,time:"21:00",name:"커피 집기 및 쉐이크 부품 우선 세척",cat:"청소"},{id:504,time:"~22:15",name:"백룸 정리 마무리",cat:"청소"},{id:505,time:"~22:20",name:"식세기 마감 + 백룸 바닥 닦기 + 걸레물 비우기",cat:"청소"},{id:506,time:"~22:30",name:"쓰레기 배출 후 관리자 보고",cat:"청소"}]}};

const CC={"오픈준비":{bg:"#E6F1FB",c:"#0C447C"},"물류제품":{bg:"#FAEEDA",c:"#633806"},"소비기한":{bg:"#FCEBEB",c:"#791F1F"},"라운딩":{bg:"#E1F5EE",c:"#085041"},"제품체크":{bg:"#FAECE7",c:"#712B13"},"청소":{bg:"#E6F1FB",c:"#0C447C"},"정산인수인계":{bg:"#E6F1FB",c:"#0C447C"},"마감체크":{bg:"#FCEBEB",c:"#791F1F"}};

const fmt=d=>`${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")}`;
const now=()=>{const d=new Date();return`${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;};
const isoDate=()=>new Date().toISOString().split("T")[0];
const DAYS=["일","월","화","수","목","금","토"];

async function syncCheck(data){try{const r=await fetch("/api/checklist",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});return r.ok;}catch{return false;}}

export default function App(){
  const[scr,setScr]=useState("home");
  const[loc,setLoc]=useState(null);
  const[locType,setLocType]=useState(null);
  const[shift,setShift]=useState(null);
  const[pos,setPos]=useState(null);
  const[floor,setFloor]=useState(null);
  const[tab,setTab]=useState("check");
  const[worker,setWorker]=useState("");
  const[chk,setChk]=useState({});
  const[syncing,setSyncing]=useState({});
  const[syncOk,setSyncOk]=useState({});
  const[selProduct,setSelProduct]=useState(null);
  const[selStep,setSelStep]=useState(null);
  const[prodQty,setProdQty]=useState("");
  const[prodNote,setProdNote]=useState("");
  const[prodLogs,setProdLogs]=useState([]);
  const[prodSaving,setProdSaving]=useState(false);

  const items=(loc&&pos&&CL[loc]?.[pos])||[];
  const done=items.filter(i=>chk[i.id]).length;
  const pct=items.length?Math.round(done/items.length*100):0;

  const handleCheck=useCallback(async(item)=>{
    if(chk[item.id])return;const t=now();
    setChk(p=>({...p,[item.id]:t}));setSyncing(p=>({...p,[item.id]:true}));
    const ok=await syncCheck({location:loc,shift,worker,itemName:item.name,completedTime:t,inputValue:"",date:isoDate()});
    setSyncing(p=>({...p,[item.id]:false}));setSyncOk(p=>({...p,[item.id]:ok}));
  },[loc,shift,worker,chk]);

  const handleProdSave=async()=>{
    if(!selProduct||!selStep||!prodQty)return;setProdSaving(true);
    const entry={product:selProduct.name,step:selStep,qty:prodQty,unit:selProduct.unit,note:prodNote,time:now()};
    try{await fetch("/api/checklist",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({location:floor,shift:"생산",worker,itemName:`${selProduct.name} - ${selStep}`,completedTime:now(),inputValue:`수량: ${prodQty}${selProduct.unit} ${prodNote?'/ '+prodNote:''}`,date:isoDate()})});}catch{}
    setProdLogs(p=>[entry,...p]);setSelProduct(null);setSelStep(null);setProdQty("");setProdNote("");setProdSaving(false);
  };

  const goHome=()=>{setScr("home");setLoc(null);setLocType(null);setShift(null);setPos(null);setFloor(null);setTab("check");setChk({});setSyncing({});setSyncOk({});setWorker("");setSelProduct(null);setSelStep(null);setProdQty("");setProdNote("");setProdLogs([]);};
  const goBack=()=>{
    if(scr==="shift"||scr==="floor"){setScr("home");setLoc(null);setLocType(null);}
    else if(scr==="pos"){setScr("shift");setShift(null);}
    else if(scr==="worker"){setScr(locType==="prod"?"floor":"pos");locType==="prod"?setFloor(null):setPos(null);}
    else{goHome();}
  };

  const s={wrap:{maxWidth:440,margin:"0 auto",minHeight:"100vh",fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",background:"#F7F6F3"},hdr:{background:"#fff",borderBottom:"0.5px solid #e5e5e5",padding:"12px 16px",display:"flex",alignItems:"center",gap:8,position:"sticky",top:0,zIndex:10},btn:{background:"none",border:"none",padding:4,cursor:"pointer",color:"#888",display:"flex"},card:{background:"#fff",border:"0.5px solid #e5e5e5",borderRadius:12,padding:"14px 16px",cursor:"pointer",textAlign:"left",width:"100%"}};

  return(
    <div style={s.wrap}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}.ani{animation:fadeIn .3s ease both}`}</style>

      <div style={s.hdr}>
        {scr!=="home"&&<button onClick={goBack} style={s.btn}><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>}
        <div style={{flex:1}}>
          <div style={{fontSize:17,fontWeight:500}}>{scr==="home"?"시민제과":scr==="prod"?floor:scr==="main"?(pos||loc):loc||"시민제과"}</div>
          {(scr==="main"||scr==="prod")&&<div style={{fontSize:11,color:"#888",marginTop:1}}>{scr==="prod"?"생산기록":shift} · {worker} · {fmt(new Date())}</div>}
        </div>
        {scr==="home"&&<div style={{fontSize:12,color:"#888"}}>{fmt(new Date())}</div>}
      </div>

      {scr==="home"&&(<div className="ani" style={{padding:20}}>
        <div style={{fontSize:15,color:"#666",marginBottom:24,lineHeight:1.6}}>안녕하세요!<br/>근무지를 선택해주세요.</div>
        {LOCATIONS.map(g=>(<div key={g.id}><div style={{fontSize:11,color:"#999",letterSpacing:0.5,marginBottom:8,marginTop:16}}>{g.label}</div><div style={{display:"flex",flexDirection:"column",gap:8}}>{g.items.map(l=>(<button key={l.key} onClick={()=>{setLoc(l.key);setLocType(l.type);setScr(l.type==="prod"?"floor":"shift")}} style={s.card}><div style={{fontSize:15,fontWeight:500}}>{l.name}</div><div style={{fontSize:12,color:"#999",marginTop:2}}>{l.sub}</div></button>))}</div></div>))}
      </div>)}

      {scr==="shift"&&(<div className="ani" style={{padding:20}}>
        <div style={{fontSize:15,color:"#666",marginBottom:24}}>시프트를 선택해주세요.</div>
        <div style={{display:"flex",gap:12}}>{["오픈","마감"].map(sh=>(<button key={sh} onClick={()=>{setShift(sh);setScr("pos")}} style={{...s.card,flex:1,textAlign:"center",padding:"24px 16px"}}><div style={{fontSize:24,marginBottom:8}}>{sh==="오픈"?"☀️":"🌙"}</div><div style={{fontSize:16,fontWeight:500}}>{sh}</div><div style={{fontSize:12,color:"#999",marginTop:4}}>{sh==="오픈"?"08:00 ~ 17:00":"13:30 ~ 22:30"}</div></button>))}</div>
      </div>)}

      {scr==="pos"&&(<div className="ani" style={{padding:20}}>
        <div style={{fontSize:15,color:"#666",marginBottom:24}}>포지션을 선택해주세요.</div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>{(POSITIONS[loc]?.[shift]||[]).map(p=>(<button key={p.key} onClick={()=>{setPos(p.key);setScr("worker")}} style={s.card}><div style={{fontSize:15,fontWeight:500}}>{p.name}</div><div style={{fontSize:12,color:"#999",marginTop:2}}>{p.sub}</div></button>))}</div>
        {!POSITIONS[loc]&&<div style={{marginTop:16,padding:12,background:"#FFF8E1",borderRadius:8,fontSize:13,color:"#856404"}}>이 근무지는 아직 등록되지 않았습니다.</div>}
      </div>)}

      {scr==="floor"&&(<div className="ani" style={{padding:20}}>
        <div style={{fontSize:15,color:"#666",marginBottom:24}}>작업 층을 선택해주세요.</div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>{(FLOORS[loc]||[]).map(f=>(<button key={f.key} onClick={()=>{setFloor(f.key);setScr("worker")}} style={s.card}><div style={{fontSize:15,fontWeight:500}}>{f.name}</div><div style={{fontSize:12,color:"#999",marginTop:2}}>{f.sub}</div></button>))}</div>
      </div>)}

      {scr==="worker"&&(<div className="ani" style={{padding:20}}>
        <div style={{fontSize:15,color:"#666",marginBottom:24}}>이름을 입력해주세요.</div>
        <input type="text" placeholder="예: 이승훈" value={worker} onChange={e=>setWorker(e.target.value)} autoFocus style={{width:"100%",padding:"12px 16px",fontSize:16,border:"0.5px solid #ccc",borderRadius:10,outline:"none",background:"#fff",boxSizing:"border-box"}}/>
        <button onClick={()=>setScr(locType==="prod"?"prod":"main")} disabled={!worker.trim()} style={{width:"100%",marginTop:16,padding:12,fontSize:15,fontWeight:500,background:worker.trim()?"#534AB7":"#ddd",color:worker.trim()?"#fff":"#999",border:"none",borderRadius:10,cursor:worker.trim()?"pointer":"default"}}>시작하기</button>
      </div>)}

      {scr==="prod"&&(<div className="ani" style={{padding:"16px 16px 80px"}}>
        <div style={{fontSize:11,color:"#999",letterSpacing:0.5,marginBottom:12}}>작업명 선택</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:16}}>{PRODUCTS.map(p=>(<button key={p.name} onClick={()=>{setSelProduct(p);setSelStep(p.steps.length===1?p.steps[0]:null)}} style={{padding:"8px 14px",borderRadius:8,fontSize:13,border:"0.5px solid "+(selProduct?.name===p.name?"#534AB7":"#e5e5e5"),background:selProduct?.name===p.name?"#EEEDFE":"#fff",color:selProduct?.name===p.name?"#534AB7":"#1a1a1a",cursor:"pointer",fontWeight:selProduct?.name===p.name?500:400}}>{p.name}</button>))}</div>
        {selProduct&&selProduct.steps.length>1&&(<><div style={{fontSize:11,color:"#999",letterSpacing:0.5,marginBottom:8}}>공정 선택</div><div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:16}}>{selProduct.steps.map(st=>(<button key={st} onClick={()=>setSelStep(st)} style={{padding:"8px 14px",borderRadius:8,fontSize:13,border:"0.5px solid "+(selStep===st?"#534AB7":"#e5e5e5"),background:selStep===st?"#EEEDFE":"#fff",color:selStep===st?"#534AB7":"#1a1a1a",cursor:"pointer",fontWeight:selStep===st?500:400}}>{st}</button>))}</div></>)}
        {selStep&&(<>
          <div style={{fontSize:11,color:"#999",letterSpacing:0.5,marginBottom:8}}>수량</div>
          <div style={{display:"flex",gap:8,marginBottom:16}}><input type="number" placeholder="예: 150" value={prodQty} onChange={e=>setProdQty(e.target.value)} style={{flex:1,padding:"10px 14px",fontSize:15,border:"0.5px solid #ccc",borderRadius:8,outline:"none",background:"#fff",boxSizing:"border-box"}}/><div style={{padding:"10px 14px",fontSize:14,color:"#888",background:"#f5f5f5",borderRadius:8,display:"flex",alignItems:"center"}}>{selProduct.unit}</div></div>
          <div style={{fontSize:11,color:"#999",letterSpacing:0.5,marginBottom:8}}>비고 (선택)</div>
          <input type="text" placeholder="예: 월요일분 선제작" value={prodNote} onChange={e=>setProdNote(e.target.value)} style={{width:"100%",padding:"10px 14px",fontSize:14,border:"0.5px solid #ccc",borderRadius:8,outline:"none",background:"#fff",boxSizing:"border-box",marginBottom:16}}/>
          <button onClick={handleProdSave} disabled={!prodQty||prodSaving} style={{width:"100%",padding:12,fontSize:15,fontWeight:500,background:(prodQty&&!prodSaving)?"#534AB7":"#ddd",color:(prodQty&&!prodSaving)?"#fff":"#999",border:"none",borderRadius:10,cursor:(prodQty&&!prodSaving)?"pointer":"default"}}>{prodSaving?"저장 중...":"기록 완료"}</button>
        </>)}
        {prodLogs.length>0&&(<div style={{marginTop:24}}><div style={{fontSize:11,color:"#999",letterSpacing:0.5,marginBottom:8}}>오늘 기록한 작업 ({prodLogs.length}건)</div>{prodLogs.map((log,i)=>(<div key={i} style={{padding:"10px 0",borderBottom:"0.5px solid #eee",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div><div style={{fontSize:13,fontWeight:500}}>{log.product} — {log.step}</div><div style={{fontSize:12,color:"#888",marginTop:2}}>{log.qty}{log.unit}{log.note&&` · ${log.note}`}</div></div><div style={{fontSize:11,color:"#1D9E75",flexShrink:0}}>{log.time}</div></div>))}</div>)}
      </div>)}

      {scr==="main"&&(<div className="ani">
        <div style={{padding:"16px 16px 80px"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:13,color:"#888"}}>오늘 업무 {done}/{items.length} 완료</span><span style={{fontSize:12,fontWeight:500,color:pct===100?"#1D9E75":"#999"}}>{pct}%</span></div>
          <div style={{height:4,background:"#eee",borderRadius:2,marginBottom:20}}><div style={{height:"100%",width:`${pct}%`,background:pct===100?"#1D9E75":"#534AB7",borderRadius:2,transition:"width 0.4s"}}/></div>
          {(()=>{const g={};items.forEach(i=>{if(!g[i.time])g[i.time]=[];g[i.time].push(i);});return Object.entries(g).map(([time,its])=>(<div key={time} style={{marginBottom:16}}><div style={{fontSize:11,color:"#999",letterSpacing:0.5,marginBottom:6}}>{time}</div>{its.map(item=>{const d=!!chk[item.id];const cc=CC[item.cat]||{bg:"#F1EFE8",c:"#444"};return(<div key={item.id} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 0",borderBottom:"0.5px solid #eee"}}><button onClick={()=>!d&&handleCheck(item)} disabled={d} style={{width:22,height:22,minWidth:22,borderRadius:"50%",border:d?"none":"1.5px solid #ccc",background:d?"#1D9E75":"transparent",cursor:d?"default":"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0,marginTop:1}}>{d&&<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7.5L5.5 10L11 4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}</button><div style={{flex:1}}><div style={{fontSize:13,color:d?"#999":"#1a1a1a",textDecoration:d?"line-through":"none",lineHeight:1.4}}>{item.name}</div><div style={{display:"flex",gap:6,marginTop:4}}><span style={{fontSize:10,padding:"1px 6px",borderRadius:6,background:cc.bg,color:cc.c}}>{item.cat}</span></div>{d&&<div style={{display:"flex",alignItems:"center",gap:4,marginTop:3}}><span style={{fontSize:11,color:"#1D9E75"}}>완료 {chk[item.id]}</span>{syncing[item.id]&&<svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{animation:"spin 1s linear infinite"}}><path d="M2 8a6 6 0 0110.3-4.2M14 8a6 6 0 01-10.3 4.2" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round"/></svg>}{syncOk[item.id]===true&&<span style={{fontSize:10,color:"#1D9E75"}}>저장됨</span>}{syncOk[item.id]===false&&<span style={{fontSize:10,color:"#E24B4A"}}>실패</span>}</div>}</div></div>);})}</div>));})()}
        </div>
      </div>)}
    </div>
  );
}
