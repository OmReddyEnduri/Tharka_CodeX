Start-Job -ScriptBlock {
    Set-Location "C:\Users\Administrator\TharkaLabContest\TharkaContestPlatform\apps\admin-web"
    npx vite --host
}
