'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';

const WORDS = [
  '소프트웨어','프로그래밍','사물인터넷','양자컴퓨팅','자율주행차',
  '데이터분석','충북과학고','반도체공학','컴퓨터비전','딥러닝모델',
  '리눅스커널','인터넷속도','스마트폰앱','로봇공학과','나노기술학',
  '바이오기술','화학실험실','생물다양성','우주탐험대','전기자동차',
  '행복한하루','재미있어요','아름다워요','즐거운시간','맛있는음식',
  '과학기술원','별이빛나요','무지개색깔','여름이좋아','봄이왔어요',
  '인터넷뱅킹','수학공식들','통계학기초','물리학법칙','생명과학관',
  '달에가고파','초록빛하늘','피자먹어요','치킨먹고파','눈이내려요',
];

type Status = 'correct' | 'present' | 'absent' | 'empty' | 'active';

interface Row { chars: string[]; statuses: Status[] }

function evaluate(guess: string, answer: string): Status[] {
  const g = [...guess], a = [...answer];
  const result: Status[] = Array(5).fill('absent');
  const used = Array(5).fill(false);
  // pass 1: correct
  for (let i = 0; i < 5; i++) {
    if (g[i] === a[i]) { result[i] = 'correct'; used[i] = true; }
  }
  // pass 2: present
  for (let i = 0; i < 5; i++) {
    if (result[i] === 'correct') continue;
    for (let j = 0; j < 5; j++) {
      if (!used[j] && g[i] === a[j]) { result[i] = 'present'; used[j] = true; break; }
    }
  }
  return result;
}

const STATUS_STYLE: Record<Status, string> = {
  correct: 'bg-green-500 border-green-500 text-white',
  present: 'bg-yellow-400 border-yellow-400 text-white',
  absent:  'bg-muted/50 border-border/50 text-muted-foreground',
  empty:   'bg-transparent border-border/30 text-foreground',
  active:  'bg-transparent border-primary text-foreground',
};

export default function WordleKR() {
  const [answer, setAnswer] = useState(() => WORDS[Math.floor(Math.random() * WORDS.length)]);
  const [rows, setRows] = useState<Row[]>(Array.from({length:6}, () => ({ chars: Array(5).fill(''), statuses: Array(5).fill('empty') })));
  const [currentRow, setCurrentRow] = useState(0);
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState<'playing'|'won'|'lost'>('playing');
  const [shake, setShake] = useState(false);
  const [charMap, setCharMap] = useState<Record<string, Status>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = useCallback(() => {
    if (phase !== 'playing') return;
    const chars = [...input];
    if (chars.length !== 5 || !chars.every(c => /[가-힣]/.test(c))) {
      setShake(true); setTimeout(() => setShake(false), 500);
      return;
    }
    const statuses = evaluate(input, answer);
    const newRows = rows.map((r, i) => i === currentRow ? { chars, statuses } : r);
    setRows(newRows);

    // update char map
    const nm = { ...charMap };
    chars.forEach((ch, i) => {
      const prev = nm[ch];
      const next = statuses[i];
      if (prev === 'correct') return;
      if (prev === 'present' && next !== 'correct') return;
      nm[ch] = next;
    });
    setCharMap(nm);
    setInput('');

    if (input === answer) { setPhase('won'); return; }
    if (currentRow === 5) { setPhase('lost'); return; }
    setCurrentRow(r => r + 1);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [input, answer, rows, currentRow, phase, charMap]);

  const reset = () => {
    setAnswer(WORDS[Math.floor(Math.random() * WORDS.length)]);
    setRows(Array.from({length:6}, () => ({ chars: Array(5).fill(''), statuses: Array(5).fill('empty') })));
    setCurrentRow(0); setInput(''); setPhase('playing'); setCharMap({});
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [submit]);

  // preview current input in active row
  const displayRows = rows.map((r, i) => {
    if (i !== currentRow || phase !== 'playing') return r;
    const chars = [...input].slice(0, 5);
    while (chars.length < 5) chars.push('');
    const statuses: Status[] = chars.map((c, ci) => c ? (ci < [...input].length ? 'active' : 'empty') : 'empty');
    return { chars, statuses };
  });

  // get unique syllables used in all words for keyboard hint
  const allChars = Array.from(new Set(WORDS.join(''))).sort();

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="text-center">
        <h2 className="font-black text-lg uppercase tracking-tighter">꼬들 KR</h2>
        <p className="text-xs text-muted-foreground font-medium">5글자 한국어 단어를 맞춰보세요 (6번 시도)</p>
      </div>

      {/* grid */}
      <div className={`grid grid-rows-6 gap-1.5 transition-transform ${shake ? 'animate-bounce' : ''}`}>
        {displayRows.map((row, ri) => (
          <div key={ri} className="flex gap-1.5">
            {row.chars.map((ch, ci) => (
              <div key={ci}
                className={`w-12 h-12 flex items-center justify-center font-black text-lg border-2 rounded-lg transition-all select-none ${STATUS_STYLE[row.statuses[ci]]}`}>
                {ch}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* input area */}
      {phase === 'playing' && (
        <div className="flex gap-2 items-center">
          <input
            ref={inputRef}
            value={input}
            onChange={e => {
              const v = e.target.value;
              const filtered = [...v].filter(c => /[가-힣]/.test(c)).slice(0, 5).join('');
              setInput(filtered);
            }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
            placeholder="5글자 입력..."
            className="h-10 px-3 text-sm bg-muted border border-border/50 rounded-xl outline-none focus:border-primary font-bold text-center w-36"
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <Button onClick={submit} className="font-black uppercase tracking-widest h-10">확인</Button>
        </div>
      )}

      {/* char hint keyboard */}
      <div className="flex flex-wrap gap-1 justify-center max-w-xs">
        {allChars.slice(0, 40).map(ch => (
          <div key={ch}
            className={`w-7 h-7 flex items-center justify-center text-[11px] font-black rounded border transition-all ${
              charMap[ch] ? STATUS_STYLE[charMap[ch]] : 'bg-muted/40 border-border/30 text-muted-foreground'
            }`}>
            {ch}
          </div>
        ))}
      </div>

      {/* result */}
      {phase !== 'playing' && (
        <div className={`text-center p-4 rounded-2xl border ${phase === 'won' ? 'bg-green-500/10 border-green-500/30' : 'bg-muted/20 border-border/30'}`}>
          {phase === 'won'
            ? <p className="font-black text-green-500 uppercase tracking-widest text-lg">🎉 정답! ({currentRow+1}/6)</p>
            : <><p className="font-black uppercase tracking-widest text-lg">😢 아쉽...</p>
               <p className="text-muted-foreground font-bold mt-1">정답: <span className="text-primary font-black">{answer}</span></p></>
          }
          <Button onClick={reset} className="mt-3 font-black uppercase tracking-widest">새 단어</Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground font-medium text-center max-w-xs">
        초록=정확 · 노랑=있지만 위치 다름 · 회색=없음 · Enter로 제출
      </p>
    </div>
  );
}
