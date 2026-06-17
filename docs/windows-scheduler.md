# Windows 작업 스케줄러 등록

이 프로젝트를 하루 2회 자동 실행하려면 PowerShell에서 다음 명령을 실행한다.

```powershell
cd C:\workdir\space-cap\guard-job-finder
powershell -ExecutionPolicy Bypass -File .\scripts\register-windows-task.ps1
```

기본 실행 시간:

- 08:00
- 18:00

실행 작업:

```powershell
npm run fetch:jobs
```

다른 시간으로 등록하려면:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\register-windows-task.ps1 -Times "07:30","17:30"
```

등록 해제:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\unregister-windows-task.ps1
```

확인:

```powershell
Get-ScheduledTask -TaskName GuardJobFinderFetch
```
