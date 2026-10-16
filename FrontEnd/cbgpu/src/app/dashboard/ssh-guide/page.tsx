'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowRight, Copy, Download, FileText, KeyRound, ShieldCheck, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAlert } from '@/lib/alert';

function Command({ value }: { value: string }) {
  const { showError, showSuccess } = useAlert();

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      showSuccess('명령어를 복사했습니다.');
    } catch {
      showError('복사하지 못했습니다. 명령어를 직접 선택해 주세요.');
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2">
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-sm">{value}</code>
      <Button type="button" size="sm" variant="ghost" onClick={copy} className="shrink-0 gap-1.5 text-xs">
        <Copy className="size-3.5" /> 복사
      </Button>
    </div>
  );
}

const STEPS = [
  {
    title: '1. SSH 키 만들기',
    body: 'Windows는 PowerShell, macOS·Linux는 터미널을 열고 실행하세요. 기본 저장 위치는 Enter로 선택할 수 있습니다. 같은 이름의 키가 이미 있으면 덮어쓰지 마세요.',
    commands: [{ label: '모든 운영체제', value: 'ssh-keygen -t ed25519' }],
  },
  {
    title: '2. 공개키 복사하기',
    body: '.pub으로 끝나는 파일이 공개키입니다. 사용하는 운영체제의 명령어를 실행하세요.',
    commands: [
      { label: 'Windows PowerShell', value: 'Get-Content $env:USERPROFILE\\.ssh\\id_ed25519.pub | Set-Clipboard' },
      { label: 'macOS', value: 'pbcopy < ~/.ssh/id_ed25519.pub' },
      { label: 'Linux', value: 'cat ~/.ssh/id_ed25519.pub' },
    ],
  },
];

const SKILL_PATH = '/skills/cbgpu-gpu-ssh/SKILL.md';

export default function GpuSshGuidePage() {
  const { showError, showSuccess } = useAlert();

  async function copySkill() {
    try {
      const response = await fetch(SKILL_PATH);
      if (!response.ok) throw new Error('스킬 문서를 불러오지 못했습니다.');
      await navigator.clipboard.writeText(await response.text());
      showSuccess('AI Agent 스킬 문서를 복사했습니다.');
    } catch {
      showError('스킬 문서를 복사하지 못했습니다. 파일 받기를 이용해 주세요.');
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> GPU 예약으로 돌아가기
      </Link>

      <header className="space-y-3">
        <div className="flex items-center gap-2 text-primary">
          <Terminal className="size-6" />
          <span className="text-xs font-black uppercase tracking-widest">GPU SSH</span>
        </div>
        <h1 className="text-3xl font-black italic tracking-tight sm:text-4xl">SSH 접속 방법</h1>
        <p className="text-sm text-muted-foreground">키를 한 번 등록하면 예약한 GPU 컨테이너에 서버 비밀번호 없이 접속할 수 있습니다.</p>
      </header>

      {STEPS.map((step) => (
        <section key={step.title} className="space-y-4 rounded-2xl border bg-card p-5 sm:p-6">
          <div className="space-y-1">
            <h2 className="text-lg font-black">{step.title}</h2>
            <p className="text-sm text-muted-foreground">{step.body}</p>
          </div>
          <div className="space-y-3">
            {step.commands.map((command) => (
              <div key={command.label} className="space-y-1.5">
                <p className="text-xs font-bold text-muted-foreground">{command.label}</p>
                <Command value={command.value} />
              </div>
            ))}
          </div>
          {step.title.startsWith('2.') && (
            <p className="text-xs text-muted-foreground">Linux에서는 표시된 한 줄을 직접 복사하세요.</p>
          )}
        </section>
      ))}

      <section className="space-y-4 rounded-2xl border bg-card p-5 sm:p-6">
        <h2 className="text-lg font-black">3. 사이트에 공개키 등록하기</h2>
        <p className="text-sm text-muted-foreground">프로필의 ‘GPU SSH 공개키’ 입력란에 복사한 내용을 붙여 넣고 저장하세요.</p>
        <Button asChild className="gap-2">
          <Link href="/profile#gpu-ssh-key"><KeyRound className="size-4" /> 공개키 등록 <ArrowRight className="size-4" /></Link>
        </Button>
      </section>

      <section className="space-y-4 rounded-2xl border bg-card p-5 sm:p-6">
        <h2 className="text-lg font-black">4. 예약한 GPU에 접속하기</h2>
        <p className="text-sm text-muted-foreground">관리자에게 Tailscale 네트워크 초대를 받아 연결한 뒤, 예약 시간에 해당 GPU의 명령어를 실행하세요.</p>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((gpu) => (
            <div key={gpu} className="space-y-1.5">
              <p className="text-xs font-bold text-muted-foreground">GPU #{gpu}</p>
              <Command value={`ssh -p ${2200 + gpu} root@100.100.136.37`} />
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">접속 권한은 승인된 예약 시간에만 적용됩니다. 공개키 저장 후 반영까지 약 30초 걸릴 수 있습니다.</p>
      </section>

      <div className="flex gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
        <p><strong>개인키는 본인 기기에만 보관하세요.</strong> 사이트에는 <code>.pub</code> 파일 내용만 입력합니다. SSH의 <code>root</code> 권한은 해당 GPU 컨테이너 내부에만 적용됩니다.</p>
      </div>

      <section className="space-y-4 rounded-2xl border bg-card p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <FileText className="size-5 text-primary" />
          <h2 className="text-lg font-black">AI Agent용 스킬</h2>
        </div>
        <p className="text-sm text-muted-foreground">에이전트가 키 생성과 GPU 접속을 도울 때 사용할 <code>SKILL.md</code>입니다. 내용을 복사해 전달하거나 파일로 받으세요.</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={copySkill} className="gap-2"><Copy className="size-4" /> 내용 복사</Button>
          <Button asChild variant="outline" className="gap-2">
            <a href={SKILL_PATH} download="SKILL.md"><Download className="size-4" /> 파일 받기</a>
          </Button>
          <Button asChild variant="ghost"><a href={SKILL_PATH} target="_blank" rel="noopener noreferrer">내용 보기</a></Button>
        </div>
      </section>
    </div>
  );
}
