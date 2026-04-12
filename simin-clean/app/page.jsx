"use client";
import { useState, useCallback } from "react";

const LOCATIONS = [
  { id: "store", label: "매장", items: [
    { key: "효자강변점 매장", name: "효자강변점", sub: "효자동" },
    { key: "본점 매장", name: "본점", sub: "중앙상가 1-2층" },
    { key: "롯데백화점 포항점 매장", name: "롯데백화점 포항점", sub: "롯데백화점 B1" },
  ]},
  { id: "prod", label: "생산", items: [
    { key: "본점 생산", name: "본점 생산", sub: "3층·4층" },
    { key: "효자점 생산", name: "효자점 생산", sub: "효자강변점 생산실" },
  ]},
];

const CHECKLIST = {
  "효자강변점 매장": {
    "오픈": [
      { id:1, time:"출근", cat:"오픈준비", name:"노션확인/예약건 확인/금일 물량지 확인", type:"체크", day:"매일" },
      { id:2, time:"8시~8시50분", cat:"오픈준비", name:"포스오픈/식세기오픈/쉐이크머신셋팅/원두셋팅/2층 오픈", type:"체크", day:"매일" },
      { id:3, time:"~8시40분", cat:"물량챙기기", name:"본점/롯데 각지점 전달 사워도우 및 샌드위치 챙기기", type:"체크", day:"매일" },
      { id:4, time:"9시~10시", cat:"물류제품", name:"각지점 전달 제품 및 1차 받은 제품 확인", type:"체크", day:"매일" },
      { id:5, time:"9시~10시", cat:"물류제품", name:"냉동제품 해동 및 구움과자 진열 상태 확인", type:"체크", day:"매일" },
      { id:6, time:"9시~10시", cat:"소비기한", name:"소비기한 체크 (냉장,구움과자) — 전날 폐기 포함 확인 후 노션 작성", type:"체크", day:"매일" },
      { id:7, time:"9시~10시", cat:"제품체크", name:"패스츄리 및 소금빵, 바게트류 제품 상태 체크", type:"체크", day:"매일" },
      { id:8, time:"9시~10시", cat:"제품체크", name:"매대 빵 진열 상태 확인", type:"체크", day:"매일" },
      { id:9, time:"8시/11시", cat:"온도체크", name:"1층 에어컨/온도 설정 확인", type:"숫자입력", day:"매일" },
      { id:10, time:"8시/11시", cat:"온도체크", name:"2층 에어컨/온도 설정 확인", type:"숫자입력", day:"매일" },
      { id:11, time:"11시", cat:"온도체크", name:"쇼케이스 온도 체크 (케이크/중앙좌우/안쪽)", type:"숫자입력", day:"매일" },
      { id:12, time:"상시", cat:"라운딩", name:"라운딩 체크 (화장실+테라스 포함)", type:"텍스트입력", day:"매일" },
      { id:13, time:"상시", cat:"인력", name:"인력 배치 및 전달사항 전달", type:"텍스트입력", day:"매일" },
      { id:14, time:"상시", cat:"인력", name:"신입 및 교육 보강 필요한 직원 교육 실시", type:"텍스트입력", day:"매일" },
      { id:15, time:"상시", cat:"제품체크", name:"케이크 쇼케이스 진열 상태 확인", type:"체크", day:"매일" },
      { id:16, time:"상시", cat:"제품체크", name:"매대 빵진열 상태 체크 (시간대별)", type:"텍스트입력", day:"매일" },
      { id:17, time:"목요일", cat:"재고조사", name:"금주 미입고 재고조사 재고 확인 (주말대비)", type:"체크", day:"목요일" },
      { id:18, time:"화요일", cat:"소비기한", name:"유통기한 관리대장 정리 및 소비기한 임박 체크", type:"체크", day:"화요일" },
      { id:19, time:"금요일", cat:"소비기한", name:"임박 제품 캘린더 작성", type:"체크", day:"금요일" },
      { id:20, time:"물량확인", cat:"물류제품", name:"물량지 오전 물류 체크 완료", type:"체크", day:"매일" },
      { id:21, time:"12시", cat:"보고서", name:"매출 파악 및 보고서 작성", type:"체크", day:"매일" },
      { id:22, time:"수요일", cat:"청소", name:"매장 체크리스트 점검", type:"체크", day:"수요일" },
      { id:23, time:"수요일", cat:"청소", name:"대청소 구역 청소 (청소완료 후 청소일지 작성)", type:"체크", day:"수요일" },
      { id:24, time:"15시30분", cat:"물류제품", name:"오후추가 물량 입고 확인", type:"텍스트입력", day:"매일" },
      { id:25, time:"17시(퇴근)", cat:"정산인수인계", name:"포스정산 및 인수인계 전달", type:"체크", day:"매일" },
    ],
    "마감": [
      { id:101, time:"13시30분", cat:"정산인수인계", name:"노션확인/인수인계 확인", type:"체크", day:"매일" },
      { id:102, time:"13시30분", cat:"인력", name:"마감인력 시간표 및 전달사항 전달", type:"체크", day:"매일" },
      { id:103, time:"13시30분", cat:"제품체크", name:"매대 체크 및 물량 추가 확인", type:"체크", day:"매일" },
      { id:104, time:"14시", cat:"소비기한", name:"당일 폐기제품 확인", type:"텍스트입력", day:"매일" },
      { id:105, time:"14시", cat:"인력", name:"인력 배치 및 전달사항 전달", type:"텍스트입력", day:"매일" },
      { id:106, time:"14시", cat:"인력", name:"신입 및 교육 보강 필요한 직원 교육 실시", type:"텍스트입력", day:"매일" },
      { id:107, time:"상시", cat:"제품체크", name:"매대 빵진열 상태 체크 (후방카트 정리 포함)", type:"텍스트입력", day:"매일" },
      { id:108, time:"15시", cat:"보고서", name:"매출 파악 및 보고서 작성", type:"체크", day:"매일" },
      { id:109, time:"물량확인", cat:"물류제품", name:"물량지 오전 물류 체크 완료", type:"체크", day:"매일" },
      { id:110, time:"상시", cat:"라운딩", name:"라운딩 체크 (화장실+테라스 포함)", type:"텍스트입력", day:"매일" },
      { id:111, time:"14시/18시", cat:"온도체크", name:"1층 에어컨/온도 설정 확인", type:"숫자입력", day:"매일" },
      { id:112, time:"14시/18시", cat:"온도체크", name:"2층 에어컨/온도 설정 확인", type:"숫자입력", day:"매일" },
      { id:113, time:"17시", cat:"온도체크", name:"쇼케이스 온도 체크 (케이크/중앙좌우/안쪽)", type:"숫자입력", day:"매일" },
      { id:114, time:"수요일", cat:"청소", name:"대청소 구역 청소 상태 사진 올리기", type:"체크", day:"수요일" },
      { id:115, time:"마감", cat:"마감체크", name:"원두재고 정리 및 기입", type:"체크", day:"매일" },
      { id:116, time:"마감", cat:"마감체크", name:"케이크 마감재고리스트 정리 완료", type:"체크", day:"매일" },
      { id:117, time:"마감", cat:"마감체크", name:"당일 폐기제품 확인", type:"체크", day:"매일" },
      { id:118, time:"마감", cat:"마감체크", name:"백룸 물기 제거 및 청결상태 확인", type:"체크", day:"매일" },
      { id:119, time:"마감", cat:"마감체크", name:"2층 마감상태 체크 (서비스바/테이블/창문/테라스/에어컨)", type:"체크", day:"매일" },
      { id:120, time:"마감", cat:"마감체크", name:"재판카트/기부/공장 확인 완료", type:"체크", day:"매일" },
    ],
  },
};

const INVENTORY_SAMPLE = [
  { id:"s1", name:"소보로 생지", cat:"냉동생지", unit:"개", qty:48, made:"04.08", exp:"04.15" },
  { id:"s2", name:"단팥빵 생지", cat:"냉동생지", unit:"개", qty:120, made:"04.09", exp:"04.16" },
  { id:"s3", name:"크로와상 생지", cat:"냉동생지", unit:"개", qty:36, made:"04.07", exp:"04.14" },
  { id:"s4", name:"찹쌀떡 (팥)", cat:"냉동제품", unit:"개", qty:200, made:"04.10", exp:"04.17" },
  { id:"s5", name:"식빵 생지", cat:"냉동생지", unit:"개", qty:60, made:"04.09", exp:"04.16" },
  { id:"s6", name:"쉐이크 원액", cat:"쉐이크원액", unit:"L", qty:5, made:"04.10", exp:"04.24" },
];

const DAYS = ["일요일","월요일","화요일","수요일","목요일","금요일","토요일"];
const CC = {
  "오픈준비":{bg:"#E6F1FB",c:"#0C447C"},"물량챙기기":{bg:"#FAEEDA",c:"#633806"},
  "물류제품":{bg:"#FAEEDA",c:"#633806"},"소비기한":{bg:"#FCEBEB",c:"#791F1F"},
  "온도체크":{bg:"#FBEAF0",c:"#72243E"},"라운딩":{bg:"#E1F5EE",c:"#085041"},
  "인력":{bg:"#EEEDFE",c:"#3C3489"},"제품체크":{bg:"#FAECE7",c:"#712B13"},
  "보고서":{bg:"#F1EFE8",c:"#444441"},"청소":{bg:"#E6F1FB",c:"#0C447C"},
  "재고조사":{bg:"#FAEEDA",c:"#633806"},"정산인수인계":{bg:"#E6F1FB",c:"#0C447C"},
  "마감체크":{bg:"#FCEBEB",c:"#791F1F"},
};

const fmt = (d) => `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")}`;
const now = () => { const d=new Date(); return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; };
const today = () => DAYS[new Date().getDay()];
const isoDate = () => new Date().toISOString().split("T")[0];
const filterDay = (items) => items.filter(i => i.day === "매일" || i.day === today());

async function syncCheck(data) {
  try {
    const res = await fetch("/api/checklist", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch { return false; }
}

export default function App() {
  const [scr, setScr] = useState("home");
  const [loc, setLoc] = useState(null);
  const [shift, setShift] = useState(null);
  const [tab, setTab] = useState("check");
  const [worker, setWorker] = useState("");
  const [chk, setChk] = useState({});
  const [vals, setVals] = useState({});
  const [syncing, setSyncing] = useState({});
  const [syncOk, setSyncOk] = useState({});
  const [inv, setInv] = useState(INVENTORY_SAMPLE.map(i=>({...i})));

  const items = (loc && shift && CHECKLIST[loc]?.[shift]) ? filterDay(CHECKLIST[loc][shift]) : [];
  const done = items.filter(i=>chk[i.id]).length;
  const pct = items.length ? Math.round(done/items.length*100) : 0;

  const handleCheck = useCallback(async (item) => {
    if (chk[item.id]) return;
    const t = now();
    setChk(p=>({...p,[item.id]:t}));
    setSyncing(p=>({...p,[item.id]:true}));
    const ok = await syncCheck({ location:loc, shift, worker, itemName:item.name, completedTime:t, inputValue:vals[item.id]||"", date:isoDate() });
    setSyncing(p=>({...p,[item.id]:false}));
    setSyncOk(p=>({...p,[item.id]:ok}));
  }, [loc, shift, worker, chk, vals]);

  const goHome = () => { setScr("home"); setLoc(null); setShift(null); setTab("check"); setChk({}); setVals({}); setSyncing({}); setSyncOk({}); setWorker(""); };

  const s = {
    wrap: { maxWidth:440, margin:"0 auto", minHeight:"100vh", background:"#F7F6F3" },
    hdr: { background:"#fff", borderBottom:"0.5px solid #e5e5e5", padding:"12px 16px", display:"flex", alignItems:"center", gap:8, position:"sticky", top:0, zIndex:10 },
    btn: { background:"none", border:"none", padding:4, cursor:"pointer", color:"#888", display:"flex" },
    card: { background:"#fff", border:"0.5px solid #e5e5e5", borderRadius:12, padding:"14px 16px", cursor:"pointer", textAlign:"left", width:"100%" },
  };

  return (
    <div style={s.wrap}>
      {/* Header */}
      <div style={s.hdr}>
        {scr!=="home" && <button onClick={goHome} style={s.btn}><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></button>}
        <div style={{flex:1}}>
          <div style={{fontSize:17,fontWeight:500}}>{scr==="home"?"시민제과":loc||"시민제과"}</div>
          {scr==="main"&&<div style={{fontSize:11,color:"#888",marginTop:1}}>{shift} · {worker} · {fmt(new Date())}</div>}
        </div>
        {scr==="home"&&<div style={{fontSize:12,color:"#888"}}>{fmt(new Date())}</div>}
      </div>

      {/* Home */}
      {scr==="home"&&(
        <div className="ani" style={{padding:20}}>
          <div style={{fontSize:15,color:"#666",marginBottom:24,lineHeight:1.6}}>안녕하세요!<br/>근무지를 선택해주세요.</div>
          {LOCATIONS.map(g=>(
            <div key={g.id}>
              <div style={{fontSize:11,color:"#999",letterSpacing:0.5,marginBottom:8,marginTop:16}}>{g.label}</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {g.items.map(l=>(
                  <button key={l.key} onClick={()=>{setLoc(l.key);setScr("shift")}} style={s.card}>
                    <div style={{fontSize:15,fontWeight:500}}>{l.name}</div>
                    <div style={{fontSize:12,color:"#999",marginTop:2}}>{l.sub}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Shift */}
      {scr==="shift"&&(
        <div className="ani" style={{padding:20}}>
          <div style={{fontSize:15,color:"#666",marginBottom:24}}>시프트를 선택해주세요.</div>
          <div style={{display:"flex",gap:12}}>
            {["오픈","마감"].map(sh=>(
              <button key={sh} onClick={()=>{setShift(sh);setScr("worker")}}
                style={{...s.card,flex:1,textAlign:"center",padding:"24px 16px"}}>
                <div style={{fontSize:24,marginBottom:8}}>{sh==="오픈"?"☀️":"🌙"}</div>
                <div style={{fontSize:16,fontWeight:500}}>{sh}</div>
                <div style={{fontSize:12,color:"#999",marginTop:4}}>{sh==="오픈"?"08:00 ~ 17:00":"13:30 ~ 22:00"}</div>
              </button>
            ))}
          </div>
          {!CHECKLIST[loc]&&<div style={{marginTop:16,padding:12,background:"#FFF8E1",borderRadius:8,fontSize:13,color:"#856404"}}>이 근무지는 아직 체크리스트가 등록되지 않았습니다.</div>}
        </div>
      )}

      {/* Worker */}
      {scr==="worker"&&(
        <div className="ani" style={{padding:20}}>
          <div style={{fontSize:15,color:"#666",marginBottom:24}}>이름을 입력해주세요.</div>
          <input type="text" placeholder="예: 김지현" value={worker} onChange={e=>setWorker(e.target.value)} autoFocus
            style={{width:"100%",padding:"12px 16px",fontSize:16,border:"0.5px solid #ccc",borderRadius:10,outline:"none",background:"#fff",boxSizing:"border-box"}}/>
          <button onClick={()=>setScr("main")} disabled={!worker.trim()}
            style={{width:"100%",marginTop:16,padding:12,fontSize:15,fontWeight:500,background:worker.trim()?"#534AB7":"#ddd",color:worker.trim()?"#fff":"#999",border:"none",borderRadius:10,cursor:worker.trim()?"pointer":"default"}}>
            시작하기
          </button>
        </div>
      )}

      {/* Main */}
      {scr==="main"&&(
        <div className="ani">
          <div style={{display:"flex",background:"#fff",borderBottom:"0.5px solid #e5e5e5"}}>
            {[{k:"check",l:"체크리스트"},{k:"inv",l:"냉동재고"}].map(t=>(
              <button key={t.k} onClick={()=>setTab(t.k)}
                style={{flex:1,padding:"11px 0",fontSize:13,fontWeight:tab===t.k?500:400,border:"none",borderBottom:tab===t.k?"2px solid #534AB7":"2px solid transparent",color:tab===t.k?"#1a1a1a":"#999",background:"none",cursor:"pointer"}}>
                {t.l}
              </button>
            ))}
          </div>

          {tab==="check"&&(
            <div style={{padding:"16px 16px 80px"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <span style={{fontSize:13,color:"#888"}}>오늘 업무 {done}/{items.length} 완료</span>
                <span style={{fontSize:12,fontWeight:500,color:pct===100?"#1D9E75":"#999"}}>{pct}%</span>
              </div>
              <div style={{height:4,background:"#eee",borderRadius:2,marginBottom:20}}>
                <div style={{height:"100%",width:`${pct}%`,background:pct===100?"#1D9E75":"#534AB7",borderRadius:2,transition:"width 0.4s"}}/>
              </div>
              <div style={{display:"inline-block",fontSize:11,padding:"3px 10px",borderRadius:8,background:"#E1F5EE",color:"#085041",marginBottom:14}}>
                {today()} 기준 항목 표시 중
              </div>

              {(()=>{
                const g={};
                items.forEach(i=>{if(!g[i.time])g[i.time]=[];g[i.time].push(i);});
                return Object.entries(g).map(([time,its])=>(
                  <div key={time} style={{marginBottom:16}}>
                    <div style={{fontSize:11,color:"#999",letterSpacing:0.5,marginBottom:6}}>{time}</div>
                    {its.map(item=>{
                      const d=!!chk[item.id]; const cc=CC[item.cat]||{bg:"#F1EFE8",c:"#444"};
                      return (
                        <div key={item.id} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 0",borderBottom:"0.5px solid #eee"}}>
                          <button onClick={()=>!d&&item.type==="체크"&&handleCheck(item)} disabled={d}
                            style={{width:22,height:22,minWidth:22,borderRadius:"50%",border:d?"none":"1.5px solid #ccc",background:d?"#1D9E75":"transparent",cursor:d?"default":"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0,marginTop:1}}>
                            {d&&<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7.5L5.5 10L11 4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          </button>
                          <div style={{flex:1}}>
                            <div style={{fontSize:13,color:d?"#999":"#1a1a1a",textDecoration:d?"line-through":"none",lineHeight:1.4}}>{item.name}</div>
                            <div style={{display:"flex",gap:6,marginTop:4}}>
                              <span style={{fontSize:10,padding:"1px 6px",borderRadius:6,background:cc.bg,color:cc.c}}>{item.cat}</span>
                              {item.type!=="체크"&&!d&&<span style={{fontSize:10,padding:"1px 6px",borderRadius:6,background:"#EEEDFE",color:"#534AB7"}}>{item.type==="숫자입력"?"숫자":"메모"}</span>}
                            </div>
                            {item.type!=="체크"&&!d&&(
                              <div style={{display:"flex",gap:6,marginTop:6}}>
                                <input type={item.type==="숫자입력"?"number":"text"} placeholder={item.type==="숫자입력"?"온도 입력":"메모 입력"}
                                  value={vals[item.id]||""} onChange={e=>setVals(p=>({...p,[item.id]:e.target.value}))}
                                  style={{flex:1,padding:"6px 10px",fontSize:12,border:"0.5px solid #ddd",borderRadius:6,outline:"none",background:"#fff"}}/>
                                <button onClick={()=>handleCheck(item)} style={{padding:"6px 12px",fontSize:11,fontWeight:500,background:"#534AB7",color:"#fff",border:"none",borderRadius:6,cursor:"pointer"}}>완료</button>
                              </div>
                            )}
                            {d&&(
                              <div style={{display:"flex",alignItems:"center",gap:4,marginTop:3}}>
                                <span style={{fontSize:11,color:"#1D9E75"}}>완료 {chk[item.id]}</span>
                                {syncing[item.id]&&<svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{animation:"spin 1s linear infinite"}}><path d="M2 8a6 6 0 0110.3-4.2M14 8a6 6 0 01-10.3 4.2" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                                {syncOk[item.id]===true&&<span style={{fontSize:10,color:"#1D9E75"}}>Notion 저장됨</span>}
                                {syncOk[item.id]===false&&<span style={{fontSize:10,color:"#E24B4A"}}>저장 실패</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ));
              })()}
            </div>
          )}

          {tab==="inv"&&(
            <div style={{padding:"16px 16px 80px"}}>
              <div style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:11,color:"#888",background:"#f5f5f5",padding:"4px 10px",borderRadius:8,marginBottom:14}}>
                <span style={{width:6,height:6,borderRadius:"50%",background:"#1D9E75"}}/>Notion 동기화 가능
              </div>
              {inv.map(item=>(
                <div key={item.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0",borderBottom:"0.5px solid #eee"}}>
                  <div>
                    <div style={{fontSize:14}}>{item.name}</div>
                    <div style={{fontSize:11,color:"#999",marginTop:2}}>제조 {item.made} | 유효 {item.exp}</div>
                    <span style={{fontSize:10,padding:"1px 6px",borderRadius:6,background:"#E6F1FB",color:"#0C447C",marginTop:3,display:"inline-block"}}>{item.cat}</span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <button onClick={()=>setInv(p=>p.map(i=>i.id===item.id?{...i,qty:Math.max(0,i.qty-1)}:i))}
                      style={{width:28,height:28,borderRadius:"50%",border:"0.5px solid #ccc",background:"#f5f5f5",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:16}}>-</button>
                    <span style={{fontSize:16,fontWeight:500,minWidth:36,textAlign:"center"}}>{item.qty}</span>
                    <button onClick={()=>setInv(p=>p.map(i=>i.id===item.id?{...i,qty:i.qty+1}:i))}
                      style={{width:28,height:28,borderRadius:"50%",border:"0.5px solid #ccc",background:"#f5f5f5",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:16}}>+</button>
                    <span style={{fontSize:11,color:"#999",minWidth:16}}>{item.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
